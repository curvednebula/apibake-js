import fs from 'fs';
import { OpenApiParser } from './openapi-parser';
import { PdfWriter } from './pdf-writer';

const inputJson = fs.readFileSync('test-data/domain.json', 'utf8');

const parser = new OpenApiParser(new PdfWriter(), true);
parser.writeToDoc(inputJson);
parser.finalizeDoc();


// const PDFDocument = require('pdfkit');

// const doc = new PDFDocument();

// const writeStream = fs.createWriteStream('output.pdf');
// doc.pipe(writeStream);

// const { outline } = doc;

// doc.text('Chapter 1 Content');
// outline.addItem('Chapter 1', { fontSize: 18 });

// doc.text('Goto Destination', { goTo: 'ENDP', underline: true });

// for (let i=0; i<100; i++) {
//   doc.text(`Line ${i}`, 100);
// }

// doc.addPage();
// doc.text('Chapter 2', { fontSize: 18 });
// const chapter2 = outline.addItem('Chapter 2');

// doc.addPage();
// doc.text('Chapter 2.1 Content', { fontSize: 16 });
// chapter2.addItem('Chapter 2.1');

// for (let i=0; i<10; i++) {
//   doc.text(`Line ${i}`, 100);
// }

// doc.text('Jump HERE!', { destination: 'ENDP' });

// for (let i=0; i<100; i++) {
//   doc.text(`Line ${i}`, 100);
// }

// doc.text('Very long long long long long long long long long long long long long long long long long long long long long long long long long long longlong long long long long long long long longlong long long long long longlong long line,', 200);

// doc.end();
