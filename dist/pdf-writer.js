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
        this.baseFontSize = 10;
        this.paraGap = this.baseFontSize / 3;
        this.subHeaderGap = this.baseFontSize / 2;
        this.headerGap = this.baseFontSize + 4;
        this.indentStep = 12;
        this.margins = {
            horizontal: 70,
            vertical: 50
        };
        this.baseStyle = {
            font: EFont.NORM,
            fontSize: this.baseFontSize,
            fillColor: this.colorMain,
            leftMargin: this.margins.horizontal,
            lineGap: 0,
        };
        this.doc = new PDFDocument({
            bufferPages: true,
            autoFirstPage: false,
            margins: {
                left: this.margins.horizontal,
                right: this.margins.horizontal,
                top: this.margins.vertical,
                bottom: this.margins.vertical
            }
        });
        const writeStream = fs_1.default.createWriteStream(outputFilePath);
        this.doc.pipe(writeStream);
        // NOTE: it is impossible to edit pages in pageAdded as it is sometimes invoked after one text already placed on the page
        // which produces unexpected formatting issues
        this.doc.on('pageAdded', () => {
            // debugLog(`Page: ${this.pageNumber}, headerNote: ${this.currentSectionName}`);
            this.pageNumber++;
            this.pageHeaderNodes.push(this.currentSectionName);
        });
    }
    addTitlePage(title, subtitle, date) {
        // NOTE: font sizes on the title screen don't depent on base fontSize
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
        const styledOpt = Object.assign({ lineGap: style.lineGap }, options);
        const absolutePos = styledOpt.x !== undefined || styledOpt.y !== undefined;
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
        this.styledText(str, { font: EFont.BOLD, fontSize: this.baseFontSize + 4 - level * 2, lineGap: this.headerGap - level * 3 }, { destination: anchor });
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
        this.styledText(str, { font: EFont.BOLD, fontSize: this.baseFontSize, lineGap: this.subHeaderGap });
    }
    indentStart() {
        this.pushStyle({ leftMargin: this.indentStep });
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
        this.styledText(str, { lineGap: this.paraGap });
        return this;
    }
    description(str, options) {
        this.styledText(str, { fillColor: this.colorDisabled }, options);
    }
    dataFields(dataFields) {
        const origX = this.doc.x;
        // const gap = 5;
        // let nameAndTypeMaxWidth = 0;
        // dataFields.forEach((field) => {
        //   let nameAndType = `${field.name}${(field.required ?? true) ? '':'?'}`;
        //   if (field.type?.text) {
        //     nameAndType += `: ${field.type?.text}`;
        //   }
        //   const width = this.doc.widthOfString(nameAndType);
        //   if (nameAndTypeMaxWidth < width) {
        //     nameAndTypeMaxWidth = width;
        //   }
        // });
        dataFields.forEach((field) => {
            var _a, _b, _c, _d;
            const fieldName = `${field.name}${((_a = field.required) !== null && _a !== void 0 ? _a : true) ? '' : '?'}`;
            const fieldType = (_b = field.type) === null || _b === void 0 ? void 0 : _b.text;
            this.text(fieldName, { continued: fieldType ? true : false });
            if (fieldType) {
                this.text(': ', { continued: true });
                this.styledText(`${fieldType};`, { fillColor: this.colorAccent }, {
                    goTo: (_c = field.type) === null || _c === void 0 ? void 0 : _c.anchor,
                    underline: ((_d = field.type) === null || _d === void 0 ? void 0 : _d.anchor) ? true : false
                });
            }
            if (field.description) {
                this.doc.moveUp();
                let nameAndType = fieldName + (fieldType ? `: ${fieldType}` : '');
                this.styledText(`// ${field.description}`, { fillColor: this.colorDisabled }, { x: origX + 12, indent: this.doc.widthOfString(nameAndType) });
            }
            this.doc.x = origX;
        });
    }
    object(dataFields) {
        this.text('{').indentStart();
        this.dataFields(dataFields);
        this.indentEnd().text('}');
    }
    schemaType(typeName) {
        this.text('Type: ', { continued: true });
        this.styledText(typeName, { fillColor: this.colorAccent });
    }
    enumValues(values) {
        this.text('Values: ');
        this.doc.moveUp();
        const nextLineIndent = this.doc.x + this.indentStep;
        const indent = this.doc.widthOfString('Values: ') - this.indentStep;
        values.forEach((value, index, array) => {
            const str = (index < array.length - 1) ? `${value}, ` : value;
            const continued = (index < array.length - 1) ? true : false;
            if (index === 0) {
                this.text(str, { x: nextLineIndent, indent, continued });
            }
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
                    this.text(`Page ${i} / ${pages.count - 1}`, { y: this.doc.page.height - origBottom / 2, align: 'right' });
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
        mergedStyle.leftMargin = ((_a = this.currentStyle().leftMargin) !== null && _a !== void 0 ? _a : 0) + ((_b = style.leftMargin) !== null && _b !== void 0 ? _b : 0); // nested indent
        this.setStyle(mergedStyle);
        this.doc.x = mergedStyle.leftMargin;
        this.styleStack.push(mergedStyle);
        return mergedStyle;
    }
    popStyle() {
        this.styleStack.pop();
        const prevStyle = this.currentStyle();
        this.setStyle(prevStyle);
        this.doc.x = prevStyle.leftMargin;
        return prevStyle;
    }
    currentStyle() {
        return (this.styleStack.length > 0)
            ? this.styleStack[this.styleStack.length - 1]
            : this.baseStyle;
    }
}
exports.PdfWriter = PdfWriter;
