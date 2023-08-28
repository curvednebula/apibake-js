"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PdfWriter = void 0;
const fs_1 = __importDefault(require("fs"));
const PDFDocument = require('pdfkit');
;
var EFont;
(function (EFont) {
    EFont[EFont["NORM"] = 0] = "NORM";
    EFont[EFont["BOLD"] = 1] = "BOLD";
    EFont[EFont["ITALIC"] = 2] = "ITALIC";
    EFont[EFont["BOLD_ITALIC"] = 3] = "BOLD_ITALIC";
})(EFont || (EFont = {}));
;
class PdfWriter {
    constructor(outputFilePath) {
        this.currentSectionName = '';
        this.pageNumber = 0;
        this.pageHeaderNodes = [];
        this.docOutlines = [];
        this.styleStack = [];
        this.fonts = [
            'Helvetica',
            'Helvetica-Bold',
            'Helvetica-Oblique',
            'Helvetica-BoldOblique'
        ];
        this.colorMain = 'black';
        this.colorAccent = 'blue';
        this.colorDisabled = 'grey';
        this.paraGap = 4;
        this.subHeaderGap = 6;
        this.headerGap = 16;
        this.baseStyle = {};
        this.doc = new PDFDocument({ bufferPages: true, autoFirstPage: false });
        const writeStream = fs_1.default.createWriteStream(outputFilePath);
        this.doc.pipe(writeStream);
        // NOTE: it is impossible to edit pages in pageAdded as it is sometimes invoked after one text already placed on the page
        // which produces unexpected formatting issues
        this.doc.on('pageAdded', () => {
            // debugLog(`Page: ${this.pageNumber}, headerNote: ${this.currentSectionName}`);
            this.pageNumber++;
            this.pageHeaderNodes.push(this.currentSectionName);
        });
        this.baseStyle = {
            font: EFont.NORM,
            fontSize: 12,
            fillColor: this.colorMain,
            indent: 0,
            lineGap: 0,
        };
    }
    addTitlePage(title, subtitle, date) {
        this.doc.addPage();
        this.doc.y = this.doc.page.height * 0.3;
        this.styledText(title, { font: EFont.BOLD, fontSize: 20 }, { align: 'center' });
        this.lineBreak(1);
        if (subtitle) {
            this.styledText(subtitle, { font: EFont.NORM, fontSize: 14 }, { align: 'center' });
            this.lineBreak(0.5);
        }
        if (date) {
            this.styledText(date, { font: EFont.NORM, fontSize: 12, fillColor: this.colorDisabled }, { align: 'center' });
        }
    }
    newSection(name) {
        this.currentSectionName = name;
        this.resetStyle();
        this.doc.addPage();
    }
    text(str, options) {
        var _a, _b;
        const style = this.currentStyle();
        const styledOpt = Object.assign({ lineGap: style.lineGap, indent: style.indent }, options);
        const absolutePos = styledOpt.x !== undefined || styledOpt.y !== undefined;
        if (absolutePos) {
            delete styledOpt.indent; // when absolute coordinates - ignore indent
        }
        // debugLog(`text: ${str}, options: ${JSON.stringify(styledOpt)}`);
        if (absolutePos) {
            this.doc.text(str, (_a = styledOpt.x) !== null && _a !== void 0 ? _a : this.doc.x, (_b = styledOpt.y) !== null && _b !== void 0 ? _b : this.doc.y, styledOpt);
        }
        else {
            this.doc.text(str, styledOpt);
        }
        return this;
    }
    styledText(str, style, options) {
        this.withStyle(style, () => this.text(str, options));
    }
    header(level, str, anchor) {
        const doc = this.doc;
        this.withStyle({ font: EFont.BOLD, fontSize: 16 - level * 2, lineGap: this.headerGap - level * 3 }, () => {
            this.text(str, { destination: anchor });
        });
        let newOutline;
        const outlinesLen = this.docOutlines.length;
        let headerLevelError = false;
        // debugLog(`header: level=${level}, text="${text}"`);
        if (level === 0) {
            newOutline = doc.outline.addItem(str);
        }
        else if (level > 0 && level <= outlinesLen) {
            newOutline = this.docOutlines[level - 1].addItem(str);
        }
        else {
            headerLevelError = true;
        }
        if (!headerLevelError) {
            if (level === outlinesLen) {
                this.docOutlines.push(newOutline);
            }
            else if (level < outlinesLen) {
                this.docOutlines[level] = newOutline;
                this.docOutlines.splice(level + 1); // remore remainings
            }
            else if (level > outlinesLen) {
                headerLevelError = true;
            }
        }
        if (headerLevelError) {
            throw new Error(`A header can only be nested inside headers with level - 1. level=${level}, previousLevel=${outlinesLen - 1}`);
        }
    }
    subHeader(str) {
        this.withStyle({ font: EFont.BOLD, fontSize: 12, lineGap: this.subHeaderGap }, () => {
            this.text(str);
        });
    }
    indentStart() {
        this.pushStyle({ indent: 12 });
        return this;
    }
    indentEnd() {
        this.popStyle();
        return this;
    }
    lineBreak(n = 1) {
        this.doc.moveDown(n);
        return this;
    }
    para(str) {
        this.withStyle({ lineGap: this.paraGap }, () => {
            this.text(str);
        });
        return this;
    }
    description(str, options) {
        this.withStyle({ fillColor: this.colorDisabled }, () => {
            this.text(str, options);
        });
    }
    dataField(name, type, description, typeAnchor) {
        this.text(name, { continued: (type || description) ? true : false });
        if (type) {
            this.text(': ', { continued: true });
            this.withStyle({ fillColor: this.colorAccent }, () => {
                this.text(type, {
                    goTo: typeAnchor,
                    underline: typeAnchor ? true : false,
                    continued: description ? true : false
                });
            });
        }
        if (description) {
            this.description(`  // ${description}`, { goTo: null, underline: false });
        }
    }
    schemaType(typeName) {
        this.text('Type: ', { continued: true });
        this.withStyle({ fillColor: this.colorAccent }, () => {
            this.text(typeName);
        });
    }
    enumValues(values) {
        this.text('Values: ', { continued: true });
        values.forEach((value, index, array) => {
            const str = (index < array.length - 1) ? `${value}, ` : value;
            const continued = (index < array.length - 1) ? true : false;
            this.text(str, { continued });
        });
    }
    finish() {
        const doc = this.doc;
        // Add headers and footers to all pages
        let pages = doc.bufferedPageRange();
        for (let i = 0; i < pages.count; i++) {
            doc.switchToPage(i);
            const origTop = this.doc.page.margins.top;
            const origBottom = this.doc.page.margins.bottom;
            doc.page.margins.top = 0;
            doc.page.margins.bottom = 0;
            if (i > 0) {
                this.withStyle({ font: EFont.NORM, fontSize: 9, fillColor: this.colorDisabled }, () => {
                    if (this.pageHeaderNodes[i]) {
                        this.text(this.pageHeaderNodes[i], { y: origTop / 2, align: 'right' });
                    }
                    this.text(`Page ${i} / ${pages.count}`, { y: this.doc.page.height - origBottom / 2, align: 'right' });
                });
            }
            doc.page.margins.top = origTop;
            doc.page.margins.bottom = origBottom;
        }
        doc.end();
    }
    setStyle(style) {
        var _a;
        this.doc.font(this.fonts[(_a = style.font) !== null && _a !== void 0 ? _a : 0]).fontSize(style.fontSize).fillColor(style.fillColor);
    }
    resetStyle() {
        this.styleStack = [];
        this.setStyle(this.baseStyle);
    }
    withStyle(style, fn) {
        const newStyle = this.pushStyle(style);
        fn(newStyle);
        this.popStyle();
    }
    pushStyle(style) {
        var _a, _b;
        const mergedStyle = Object.assign(Object.assign({}, this.currentStyle()), style);
        mergedStyle.indent = ((_a = this.currentStyle().indent) !== null && _a !== void 0 ? _a : 0) + ((_b = style.indent) !== null && _b !== void 0 ? _b : 0); // nested indent
        this.setStyle(mergedStyle);
        this.styleStack.push(mergedStyle);
        return mergedStyle;
    }
    popStyle() {
        this.styleStack.pop();
        const prevStyle = this.currentStyle();
        this.setStyle(prevStyle);
        return prevStyle;
    }
    currentStyle() {
        return (this.styleStack.length > 0)
            ? this.styleStack[this.styleStack.length - 1]
            : this.baseStyle;
    }
}
exports.PdfWriter = PdfWriter;
