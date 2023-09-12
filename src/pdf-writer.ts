import fs from 'fs';
import { DataField } from './openapi-parser';
import { deepOverride } from './obj-utils';
const PDFDocument = require('pdfkit');

class Font {
  constructor(
    public face: string,
    public style?: string
  ) {}
}

interface ITextStyle {
  font?: Font;
  fontSize?: number;
  fillColor?: string;
  leftMargin?: number;
  lineGap?: number;
}

interface ITextOptions {
  continued?: boolean;
  lineBreak?: boolean;
  underline?: boolean;
  destination?: string;
  goTo?: string | null;
  indent?: number;
  align?: string;
  x?: number;
  y?: number;
};

export class PdfWriter {

  // configurable PDF style
  style = {
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

  private doc;

  private currentSectionName = '';

  private pageNumber = 0;
  private pageHeaderNodes: string[] = []; 

  private docOutlines: any[] = [];
  private styleStack: ITextStyle[] = [];

  private headerGap = 0.7;
  private paraGap = 0.5;

  private baseStyle: ITextStyle;

  constructor(outputFilePath?: string, style?: any) {
    if (style) {
      this.style = deepOverride(this.style, style);
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
      margins:  {
        left: this.style.format.horizontalMargin,
        right: this.style.format.horizontalMargin,
        top: this.style.format.verticalMargin,
        bottom: this.style.format.verticalMargin
      }
    });

    if (outputFilePath) {
      const writeStream = fs.createWriteStream(outputFilePath);
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

  addTitlePage(title: string, subtitle?: string, date?: string) {
    // NOTE: font sizes on the title screen don't depent on base fontSize
    this.doc.addPage();
    this.doc.y = this.doc.page.height * 0.3;
    this.text(title, { font: this.style.font.main.bold, fontSize: 20 }, { align: 'center' });
    
    if (subtitle) {
      this.lineBreak(0.5);
      this.text(subtitle, { fontSize: 14 }, { align: 'center' });
    }
    
    if (date) {
      this.lineBreak(3);
      this.text(date, { fontSize: 12, fillColor: this.style.color.secondary }, { align: 'center' });
    }
  }

  newSection(name: string) {
    this.currentSectionName = name;
    this.resetStyle();
    this.doc.addPage();
  }

  indentStart(): PdfWriter {
    this.pushStyle({ leftMargin: this.style.format.indentStep });
    return this;
  }

  indentEnd(): PdfWriter {
    this.popStyle();
    return this;
  }

  lineBreak(n: number = 1): PdfWriter {
    this.doc.moveDown(n);
    return this;
  }

  text(str: string, style?: ITextStyle, options?: ITextOptions): PdfWriter {
    if (style && Object.keys(style).length > 0) {
      this.withStyle(style, () => this.textImpl(str, options));
    } else {
      this.textImpl(str, options);
    }
    return this;
  }

  private textImpl(str: string, options?: ITextOptions): PdfWriter {
    const style = this.currentStyle();
    const styledOpt = { lineGap: style.lineGap, ...options };
    const absolutePos = styledOpt.x !== undefined || styledOpt.y !== undefined;

    if (absolutePos) {
      this.doc.text(str, styledOpt.x ?? this.doc.x, styledOpt.y ?? this.doc.y, styledOpt);
    } else {
      this.doc.text(str, styledOpt);
    }
    return this;
  }

  header(level: number, str: string, anchor?: string) {
    this.withStyle({ fillColor: this.style.color.headers, font: this.style.font.main.bold, fontSize: this.style.font.baseSize + 4 - level * 2 }, () => {
      this.text(str, {}, { destination: anchor });
      this.lineBreak(this.headerGap);
    });
    this.addOutline(level, str);
  }

  apiHeader(method: string, endpoint: string, headerLevel: number) {
    const fontSize = this.style.font.baseSize + 2;

    const colorByMethod: Record<string, string> = {
      'get': this.style.color.getMethod,
      'put': this.style.color.putMethod,
      'post': this.style.color.postMethod,
      'patch': this.style.color.patchMethod,
      'delete': this.style.color.deleteMethod,
    };
    
    this.withStyle({ font: this.style.font.main.bold, fontSize }, () => {
      const width = this.doc.widthOfString(method);
      const height = this.doc.heightOfString(method);
      const color = colorByMethod[method.toLowerCase()] ?? this.style.color.otherMethods;

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

  private addOutline(level: number, str: string) {
    let newOutline;
    const outlinesLen = this.docOutlines.length;
    let levelError = false;

    // debugLog(`header: level=${level}, text="${text}"`);

    if (level === 0) {
      newOutline = this.doc.outline.addItem(str);
    } else if (level > 0 && level <= outlinesLen) {
      newOutline = this.docOutlines[level - 1].addItem(str);
    } else {
      levelError = true;
    }
    
    if (!levelError) {
      if (level === outlinesLen) {
        this.docOutlines.push(newOutline);
      } else if (level < outlinesLen) {
        this.docOutlines[level] = newOutline;
        this.docOutlines.splice(level + 1); // remore remainings
      } else if (level > outlinesLen) {
        levelError = true;
      }
    }

    if (levelError) {
      throw new Error(`A header can only be nested inside headers with level - 1. level=${level}, previousLevel=${outlinesLen-1}`);
    }
  }

  subHeader(str: string) {
    this.withStyle({ fillColor: this.style.color.subHeaders, font: this.style.font.main.bold, fontSize: this.style.font.baseSize }, () => {
      this.text(str, );
      this.lineBreak(this.headerGap);
    });
  }

  para(str: string): PdfWriter {
    this.text(str);
    this.lineBreak(this.paraGap);
    return this;
  }

  description(str: string) {
    this.text(str, { fillColor: this.style.color.secondary });
    this.lineBreak(0.5);
  }

  dataFields(dataFields: DataField[]) {
    const origX = this.doc.x;

    dataFields.forEach((field) => {
      const fieldName = `${field.name}${(field.required ?? true) ? '':'?'}`
      const fieldType = field.type?.text ? `${field.type?.text};`  : undefined;
      this.text(fieldName, {}, { continued: fieldType ? true : false });

      if (fieldType) {
        this.text(': ', {}, { continued: true });
        this.text(fieldType, { fillColor: this.style.color.highlight }, {
          goTo: field.type?.anchor, 
          underline: field.type?.anchor ? true : false
        });
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

  schemaType(typeName: string, contentType?: string) {
    if (contentType) {
      this.text('Content: ', {}, { continued: true });
      this.text(contentType, { fillColor: this.style.color.highlight }, { continued: true });
      this.text(' | ', {}, { continued: true });
    }
    this.text('Type: ', {}, { continued: true });
    this.text(typeName, { fillColor: this.style.color.highlight });
    this.lineBreak(this.paraGap);
  }

  objectSchema(dataFields: DataField[]) {
    this.text('{').indentStart();
    this.dataFields(dataFields);
    this.indentEnd().text('}');
  }

  example(name: string, body: string) {
    this.text(`Example "${name}":`, { font: this.style.font.main.bold });
    this.lineBreak(this.paraGap);
    this.text(body, { fillColor: this.style.color.secondary, fontSize: this.style.font.baseSize - 2, font: this.style.font.mono.bold });
  }

  enumValues(values: string[]) {
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
        } else {
          this.text(str, {}, { continued });
        }
      });
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
        this.withStyle({ fontSize: 9, fillColor: this.style.color.secondary }, () => {
          if (this.pageHeaderNodes[i]) {
            this.text(this.pageHeaderNodes[i], {}, { y: origTop / 2, align: 'right' });
          }
          this.text(`Page ${i} / ${pages.count - 1}`, {}, { y: this.doc.page.height - origBottom / 2, align: 'right' });
        });
      }
      
      doc.page.margins.top = origTop;
      doc.page.margins.bottom = origBottom;
    }

    doc.end();
  }

  private setStyle(style: ITextStyle) {
    this.doc.font(style.font!.face, style.font?.style || undefined).fontSize(style.fontSize).fillColor(style.fillColor);
  }

  private resetStyle() {
    this.styleStack = [];
    this.setStyle(this.baseStyle);
  }

  private withStyle(style: ITextStyle, fn: (style: ITextStyle) => void) {
    const newStyle = this.pushStyle(style);
    fn(newStyle);
    this.popStyle();
  }

  private pushStyle(style: ITextStyle): ITextStyle {
    const mergedStyle = { ...this.currentStyle(), ...style };
    mergedStyle.leftMargin = (this.currentStyle().leftMargin ?? 0) + (style.leftMargin ?? 0); // nested indent
    this.setStyle(mergedStyle);
    this.doc.x = mergedStyle.leftMargin;
    this.styleStack.push(mergedStyle);
    return mergedStyle;
  }

  private popStyle(): ITextStyle {
    this.styleStack.pop();
    const prevStyle = this.currentStyle();
    this.setStyle(prevStyle);
    this.doc.x = prevStyle.leftMargin;
    return prevStyle;
  }

  private currentStyle(): ITextStyle {
    return (this.styleStack.length > 0)
      ? this.styleStack[this.styleStack.length-1]
      : this.baseStyle;
  }
}
