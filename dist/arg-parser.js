"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArgsParser = void 0;
const logger_1 = require("./logger");
class ArgsParser {
    constructor(args) {
        this.args = args;
        this.rest = [];
    }
    parse() {
        const rawArgs = process.argv.slice(2);
        let allGood = true;
        for (let i = 0; i < rawArgs.length; i++) {
            const arg = rawArgs[i];
            if (arg.startsWith('-')) {
                const argAfterHyphen = arg.startsWith('--') ? arg.substring(2) : arg.substring(1);
                const argObj = Object.values(this.args).find((a) => a.key === argAfterHyphen);
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
                this.rest.push(arg);
            }
        }
        return allGood;
    }
    printArgUsage() {
        Object.values(this.args).forEach((a) => {
            const needValue = typeof a.value !== 'boolean';
            const hyphen = a.key.length == 1 ? '-' : '--';
            if (needValue) {
                (0, logger_1.log)(` ${hyphen}${a.key} <${typeof a.value}>: ${a.help}`);
            }
            else {
                (0, logger_1.log)(` ${hyphen}${a.key}: ${a.help}`);
            }
        });
    }
}
exports.ArgsParser = ArgsParser;
