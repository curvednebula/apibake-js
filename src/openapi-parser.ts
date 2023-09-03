import { log } from './logger';
import { PdfWriter } from './pdf-writer';
import { sanitizeDescription } from './string-utils';

export type ApiSpec = Record<string, any>;

class ApiSpecLeaf {
  constructor(
    public name: string,
    public spec: any
  ) {}
}

export class SchemaRef {
  constructor(
    public text: string, 
    public schemaName: string, 
    public anchor?: string, 
    public isArray = false
  ) {}

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

export class DataField {
  description?: string;

  constructor(
    public name: string,
    public type?: SchemaRef,
    description?: string,
    public required?: boolean,
  ) {
    if (description) {
      this.description = sanitizeDescription(description);
    }
  }
}

export class OpenApiParser {
  private firstHeaderLevel = 0;

  private spec: ApiSpec = {}; // open api spec being processed
  private sectionName?: string;

  private schemas: ApiSpec = {};

  constructor(
    private doc: PdfWriter,
    private mergeSchemasInOneSection = false
  ) {}

  parse(apiSpec: ApiSpec, sectionName: string) {
    this.spec = apiSpec;

    const openapiVer = this.spec['openapi'] ?? this.spec['swagger'];;
    if (openapiVer == null) {
      throw Error('Invalid OpenAPI specification.');
    }
    
    if (openapiVer.startsWith('1') || openapiVer.startsWith('2')) {
      throw Error(`Not supported OpenAPI version: ${openapiVer}, supported: 3.0.0+.`);
    }

    this.sectionName = sectionName;
    this.doc.newSection(this.sectionName);
    this.doc.header(this.firstHeaderLevel, this.sectionName);

    const paths = this.spec['paths'] as Record<string, any>;

    if (paths && Object.entries(paths).length > 0) {
      log('Endpoints:');
      Object.entries(paths).forEach(([key, value]) => {
        this.parsePath(key, value);
      });
    }
    
    const schemas = this.spec['components']?.['schemas'] as ApiSpec;

    if (schemas && Object.entries(schemas).length > 0) {
      if (this.mergeSchemasInOneSection) {
        this.saveSchemasToParseLater(schemas);
      } else {
        this.parseSchemas(schemas);
      }
    }
  }

  // if we parse multiple api spec files - done() shoud be called only once in the end
  done() {
    if (this.mergeSchemasInOneSection && Object.entries(this.schemas).length > 0) {
      this.parseSchemas(this.schemas);
    }
    this.doc.finish();
  }

  private parsePath(path: string, pathSpec: ApiSpec) {
    Object.entries(pathSpec).forEach(([methodName, methodSpec]) => {
      log(` - ${methodName.toUpperCase()} ${path}`);
      this.doc.apiHeader(methodName.toUpperCase(), path, this.firstHeaderLevel + 1);
      this.parseMethod(methodSpec);
      this.doc.lineBreak(2);
    });
  }

  private parseMethod(methodSpec: ApiSpec) {
    const parameters = methodSpec['parameters'] as ApiSpec[];

    if (parameters && Object.keys(parameters).length > 0) {
      this.doc.subHeader('Request Parameters:');

      // TODO: for some reason sometimes there are duplicated parameters
      this.doc.indentStart();
      const uniqParams = parameters;
      uniqParams.forEach((param) => {
        this.parseParameter(param);
      });
      this.doc.indentEnd();
      this.doc.lineBreak();
    }

    const body = methodSpec['requestBody'];

    if (body && Object.keys(body).length > 0) {
      this.doc.subHeader('Request Body:');
      this.doc.indentStart();
      this.parseBody(body);
      this.doc.indentEnd();
    }

    const responses = methodSpec['responses'] as ApiSpec;
    if (responses) {
      Object.entries(responses).forEach(([key, value]) => {
        this.doc.subHeader(`Response ${key}:`);
        this.doc.indentStart();
        this.parseBody(value);
        this.doc.indentEnd();
      });
    }
  }

  private parseBody(bodySpec: ApiSpec) {
    const descr = bodySpec['description'] as string;
    if (descr) {
      this.doc.description(sanitizeDescription(descr));
      this.doc.lineBreak(0.5);
    }

    const contentSpec = bodySpec['content'] as ApiSpec;
    let emptyBody = true;

    if (contentSpec) {
      Object.entries(contentSpec).forEach(([contentType, spec]) => {
        const schemaRef = spec['schema'] as ApiSpec;
        if (schemaRef) {
          const schema = this.parseSchemaRef(schemaRef);
          const schemaSpec = this.spec['components']?.['schemas']?.[schema.schemaName] as ApiSpec;
          this.parseSchema(schemaSpec, schema.text, contentType);
          emptyBody = false;
        }
      });
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
  
  private parseSchemas(schemas: ApiSpec) {
    log('Schemas:');

    const headerLevel = this.mergeSchemasInOneSection ? this.firstHeaderLevel : this.firstHeaderLevel + 1;

    this.doc.newSection('Schemas');
    this.doc.header(headerLevel, 'Schemas');

    Object.entries(schemas).forEach(([key, value]) => {
      log(` - ${key}`);
      this.doc.header(headerLevel + 1, key, this.schemaAnchor(key));
      this.parseSchema(value);
      this.doc.lineBreak(2);
    });
  }

  private parseSchema(schemaSpec?: ApiSpec, name?: string, contentType?: string) {
    const typeName = name ?? schemaSpec?.['type'] as string;
    if (typeName !== 'object') {
      this.doc.schemaType(typeName, contentType);
    }

    if (!schemaSpec) {
      return;
    }

    const properties = schemaSpec['properties'] as ApiSpec;
    if (properties) {
      const required = schemaSpec['required'] as string[];
      const dataFields: DataField[] = []; 

      Object.entries(properties).forEach(([key, value]) => {
        const typeRef = this.parseSchemaRef(value);
        dataFields.push(
          new DataField(key, typeRef, value['description'], required?.includes(key))
        );
      });
      
      this.doc.objectSchema(dataFields);
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

  private parseParameter(paramSpec: ApiSpec) {
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
      this.doc.dataFields([
        new DataField(paramSpec['name'], typeRef, paramSpec['description'], paramSpec['required'])
      ]);
    }
  }

  private getFirstOf(spec: ApiSpec, children: string[]): ApiSpecLeaf | undefined {
    for (const child of children) {
      if (spec[child]) {
        return new ApiSpecLeaf(child, spec[child]);
      }
    }
    return undefined;
  }
}