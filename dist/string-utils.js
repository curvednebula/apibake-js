"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.capitalizeFirst = void 0;
const capitalizeFirst = (str) => {
    return str.charAt(0).toUpperCase() + str.slice(1);
};
exports.capitalizeFirst = capitalizeFirst;
