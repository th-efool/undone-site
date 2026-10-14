/** Real, ASCII-only PDF fixture; accurate xref byte offsets, no parser mocking. */
export function sourcePdf(pages:string[]) {
  const objects=['<< /Type /Catalog /Pages 2 0 R >>',`<< /Type /Pages /Kids [${pages.map((_,i)=>`${4+i*2} 0 R`).join(' ')}] /Count ${pages.length} >>`,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  for(const [i,text] of pages.entries()) {
    const stream=text?`BT /F1 12 Tf 50 700 Td (${text.replace(/[\\()]/g,'\\$&')}) Tj ET`:'';
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5+i*2} 0 R >>`,`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
  }
  let document='%PDF-1.4\n';const offsets=[0];
  objects.forEach((object,i)=>{offsets.push(Buffer.byteLength(document));document+=`${i+1} 0 obj\n${object}\nendobj\n`;});
  const xref=Buffer.byteLength(document);
  document+=`xref\n0 ${offsets.length}\n0000000000 65535 f \n${offsets.slice(1).map(offset=>`${String(offset).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(document);
}
