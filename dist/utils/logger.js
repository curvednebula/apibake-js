"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.log = exports.errorLog = exports.debugLog = void 0;
const debugLog = (str) => {
    console.debug(str);
};
exports.debugLog = debugLog;
const errorLog = (e, str) => {
    console.error(`ERROR: ${e}`);
    if (str) {
        console.error(str);
    }
};
exports.errorLog = errorLog;
const log = (str) => {
    console.log(str);
};
exports.log = log;
