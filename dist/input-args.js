"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inputArgs = exports.EFooterOptions = exports.configFile = void 0;
exports.configFile = 'apibake-config.json';
var EFooterOptions;
(function (EFooterOptions) {
    EFooterOptions["pageNumber"] = "page-number";
})(EFooterOptions || (exports.EFooterOptions = EFooterOptions = {}));
exports.inputArgs = {
    output: { key: 'out', value: 'output.pdf', help: 'Output PDF file name.' },
    title: { key: 'title', value: 'API Spec', help: 'Document title.' },
    subtitle: { key: 'subtitle', value: '', help: 'Document sub title.' },
    separateSchemas: { key: 'separate-schemas', value: false, help: 'When multiple API files parsed, create separate schemas section for each.' },
    footer: { key: 'footer', value: 'page-number', help: `Defines content of common page footer. Options: "${Object.values(EFooterOptions).join(' ')}". To turn off: "".` },
    config: { key: 'config', value: '', help: `Path to ${exports.configFile}. See --export-config.` },
    exportConfig: { key: 'export-config', value: false, help: 'Save default config into json file for editing.' },
    help: { key: 'h', value: false, help: 'Show this help.' },
};
