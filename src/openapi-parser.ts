import { log } from './logger';
import { PdfWriter } from './pdf-writer';
import { capitalizeFirst } from './string-utils';

export type ApiSpec = Record<string, any>;

interface ApiSpecLeaf {
  name: string;
  spec: any;
}

class SchemaRef {
  text: string = '';
  schemaName: string = '';
  isArray = false;
  anchor?: string;

  constructor(text: string, schemaName: string, anchor?: string, isArray = false) {
    this.text = text;
    this.schemaName = schemaName;
    if (anchor) {
      this.anchor = anchor;
    }
    if (isArray) {
      this.isArray = isArray;
    }
  }

  static undefined(): SchemaRef {
    return new SchemaRef('undefined', 'undefined');
  }

  isUndefined(): boolean {
    return this.text == 'undefined';
  }

  toString(): string {
    return JSON.stringify(this);
  }
}

export class OpenApiParser {
  private doc: PdfWriter;
  private firstHeaderLevel = 0;

  private spec: ApiSpec = {}; // open api spec being processed
  private sectionName?: string;

  // when multiple API specs parsed into the same doc - merge all schemas into one section
  private mergeSchemasInOneSection: boolean;
  private schemas: ApiSpec = {};

  constructor(
    doc: PdfWriter,
    mergeSchemasInOneSection = false
  ) {
    this.doc = doc;
    this.mergeSchemasInOneSection = mergeSchemasInOneSection;
  }

  parse(apiSpec: ApiSpec, sectionName: string) {
    this.spec = apiSpec;

    const openapiVer = this.spec['openapi'] as string;
    if (openapiVer == null) {
      throw Error('Invalid OpenAPI specification.');
    }
    
    if (openapiVer.startsWith('1') || openapiVer.startsWith('2')) {
      throw Error('Invalid OpenAPI version: $openapiVer, required 3.0.0+.');
    }

    this.sectionName = sectionName;
    this.doc.newSection(this.sectionName);
    this.doc.header(this.firstHeaderLevel, this.sectionName);

    const paths = this.spec['paths'] as Record<string, any>;

    if (Object.entries(paths).length > 0) {
      log('Endpoints:');
      Object.entries(paths).forEach(([key, value]) => {
        this.writePath(key, value);
      });
    }
    
    const schemas = this.spec['components']?.['schemas'] as ApiSpec;

    if (schemas && Object.entries(schemas).length > 0) {
      if (this.mergeSchemasInOneSection) {
        this.saveSchemasToParseLater(schemas);
      } else {
        this.writeSchemas(schemas);
      }
    }
  }

  // if we parse multiple api spec files - done() shoud be called only once in the end
  done() {
    if (this.mergeSchemasInOneSection && Object.entries(this.schemas).length > 0) {
      this.writeSchemas(this.schemas);
    }
    this.doc.finish();
  }

  private writePath(path: string, pathSpec: ApiSpec) {
    Object.entries(pathSpec).forEach(([methodName, methodSpec]) => {
      const endpoint = `${methodName.toUpperCase()} ${path}`;
      log(` - ${endpoint}`);
      this.doc.header(this.firstHeaderLevel + 1, endpoint);
      this.writeMethod(methodSpec);
      this.doc.lineBreak(2);
    });
  }

  private writeMethod(methodSpec: ApiSpec) {
    const parameters = methodSpec['parameters'] as ApiSpec[];

    if (parameters && Object.keys(parameters).length > 0) {
      this.doc.subHeader('Request Parameters:');

      // TODO: for some reason sometimes there are duplicated parameters
      this.doc.indentStart();
      const uniqParams = parameters;
      uniqParams.forEach((param) => {
        this.writeParameter(param);
      });
      this.doc.indentEnd();
      this.doc.lineBreak();
    }

    const body = methodSpec['requestBody'];

    if (body && Object.keys(body).length > 0) {
      this.doc.subHeader('Request Body:');
      this.doc.indentStart();
      this.writeBody(body);
      this.doc.indentEnd();
    }

    const responses = methodSpec['responses'] as ApiSpec;
    if (responses) {
      Object.entries(responses).forEach(([key, value]) => {
        this.doc.subHeader(`Response ${key}:`);
        this.doc.indentStart();
        this.writeBody(value);
        this.doc.indentEnd();
      });
    }
  }

  private writeBody(bodySpec: ApiSpec) {
    const descr = bodySpec['description'] as string;
    if (descr) {
      this.doc.description(capitalizeFirst(descr));
      this.doc.lineBreak(0.5);
    }

    const contentSpec = bodySpec['content'] as ApiSpec;
    let emptyBody = true;

    if (contentSpec) {
      const content = this.getFirstOf(contentSpec, ['application/json', 'multipart/form-data']);

      if (content) {
        const schemaRef = content.spec['schema'] as ApiSpec;
        if (schemaRef) {
          const schema = this.parseSchemaRef(schemaRef);
          const schemaSpec = this.spec['components']?.['schemas']?.[schema.schemaName] as ApiSpec;
          this.writeSchema(schemaSpec, schema.text);
          emptyBody = false;
        }
      }
    }
    if (emptyBody) {
      this.doc.para('Empty body.');
    }
    this.doc.lineBreak();
  }

