import fs from 'fs';
import { DataField, SchemaRef } from './openapi-parser';
const PDFDocument = require('pdfkit');

interface TextStyle {
  font?: EFont;
  fontSize?: number;
  fillColor?: string;
  leftMargin?: number;
  lineGap?: number;
}

interface TextOptions {
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

enum EFont {
  NORM = 0,
  BOLD = 1,
  ITALIC = 2,
  BOLD_ITALIC = 3,
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
    },
    font: {
      baseSize: 10,
    },
    format: {
      indentStep: 12,
      horizontalMargin: 70,
      verticalMargin: 50
    }
  }

  private doc;

  private currentSectionName = '';

  private pageNumber = 0;
  private pageHeaderNodes: string[] = []; 

  private docOutlines: any[] = [];
  private styleStack: TextStyle[] = [];

  private fonts = [
    'Helvetica',
    'Helvetica-Bold',
    'Helvetica-Oblique',
    'Helvetica-BoldOblique'
  ];

  // calculated in applyStyle()
  private paraGap = 0;
  private subHeaderGap = 0;
  private headerGap = 0;

  private baseStyle: TextStyle = {
    font: EFont.NORM,
    fontSize: this.style.font.baseSize,
    fillColor: this.style.color.main,
    leftMargin: this.style.format.horizontalMargin,
    lineGap: 0,
  };

  constructor(outputFilePath: string, style?: any) {
    if (style) {
      this.style = style; // external style
    }
    this.applyStyle();

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

    const writeStream = fs.createWriteStream(outputFilePath);
    this.doc.pipe(writeStream);

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
    this.styledText(title, { font: EFont.BOLD, fontSize: 20 }, { align: 'center' });
    this.lineBreak(1);
    
    if (subtitle) {
      this.styledText(subtitle, { font: EFont.NORM, fontSize: 14 }, { align: 'center' });
      this.lineBreak(0.5);
    }
    
    if (date) {
      this.styledText(date, { font: EFont.NORM, fontSize: 12, fillColor: this.style.color.secondary }, { align: 'center' });
    }
  }

  newSection(name: string) {
    this.currentSectionName = name;
    this.resetStyle();
    this.doc.addPage();
  }

  text(str: string, options?: TextOptions): PdfWriter {
    const style = this.currentStyle();
    const styledOpt = { lineGap: style.lineGap, ...options };
    
    const absolutePos = styledOpt.x !== undefined || styledOpt.y !== undefined;

    // debugLog(`text: ${str}, options: ${JSON.stringify(styledOpt)}`);

    if (absolutePos) {
      this.doc.text(str, styledOpt.x ?? this.doc.x, styledOpt.y ?? this.doc.y, styledOpt);
    } else {
      this.doc.text(str, styledOpt);
    }
    return this;
  }

  styledText(str: string, style: TextStyle, options?: TextOptions) {
    this.withStyle(style, () => this.text(str, options));
  }

  header(level: number, str: string, anchor?: string) {
    this.styledText(str, 
      { fillColor: this.style.color.headers, font: EFont.BOLD, fontSize: this.style.font.baseSize + 4 - level * 2, lineGap: this.headerGap - level * 3 }, 
      { destination: anchor }
    );
    this.addOutline(level, str);
  }

  apiMethod(method: string, endpoint: string, headerLevel: number) {
    this.withStyle({ font: EFont.BOLD, fontSize: this.style.font.baseSize + 2, lineGap: this.headerGap - headerLevel * 3 }, () => {
      this.styledText(method, { fillColor: this.style.color.highlight }, { continued: true });
      this.styledText(` ${endpoint}`, { fillColor: this.style.color.headers });
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
    this.styledText(str, { fillColor: this.style.color.subHeaders, font: EFont.BOLD, fontSize: this.style.font.baseSize,  lineGap: this.subHeaderGap });
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

  para(str: string): PdfWriter {
    this.styledText(str, { lineGap: this.paraGap });
    return this;
  }

  description(str: string, options?: TextOptions) {
    this.styledText(str, { fillColor: this.style.color.secondary }, options);
  }

  dataFields(dataFields: DataField[]) {
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
      const fieldName = `${field.name}${(field.required ?? true) ? '':'?'}`
      const fieldType = field.type?.text ? `${field.type?.text};`  : undefined;
      this.text(fieldName, { continued: fieldType ? true : false });

      if (fieldType) {
        this.text(': ', { continued: true });
        this.styledText(fieldType, { fillColor: this.style.color.highlight }, {
          goTo: field.type?.anchor, 
          underline: field.type?.anchor ? true : false
        });
      }

      if (field.description) {
        this.doc.moveUp();
        let nameAndType = fieldName + (fieldType ? `: ${fieldType}` : '');
        this.styledText(`  // ${field.description}`, { fillColor: this.style.color.secondary }, { 
          x: origX + this.style.format.indentStep, 
          indent: this.doc.widthOfString(nameAndType) - this.style.format.indentStep 
        });
      }
      this.doc.x = origX;
    });
  }

  object(dataFields: DataField[]) {
    this.text('{').indentStart();
    this.dataFields(dataFields);
    this.indentEnd().text('}');
  }

  schemaType(typeName: string, contentType?: string) {
    if (contentType) {
      this.text('Content: ', { continued: true });
      this.styledText(contentType, { fillColor: this.style.color.highlight }, { continued: true });
      this.text(' | ', { continued: true });
    }
    this.text('Type: ', { continued: true });
    this.styledText(typeName, { fillColor: this.style.color.highlight });
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
          this.text(str, { x: nextLineIndent, indent, continued });
        }
        this.text(str, { continued });
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
        this.withStyle({ font: EFont.NORM, fontSize: 9, fillColor: this.style.color.secondary }, () => {
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

  private applyStyle() {
    this.paraGap = this.style.font.baseSize / 3;
    this.subHeaderGap = this.style.font.baseSize / 2;
    this.headerGap = this.style.font.baseSize + 4;
  }

  private setStyle(style: TextStyle) {
    this.doc.font(this.fonts[style.font ?? 0]).fontSize(style.fontSize).fillColor(style.fillColor);
  }

  private resetStyle() {
    this.styleStack = [];
    this.setStyle(this.baseStyle);
  }

  private withStyle(style: TextStyle, fn: (style: TextStyle) => void) {
    const newStyle = this.pushStyle(style);
    fn(newStyle);
    this.popStyle();
  }

  private pushStyle(style: TextStyle): TextStyle {
    const mergedStyle = { ...this.currentStyle(), ...style };
    mergedStyle.leftMargin = (this.currentStyle().leftMargin ?? 0) + (style.leftMargin ?? 0); // nested indent
    this.setStyle(mergedStyle);
    this.doc.x = mergedStyle.leftMargin;
    this.styleStack.push(mergedStyle);
    return mergedStyle;
  }

  private popStyle(): TextStyle {
    this.styleStack.pop();
    const prevStyle = this.currentStyle();
    this.setStyle(prevStyle);
    this.doc.x = prevStyle.leftMargin;
    return prevStyle;
  }

  private currentStyle(): TextStyle {
    return (this.styleStack.length > 0)
      ? this.styleStack[this.styleStack.length-1]
      : this.baseStyle;
  }
}
