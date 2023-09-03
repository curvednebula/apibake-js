#!/usr/bin/env node
import fs from 'fs';
import { OpenApiParser } from './openapi-parser';
import { PdfWriter } from './pdf-writer';
import { errorLog, log } from './logger';
import * as path from 'path';
import moment from 'moment';
import YAML from 'yaml';
import { capitalizeFirst } from './string-utils';
import { Arg, ArgsParser } from './arg-parser';

const packageJson = require('../package.json');
const configFile = 'apibake-config.json';

const args = {
  output: <Arg>{ key: '-out', value: 'output.pdf', help: 'Output PDF file name.' },
  title: <Arg>{ key: '-title', value: 'API Spec', help: 'Document title.' },
  subtitle: <Arg>{ key: '-subtitle', value: '', help: 'Document sub title.' },
  separateSchemas: <Arg>{ key: '-separate-schemas', value: false, help: 'When multiple API files parsed, create separate schemas section for each.' },
  config: <Arg>{ key: '-config', value: '', help: `Path to ${configFile}. See -export-config.` },
  exportConfig: <Arg>{ key: '-export-config', value: false, help: 'Save default config into json file for editing.' },
  help: <Arg>{ key: '-h', value: false, help: 'Show this help.' },
}

const argsParser = new ArgsParser(args);

const printUsageHelp = () => {
  log(`ApiBake ${packageJson.version} - REST API to PDF.`);
  log('Usage: apibake <openapi.json|.yaml|folder-name> [<file-or-folder2> <file-or-folder3> ...] [<options>]');
  log('Options:');
  argsParser.printArgUsage();
}

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
      style = JSON.parse(fs.readFileSync(args.config.value as string, 'utf8'));
    } catch (e) {
      errorLog(`Error in ${args.config.value}: ${e}`);
      return;
    }
  }

  if (args.exportConfig.value) {
    const defaultStyleDoc = new PdfWriter();
    fs.writeFileSync(configFile, JSON.stringify(defaultStyleDoc.style, null, 2));
    log(`Default config exported into ${configFile}`);
    return;
  }

  const outputFile = args.output.value as string;
  const doc = new PdfWriter(outputFile, style);

  if (argsParser.rest.length === 0) {
    printUsageHelp();
    return;
  }

  doc.addTitlePage(
    args.title.value as string, 
    args.subtitle.value as string,
    moment().format('YYYY-MM-DD')
  );

  const errorMessages: string[] = [];
  const allFiles: string[] = [];

  argsParser.rest.forEach((arg) => {
    if (fs.existsSync(arg)) {
      const stats = fs.statSync(arg);

      if (stats.isDirectory()) {
        // get all files in the directory
        const items = fs.readdirSync(arg);
        items.forEach((item) => {
          const filepath = path.join(arg, item);
          if (fs.statSync(filepath).isFile()) {
            allFiles.push(filepath);
          }
        });
      } else {
        allFiles.push(arg);
      }
    } else {
      const msg = `ERROR: file or folder doesn't exist: ${arg}`;
      errorLog(msg);
      errorMessages.push(msg);
    }
  });

  const parser = new OpenApiParser(doc, !(args.separateSchemas.value as boolean));

  const filesToParse = allFiles.filter((f) => ['.json', '.yaml', '.yml'].includes(path.extname(f)));

  if (filesToParse && filesToParse.length > 0) {
    filesToParse.forEach((filepath) => {
      const fileExt = path.extname(filepath);
      try {
        log(`Parsing: ${filepath}`);
        const sectionName = capitalizeFirst(path.basename(filepath, fileExt));
        const inputJson = fs.readFileSync(filepath, 'utf8');
        const apiSpec = (fileExt === '.json') ? JSON.parse(inputJson) : YAML.parse(inputJson);
        parser.parse(apiSpec, sectionName);
      } catch (e) {
        const msg = `ERROR: while parsing ${filepath}`;
        errorLog(e, msg);
        errorMessages.push(msg);
      }
    });

    try {
      parser.done();
      log(`Saving output to ${outputFile}`);
    } catch (e) {
      const msg = `ERROR: while saving ${outputFile}`;
      errorLog(e, msg);
      errorMessages.push(msg);
    }
  } else {
    log('No .json or .yaml files found.\n');
    return;
  }

  if (errorMessages.length > 0) {
    errorLog('Errors summary:');
    errorMessages.forEach((msg) => errorLog(` - ${msg}`));
  }
}

main();
