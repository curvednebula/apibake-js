#!/usr/bin/env node
import fs from 'fs';
import { OpenApiParser } from './openapi-parser';
import { PdfWriter } from './pdf/pdf-writer';
import { errorLog, log } from './utils/logger';
import * as path from 'path';
import moment from 'moment';
import YAML from 'yaml';
import { capitalizeFirst } from './utils/string-utils';
import { ArgsParser } from './utils/arg-parser';
import { configFile, inputArgs } from './input-args';

const packageJson = require('../package.json');

const argsParser = new ArgsParser(inputArgs);

const printUsageHelp = () => {
  log(`ApiBake ${packageJson.version} - Convert OpenAPI spec to PDF.`);
  log('Usage: apibake <openapi.json|.yaml|folder-name> [<file-or-folder2> <file-or-folder3> ...] [<options>]');
  log('Options:');
  argsParser.printArgUsage();
}

const main = () => {
  const args = argsParser.parse();
  if (!args) {
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

  if (argsParser.rest.length === 0) {
    printUsageHelp();
    return;
  }

  const outputFile = args.output.value as string;
  const doc = new PdfWriter(outputFile, { 
    style, 
    footerContent: args.footer.value as string
  });

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
