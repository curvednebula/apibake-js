"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PdfWriter = void 0;
const fs_1 = __importDefault(require("fs"));
const obj_utils_1 = require("../utils/obj-utils");
const input_args_1 = require("../input-args");
const PDFDocument = require('pdfkit');
class Font {
    constructor(face, style) {
        this.face = face;
        this.style = style;
    }
}
;
class PdfWriter {
    constructor(outputFile, options) {
        this.options = options;
        // configurable PDF style
        this.style = {
            color: {
                main: '#333333',
                secondary: '#6B7B8E',
                highlight: '#8A3324',
                headers: '#2A4D69',
                subHeaders: '#4B86B4',
                getMethod: '#4A90E2',
                putMethod: '#6B8E23',
                postMethod: '#D87F0A',
                patchMethod: '#C2A000',
                deleteMethod: '#D0021B',
                otherMethods: '#2A4D69'
            },
            font: {
                baseSize: 10,
                main: {
                    norm: new Font('Helvetica'),
                    bold: new Font('Helvetica-Bold'),
                    italic: new Font('Helvetica-Oblique'),
                },
                mono: {
                    norm: new Font('Courier'),
                    bold: new Font('Courier-Bold'),
                    italic: new Font('Courier-Oblique')
                }
            },
            format: {
                indentStep: 12,
                horizontalMargin: 70,
                verticalMargin: 50
            }
        };
        this.currentSectionName = '';
        this.pageNumber = 0;
        this.pageHeaderNodes = [];
        this.docOutlines = [];
        this.styleStack = [];
        this.headerGap = 0.7;
        this.paraGap = 0.5;
        if (options === null || options === void 0 ? void 0 : options.style) {
            this.style = (0, obj_utils_1.deepOverride)(this.style, options === null || options === void 0 ? void 0 : options.style);
        }
        this.baseStyle = {
            font: this.style.font.main.norm,
            fontSize: this.style.font.baseSize,
            fillColor: this.style.color.main,
            leftMargin: this.style.format.horizontalMargin,
            lineGap: 0,
        };
        this.doc = new PDFDocument({
            bufferPages: true,
            autoFirstPage: false,
            margins: {
                left: this.style.format.horizontalMargin,
                right: this.style.format.horizontalMargin,
                top: this.style.format.verticalMargin,
                bottom: this.style.format.verticalMargin
            }
        });
        if (outputFile) {
            const writeStream = fs_1.default.createWriteStream(outputFile);
            this.doc.pipe(writeStream);
        }
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
        this.text(title, { font: this.style.font.main.bold, fontSize: 20 }, { align: 'center' });
        if (subtitle) {
            this.lineBreak(this.paraGap);
            this.text(subtitle, { fontSize: 14 }, { align: 'center' });
        }
        if (date) {
            this.lineBreak(3);
            this.text(date, { fontSize: 12, fillColor: this.style.color.secondary }, { align: 'center' });
        }
    }
    newSection(name) {
        this.currentSectionName = name;
        this.resetStyle();
        this.doc.addPage();
    }
    indentStart() {
        this.pushStyle({ leftMargin: this.style.format.indentStep });
        return this;
    }
    indentEnd() {
        this.popStyle();
        return this;
    }
    nextLine() {
        return this.text('').lineBreak();
    }
    lineBreak(n = 1) {
        this.doc.moveDown(n);
        return this;
    }
    paraBreak() {
        return this.lineBreak(this.paraGap);
    }
    text(str, style, options) {
        if (style && Object.keys(style).length > 0) {
            this.withStyle(style, () => this.textImpl(str, options));
        }
        else {
            this.textImpl(str, options);
        }
        return this;
    }
    textRef(str, anchor) {
        this.text(str, { fillColor: this.style.color.highlight }, {
            goTo: anchor !== null && anchor !== void 0 ? anchor : undefined,
            underline: anchor ? true : false
        });
    }
    textImpl(str, options) {
        var _a, _b;
        const style = this.currentStyle();
        const styledOpt = Object.assign({ lineGap: style.lineGap }, options);
        const absolutePos = styledOpt.x !== undefined || styledOpt.y !== undefined;
        if (absolutePos) {
            this.doc.text(str, (_a = styledOpt.x) !== null && _a !== void 0 ? _a : this.doc.x, (_b = styledOpt.y) !== null && _b !== void 0 ? _b : this.doc.y, styledOpt);
        }
        else {
            this.doc.text(str, styledOpt);
        }
        return this;
    }
    header(level, str, anchor) {
        this.withStyle({ fillColor: this.style.color.headers, font: this.style.font.main.bold, fontSize: this.style.font.baseSize + 4 - level * 2 }, () => {
            this.text(str, {}, { destination: anchor });
            this.lineBreak(this.headerGap);
        });
        this.addOutline(level, str);
    }
    apiHeader(method, endpoint, headerLevel) {
        const fontSize = this.style.font.baseSize + 2;
        const colorByMethod = {
            'get': this.style.color.getMethod,
            'put': this.style.color.putMethod,
            'post': this.style.color.postMethod,
            'patch': this.style.color.patchMethod,
            'delete': this.style.color.deleteMethod,
        };
        this.withStyle({ font: this.style.font.main.bold, fontSize }, () => {
            var _a;
            const width = this.doc.widthOfString(method);
            const height = this.doc.heightOfString(method);
            const color = (_a = colorByMethod[method.toLowerCase()]) !== null && _a !== void 0 ? _a : this.style.color.otherMethods;
            // bugfix: make sure we are already on a new page if needed - to dray rect correctly 
            this.text(method, {}, { continued: true });
            this.text(' ');
            this.doc.moveUp();
            this.doc
                .lineJoin('round').lineWidth(4)
                .rect(this.doc.x, this.doc.y - fontSize / 4, width, height)
                .fillAndStroke(color, color);
            this.text(method, { fillColor: 'white' }, { continued: true });
            this.text(`  ${endpoint}`, { fillColor: this.style.color.headers });
            this.lineBreak(this.headerGap);
        });
        this.addOutline(headerLevel, `${method} ${endpoint}`);
    }
    addOutline(level, str) {
        let newOutline;
        const outlinesLen = this.docOutlines.length;
        let levelError = false;
        // debugLog(`header: level=${level}, text="${text}"`);
        if (level === 0) {
            newOutline = this.doc.outline.addItem(str);
        }
        else if (level > 0 && level <= outlinesLen) {
            newOutline = this.docOutlines[level - 1].addItem(str);
        }
        else {
            levelError = true;
        }
        if (!levelError) {
            if (level === outlinesLen) {
                this.docOutlines.push(newOutline);
            }
            else if (level < outlinesLen) {
                this.docOutlines[level] = newOutline;
                this.docOutlines.splice(level + 1); // remore remainings
            }
            else if (level > outlinesLen) {
                levelError = true;
            }
        }
        if (levelError) {
            throw new Error(`A header can only be nested inside headers with level - 1. level=${level}, previousLevel=${outlinesLen - 1}`);
        }
    }
    subHeader(str) {
        this.withStyle({ fillColor: this.style.color.subHeaders, font: this.style.font.main.bold, fontSize: this.style.font.baseSize }, () => {
            this.text(str);
            this.lineBreak(this.headerGap);
        });
    }
    para(str) {
        this.text(str);
        this.lineBreak(this.paraGap);
        return this;
    }
    description(str) {
        this.text(str, { fillColor: this.style.color.secondary });
        this.lineBreak(this.paraGap);
    }
    dataFields(dataFields) {
        const origX = this.doc.x;
        dataFields.forEach((field) => {
            var _a, _b, _c, _d;
            const fieldName = `${field.name}${((_a = field.required) !== null && _a !== void 0 ? _a : true) ? '' : '?'}`;
            const fieldType = ((_b = field.type) === null || _b === void 0 ? void 0 : _b.text) ? `${(_c = field.type) === null || _c === void 0 ? void 0 : _c.text};` : undefined;
            this.text(fieldName, {}, { continued: fieldType ? true : false });
            if (fieldType) {
                this.text(': ', {}, { continued: true });
                this.textRef(fieldType, (_d = field.type) === null || _d === void 0 ? void 0 : _d.anchor);
            }
            if (field.description) {
                this.doc.moveUp();
                let nameAndType = fieldName + (fieldType ? `: ${fieldType}` : '');
                this.text(`  // ${field.description}`, { fillColor: this.style.color.secondary }, {
                    x: origX + this.style.format.indentStep,
                    indent: this.doc.widthOfString(nameAndType) - this.style.format.indentStep
                });
            }
            this.doc.x = origX;
        });
    }
    contentType(contentType, options) {
        this.text('Content: ', {}, { continued: true });
        this.text(contentType, { fillColor: this.style.color.highlight }, { continued: options === null || options === void 0 ? void 0 : options.lineContinues });
    }
    schemaType(typeName) {
        this.text('Type: ', {}, { continued: true });
        this.text(typeName !== null && typeName !== void 0 ? typeName : '-', { fillColor: this.style.color.highlight });
        this.lineBreak(this.paraGap);
    }
    objectSchema(dataFields) {
        this.text('{').indentStart();
        this.dataFields(dataFields);
        this.indentEnd().text('}');
    }
    example(name, body) {
        this.text(`Example "${name}":`, { font: this.style.font.main.bold });
        this.lineBreak(this.paraGap);
        this.text(body, { fillColor: this.style.color.secondary, fontSize: this.style.font.baseSize - 2, font: this.style.font.mono.bold });
        this.lineBreak(this.paraGap);
    }
    enumValues(values) {
        this.text('Values: ');
        this.doc.moveUp();
        const nextLineIndent = this.doc.x + this.style.format.indentStep;
        const indent = this.doc.widthOfString('Values: ') - this.style.format.indentStep;
        this.withStyle({ fillColor: this.style.color.highlight }, () => {
            values.forEach((value, index, array) => {
                const str = (index < array.length - 1) ? `${value}, ` : value;
                const continued = (index < array.length - 1) ? true : false;
                if (index === 0) {
                    this.text(str, {}, { x: nextLineIndent, indent, continued });
                }
                else {
                    this.text(str, {}, { continued });
                }
            });
        });
    }
    finish() {
        var _a, _b;
        const doc = this.doc;
        const footerOptions = (_b = (_a = this.options) === null || _a === void 0 ? void 0 : _a.footerContent) === null || _b === void 0 ? void 0 : _b.trim().split(/\s+/);
        const showPageNumbers = footerOptions === null || footerOptions === void 0 ? void 0 : footerOptions.includes(input_args_1.EFooterOptions.pageNumber);
        // Add headers and footers to all pages
        let pages = doc.bufferedPageRange();
        for (let i = 0; i < pages.count; i++) {
            doc.switchToPage(i);
            const origTop = this.doc.page.margins.top;
            const origBottom = this.doc.page.margins.bottom;
            doc.page.margins.top = 0;
            doc.page.margins.bottom = 0;
            if (i > 0) {
                this.withStyle({ fontSize: 9, fillColor: this.style.color.secondary }, () => {
                    if (this.pageHeaderNodes[i]) {
                        this.text(this.pageHeaderNodes[i], {}, { y: origTop / 2, align: 'right' });
                    }
                    if (showPageNumbers) {
                        this.text(`Page ${i} / ${pages.count - 1}`, {}, { y: this.doc.page.height - origBottom / 2, align: 'right' });
                    }
                });
            }
            doc.page.margins.top = origTop;
            doc.page.margins.bottom = origBottom;
        }
        doc.end();
    }
    setStyle(style) {
        var _a;
        this.doc.font(style.font.face, ((_a = style.font) === null || _a === void 0 ? void 0 : _a.style) || undefined).fontSize(style.fontSize).fillColor(style.fillColor);
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
