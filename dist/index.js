#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const openapi_parser_1 = require("./openapi-parser");
const pdf_writer_1 = require("./pdf-writer");
const logger_1 = require("./logger");
const path = __importStar(require("path"));
const moment_1 = __importDefault(require("moment"));
const yaml_1 = __importDefault(require("yaml"));
const string_utils_1 = require("./string-utils");
const args = {
    output: { key: '-out', value: 'output.pdf', help: 'Output PDF file name.' },
    title: { key: '-title', value: 'API Spec', help: 'Document title.' },
    subtitle: { key: '-subtitle', value: '', help: 'Document sub title.' },
    separateSchemas: { key: '-separate-schemas', value: false, help: 'When multiple API files parsed, create separate schemas section for each.' },
    help: { key: '-h', value: false, help: 'Show this help.' },
};
const argsRest = [];
const printArgUsage = () => {
    Object.values(args).forEach((a) => {
        const needValue = typeof a.value !== 'boolean';
        if (needValue) {
            (0, logger_1.log)(` ${a.key} <${typeof a.value}>: ${a.help}`);
        }
        else {
            (0, logger_1.log)(` ${a.key}: ${a.help}`);
        }
    });
};
const printUsageHelp = () => {
    (0, logger_1.log)(`ApiBake ${pack.version} - REST API to PDF.`);
    (0, logger_1.log)('Usage: apibake <openapi.json|.yaml|folder-name> [<file-or-folder2> <file-or-folder3> ...] [<options>]');
    (0, logger_1.log)('Options:');
    printArgUsage();
};
const parseArgs = () => {
    const rawArgs = process.argv.slice(2);
    let allGood = true;
    for (let i = 0; i < rawArgs.length; i++) {
        const arg = rawArgs[i];
        if (arg.startsWith('-')) {
            const argObj = Object.values(args).find((a) => a.key === arg);
            if (argObj) {
                const argValue = (i < rawArgs.length - 1) ? rawArgs[i + 1] : '';
                switch (typeof argObj.value) {
                    case 'boolean':
                        argObj.value = true;
                        break;
                    case 'string':
                        argObj.value = argValue;
                        i++;
                        break;
                    case 'number':
                        argObj.value = Number.parseFloat(argValue);
                        i++;
                        break;
                }
            }
            else {
                (0, logger_1.errorLog)(`Unknown option: ${arg}`);
                allGood = false;
            }
        }
        else {
            argsRest.push(arg);
        }
    }
    return allGood;
};
const pack = require('../package.json');
const main = () => {
    if (!parseArgs()) {
        return;
    }
    if (args.help.value || argsRest.length === 0) {
        printUsageHelp();
        return;
    }
    const outputFile = args.output.value;
    const doc = new pdf_writer_1.PdfWriter(outputFile);
    doc.addTitlePage(args.title.value, args.subtitle.value, (0, moment_1.default)().format('YYYY-MM-DD'));
    const errorMessages = [];
    const allFiles = [];
    argsRest.forEach((arg) => {
        if (fs_1.default.existsSync(arg)) {
            const stats = fs_1.default.statSync(arg);
            if (stats.isDirectory()) {
                // get all files in the directory
                const items = fs_1.default.readdirSync(arg);
                items.forEach((item) => {
                    const filepath = path.join(arg, item);
                    if (fs_1.default.statSync(filepath).isFile()) {
                        allFiles.push(filepath);
                    }
                });
            }
            else {
                allFiles.push(arg);
            }
        }
        else {
            const msg = `ERROR: file or folder doesn't exist: ${arg}`;
            (0, logger_1.errorLog)(msg);
            errorMessages.push(msg);
        }
    });
    const parser = new openapi_parser_1.OpenApiParser(doc, !args.separateSchemas.value);
    const filesToParse = allFiles.filter((f) => ['.json', '.yaml', '.yml'].includes(path.extname(f)));
    if (filesToParse && filesToParse.length > 0) {
        filesToParse.forEach((filepath) => {
            const fileExt = path.extname(filepath);
            try {
                (0, logger_1.log)(`Parsing: ${filepath}`);
                const sectionName = (0, string_utils_1.capitalizeFirst)(path.basename(filepath, fileExt));
                const inputJson = fs_1.default.readFileSync(filepath, 'utf8');
                const apiSpec = (fileExt === '.json') ? JSON.parse(inputJson) : yaml_1.default.parse(inputJson);
                parser.parse(apiSpec, sectionName);
            }
            catch (e) {
                const msg = `ERROR: while parsing ${filepath}`;
                (0, logger_1.errorLog)(e, msg);
                errorMessages.push(msg);
            }
        });
        try {
            parser.done();
            (0, logger_1.log)(`Saving output to ${outputFile}`);
        }
        catch (e) {
            const msg = `ERROR: while saving ${outputFile}`;
            (0, logger_1.errorLog)(e, msg);
            errorMessages.push(msg);
        }
    }
    else {
        (0, logger_1.log)('No .json or .yaml files found.\n');
        return;
    }
    if (errorMessages.length > 0) {
        (0, logger_1.errorLog)('Errors summary:');
        errorMessages.forEach((msg) => (0, logger_1.errorLog)(` - ${msg}`));
    }
};
main();
