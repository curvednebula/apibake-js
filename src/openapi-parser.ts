import { errorLog, log } from './utils/logger';
import { PdfWriter } from './pdf/pdf-writer';
import { sanitizeDescription } from './utils/string-utils';

export type ApiSpec = Record<string, any>;

type JsonNode = {
  key: string,
  value: any
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

const allAnyOne: Record<string, { name: string; connectWord: string }> = {
  'allOf': { name: 'All of', connectWord: 'and' },
  'anyOf': { name: 'Any of', connectWord: 'or' },
  'oneOf': { name: 'One of', connectWord: 'or' },
};

function getFirstOf(spec: ApiSpec, children: string[]): JsonNode | undefined {
  for (const child of children) {
    if (spec[child]) {
      return { key: child, value: spec[child] };
    }
  }
  return undefined;
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
    const summary = methodSpec['summary'];
    const descr = methodSpec['description'];
    if (summary) {
      this.doc.description(sanitizeDescription(summary));
    }
    if (descr) {
      this.doc.description(sanitizeDescription(descr));
    }

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
    }

    const contentSpec = bodySpec['content'] as ApiSpec;
    let emptyBody = true;

    if (contentSpec) {
      Object.entries(contentSpec).forEach(([contentType, contentSpec]) => {
        const schema = contentSpec['schema'] as ApiSpec;
        if (schema) {
          this.doc.contentType(contentType, { lineContinues: true });
          this.parseSchema(schema, { alwaysShowType: true, lineContinues: true });
          emptyBody = false;
        }
        this.parseExamples(contentSpec['examples'] as ApiSpec);
      });
    }
    if (emptyBody) {
      // this.doc.para('Empty body.');
    }
    this.doc.paraBreak();
  }

  private parseExamples(spec: ApiSpec) {
    if (!spec) {
      return;
    }
    Object.entries(spec).forEach(([name, spec]) => {
      if (spec?.value && Object.keys(spec.value).length > 0) {
        const exampleBody = typeof spec.value === 'object' ? JSON.stringify(spec.value, null, 2) : spec.value;
        if (exampleBody) {
          this.doc.example(name, exampleBody);
        }
      }
    });
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
    // Example:
    // {
    //   "Pet": {
    //     "allOf": [
    //       {
    //         "$ref": "#/components/schemas/NewPet"
    //       },
    //       {
    //         "type": "object",
    //         "required": [
    //           "id"
    //         ],
    //         "properties": {
    //           "id": {
    //             "type": "integer",
    //             "format": "int64"
    //           }
    //         }
    //       }
    //     ]
    //   },
    //   "NewPet": {
    //     "type": "object",
    //     "required": [
    //       "name"
    //     ],
    //     "properties": {
    //       "name": {
    //         "type": "string"
    //       },
    //       "tag": {
    //         "type": "string"
    //       }
    //     }
    //   },
    // }

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

  private parseSchema(schemaSpec: ApiSpec, options?: { alwaysShowType?: boolean, lineContinues?: boolean }) {
    if (!schemaSpec) {
      return;
    }

    // If schema is aggregate: allOf, anyOf, oneOf

    const found = getFirstOf(schemaSpec, Object.keys(allAnyOne));

    if (found?.value && Array.isArray(found.value)) {
      if (options?.lineContinues) {
        this.doc.nextLine();
        this.doc.paraBreak();
      }
      const aggregate = allAnyOne[found.key];
      this.doc.description(`${aggregate.name}:`);
      
      // TODO: for allOf combine schemas into a single object
      found.value.forEach((it, index, arr) => {
        this.doc.indentStart();
        this.parseSchema(it);
        this.doc.indentEnd();
        if (index < arr.length - 1) {
          this.doc.description(aggregate.connectWord);
        }
      });
      return;
    }

    // If schema is a reference

    if (options?.lineContinues) {
      this.doc.text(' | ', {}, { continued: true });
    }

    const ref = this.parseSchemaRef(schemaSpec);
    if (ref.schemaName && ref.anchor) {
      const foundRef = this.spec['components']?.['schemas']?.[ref.schemaName] as ApiSpec;
      if (foundRef) {
        this.doc.textRef(ref.text, ref.anchor);
        if (options?.lineContinues) {
          this.doc.paraBreak();
        }
        this.parseSchema(foundRef);
      } else {
        this.doc.textRef(ref.text, ref.anchor);
      }
      return;
    } else {
      if (!ref.isUndefined() && ref.text !== 'object') {
        this.doc.text(ref.text);
      }
    }

    // If schema defined explicetly

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
      this.doc.enumValues(schemaSpec['enum'] as string[]);
    }

    this.doc.paraBreak();
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
    return this.mergeSchemasInOneSection ?  `schemas:${schemaName}` : `${this.sectionName}:${schemaName}`;
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
      if (!anchor) {
        log(`! No definition for ref: ${schemaRef['\$ref']}`);
      }
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
        const leaf = getFirstOf(paramSpec, Object.keys(allAnyOne));
        // TODO: parse entire array of possible schemas
        if (leaf?.value[0]) {
          typeRef = this.parseSchemaRef(leaf?.value[0]!);
        }
      }
      this.doc.dataFields([
        new DataField(paramSpec['name'], typeRef, paramSpec['description'], paramSpec['required'])
      ]);
    }
  }
}
