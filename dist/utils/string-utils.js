"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeDescription = exports.endWithDot = exports.capitalizeFirst = void 0;
const capitalizeFirst = (str) => {
    return str.charAt(0).toUpperCase() + str.slice(1);
};
exports.capitalizeFirst = capitalizeFirst;
const endWithDot = (str) => {
    return `${str}${str.endsWith('.') ? '' : '.'}`;
};
exports.endWithDot = endWithDot;
const sanitizeDescription = (str) => {
    return (0, exports.capitalizeFirst)((0, exports.endWithDot)(str.replace('\n', ' ').trim()));
};
exports.sanitizeDescription = sanitizeDescription;
