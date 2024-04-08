import { Arg } from "./utils/arg-parser";

export const configFile = 'apibake-config.json';

export enum EFooterOptions {
  pageNumber = 'page-number'
}

export const inputArgs = {
  output: <Arg>{ key: 'out', value: 'output.pdf', help: 'Output PDF file name.' },
  title: <Arg>{ key: 'title', value: 'API Spec', help: 'Document title.' },
  subtitle: <Arg>{ key: 'subtitle', value: '', help: 'Document sub title.' },
  separateSchemas: <Arg>{ key: 'separate-schemas', value: false, help: 'When multiple API files parsed, create separate schemas section for each.' },
  footer: <Arg>{ key: 'footer', value: 'page-number', help: `Defines content of common page footer. Options: "${Object.values(EFooterOptions).join(' ')}". To turn off: "".` },
  config: <Arg>{ key: 'config', value: '', help: `Path to ${configFile}. See --export-config.` },
  exportConfig: <Arg>{ key: 'export-config', value: false, help: 'Save default config into json file for editing.' },
  help: <Arg>{ key: 'h', value: false, help: 'Show this help.' },
}
