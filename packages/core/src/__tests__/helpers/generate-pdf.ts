import PDFDocument from 'pdfkit';

export function generateItauCartaoPdf(lines: string[]): Promise<Buffer> {
  return new Promise((resolve) => {
    const doc = new PDFDocument();
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    doc.text('ITAUUNIBANCOHOLDINGS.A.');
    doc.text('Cartão final 9999');
    for (const line of lines) {
      doc.text(line);
    }
    doc.end();
  });
}
