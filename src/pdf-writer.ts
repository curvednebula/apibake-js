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

  private colorMain = 'black';
  private colorAccent = 'blue';
  private colorDisabled = 'grey';

  private baseFontSize = 10;
  private paraGap = this.baseFontSize / 3;
  private subHeaderGap = this.baseFontSize / 2;
  private headerGap = this.baseFontSize + 4;
  private indentStep = 12;

  private margins = {
    horizontal: 70,
    vertical: 50
  };

  private baseStyle: TextStyle = {
    font: EFont.NORM,
    fontSize: this.baseFontSize,
    fillColor: this.colorMain,
    leftMargin: this.margins.horizontal,
    lineGap: 0,
  };


  constructor(outputFilePath: string) {
    this.doc = new PDFDocument({ 
      bufferPages: true, 
      autoFirstPage: false, 
      margins:  {
        left: this.margins.horizontal,
        right: this.margins.horizontal,
        top: this.margins.vertical,
        bottom: this.margins.vertical
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
      this.styledText(date, { font: EFont.NORM, fontSize: 12, fillColor: this.colorDisabled }, { align: 'center' });
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
    const doc = this.doc;

    this.styledText(str, 
      { font: EFont.BOLD, fontSize: this.baseFontSize + 4 - level * 2, lineGap: this.headerGap - level * 3 }, 
      { destination: anchor }
    );

    let newOutline;
    const outlinesLen = this.docOutlines.length;
    let headerLevelError = false;

    // debugLog(`header: level=${level}, text="${text}"`);

    if (level === 0) {
      newOutline = doc.outline.addItem(str);
    } else if (level > 0 && level <= outlinesLen) {
      newOutline = this.docOutlines[level - 1].addItem(str);
    } else {
      headerLevelError = true;
    }
    
    if (!headerLevelError) {
      if (level === outlinesLen) {
        this.docOutlines.push(newOutline);
      } else if (level < outlinesLen) {
        this.docOutlines[level] = newOutline;
        this.docOutlines.splice(level + 1); // remore remainings
      } else if (level > outlinesLen) {
        headerLevelError = true;
      }
    }

    if (headerLevelError) {
      throw new Error(`A header can only be nested inside headers with level - 1. level=${level}, previousLevel=${outlinesLen-1}`);
    }
  }

  subHeader(str: string) {
    this.styledText(str, { font: EFont.BOLD, fontSize: this.baseFontSize,  lineGap: this.subHeaderGap });
  }

  indentStart(): PdfWriter {
    this.pushStyle({ leftMargin: this.indentStep });
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
    this.styledText(str, { fillColor: this.colorDisabled }, options);
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
      const fieldType = field.type?.text;
      this.text(fieldName, { continued: fieldType ? true : false });

      if (fieldType) {
        this.text(': ', { continued: true });
        this.styledText(fieldType, { fillColor: this.colorAccent }, {
          goTo: field.type?.anchor, 
          underline: field.type?.anchor ? true : false
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

  object(dataFields: DataField[]) {
    this.text('{').indentStart();
    this.dataFields(dataFields);
    this.indentEnd().text('}');
  }

  schemaType(typeName: string) {
    this.text('Type: ', { continued: true });
    this.styledText(typeName, { fillColor: this.colorAccent });
  }

  enumValues(values: string[]) {
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
          this.text(`Page ${i} / ${pages.count - 1}`, { y: this.doc.page.height - origBottom / 2, align: 'right' });
        });
      }
      
      doc.page.margins.top = origTop;
      doc.page.margins.bottom = origBottom;
    }

    doc.end();
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
