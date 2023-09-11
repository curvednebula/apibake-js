"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenApiParser = exports.DataField = exports.SchemaRef = void 0;
const logger_1 = require("./logger");
const string_utils_1 = require("./string-utils");
class ApiSpecLeaf {
    constructor(name, spec) {
        this.name = name;
        this.spec = spec;
    }
}
class SchemaRef {
    constructor(text, schemaName, anchor, isArray = false) {
        this.text = text;
        this.schemaName = schemaName;
        this.anchor = anchor;
        this.isArray = isArray;
    }
    static undefined() {
        return new SchemaRef('undefined', 'undefined');
    }
    isUndefined() {
        return this.text == 'undefined';
    }
    toString() {
        return JSON.stringify(this);
    }
}
exports.SchemaRef = SchemaRef;
class DataField {
    constructor(name, type, description, required) {
        this.name = name;
        this.type = type;
        this.required = required;
        if (description) {
            this.description = (0, string_utils_1.sanitizeDescription)(description);
        }
    }
}
exports.DataField = DataField;
class OpenApiParser {
    constructor(doc, mergeSchemasInOneSection = false) {
        this.doc = doc;
        this.mergeSchemasInOneSection = mergeSchemasInOneSection;
        this.firstHeaderLevel = 0;
        this.spec = {}; // open api spec being processed
        this.schemas = {};
    }
    parse(apiSpec, sectionName) {
        var _a, _b;
        this.spec = apiSpec;
        const openapiVer = (_a = this.spec['openapi']) !== null && _a !== void 0 ? _a : this.spec['swagger'];
        ;
        if (openapiVer == null) {
            throw Error('Invalid OpenAPI specification.');
        }
        if (openapiVer.startsWith('1') || openapiVer.startsWith('2')) {
            throw Error(`Not supported OpenAPI version: ${openapiVer}, supported: 3.0.0+.`);
        }
        this.sectionName = sectionName;
        this.doc.newSection(this.sectionName);
        this.doc.header(this.firstHeaderLevel, this.sectionName);
        const paths = this.spec['paths'];
        if (paths && Object.entries(paths).length > 0) {
            (0, logger_1.log)('Endpoints:');
            Object.entries(paths).forEach(([key, value]) => {
                this.parsePath(key, value);
            });
        }
        const schemas = (_b = this.spec['components']) === null || _b === void 0 ? void 0 : _b['schemas'];
        if (schemas && Object.entries(schemas).length > 0) {
            if (this.mergeSchemasInOneSection) {
                this.saveSchemasToParseLater(schemas);
            }
            else {
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
    parsePath(path, pathSpec) {
        Object.entries(pathSpec).forEach(([methodName, methodSpec]) => {
            (0, logger_1.log)(` - ${methodName.toUpperCase()} ${path}`);
            this.doc.apiHeader(methodName.toUpperCase(), path, this.firstHeaderLevel + 1);
            this.parseMethod(methodSpec);
            this.doc.lineBreak(2);
        });
    }
    parseMethod(methodSpec) {
        const summary = methodSpec['summary'];
        const descr = methodSpec['description'];
        if (summary) {
            this.doc.description((0, string_utils_1.sanitizeDescription)(summary));
        }
        if (descr) {
            this.doc.description((0, string_utils_1.sanitizeDescription)(descr));
        }
        const parameters = methodSpec['parameters'];
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
        const responses = methodSpec['responses'];
        if (responses) {
            Object.entries(responses).forEach(([key, value]) => {
                this.doc.subHeader(`Response ${key}:`);
                this.doc.indentStart();
                this.parseBody(value);
                this.doc.indentEnd();
            });
        }
    }
    parseBody(bodySpec) {
        const descr = bodySpec['description'];
        if (descr) {
            this.doc.description((0, string_utils_1.sanitizeDescription)(descr));
        }
        const contentSpec = bodySpec['content'];
        let emptyBody = true;
        if (contentSpec) {
            Object.entries(contentSpec).forEach(([contentType, contentSpec]) => {
                var _a, _b;
                const schemaRef = contentSpec['schema'];
                if (schemaRef) {
                    const schema = this.parseSchemaRef(schemaRef);
                    const schemaSpec = (_b = (_a = this.spec['components']) === null || _a === void 0 ? void 0 : _a['schemas']) === null || _b === void 0 ? void 0 : _b[schema.schemaName];
                    this.parseSchema(schemaSpec, schema.text, contentType);
                    emptyBody = false;
                }
                this.parseExamples(contentSpec['examples']);
            });
        }
        if (emptyBody) {
            // this.doc.para('Empty body.');
        }
        this.doc.lineBreak();
    }
    parseExamples(spec) {
        if (!spec) {
            return;
        }
        Object.entries(spec).forEach(([name, spec]) => {
            if ((spec === null || spec === void 0 ? void 0 : spec.value) && Object.keys(spec.value).length > 0) {
                const exampleBody = typeof spec.value === 'object' ? JSON.stringify(spec.value, null, 2) : spec.value;
                if (exampleBody) {
                    this.doc.example(name, exampleBody);
                }
            }
        });
    }
    saveSchemasToParseLater(schemas) {
        Object.entries(schemas).forEach(([key, value]) => {
            if (!this.schemas[key]) {
                this.schemas[key] = value;
            }
            else {
                (0, logger_1.log)(`!Duplicated schema: ${key}`);
            }
        });
    }
    parseSchemas(schemas) {
        (0, logger_1.log)('Schemas:');
        const headerLevel = this.mergeSchemasInOneSection ? this.firstHeaderLevel : this.firstHeaderLevel + 1;
        this.doc.newSection('Schemas');
        this.doc.header(headerLevel, 'Schemas');
        Object.entries(schemas).forEach(([key, value]) => {
            (0, logger_1.log)(` - ${key}`);
            this.doc.header(headerLevel + 1, key, this.schemaAnchor(key));
            this.parseSchema(value);
            this.doc.lineBreak(2);
        });
    }
    parseSchema(schemaSpec, name, contentType) {
        const typeName = name !== null && name !== void 0 ? name : schemaSpec === null || schemaSpec === void 0 ? void 0 : schemaSpec['type'];
        if (typeName !== 'object') {
            this.doc.schemaType(typeName, contentType);
        }
        if (!schemaSpec) {
            return;
        }
        const properties = schemaSpec['properties'];
        if (properties) {
            const required = schemaSpec['required'];
            const dataFields = [];
            Object.entries(properties).forEach(([key, value]) => {
                const typeRef = this.parseSchemaRef(value);
                dataFields.push(new DataField(key, typeRef, value['description'], required === null || required === void 0 ? void 0 : required.includes(key)));
            });
            this.doc.objectSchema(dataFields);
        }
        else if (schemaSpec['enum']) {
            this.doc.enumValues(schemaSpec['enum']);
        }
    }
    schemaNameByRef(ref) {
        const refPath = '#/components/schemas/';
        const start = ref.indexOf(refPath);
        if (start >= 0) {
            return ref.substring(ref.indexOf(refPath) + refPath.length);
        }
        return ref;
    }
    schemaDefinitionExists(name) {
        var _a, _b;
        return ((_b = (_a = this.spec['components']) === null || _a === void 0 ? void 0 : _a['schemas']) === null || _b === void 0 ? void 0 : _b[name]) ? true : false;
    }
    schemaAnchor(schemaName) {
        return this.mergeSchemasInOneSection ? `schemas: ${schemaName}` : `${this.sectionName}: ${schemaName}`;
    }
    parseSchemaRef(schemaRef) {
        if (schemaRef['type']) {
            if (schemaRef['type'] === 'array' && schemaRef['items']) {
                const typeRef = this.parseSchemaRef(schemaRef['items']);
                return new SchemaRef(`Array<${typeRef.text}>`, typeRef.schemaName, typeRef.anchor, true);
            }
            else {
                return new SchemaRef(schemaRef['type'], schemaRef['type']);
            }
        }
        else if (schemaRef['\$ref']) {
            const schemaName = this.schemaNameByRef(schemaRef['\$ref']);
            const anchor = this.schemaDefinitionExists(schemaName) ? this.schemaAnchor(schemaName) : undefined;
            return new SchemaRef(schemaName, schemaName, anchor);
        }
        return SchemaRef.undefined();
    }
    parseParameter(paramSpec) {
        if (paramSpec['name']) {
            let typeRef = undefined;
            if (paramSpec['schema'] != null) {
                typeRef = this.parseSchemaRef(paramSpec['schema']);
            }
            if (typeRef === undefined || typeRef.isUndefined()) {
                const leaf = this.getFirstOf(paramSpec, ['anyOf', 'allOf', 'oneOf']);
                // TODO: parse entire array of possible schemas
                if (leaf === null || leaf === void 0 ? void 0 : leaf.spec[0]) {
                    typeRef = this.parseSchemaRef(leaf === null || leaf === void 0 ? void 0 : leaf.spec[0]);
                }
            }
            this.doc.dataFields([
                new DataField(paramSpec['name'], typeRef, paramSpec['description'], paramSpec['required'])
            ]);
        }
    }
    getFirstOf(spec, children) {
        for (const child of children) {
            if (spec[child]) {
                return new ApiSpecLeaf(child, spec[child]);
            }
        }
        return undefined;
    }
}
exports.OpenApiParser = OpenApiParser;
