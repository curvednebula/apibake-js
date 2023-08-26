import { PdfWriter } from './pdf-writer';

type TJson = Record<string, any>;

interface _JsonLeaf {
  name: string;
  spec: any;
}

const log = (str: string) => {
  console.log(str);
}

class _SchemaRef {
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

  static undefined(): _SchemaRef {
    return new _SchemaRef('undefined', 'undefined');
  }

  isUndefined(): boolean {
    return this.text == 'undefined';
  }

  toString(): string {
    return JSON.stringify(this);
  }
}

export class OpenApiParser {
  private _doc: PdfWriter;
  private _firstHeaderLevel = 0;

  private _spec: TJson = {}; // open api spec being processed
  private _topHeader?: string;

  // when multiple API specs parsed into the same doc - merge all schemas into one section
  private _mergeSchemasInOneSection: boolean;
  private _schemas: TJson = {};

  constructor(
    doc: PdfWriter,
    mergeSchemasInOneSection = false
  ) {
    this._doc = doc;
    this._mergeSchemasInOneSection = mergeSchemasInOneSection;
  }

  writeToDoc(apiJson: string, header?: string) {
    this._spec = JSON.parse(apiJson);

    const openapiVer = this._spec['openapi'] as string;
    if (openapiVer == null) {
      throw Error('Invalid OpenAPI specification.');
    }
    
    if (openapiVer.startsWith('1') || openapiVer.startsWith('2')) {
      throw Error('Invalid OpenAPI version: $openapiVer, required 3.0.0+.');
    }

    this._topHeader = header;
    this._doc.topRightText = header;

    if (header) {
      this._doc.addHeader(this._firstHeaderLevel, header);
    }

    const paths = this._spec['paths'] as Record<string, any>;

    if (Object.entries(paths).length > 0) {
      log('Endpoints:');
      Object.entries(paths).forEach(([key, value]) => {
        this._writePath(key, value);
      });
    }
    
    const schemas = this._spec['components']?.['schemas'] as TJson;

    if (Object.entries(schemas).length > 0) {
      if (this._mergeSchemasInOneSection) {
        this._saveSchemasToParseLater(schemas);
      } else {
        this._doc.addHeader(this._firstHeaderLevel + 1, 'Schemas');
        this._writeSchemas(schemas);
      }
    }
    
    // this._doc.flush();
  }

  finalizeDoc() {
    this._doc.topRightText = 'Schemas';

    if (this._mergeSchemasInOneSection && Object.entries(this._schemas).length > 0) {
      this._doc.addHeader(this._firstHeaderLevel, 'Schemas');
      this._writeSchemas(this._schemas);
    }
    this._doc.flush();
  }

  _writePath(path: string, pathSpec: TJson) {
    Object.entries(pathSpec).forEach(([methodName, methodSpec]) => {
      const endpoint = `${methodName.toUpperCase()} ${path}`;
      log(endpoint);
      this._doc.addHeader(this._firstHeaderLevel + 1, endpoint);
      this._writeMethod(methodSpec);
    });
  }

  _writeMethod(methodSpec: TJson) {
    const parameters = methodSpec['parameters'] as TJson[];

    if (parameters && Object.keys(parameters).length > 0) {
      this._doc.addSubHeader('Request Parameters:');

      // TODO: for some reason sometimes there are duplicated parameters
      const uniqParams = parameters;
      uniqParams.forEach((param) => {
        this._writeParameter(param);
      });
    }

    const body = methodSpec['requestBody'];

    if (body && Object.keys(body).length > 0) {
      this._doc.addSubHeader('Request Body:');
      this._writeBody(body);
    }

    const responses = methodSpec['responses'] as TJson;
    if (responses) {
      Object.entries(responses).forEach(([key, value]) => {
        this._doc.addSubHeader(`Response ${key}:`);
        this._writeBody(value);
      });
    }
  }

  _writeBody(bodySpec: TJson) {
    const descr = bodySpec['description'] as string;
    if (descr) {
      this._doc.addComment(descr);
    }

    const contentSpec = bodySpec['content'] as TJson;
    let emptyBody = true;

    if (contentSpec) {
      const content = this._getFirstOf(contentSpec, ['application/json', 'multipart/form-data']);

      if (content) {
        const schemaRef = content.spec['schema'] as TJson;
        if (schemaRef) {
          const schema = this._parseSchemaRef(schemaRef);
          const schemaSpec = this._spec['components']?.['schemas']?.[schema.schemaName] as TJson;
          this._writeSchema(schemaSpec, schema.text);
          emptyBody = false;
        }
      }
    }
    if (emptyBody) {
      this._doc.addPara('Empty body.');
    }
  }

