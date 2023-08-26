import fs from 'fs';
const PDFDocument = require('pdfkit');

export class PdfWriter {
  topRightText?: string;

  private doc;

  constructor() {
    this.doc = new PDFDocument();

    const writeStream = fs.createWriteStream('output.pdf');
    this.doc.pipe(writeStream);
  }

  addHeader(level: number, text: string, anchor?: string) {
    const doc = this.doc;
    doc.text(' ', { fontSize: 20, lineGap: 20 });
    doc.fontSize(20).fillColor('black');
    doc.text(text, { lineGap: 20, destination: anchor });
    doc.fontSize(12);
    doc.outline.addItem(text);
  }

  addSubHeader(text: string) {
    this.doc.text(text, { fontSize: 16 });
  }

  addPara(text: string) {
    this.doc.text(text, { fontSize: 12 });
  }

  addSchemaType(text: string) {
    this.doc.text(text, { fontSize: 12 });
  }

  addVariable(varName: string, varType?: string, description?: string, typeAnchor?: string) {
    const doc = this.doc;
    doc.fillColor('black').text(varName, { indent: 12, continued: true });
    if (varType) {
      doc.text(': ', { continued: true });
      doc.fillColor('blue').text(varType, { goTo: typeAnchor, underline: typeAnchor ? true : false });
    }
  }

  addEnumValues(values: string[]) {
    values.forEach((value, index, array) => {
      const str = (index < array.length - 1) ? `${value}, ` : value;
      const continued = (index < array.length - 1) ? true : false;
      this.doc.text(str, { fontSize: 12, continued });
    });
  }

  addComment(text: string) {
    this.doc.fillColor('grey').text(text, { fontSize: 12 });
  }

  flush() {
    this.doc.end();
  }
}
