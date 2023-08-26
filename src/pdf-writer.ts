import fs from 'fs';
import { debugLog, log } from './logger';
const PDFDocument = require('pdfkit');

interface TextStyle {
  font?: FontFace;
  fontSize?: number;
  fillColor?: string;
  indent?: number;
  gapBefore?: number;
  gapAfter?: number;
}

enum FontFace {
  NORM = 0,
  BOLD = 1,
  ITALIC = 2,
  BOLD_ITALIC = 3,
};

export class PdfWriter {
  private topRightText?: string;
  private doc;

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

  private paraGap = 4;
  private subHeaderGap = 6;
  private headerGap = 8;

  private baseStyle: TextStyle = {};

  constructor() {
    this.doc = new PDFDocument();

    const writeStream = fs.createWriteStream('output.pdf');
    this.doc.pipe(writeStream);

    this.baseStyle = {
      font: FontFace.NORM,
      fontSize: 12,
      fillColor: this.colorMain,
      indent: this.doc.x,
      gapBefore: 0,
      gapAfter: 0,
    };
  }

  newSection(name: string) {
    this.topRightText = name;
    this.resetStyle();
    this.doc.addPage();
  }

  header(level: number, text: string, anchor?: string) {
    const doc = this.doc;

    this.withStyle({ font: FontFace.NORM, fontSize: 18 - level * 2, gapBefore: this.headerGap + 2, gapAfter: this.headerGap }, () => {
      doc.text(text, { destination: anchor });
    });

    let newOutline;
    const outlinesLen = this.docOutlines.length;
    let headerLevelError = false;

    // debugLog(`header: level=${level}, text="${text}"`);

    if (level === 0) {
      newOutline = doc.outline.addItem(text);
    } else if (level > 0 && level <= outlinesLen) {
      newOutline = this.docOutlines[level - 1].addItem(text);
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

  subHeader(text: string) {
    this.withStyle({ font: FontFace.BOLD, fontSize: 12,  gapBefore: this.subHeaderGap + 2, gapAfter: this.subHeaderGap }, () => {
      this.doc.text(text);
    });
  }

  para(text: string) {
    this.withStyle({ gapBefore: this.paraGap + 2, gapAfter: this.paraGap }, () => {
      this.doc.text(text);
    });
  }

  dataField(fieldName: string, fieldType?: string, description?: string, typeAnchor?: string) {
    const doc = this.doc;
    this.withStyle({ indent: 12 }, () => {
      doc.text(fieldName, { continued: true });
      if (fieldType) {
        doc.text(': ', { continued: true });
        this.withStyle({ fillColor: this.colorAccent }, () => {
          doc.text(fieldType, { goTo: typeAnchor, underline: typeAnchor ? true : false });
        });
      }
    });
  }

  schemaType(typeName: string) {
    const doc = this.doc;
    doc.text('Type: ', { continued: true });
    this.withStyle({ fillColor: this.colorAccent }, () => {
      doc.text(typeName);
    });
  }

  enumValues(values: string[]) {
    values.forEach((value, index, array) => {
      const str = (index < array.length - 1) ? `${value}, ` : value;
      const continued = (index < array.length - 1) ? true : false;
      this.doc.text(str, { continued });
    });
  }

  comment(text: string) {
    this.withStyle({ fillColor: this.colorDisabled, indent: 12 }, () => {
      this.para(text);
    });
  }

  finish() {
    this.doc.end();
  }

  private setStyle(style: TextStyle) {
    this.doc.font(this.fonts[style.font ?? 0]).fontSize(style.fontSize).fillColor(style.fillColor);
  }

  private resetStyle() {
    this.styleStack = [];
    this.setStyle(this.baseStyle);
  }

  private withStyle(style: TextStyle, fn: (style: TextStyle) => void) {
    const pushedStyle = this.pushStyle(style);
    this.doc.x = pushedStyle.indent;
    this.doc.y += pushedStyle.gapBefore;
    fn(pushedStyle);
    this.doc.y += pushedStyle.gapAfter;
    const popedStyle = this.popStyle();
    this.doc.x = popedStyle.indent;
  }

  private pushStyle(style: TextStyle): TextStyle {
    const mergedStyle = { ...this.currentStyle(), ...style};
    mergedStyle.indent = (this.currentStyle().indent ?? 0) + (style.indent ?? 0); // nested indent
    this.setStyle(mergedStyle);
    this.styleStack.push(mergedStyle);
    return mergedStyle;
  }

  private popStyle(): TextStyle {
    this.styleStack.pop();
    const style = this.currentStyle();
    this.setStyle(style);
    return style;
  }

  private currentStyle(): TextStyle {
    return (this.styleStack.length > 0)
      ? this.styleStack[this.styleStack.length-1]
      : this.baseStyle;
  }
}
