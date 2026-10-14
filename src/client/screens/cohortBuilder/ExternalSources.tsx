'use client';
import { useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useDispatchAction, useInteractionState } from '@/src/client/interaction/hooks';
import type { CohortAction, CohortSource, CohortWorkspace } from '@/src/shared/cohort-builder/contracts';
import styles from './CohortBuilder.module.css';

export function ExternalSources() {
  const state=useInteractionState<CohortWorkspace>();const {data:session}=useSession();
  const dispatch=useDispatchAction<CohortAction>();
  const [capabilities,setCapabilities]=useState({pdf:false,web:false});
  const [file,setFile]=useState<File|null>(null);const [label,setLabel]=useState('');const [url,setUrl]=useState('');
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  const ticket=useRef<{requestId:string;revision:number;ownerId:string}|null>(null);
  useEffect(()=>{let active=true;const controller=new AbortController();
    void fetch(`/api/cohort-builder/workspaces/${state.workspaceId}/sources`,{signal:controller.signal,cache:'no-store'})
      .then(async response=>{if(response.ok && active) setCapabilities(await response.json());}).catch(()=>{});
    return()=>{active=false;controller.abort();};
  },[state.workspaceId]);
  async function upload() {
    if(!file || !session?.user?.id || busy) return;
    if(file.size>2*1024*1024){setError('PDF exceeds 2 MiB. Choose a smaller document.');return;}
    const attempt=ticket.current??{requestId:crypto.randomUUID(),revision:state.revision,ownerId:session.user.id};ticket.current=attempt;
    setBusy(true);setError('');
    try {
      const response=await fetch(`/api/cohort-builder/workspaces/${state.workspaceId}/pdf`,{method:'POST',body:file,
        headers:{'Content-Type':'application/pdf','Idempotency-Key':attempt.requestId,'X-Workspace-Revision':String(attempt.revision),
          'X-Owner-Id':attempt.ownerId,'X-Source-Label':encodeURIComponent(label.trim()||file.name)}});
      if(!response.ok){const result=await response.json();throw new Error(result.code??'UPLOAD_UNAVAILABLE');}
      ticket.current=null;setFile(null);setLabel('');
    } catch(problem) {setError(problem instanceof Error?problem.message:'UPLOAD_UNAVAILABLE');}
    finally {setBusy(false);}
  }
  return <div aria-label="PDF and web sources">
    {capabilities.pdf && <fieldset disabled={busy} className={styles.formField}><legend>Retain PDF</legend>
      <label htmlFor="builder-pdf-label">PDF title</label><input id="builder-pdf-label" value={label} onChange={event=>{setLabel(event.target.value);ticket.current=null;}} maxLength={300}/>
      <label htmlFor="builder-pdf">PDF file (2 MiB maximum)</label><input id="builder-pdf" type="file" accept="application/pdf,.pdf" onChange={event=>{setFile(event.target.files?.[0]??null);ticket.current=null;setError('');}}/>
      <p>Readable text only, up to 200 pages. No OCR. Scanned, encrypted, or partly unreadable documents are rejected. Unacknowledged files stay here until you leave this page.</p>
      <button disabled={!file} onClick={()=>void upload()}>{busy?'Uploading PDF…':'Add PDF source'}</button>
    </fieldset>}
    {capabilities.web && <fieldset disabled={busy} className={styles.formField}><legend>Retain public web page</legend>
      <label htmlFor="builder-web-url">Public HTTPS URL</label><input id="builder-web-url" type="url" value={url} onChange={event=>setUrl(event.target.value)} maxLength={2048}/>
      <p>Public HTTPS, UTF-8 HTML or text, at most 1 MiB. No logins, scripts, compressed responses, or exhaustive article-coverage guarantee.</p>
      <button disabled={!url.trim()} onClick={()=>{setBusy(true);void dispatch({type:'add_web_source',label:url.trim().slice(0,300),url:url.trim()}).then(saved=>{if(saved)setUrl('');}).finally(()=>setBusy(false));}}>Add web source</button>
    </fieldset>}
    {error && <div role="alert"><p>{error}. The selected file is retained; retry uses the same submission identity.</p>
      {error==='STALE_WORKSPACE' && <button onClick={()=>{ticket.current=null;setError('Review current workspace, then submit the retained file again.');}}>Use current revision for next attempt</button>}
    </div>}
  </div>;
}

export function ExternalSourceScope({source}:{source:CohortSource}) {
  const state=useInteractionState<CohortWorkspace>();
  const dispatch=useDispatchAction<CohortAction>();const [pages,setPages]=useState(source.input?.kind==='pdf'?source.input.pages?.join(',')??'':'');
  const [error,setError]=useState('');
  if(!source.input) return null;
  return <span>
    {state.view.processing.jobs?.some(job=>job.sourceId===source.id && ['queued','running','failed'].includes(job.status)) && <button onClick={()=>void dispatch({type:'cancel_source_processing',sourceId:source.id},[{kind:'source',id:source.id,version:source.version}])}>Stop {source.label} processing</button>}
    {state.view.processing.jobs?.some(job=>job.sourceId===source.id && job.status==='canceled') && <span> · Stopped. Change scope or remove this source to unblock curriculum assembly.</span>}
    {source.input.kind==='pdf'?<><label htmlFor={`pages-${source.id}`}>Physical pages (comma-separated)</label>
      <input id={`pages-${source.id}`} value={pages} onChange={event=>setPages(event.target.value)} placeholder="e.g. 1,2"/>
      <button onClick={()=>{const selected=pages.split(',').map(value=>Number(value.trim()));
        if(selected.some(page=>!Number.isInteger(page)||page<1||page>200)||new Set(selected).size!==selected.length){setError('Choose distinct physical pages from 1 to 200.');return;}
        void dispatch({type:'set_pdf_pages',sourceId:source.id,pages:selected},[{kind:'source',id:source.id,version:source.version}]).then(saved=>setError(saved?'':'Scope changed elsewhere. Your page selection is retained; review and retry.'));}}>Apply page scope</button></>
      :<><span> · {source.provenance?.scope??'acquisition pending'}</span><button onClick={()=>void dispatch({type:'refresh_web_source',sourceId:source.id},[{kind:'source',id:source.id,version:source.version}])}>Fetch a new web version</button></>}
    {error && <span role="alert">{error}</span>}
  </span>;
}
