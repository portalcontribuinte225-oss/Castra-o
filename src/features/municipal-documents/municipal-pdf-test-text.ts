import { PDFArray, PDFDocument, PDFRawStream, decodePDFRawStream } from "pdf-lib";

// For the tests of the documents: the texts drawn on each page of a PDF written with the standard fonts, in drawing order.
export async function pdfPagesText(bytes: Uint8Array): Promise<string[][]> {
  const pdf = await PDFDocument.load(bytes);
  return pdf.getPages().map((page) => {
    const contents = page.node.Contents();
    const streams = contents instanceof PDFArray ? contents.asArray().map((entry) => pdf.context.lookup(entry)) : [contents];
    return streams.flatMap((entry) => {
      if (!(entry instanceof PDFRawStream)) return [];
      const operators = new TextDecoder().decode(decodePDFRawStream(entry).decode());
      return Array.from(operators.matchAll(/<([a-f\d]+)> Tj/gi), ([, hex]) => {
        const data = Uint8Array.from(hex.match(/../g) || [], (value) => Number.parseInt(value, 16));
        return new TextDecoder("windows-1252").decode(data);
      });
    });
  });
}

export function dataUrlBytes(dataUrl: string): Uint8Array {
  return Uint8Array.from(atob(dataUrl.split(",")[1] || ""), (character) => character.charCodeAt(0));
}
