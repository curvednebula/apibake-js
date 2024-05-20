"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenApiParser = exports.DataField = exports.SchemaRef = void 0;
const logger_1 = require("./utils/logger");
const string_utils_1 = require("./utils/string-utils");
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
const allAnyOne = {
    'allOf': { name: 'All of', connectWord: 'and' },
    'anyOf': { name: 'Any of', connectWord: 'or' },
    'oneOf': { name: 'One of', connectWord: 'or' },
};
function getFirstOf(spec, children) {
    for (const child of children) {
        if (spec[child]) {
            return { key: child, value: spec[child] };
        }
    }
    return undefined;
}
class OpenApiParser {
    constructor(doc, mergeSchemasInOneSection = false) {
        this.doc = doc;
        this.mergeSchemasInOneSection = mergeSchemasInOneSection;
        this.firstHeaderLevel = 0;
        this.spec = {}; // open api spec being processed
        this.sectionName = '';
        this.schemas = {};
    }
    parse(apiSpec, sectionName) {
        var _a, _b, _c;
        this.spec = apiSpec;
        const openapiVer = (_a = this.spec['openapi']) !== null && _a !== void 0 ? _a : this.spec['swagger'];
        ;
        if (openapiVer == null) {
            throw Error('Invalid OpenAPI specification.');
        }
        if (openapiVer.startsWith('1') || openapiVer.startsWith('2')) {
            throw Error(`Not supported OpenAPI version: ${openapiVer}, supported: 3.0.0+.`);
        }
        this.sectionName = (_b = this.spec['info']['title']) !== null && _b !== void 0 ? _b : sectionName;
        this.doc.newSection(this.sectionName);
        this.doc.header(this.firstHeaderLevel, this.sectionName);
        this.parseInfo(this.spec);
        const paths = this.spec['paths'];
        if (paths && Object.entries(paths).length > 0) {
            (0, logger_1.log)('Endpoints:');
            Object.entries(paths).forEach(([key, value]) => {
                this.parsePath(key, value);
            });
        }
        const schemas = (_c = this.spec['components']) === null || _c === void 0 ? void 0 : _c['schemas'];
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
    parseInfo(infoSpec) {
        const objectContainsOrString = (obj, fields) => {
            return typeof obj === 'string' || typeof obj === 'object' && fields.some(field => field in obj);
        };
        if (infoSpec['info']) {
            (0, logger_1.log)(`File info:`);
            Object.entries(infoSpec['info']).forEach(([key, value]) => (0, logger_1.log)(` - ${key}: ${value}`));
            this.doc.header(1, 'Overview');
            if (infoSpec['info']['description']) {
                this.doc.indentStart();
                this.doc.para((0, string_utils_1.sanitizeDescription)(infoSpec['info']['description']));
                this.doc.lineBreak();
            }
            if ("termsOfService" in infoSpec['info']) {
                this.doc.subHeader('Terms of service');
                this.doc.indentStart();
                this.doc.para(infoSpec['info']['termsOfService']);
                this.doc.indentEnd();
                this.doc.lineBreak();
            }
            if ("version" in infoSpec['info']) {
                this.doc.subHeader('Version');
                this.doc.indentStart();
                this.doc.para(infoSpec['info']['version']);
                this.doc.indentEnd();
                this.doc.lineBreak();
            }
            if ("license" in infoSpec['info']) {
                this.doc.subHeader('License');
                this.doc.indentStart();
                if (typeof infoSpec['info']['license'] === 'object') {
                    this.doc.para(infoSpec['info']['license']['name']);
                    this.doc.para(infoSpec['info']['license']['version']);
                }
                else {
                    this.doc.para(infoSpec['info']['license']);
                }
                this.doc.indentEnd();
                this.doc.lineBreak();
            }
            if (objectContainsOrString(infoSpec['info']['contact'], ['name', 'url', 'email'])) {
                this.doc.subHeader('Contact');
                this.doc.indentStart();
                if (typeof infoSpec['info']['contact'] === 'object') {
                    this.doc.para(infoSpec['info']['contact']['name']);
                    this.doc.para(infoSpec['info']['contact']['url']);
                    this.doc.para(infoSpec['info']['contact']['email']);
                }
                else if (typeof infoSpec['info']['contact'] === 'string') {
                    this.doc.para(infoSpec['info']['contact']);
                }
                this.doc.indentEnd();
                this.doc.lineBreak();
            }
            // add other info fields if any
            const processedEntries = ["title", "description", "termsOfService", "version", "license", "contact"];
            Object.entries(infoSpec['info']).forEach(([key, value]) => {
                if (processedEntries.includes(key) || value === null || typeof value !== 'string') {
                    return;
                }
                this.doc.subHeader((0, string_utils_1.capitalizeFirst)(key));
                this.doc.indentStart();
                this.doc.para(value);
                this.doc.indentEnd();
                this.doc.lineBreak();
            });
            this.doc.lineBreak(2);
        }
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
                const schema = contentSpec['schema'];
                if (schema) {
                    this.doc.contentType(contentType, { lineContinues: true });
                    this.parseSchema(schema, { alwaysShowType: true, lineContinues: true });
                    emptyBody = false;
                }
                this.parseExamples(contentSpec['examples']);
            });
        }
        if (emptyBody) {
            // this.doc.para('Empty body.');
        }
        this.doc.paraBreak();
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
    parseSchema(schemaSpec, options) {
        var _a, _b;
        if (!schemaSpec) {
            return;
        }
        // If schema is aggregate: allOf, anyOf, oneOf
        const found = getFirstOf(schemaSpec, Object.keys(allAnyOne));
        if ((found === null || found === void 0 ? void 0 : found.value) && Array.isArray(found.value)) {
            if (options === null || options === void 0 ? void 0 : options.lineContinues) {
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
        if (options === null || options === void 0 ? void 0 : options.lineContinues) {
            this.doc.text(' | ', {}, { continued: true });
        }
        const ref = this.parseSchemaRef(schemaSpec);
        if (ref.schemaName && ref.anchor) {
            const foundRef = (_b = (_a = this.spec['components']) === null || _a === void 0 ? void 0 : _a['schemas']) === null || _b === void 0 ? void 0 : _b[ref.schemaName];
            if (foundRef) {
                this.doc.textRef(ref.text, ref.anchor);
                if (options === null || options === void 0 ? void 0 : options.lineContinues) {
                    this.doc.paraBreak();
                }
                this.parseSchema(foundRef);
            }
            else {
                this.doc.textRef(ref.text, ref.anchor);
            }
            return;
        }
        else {
            if (!ref.isUndefined() && ref.text !== 'object') {
                this.doc.text(ref.text);
            }
        }
        // If schema defined explicetly
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
        this.doc.paraBreak();
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
        return this.mergeSchemasInOneSection ? `schemas:${schemaName}` : `${this.sectionName}:${schemaName}`;
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
            if (!anchor) {
                (0, logger_1.log)(`! No definition for ref: ${schemaRef['\$ref']}`);
            }
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
                const leaf = getFirstOf(paramSpec, Object.keys(allAnyOne));
                // TODO: parse entire array of possible schemas
                if (leaf === null || leaf === void 0 ? void 0 : leaf.value[0]) {
                    typeRef = this.parseSchemaRef(leaf === null || leaf === void 0 ? void 0 : leaf.value[0]);
                }
            }
            this.doc.dataFields([
                new DataField(paramSpec['name'], typeRef, paramSpec['description'], paramSpec['required'])
            ]);
        }
    }
}
exports.OpenApiParser = OpenApiParser;