  private saveSchemasToParseLater(schemas: ApiSpec) {
    Object.entries(schemas).forEach(([key, value]) => {
      if (!this.schemas[key]) {
        this.schemas[key] = value;
      } else {
        log(`!Duplicated schema: ${key}`);
      }
    });
  }
  
  private writeSchemas(schemas: ApiSpec) {
    log('Schemas:');

    const headerLevel = this.mergeSchemasInOneSection ? this.firstHeaderLevel : this.firstHeaderLevel + 1;

    this.doc.newSection('Schemas');
    this.doc.header(headerLevel, 'Schemas');

    Object.entries(schemas).forEach (([key, value]) => {
      log(` - ${key}`);
      this.doc.header(headerLevel + 1, key, this.schemaAnchor(key));
      this.writeSchema(value);
      this.doc.lineBreak(2);
    });
  }

  private writeSchema(schemaSpec?: ApiSpec, name?: string) {
    const typeName = name ?? schemaSpec?.['type'] as string;
    if (typeName !== 'object') {
      this.doc.schemaType(typeName);
    }

    if (!schemaSpec) {
      return;
    }

    const properties = schemaSpec['properties'] as ApiSpec;
    if (properties) {
      this.doc.text('{').indentStart();

      const required = schemaSpec['required'] as string[];

      Object.entries(properties).forEach(([key, value]) => {
        const typeRef = this.parseSchemaRef(value);
        this.writeVariable(key, typeRef, value['description'], required?.includes(key));
      });
      this.doc.indentEnd().text('}');
    }
    else if (schemaSpec['enum']) {
      this.doc.lineBreak(0.5);
      const values = schemaSpec['enum'] as string[];
      this.doc.enumValues(values);
    }
  }

  private schemaNameByRef(ref: string) {
    const refPath = '#/components/schemas/';
    const start = ref.indexOf(refPath);
    if (start >= 0) {
      return ref.substring(ref.indexOf(refPath) + refPath.length);
    }
    return ref;
  }

  private schemaDefinitionExists(name: string): boolean {
    return (this.spec['components']?.['schemas']?.[name]) ? true : false;
  }

  private schemaAnchor(schemaName: string): string {
    return this.mergeSchemasInOneSection ?  `schemas: ${schemaName}` : `${this.sectionName}: ${schemaName}`;
  }

  private parseSchemaRef(schemaRef: ApiSpec): SchemaRef {
    if (schemaRef['type']) {
      if (schemaRef['type'] === 'array' && schemaRef['items']) {
        const typeRef = this.parseSchemaRef(schemaRef['items']);
        return new SchemaRef(`Array<${typeRef.text}>`, typeRef.schemaName, typeRef.anchor, true);
      } else {
        return new SchemaRef(schemaRef['type'], schemaRef['type']);
      }
    } else if (schemaRef['\$ref']) {
      const schemaName = this.schemaNameByRef(schemaRef['\$ref']);
      const anchor = this.schemaDefinitionExists(schemaName) ? this.schemaAnchor(schemaName) : undefined;
      return new SchemaRef(schemaName, schemaName, anchor);
    }
    return SchemaRef.undefined();
  }

  private writeParameter(paramSpec: ApiSpec) {
    if (paramSpec['name']) {  
      let typeRef: SchemaRef | undefined = undefined;

      if (paramSpec['schema'] != null) {
        typeRef = this.parseSchemaRef(paramSpec['schema']);
      }

      if (typeRef === undefined || typeRef.isUndefined()) {
        const leaf = this.getFirstOf(paramSpec, ['anyOf', 'allOf', 'oneOf']);
        // TODO: parse entire array of possible schemas
        if (leaf?.spec[0]) {
          typeRef = this.parseSchemaRef(leaf?.spec[0]!);
        }
      }
      this.writeVariable(paramSpec['name'], typeRef, paramSpec['description'], paramSpec['required']);
    }
  }

  private getFirstOf(spec: ApiSpec, children: string[]): ApiSpecLeaf | undefined {
    for (const child of children) {
      if (spec[child]) {
        return { name: child, spec: spec[child] };
      }
    }
    return undefined;
  }

  private writeVariable(name: string, typeRef?: SchemaRef, description?: string, required?: boolean) {
    this.doc.dataField(
      `${name}${(required ?? true) ? '':'?'}`, 
      typeRef?.text,
      description, 
      typeRef?.anchor
    );
  }
}