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
const arg_parser_1 = require("./arg-parser");
const packageJson = require('../package.json');
const configFile = 'apibake-config.json';
const args = {
    output: { key: '-out', value: 'output.pdf', help: 'Output PDF file name.' },
    title: { key: '-title', value: 'API Spec', help: 'Document title.' },
    subtitle: { key: '-subtitle', value: '', help: 'Document sub title.' },
    separateSchemas: { key: '-separate-schemas', value: false, help: 'When multiple API files parsed, create separate schemas section for each.' },
    config: { key: '-config', value: '', help: `Path to ${configFile}. See -export-config.` },
    exportConfig: { key: '-export-config', value: false, help: 'Save default config into json file for editing.' },
    help: { key: '-h', value: false, help: 'Show this help.' },
};
const argsParser = new arg_parser_1.ArgsParser(args);
const printUsageHelp = () => {
    (0, logger_1.log)(`ApiBake ${packageJson.version} - Convert OpenAPI spec to PDF.`);
    (0, logger_1.log)('Usage: apibake <openapi.json|.yaml|folder-name> [<file-or-folder2> <file-or-folder3> ...] [<options>]');
    (0, logger_1.log)('Options:');
    argsParser.printArgUsage();
};
const main = () => {
    // TODO: parse will set values in args object itself - it is convinient that autocomplete works for args, but behaviour is not obvious
    if (!argsParser.parse()) {
        return;
    }
    if (args.help.value) {
        printUsageHelp();
        return;
    }
    let style;
    if (args.config.value) {
        try {
            style = JSON.parse(fs_1.default.readFileSync(args.config.value, 'utf8'));
        }
        catch (e) {
            (0, logger_1.errorLog)(`Error in ${args.config.value}: ${e}`);
            return;
        }
    }
    if (args.exportConfig.value) {
        const defaultStyleDoc = new pdf_writer_1.PdfWriter();
        fs_1.default.writeFileSync(configFile, JSON.stringify(defaultStyleDoc.style, null, 2));
        (0, logger_1.log)(`Default config exported into ${configFile}`);
        return;
    }
    if (argsParser.rest.length === 0) {
        printUsageHelp();
        return;
    }
    const outputFile = args.output.value;
    const doc = new pdf_writer_1.PdfWriter(outputFile, style);
    doc.addTitlePage(args.title.value, args.subtitle.value, (0, moment_1.default)().format('YYYY-MM-DD'));
    const errorMessages = [];
    const allFiles = [];
    argsParser.rest.forEach((arg) => {
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
