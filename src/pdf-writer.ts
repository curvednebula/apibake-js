import fs from 'fs';
import { getEnabledCategories } from 'trace_events';
import { debugLog, log } from './logger';
const PDFDocument = require('pdfkit');

export class PdfWriter {
  private topRightText?: string;
  private doc;

  private docOutlines: any[] = [];

  constructor() {
    this.doc = new PDFDocument();

    const writeStream = fs.createWriteStream('output.pdf');
    this.doc.pipe(writeStream);
  }

  newSection(name: string) {
    this.topRightText = name;
    this.doc.addPage();
  }

  header(level: number, text: string, anchor?: string) {
    const doc = this.doc;
    doc.text(' ', { lineGap: 16 });
    doc.fontSize(18 - level * 2).fillColor('black');
    doc.text(text, { lineGap: 16, destination: anchor });
    doc.fontSize(12);

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
    this.doc.fillColor('black').text(text, { fontSize: 16 });
  }

  para(text: string) {
    this.doc.fillColor('black').text(text, { fontSize: 12 });
  }

  dataField(fieldName: string, fieldType?: string, description?: string, typeAnchor?: string) {
    const doc = this.doc;
    doc.fillColor('black').text(fieldName, { indent: 12, continued: true });
    if (fieldType) {
      doc.text(': ', { continued: true });
      doc.fillColor('blue').text(fieldType, { goTo: typeAnchor, underline: typeAnchor ? true : false });
    }
  }

  schemaType(typeName: string) {
    const doc = this.doc;
    doc.fillColor('black').text('Type: ', { continued: true });
    doc.fillColor('blue').text(typeName);
  }

  enumValues(values: string[]) {
    const doc = this.doc;
    doc.fillColor('black');
    values.forEach((value, index, array) => {
      const str = (index < array.length - 1) ? `${value}, ` : value;
      const continued = (index < array.length - 1) ? true : false;
      doc.text(str, { fontSize: 12, continued });
    });
  }

  comment(text: string) {
    this.doc.fillColor('grey').text(text, { fontSize: 12 });
  }

  finish() {
    this.doc.end();
  }
}
