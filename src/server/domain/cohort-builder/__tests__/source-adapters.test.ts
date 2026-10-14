import { createHash, randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { extractRetainedSource, fetchRetainedWeb, sourceExtractionSchema } from '../source-adapters';
import type { WebTransport } from '../../cohort-creation/materials/web-fetch';
import { cohortSourceSchema } from '@/src/shared/cohort-builder/contracts';
import type { TextArtifactRef } from '../text-artifacts';

const url = 'https://docs.example.org/lesson';
function source(kind:'pdf'|'web') {
  return cohortSourceSchema.parse({id:randomUUID(),version:0,label:'Retained lesson',text:'',state:'queued',checksum:'a'.repeat(64),
    input:kind==='pdf'?{kind,uploadId:randomUUID()}:{kind,url}});
}
function ref(bytes:Uint8Array):TextArtifactRef {
  return {id:randomUUID(),workspaceId:randomUUID(),sourceId:null,sourceVersion:null,kind:'source_raw',
    inputFingerprint:'a'.repeat(64),checksum:createHash('sha256').update(bytes).digest('hex'),byteLength:bytes.length};
}
function transport(body=Buffer.from('Quorum overlap prevents conflicting decisions.')) {
  const close = vi.fn();
  const open = vi.fn(async()=>({status:200,headers:{'content-type':'text/plain'},bytes:(async function*(){yield body;})(),close}));
  const resolve = vi.fn(async()=>[{address:'93.184.216.34',family:4}]);
  return {open,resolve,close} satisfies WebTransport & {close:ReturnType<typeof vi.fn>};
}
function pdf(pages:string[]) {
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
describe('bounded retained source adapters',()=>{
  it('extracts real PDF pages and applies explicit physical page scope',async()=>{
    const bytes=pdf(['Quorum overlap prevents conflict.','Majority voting provides overlap.']);const input=source('pdf');
    const result=await extractRetainedSource(input,ref(bytes),bytes);
    expect(result.locations.map(item=>item.page)).toEqual([1,2]);
    expect(result.text).toBe('Quorum overlap prevents conflict.\n\nMajority voting provides overlap.');
    input.input={kind:'pdf',uploadId:randomUUID(),pages:[2]};
    const selected=await extractRetainedSource(input,ref(bytes),bytes);
    expect(selected.text).toBe('Majority voting provides overlap.');expect(selected.locations[0].page).toBe(2);
    input.input.pages=[3];await expect(extractRetainedSource(input,ref(bytes),bytes)).rejects.toThrow('INVALID_PDF_SCOPE');
  });
  it('rejects malformed, scanned and oversized PDFs honestly',async()=>{
    for(const bytes of [Buffer.from('%PDF-1.7 broken'),pdf([''])]) await expect(extractRetainedSource(source('pdf'),ref(bytes),bytes)).rejects.toThrow('PDF_UNREADABLE');
    const bytes=Buffer.alloc(2*1024*1024+1);await expect(extractRetainedSource(source('pdf'),ref(bytes),bytes)).rejects.toThrow('PDF_SIZE_LIMIT');
  });
  it('retains a response once and reparses it without any further network calls',async()=>{
    const network=transport();const bytes=await fetchRetainedWeb(url,network);const input=source('web');
    const result=await extractRetainedSource(input,ref(bytes),bytes);
    expect(result.text).toBe('Quorum overlap prevents conflicting decisions.');
    expect(result.provenance.scope).toBe('full_text_response');expect(result.provenance.finalUrl).toBe(url);
    expect(await extractRetainedSource(input,ref(bytes),bytes)).toEqual(result);
    expect(network.open).toHaveBeenCalledOnce();expect(network.close).toHaveBeenCalled();
    const other=source('web');other.input={kind:'web',url:'https://docs.example.org/foreign'};
    await expect(extractRetainedSource(other,ref(bytes),bytes)).rejects.toThrow('FOREIGN_WEB_RESPONSE');
    await expect(extractRetainedSource(input,{...ref(bytes),checksum:'0'.repeat(64)},bytes)).rejects.toThrow('RETAINED_SOURCE_INTEGRITY');
  });
  it('isolates HTML extraction without executing scripts or loading resources',async()=>{
    const network=transport(Buffer.from(`<html><body><article><h1>Quorum overlap</h1><p>${'A majority overlaps every other majority, preventing contradictory committed decisions. '.repeat(5)}</p></article><script>throw new Error('executed')</script><img src="https://tracker.example.org/pixel"></body></html>`));
    network.open.mockImplementation(async()=>({status:200,headers:{'content-type':'text/html'},bytes:(async function*(){yield Buffer.from(`<article><p>${'Majorities overlap to prevent conflicting decisions. '.repeat(10)}</p></article><script>throw 1</script>`);})(),close:network.close}));
    const bytes=await fetchRetainedWeb(url,network);const result=await extractRetainedSource(source('web'),ref(bytes),bytes);
    expect(result.provenance.scope).toBe('main_article');expect(result.text).not.toContain('throw');
  });
  it.each(['https://127.0.0.1/','https://[::1]/','https://169.254.169.254/','https://user:password@docs.example.org/','http://docs.example.org/'])('rejects unsafe URL %s before opening',async unsafe=>{
    const network=transport();await expect(fetchRetainedWeb(unsafe,network)).rejects.toThrow('WEB_SOURCE_REJECTED');expect(network.open).not.toHaveBeenCalled();
  });
  it('rejects DNS rebinding on redirects before contacting the changed address',async()=>{
    const network=transport();network.resolve.mockResolvedValueOnce([{address:'93.184.216.34',family:4}]).mockResolvedValueOnce([{address:'10.0.0.1',family:4}]);
    network.open.mockImplementation(async()=>({status:302,headers:{'content-type':'text/plain',location:'/redirect'},bytes:(async function*(){})(),close:network.close}));
    await expect(fetchRetainedWeb(url,network)).rejects.toThrow('WEB_SOURCE_REJECTED');expect(network.open).toHaveBeenCalledOnce();expect(network.close).toHaveBeenCalledOnce();
  });
  it('closes an oversized streamed response without retaining a partial success',async()=>{
    const network=transport(Buffer.alloc(1024*1024+1));await expect(fetchRetainedWeb(url,network)).rejects.toThrow('WEB_RESPONSE_SIZE_LIMIT');expect(network.close).toHaveBeenCalled();
  });
  it('extracts retained GitHub source and handles file scope',async()=>{
    const retainedData = {
      format: 'github-source-v1',
      acquiredAt: '2026-10-14T00:00:00.000Z',
      repo: { owner: 'facebook', repo: 'react', url: 'https://github.com/facebook/react' },
      ref: 'main',
      commitSha: '1234567890abcdef1234567890abcdef12345678',
      files: [
        { path: 'README.md', content: 'Intro to React', size: 14, checksum: 'b'.repeat(64) },
        { path: 'docs/arch.md', content: 'Architecture details', size: 20, checksum: 'c'.repeat(64) },
      ],
    };
    const bytes = Buffer.from(JSON.stringify(retainedData));
    const ghSource = cohortSourceSchema.parse({
      id: randomUUID(),
      version: 0,
      label: 'React repo',
      text: '',
      state: 'queued',
      checksum: 'a'.repeat(64),
      input: { kind: 'github', repoUrl: 'https://github.com/facebook/react', ref: 'main', paths: ['README.md'] },
    });
    const result = await extractRetainedSource(ghSource, ref(bytes), bytes);
    expect(result.text).toContain('Intro to React');
    expect(result.text).not.toContain('Architecture details');
    expect(result.locations[0].filePath).toBe('README.md');
    expect(result.provenance.scope).toBe('selected_files');
  });
  it('rejects incomplete or overlapping location coverage',()=>{
    const result={format:'cohort-extraction-v1',text:'abcdef',locations:[{start:1,end:6}],provenance:{parserVersion:'test',rawChecksum:'a'.repeat(64),scope:'full_text_response'}};
    expect(sourceExtractionSchema.safeParse(result).success).toBe(false);
  });
});

