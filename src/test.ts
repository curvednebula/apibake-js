import fs from 'fs';
const PDFDocument = require('pdfkit');

const doc = new PDFDocument({ bufferPages: true, autoFirstPage: false });

const writeStream = fs.createWriteStream("test.pdf");
doc.pipe(writeStream);

doc.addPage();
doc.text('This is start of the text.');
doc.x = doc.page.margins.left;
doc.text('And this is after doc.x = margins.left\nNew line goes here.');
doc.text('Another new line.');
doc.text('This is very long line that will wrap. This is very long line that will wrap. This is very long line that will wrap. This is very long line that will wrap. This is very long line that will wrap.');
doc.x = doc.page.margins.left + 50;
doc.text('And this is after doc.x + 50\nNew line goes here.');
doc.text('Another new line.');
doc.text('This is very long line that will wrap. This is very long line that will wrap. This is very long line that will wrap. This is very long line that will wrap. This is very long line that will wrap.');
doc.x = doc.page.margins.left + 100;
doc.text('And this is after doc.x + 100\nNew line goes here.');
doc.text('Will continue after this line. ', { continued: true });
doc.x = doc.x + 50;
doc.text('This is very long line that will wrap. This is very long line that will wrap. This is very long line that will wrap. This is very long line that will wrap. This is very long line that will wrap.');
doc.text('This is very long line that will wrap. This is very long line that will wrap. This is very long line that will wrap. This is very long line that will wrap. This is very long line that will wrap.', doc.x + 50, doc.y);
doc.text('This is very long line that will wrap. This is very long line that will wrap. This is very long line that will wrap. This is very long line that will wrap. This is very long line that will wrap.', { indent: 50 });
doc.end();