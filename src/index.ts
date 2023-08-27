#!/usr/bin/env node
import fs from 'fs';
import { OpenApiParser } from './openapi-parser';
import { PdfWriter } from './pdf-writer';
import { errorLog, log } from './logger';
import * as path from 'path';

// interface Arg {
//   key: string;
//   value: string | number | boolean;
//   help: string;
// }

const args = {
  output: { key: '-output', value: 'output.pdf', help: 'Output file.' },
  title: { key: '-title', value: 'API Spec', help: 'Document title.' },
  subtitle: { key: '-subtitle', value: '', help: 'Document sub title.' },
  separateSchemas: { key: '-separate-schemas', value: false, help: 'When multiple API files parsed create separate schemas section for each file.' },
  help: { key: '-help', value: false, help: 'Show this help page.' },
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
          // case 'number': argObj.value = Number.parseFloat(argValue); i++; break;
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

const capitalizeFirst = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

const main = () => {

  parseArgs();

  if (args.help.value) {
    log('ApiBake 1.0.0');
    log('Usage: apibake <openapi.json> [<api2.json> <api3.json> ...] [<options>]');
    log('Options:');
    printArgUsage();
    return;
  }

  const outputFile = args.output.value as string;

  const doc = new PdfWriter(outputFile);
  doc.addTitlePage(args.title.value as string, args.subtitle.value as string);

  const parser = new OpenApiParser(doc, !(args.separateSchemas.value as boolean));

  if (argsRest.length === 0) {
    argsRest.push('test-data/domain.json');
    argsRest.push('test-data/devicemgmt.json');
  }

  argsRest.forEach((filepath) => {
    const fileExt = path.extname(filepath);
    if (['.json', '.yaml', '.yml'].includes(fileExt)) {
      try {
        log(`Parsing: ${filepath}`);
        const sectionName = capitalizeFirst(path.basename(filepath, fileExt));
        const inputJson = fs.readFileSync(filepath, 'utf8');
        parser.parse(inputJson, sectionName);
      } catch (e) {
        errorLog(`ERROR while parsing ${filepath}: ${e}`);
      }
    } else {
      errorLog(`Ignored input: ${filepath}`);
    }
  });
  
  parser.done();

  log(`Saving output to ${outputFile}`);
}

main();