  _saveSchemasToParseLater(schemas: TJson) {
    Object.entries(schemas).forEach(([key, value]) => {
      if (!this._schemas[key]) {
        this._schemas[key] = value;
      } else {
        log(`!Duplicated schema: ${key}`);
      }
    });
  }
  
  _writeSchemas(schemas: TJson) {
    log('Schemas:');
    Object.entries(schemas).forEach (([key, value]) => {
      log(key);
      this._doc.addHeader(this._firstHeaderLevel + 2, key, this._schemaAnchor(key));
      this._writeSchema(value);
    });
  }

  _writeSchema(schemaSpec?: TJson, name?: string) {
    this._doc.addSchemaType(name ?? schemaSpec?.['type'] as string);

    if (schemaSpec == null) {
      return;
    }

    const properties = schemaSpec['properties'] as TJson;
    if (properties) {
      this._doc.addPara('{');

      const required = schemaSpec['required'] as string[];

      Object.entries(properties).forEach(([key, value]) => {
        const typeRef = this._parseSchemaRef(value);
        this._writeVariable(key, typeRef, value['description'], required?.includes(key));
      });
      this._doc.addPara('}');
    }
    else if (schemaSpec['enum']) {
      this._doc.addPara('Values:');
      const values = schemaSpec['enum'] as string[];
      this._doc.addEnumValues(values);
    }
  }

  _schemaNameByRef(ref: string) {
    const refPath = '#/components/schemas/';
    const start = ref.indexOf(refPath);
    if (start >= 0) {
      return ref.substring(ref.indexOf(refPath) + refPath.length);
    }
    return ref;
  }

  _schemaDefinitionExists(name: string): boolean {
    return (this._spec['components']?.['schemas']?.[name]) ? true : false;
  }

  _schemaAnchor(schemaName: string): string {
    return this._mergeSchemasInOneSection ?  `schemas: ${schemaName}` : `${this._topHeader}: ${schemaName}`;
  }

  _parseSchemaRef(schemaRef: TJson): _SchemaRef {
    if (schemaRef['type']) {
      if (schemaRef['type'] === 'array' && schemaRef['items']) {
        const typeRef = this._parseSchemaRef(schemaRef['items']);
        return new _SchemaRef(`Array<${typeRef.text}>`, typeRef.schemaName, typeRef.anchor, true);
      } else {
        return new _SchemaRef(schemaRef['type'], schemaRef['type']);
      }
    } else if (schemaRef['\$ref']) {
      const schemaName = this._schemaNameByRef(schemaRef['\$ref']);
      const anchor = this._schemaDefinitionExists(schemaName) ? this._schemaAnchor(schemaName) : undefined;
      return new _SchemaRef(schemaName, schemaName, anchor);
    }
    return _SchemaRef.undefined();
  }

  _writeParameter(paramSpec: TJson) {
    if (paramSpec['name']) {  
      let typeRef: _SchemaRef | undefined = undefined;

      if (paramSpec['schema'] != null) {
        typeRef = this._parseSchemaRef(paramSpec['schema']);
      }

      if (typeRef === undefined || typeRef.isUndefined()) {
        const leaf = this._getFirstOf(paramSpec, ['anyOf', 'allOf', 'oneOf']);
        // TODO: parse entire array of possible schemas
        if (leaf?.spec[0]) {
          typeRef = this._parseSchemaRef(leaf?.spec[0]!);
        }
      }
      this._writeVariable(paramSpec['name'], typeRef, paramSpec['description'], paramSpec['required']);
    }
  }

  _getFirstOf(spec: TJson, children: string[]): _JsonLeaf | undefined {
    for (const child of children) {
      if (spec[child]) {
        return { name: child, spec: spec[child] };
      }
    }
    return undefined;
  }

  _writeVariable(name: string, typeRef?: _SchemaRef, description?: string, required?: boolean) {
    this._doc.addVariable(
      `${name}${(required ?? true) ? '':'?'}`, 
      typeRef?.text,
      description, 
      typeRef?.anchor
    );
  }
}