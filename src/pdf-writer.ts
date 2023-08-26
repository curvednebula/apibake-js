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
    this.doc.text(' ', { fontSize: 20, lineGap: 20 });
    this.doc.fillColor('black').text(text, { fontSize: 20, lineGap: 20 });
    this.doc.outline.addItem(text);
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

  addVariable(name: string, type?: string, description?: string, anchor?: string) {
    const doc = this.doc;
    doc.fillColor('blue').text(name, { fontSize: 12, continued: true });
    if (type) {
      doc.fillColor('grey').text(type, { fontSize: 12 });
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
