#!/usr/bin/env node
import fs from 'fs';
import { OpenApiParser } from './openapi-parser';
import { PdfWriter } from './pdf-writer';
import { errorLog, log } from './logger';
import * as path from 'path';
import moment from 'moment';
import YAML from 'yaml';
import { capitalizeFirst } from './string-utils';

interface Arg {
  key: string;
  value: string | number | boolean;
  help: string;
}

const args = {
  output: <Arg>{ key: '-output', value: 'output.pdf', help: 'Output file.' },
  title: <Arg>{ key: '-title', value: 'API Spec', help: 'Document title.' },
  subtitle: <Arg>{ key: '-subtitle', value: '', help: 'Document sub title.' },
  separateSchemas: <Arg>{ key: '-separate-schemas', value: false, help: 'When multiple API files parsed create separate schemas section for each file.' },
  help: <Arg>{ key: '-help', value: false, help: 'Show this help page.' },
}

const argsRest: string[] = [];

const parseArgs = () => {
  const rawArgs = process.argv.slice(2);

  for (let i=0; i<rawArgs.length; i++) {
    const arg = rawArgs[i];

    if (arg.startsWith('-')) {
      const argObj = Object.values(args).find((a) => a.key === arg);
      if (argObj) {
        const argValue = (i < rawArgs.length-1) ? rawArgs[i+1] : '';
        switch (typeof argObj.value) {
          case 'boolean': argObj.value = true; break;
          case 'string': argObj.value = argValue; i++; break;
          case 'number': argObj.value = Number.parseFloat(argValue); i++; break;
        }
      }
    } else {
      argsRest.push(arg);
    }
  }
}

const printArgUsage = () => {
  Object.values(args).forEach((a) => {
    const needValue = typeof a.value !== 'boolean';
    if (needValue) {
      log(` ${a.key} <${typeof a.value}>: ${a.help}`);
    } else {
      log(` ${a.key}: ${a.help}`);
    }
  });
}

const main = () => {

  parseArgs();

  if (args.help.value) {
    log('ApiBake 1.0.0 - REST API PDF creator.');
    log('Usage: apibake <openapi.json|.yaml|folder-name> [<file-or-folder2> <file-or-folder3> ...] [<options>]');
    log('Options:');
    printArgUsage();
    return;
  }

  const outputFile = args.output.value as string;
  const doc = new PdfWriter(outputFile);
  doc.addTitlePage(
    args.title.value as string, 
    args.subtitle.value as string,
    moment().format('YYYY-MM-DD')
  );

  const parser = new OpenApiParser(doc, !(args.separateSchemas.value as boolean));

  if (argsRest.length === 0) {
    argsRest.push('test-data/v3.0/');
    argsRest.push('test-data/private/');
  }

  const errorMessages: string[] = [];
  const allFiles: string[] = [];

  argsRest.forEach((arg) => {
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

  const filesToParse = allFiles.filter((f) => ['.json', '.yaml', '.yml'].includes(path.extname(f)));

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

  if (errorMessages.length > 0) {
    errorLog('Errors summary:');
    errorMessages.forEach((msg) => errorLog(` - ${msg}`));
  }
}

main();

