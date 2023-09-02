"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
function pdfKitTest() {
    const PDFDocument = require('pdfkit-table');
    const doc = new PDFDocument({ bufferPages: true, autoFirstPage: false });
    const writeStream = fs_1.default.createWriteStream("test.pdf");
    doc.pipe(writeStream);
    doc.addPage();
    doc.text('This is start of the text.');
    doc.x = doc.page.margins.left;
    doc.text('And this is after doc.x = margins.left\nNew line goes here.');
    doc.text('Another new line.');
    doc.text('This is very long line that will wrap. This is very long line that will wrap. This is very long line that will wrap. This is very long line that will wrap. This is very long line that will wrap.');
    doc.x = doc.page.margins.left + 20;
    doc.text('And this is after doc.x + 20\nNew line goes here.');
    doc.text('Another new line.');
    doc.text('This is very long line that will wrap. This is very long line that will wrap. This is very long line that will wrap. This is very long line that will wrap. This is very long line that will wrap.');
    doc.x = doc.page.margins.left + 40;
    doc.text('And this is after doc.x + 40\nNew line goes here.');
    const y = doc.y;
    doc.text('Will continue after this line. ');
    doc.moveUp();
    doc.x += doc.widthOfString('Will continue after this line. ');
    doc.text('This is very long line that will wrap. This is very long line that will wrap. This is very long line that will wrap. This is very long line that will wrap. This is very long line that will wrap.');
    doc.text('This is very long line that will wrap. This is very long line that will wrap. This is very long line that will wrap. This is very long line that will wrap. This is very long line that will wrap.', doc.x + 20, doc.y);
    doc.text('This is very long line that will wrap. This is very long line that will wrap. This is very long line that will wrap. This is very long line that will wrap. This is very long line that will wrap.', { indent: 20 });
    // doc.x = doc.page.margins.left + 50;
    // ;(async function createTable(){
    //   const table = {
    //     // title: "Title",
    //     // subtitle: "Subtitle",
    //     headers: [ "Country", "Conversion rate", "Trend" ],
    //     rows: [
    //       [ "Switzerland", "12%", "+1.12%" ],
    //       [ "France", "67%", "-0.98%" ],
    //       [ "England", "33%", "+4.44%" ],
    //       [ "Switzerland", "12%", "+1.12%" ],
    //       [ "France", "67%", "-0.98%" ],
    //       [ "England", "33%", "+4.44%" ],
    //       [ "Switzerland", "12%", "+1.12%" ],
    //       [ "France", "67%", "-0.98%" ],
    //       [ "England", "33%", "+4.44%" ],
    //       [ "Switzerland", "12%", "+1.12%" ],
    //       [ "France", "67%", "-0.98%" ],
    //       [ "England", "33%", "+4.44%" ],
    //       [ "Switzerland", "12%", "+1.12%" ],
    //       [ "France", "67%", "-0.98%" ],
    //       [ "England", "33%", "+4.44%" ],
    //       [ "Switzerland", "12%", "+1.12%" ],
    //       [ "France", "67%", "-0.98%" ],
    //       [ "England", "33%", "+4.44%" ],
    //     ],
    //   };
    //   await doc.table(table, {
    //     divider: {
    //       header: { disabled: true, width: 0.5, opacity: 0.5 },
    //       horizontal: { disabled: true, width: 0.5, opacity: 0.5 },
    //     },
    //     hideHeader: true,
    //     // width: 300
    //     // columnsSize: [ 200, 100, 100 ],
    //   });
    // })();
    doc.end();
}
function mdToPdfTest() {
    const markdownpdf = require("markdown-pdf");
    // fs.createReadStream("/path/to/document.md")
    //   .pipe(markdownpdf())
    //   .pipe(fs.createWriteStream("/path/to/document.pdf"))
    markdownpdf().from("test-data/test.md").to("test.pdf", () => {
        console.log("Done");
    });
}
pdfKitTest();
