# Cohort material intake revision

## A. Execution contract
Baseline cf30f62580d44c65fde2c28fabbe7226420b78ea; root D:/ThisPC/Documents/SideQuestHQ/undone-site; PowerShell; Node24/npm. Original redesign now has complete proposed source payloads. Overall readiness remains BLOCKED pending test migration and the separate G incident. Do not deploy this draft. Preserve unrelated work. Full-file replacements below require exact SHA256 match using Get-FileHash -Algorithm SHA256. If mismatched stop dependent steps; do not overwrite newer edits.

## B. Requirements and acceptance
R1: two choices, merged goal search, explicit candidate selection. R2: URL first/default. R3: compact input with disabled file/text. R4: previews above input. R5: sticky upper-right Continue. R6: short preview with delete only, no queued/replace. R7: remove obsolete copy/accounts/technical accordion. Source handlers retain playlist support and downstream pipeline contracts. Existing files remain readable. G covers processing completion separately.

Observed causes: MaterialStageView mounts a large file-mode panel by default and places material list after it, then places Continue after another accordion. SourceItemRow combines source preview with processing controls. Starting point definitions expose separate persisted branches; Discovery automatically selects all results. These are structural composition and state-model problems, not merely color/spacing problems.

Design: rebuild collection component; reuse acquisition handlers and durable discovery actions; keep persisted legacy enum decoding. New goal UI collects the goal and reviews search candidates. It never silently adds all candidates. No dependencies or schema migration.

## C. Manifest
- S1: replace src/client/screens/cohortBuilder/stages/MaterialStageView.tsx
- S2: replace src/client/screens/cohortBuilder/stages/MaterialStageView.module.css
- S3: replace src/client/screens/cohortBuilder/stages/DiscoveryStageView.tsx
- S4: replace src/client/screens/cohortCreation/components/StartingPoint.tsx
- S5: replace src/client/screens/cohortCreation/components/StartingPoint.module.css
- S6: replace src/client/screens/cohortBuilder/CohortWorkspacePane.tsx
- S7: replace src/shared/cohort-builder/contracts.ts

## D. Exact implementation payloads

### S1
Target: `src/client/screens/cohortBuilder/stages/MaterialStageView.tsx`. Prerequisites: earlier steps. Original raw-byte SHA256: `26c5661effefa524e8207204f0477cccf6d42c51767487f84dd056b5e0850af4`. Replace entire file with:

```tsx
'use client';
import React, { useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { CohortAction, CohortSource, CohortWorkspace } from '@/src/shared/cohort-builder/contracts';
import type { EntityRef } from 'interaction-builder/core';
import { singleYoutubeVideo } from '@/src/shared/cohort-builder/youtube-transcript';
import { extractWebClient } from '@/src/client/lib/sourceExtractors/webClientExtractor';
import { extractYoutubeClient } from '@/src/client/lib/sourceExtractors/youtubeClientExtractor';
import styles from './MaterialStageView.module.css';
export interface MaterialStageViewProps {
 workspace: CohortWorkspace; workspaceId?: string; revision?: number; ownerId?: string;
 dispatchAction: (action: CohortAction, expected?: EntityRef[]) => Promise<boolean>;
}
function extractYoutubeVideoId(source: CohortSource): string | null {
  if (source.input?.kind !== 'youtube') return null;
  if (source.provenance?.videoId && /^[A-Za-z0-9_-]{11}$/.test(source.provenance.videoId)) {
    return source.provenance.videoId;
  }
  try {
    return singleYoutubeVideo(source.input.url).videoId;
  } catch {
    return null;
  }
}

function getSourceTypeBadge(source: CohortSource): string {
  switch (source.input?.kind) {
    case 'youtube':
      return 'YouTube Video';
    case 'pdf':
      return 'PDF Document';
    case 'web':
      return 'Web Article';
    case 'github':
      return 'GitHub Repo';
    case 'generated_guide':
      return 'AI Guide';
    default:
      return 'Text / Notes';
  }
}


export interface SourceItemRowProps {
 source: CohortSource; index: number; busy: boolean;
 onRemove: (sourceId: string) => void;
 errorMessage?: string | null; onRetry?: (source: CohortSource) => void; onReplace?: (sourceId: string) => void;
}
export const SourceItemRow = React.memo(function SourceItemRow({source,index,busy,onRemove}:SourceItemRowProps) {
 const videoId=extractYoutubeVideoId(source);
 return <li className={styles.sourceItem}>
  {videoId ? <img className={styles.thumbnail} src={'https://i.ytimg.com/vi/'+videoId+'/hqdefault.jpg'} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span className={styles.fileIcon} aria-hidden="true">↗</span>}
  <div><small>{getSourceTypeBadge(source)}</small><h3>{source.label || 'Source '+(index+1)}</h3></div>
  <button type="button" disabled={busy} aria-label={'Remove source '+(index+1)} onClick={()=>onRemove(source.id)}><Trash2 size={18}/></button>
 </li>;
});
export function MaterialStageView({workspace,dispatchAction}:MaterialStageViewProps) {
 const [url,setUrl]=useState(''); const [busy,setBusy]=useState(false); const [error,setError]=useState<string|null>(null); const lock=useRef(false);
  const handleAddUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lock.current) return;
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return;

    try {
      const parsed = new URL(trimmedUrl);
      if (parsed.protocol !== 'https:') {
        setError('Please enter a public HTTPS URL.');
        return;
      }
    } catch {
      setError('Please enter a valid URL.');
      return;
    }

    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      const isYouTube = /youtube\.com|youtu\.be/i.test(trimmedUrl);
      let ok = false;
      if (isYouTube) {
        // Fetch metadata to check if playlist and get clean title
        let metadata: {
          title?: string;
          isPlaylist?: boolean;
          videos?: Array<{ videoId: string; title: string }>;
        } | null = null;
        try {
          const metaRes = await fetch(
            `/api/import/youtube/metadata?url=${encodeURIComponent(trimmedUrl)}`
          );
          if (metaRes.ok) {
            metadata = await metaRes.json();
          }
        } catch {
          // Metadata fetch failure is non-fatal
        }

        if (metadata?.isPlaylist && metadata.videos && metadata.videos.length > 0) {
          // For playlists, add all videos from the playlist up to remaining capacity (max 100) in 1 batch action
          const maxCapacity = 100;
          const remainingSlots = Math.max(0, maxCapacity - (workspace.sources?.length ?? 0));
          const videosToAdd = metadata.videos.slice(0, remainingSlots);
          if (videosToAdd.length === 0) {
            setError(`Cannot add more sources. Maximum capacity of ${maxCapacity} reached.`);
            setBusy(false);
            return;
          }
          ok = await dispatchAction({
            type: 'add_youtube_sources_batch',
            videos: videosToAdd.map(v => ({
              url: `https://www.youtube.com/watch?v=${v.videoId}`,
              label: v.title || `Video ${v.videoId}`,
              mode: 'video_observation' as const,
            })),
          });
        } else {
          // Normalize video URL
          let normalizedUrl = trimmedUrl;
          try {
            const parsed = new URL(trimmedUrl);
            let vid: string | null = null;
            if (parsed.hostname === 'youtu.be') {
              vid = parsed.pathname.split('/')[1];
            } else if (parsed.pathname === '/watch') {
              vid = parsed.searchParams.get('v');
            } else if (/^\/(shorts|embed)\//.test(parsed.pathname)) {
              vid = parsed.pathname.split('/')[2];
            }
            if (vid && /^[A-Za-z0-9_-]{11}$/.test(vid)) {
              normalizedUrl = `https://www.youtube.com/watch?v=${vid}`;
            }
          } catch {}

          let extraction = undefined;
          try {
            extraction = await extractYoutubeClient(normalizedUrl, {
              title: metadata?.title,
            });
          } catch {}

          const label = metadata?.title || trimmedUrl;
          ok = await dispatchAction({
            type: 'add_youtube_source',
            url: normalizedUrl,
            label,
            mode: 'video_observation',
            ...(extraction ? { extraction } : {}),
          });
        }
      } else {
        let extraction = undefined;
        try {
          const extracted = await extractWebClient(trimmedUrl);
          extraction = {
            text: extracted.text,
            locations: extracted.locations,
            provenance: extracted.provenance,
            checksum: extracted.checksum,
          };
        } catch {}

        ok = await dispatchAction({
          type: 'add_web_source',
          url: trimmedUrl,
          label: trimmedUrl,
          ...(extraction ? { extraction } : {}),
        });
      }

      if (ok) {
        setUrl('');
      } else {
        setError('Could not add this link. Your input was preserved for retry.');
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not add link. Your input was preserved for retry.'
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };


 const act=async(action:CohortAction)=>{
  if(lock.current)return; lock.current=true;setBusy(true);setError(null);
  try {if(!await dispatchAction(action))setError('Could not save this action. Please try again.');}
  catch {setError('Could not save this action. Please try again.');}
  finally {lock.current=false;setBusy(false);}
 };
 return <section className={styles.workspace} aria-label="Learning material">
  <div className={styles.continueSection}><button disabled={busy||!workspace.sources.length} onClick={()=>void act({type:'begin_material_processing'})}>Continue to curriculum →</button></div>
  {workspace.sources.length>0&&<section aria-label="Added material"><h2>Added material <small>{workspace.sources.length}</small></h2><ul className={styles.sources}>{workspace.sources.map((source,index)=><SourceItemRow key={source.id} source={source} index={index} busy={busy} onRemove={sourceId=>void act({type:'remove_source',sourceId})}/>)}</ul></section>}
  <header><h1>Add your material</h1></header>
  <form className={styles.inputPanel} onSubmit={handleAddUrl}>
   <label htmlFor="material-url">Public article or YouTube URL</label>
   <div className={styles.inputRow}><input id="material-url" type="url" required maxLength={2048} pattern="https://.*" placeholder="https://…" value={url} disabled={busy} onChange={e=>setUrl(e.target.value)}/><button disabled={busy||!url.trim()}>Add link</button></div>
   <div className={styles.options} aria-label="Material input options"><button type="button" aria-pressed="true">Paste a link</button><button type="button" disabled title="Temporarily unavailable">Upload a file</button><button type="button" disabled title="Temporarily unavailable">Paste text</button></div>
  </form>
  <p className={styles.help}>Public YouTube videos, playlists and articles. Up to 100 sources.</p>
  {error&&<p role="alert">{error}</p>}
 </section>;
}

```
Postcondition: exact supplied contents.

### S2
Target: `src/client/screens/cohortBuilder/stages/MaterialStageView.module.css`. Prerequisites: earlier steps. Original raw-byte SHA256: `d8f3e415efe648dc48d18b5744ae211a8cdbb03a4cad8e7371230196c8252b44`. Replace entire file with:

```css
.workspace{width:100%;padding:20px;color:var(--creation-ink,#08143d)}
.workspace h1{font-size:clamp(28px,3vw,40px);line-height:1.15;margin:20px 0}.workspace h2{font-size:20px}.workspace small{font-size:13px;font-weight:400}
.continueSection{position:sticky;top:72px;z-index:4;display:flex;justify-content:flex-end;margin-bottom:20px;pointer-events:none}.continueSection button{pointer-events:auto;background:#08143d;color:#fff;border:0;border-radius:14px;padding:16px 22px;box-shadow:0 4px 16px #08143d20}
.workspace button{cursor:pointer;min-height:44px}.workspace button:disabled{opacity:.45;cursor:not-allowed}.workspace button:focus-visible,.workspace input:focus-visible{outline:2px solid #504cff;outline-offset:3px}
.sources{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr));list-style:none;padding:0;gap:12px;margin:0 0 24px}.sourceItem{display:grid;grid-template-columns:112px minmax(0,1fr) 44px;align-items:center;gap:12px;padding:12px;border:1px solid #e8dfd5;border-radius:14px;background:#fffcf7}.sourceItem h3{font-size:15px;line-height:1.4;margin:4px 0;overflow-wrap:anywhere}.sourceItem button{border:0;background:transparent}.thumbnail{width:112px;height:64px;object-fit:cover;border-radius:8px}.fileIcon{font-size:28px;text-align:center}.inputPanel{padding:20px;border:1px solid #e8dfd5;background:#fffcf7;border-radius:16px}.inputPanel label{font-size:14px}.inputRow{display:flex;gap:10px;margin-top:10px}.inputRow input{min-width:0;flex:1;padding:12px;border:1px solid #d8cec4;border-radius:8px}.inputRow button{padding:10px 18px;background:#08143d;color:white;border:0;border-radius:8px}.options{display:flex;gap:12px;flex-wrap:wrap;margin-top:16px}.options button{border:1px solid #e8dfd5;background:transparent;border-radius:8px;padding:8px 12px}.help{font-size:14px;line-height:1.5}
@media(max-width:640px){.workspace{padding:12px}.continueSection{top:64px}.inputPanel{padding:14px}.sourceItem{grid-template-columns:80px minmax(0,1fr) 44px}.thumbnail{width:80px;height:48px}.inputRow{flex-wrap:wrap}.inputRow input{flex-basis:100%}}

```
Postcondition: exact supplied contents.

### S3
Target: `src/client/screens/cohortBuilder/stages/DiscoveryStageView.tsx`. Prerequisites: earlier steps. Original raw-byte SHA256: `559c2149ee30d67b885fbedef41208f3012d0e885d9e62ec111541fc88a32e5d`. Replace entire file with:

```tsx
'use client';
import {useRef,useState} from 'react';
import type {CohortAction,CohortWorkspace} from '@/src/shared/cohort-builder/contracts';
import type {EntityRef} from 'interaction-builder/core';
import styles from './MaterialStageView.module.css';
export interface DiscoveryStageViewProps {workspace:CohortWorkspace;dispatchAction:(action:CohortAction,expected?:EntityRef[])=>Promise<boolean>}
export function DiscoveryStageView({workspace,dispatchAction}:DiscoveryStageViewProps){
 const [goal,setGoal]=useState(workspace.intent);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const lock=useRef(false);
 const discovery=workspace.discovery;const searching=discovery?.status==='queued'||discovery?.status==='running';
 const [selection,setSelection]=useState<{resultId:string;ids:string[]}>({resultId:'',ids:[]});
 const ids=selection.resultId===discovery?.resultId?selection.ids:[];
 const act=async(work:()=>Promise<boolean>)=>{if(lock.current)return;lock.current=true;setBusy(true);setError('');try{if(!await work())setError('Could not save this action. Your choices are retained.');}catch{setError('Could not complete this action. Please try again.');}finally{lock.current=false;setBusy(false);}};
 const search=()=>act(async()=>{if(!goal.trim())return false;if(goal.trim()!==workspace.intent.trim()&&!await dispatchAction({type:'set_intent',intent:goal.trim()}))return false;return dispatchAction({type:'start_discovery'});});
 return <section className={styles.workspace} aria-label="Find learning material">
 <h1>Start with a goal</h1><p>Tell us what you want to learn. Choose resources before adding them to your material.</p>
 <form className={styles.inputPanel} onSubmit={e=>{e.preventDefault();void search();}}><label htmlFor="discovery-goal">Your learning goal</label><div className={styles.inputRow}><input id="discovery-goal" required value={goal} disabled={busy||searching} onChange={e=>setGoal(e.target.value)}/><button disabled={busy||searching||!goal.trim()}>Find resources</button></div></form>
 {searching&&<p role="status">Finding resources… <button disabled={busy} onClick={()=>void act(()=>dispatchAction({type:'cancel_discovery'}))}>Cancel search</button></p>}
 {discovery?.status==='failed'&&<p role="alert">Search could not finish. Your goal is saved. Try again.</p>}
 {discovery?.status==='ready'&&<section aria-label="Suggested resources"><h2>Choose your material</h2>{!discovery.items.length&&<p>No resources found. Refine your goal or add your own link.</p>}<ul>{discovery.items.map(item=><li key={item.id}><label><input type="checkbox" checked={ids.includes(item.id)} disabled={busy} onChange={()=>setSelection({resultId:discovery.resultId!,ids:ids.includes(item.id)?ids.filter(id=>id!==item.id):[...ids,item.id]})}/>{item.label}</label> <a href={item.url} target="_blank" rel="noopener noreferrer">Preview source</a></li>)}</ul><button disabled={busy||!ids.length||!discovery.resultId} onClick={()=>void act(()=>dispatchAction({type:'select_discovery_resources',resultId:discovery.resultId!,candidateIds:ids}))}>Add selected material ({ids.length})</button></section>}
 <button disabled={busy||searching} onClick={()=>void act(()=>dispatchAction({type:'choose_starting_point',choice:'have_material'}))}>I already have material</button>
 {error&&<p role="alert">{error}</p>}
 </section>;
}

```
Postcondition: exact supplied contents.

### S4
Target: `src/client/screens/cohortCreation/components/StartingPoint.tsx`. Prerequisites: earlier steps. Original raw-byte SHA256: `928f33d9386621518b9b6ee80c6fc0bbca4b51b02a626b9afd851b57fac652dd`. Replace entire file with:

```tsx
import type { StartingPoint as StartingPointValue } from '@/src/shared/cohort-creation/contracts';
import Image from 'next/image';
import { ArrowLeft, ArrowRight, Search, Upload } from 'lucide-react';
import { StartingPointArt } from './StartingPointArt';
import { InkUnderline } from './InkUnderline';
import styles from './StartingPoint.module.css';

const choices = [
  { value: 'have_material', label: 'I already have material', description: 'A playlist, PDF, articles, videos, GitHub repo, Notion pages…', icon: Upload },
  { value: 'find_material', label: 'Start with a goal', description: 'I know what I want to learn. Help me find the best resources.', icon: Search },
] satisfies { value: StartingPointValue; label: string; description: string; icon: typeof Upload }[];
export function StartingPoint({ selected, onSelect, onBack, disabled = false, compact = false }: { selected: StartingPointValue | null; onSelect: (choice: StartingPointValue) => void; onBack: () => void; disabled?: boolean; compact?: boolean }) {
  if (compact) return <nav aria-label="Starting point" className={styles.compact}>
    <button type="button" disabled={disabled} onClick={onBack} aria-label="Back to recommendations"><ArrowLeft size={16} /></button>
    {choices.map(choice => <button key={choice.value} type="button" disabled={disabled} aria-pressed={selected === choice.value}
      onClick={() => onSelect(choice.value)}>{choice.label}</button>)}
  </nav>;
  return <section aria-label="Starting point" className={styles.starting} data-selected={!!selected}>
    <div className={styles.decorations} aria-hidden="true">
      <span className={styles.edgePhoto}><Image src="/images/hero-collage/real-mountains.jpg" alt="" fill sizes="200px" /></span>
      <span className={styles.edgeNote}>Your interests.<br />Your pace.<br />Your people.</span>
      <span className={styles.bottomPhoto}><Image src="/images/hero-collage/real-cathedral.jpg" alt="" fill sizes="260px" /></span>
      <span className={styles.bottomNote}>A more<br />curious<br />tomorrow.</span>
      <span className={styles.bottomLine} />
    </div>
    <header className={styles.heading}><p className={styles.eyebrow}>Let’s make yours</p>
      <h1>What are you<br /><span>starting with?<InkUnderline className={styles.underline} /></span></h1>
      <p className={styles.subtitle}>Pick the option that feels closest, or just tell me in your own words.</p>
      <span className={styles.annotation} aria-hidden="true">Different<br />starting points.<br />Same destination<br />— a deeper you.</span>
    </header>
    <div className={styles.cards}>
      {choices.map(choice => <button className={styles.choice} key={choice.value} type="button" disabled={disabled}
        aria-label={choice.label} aria-pressed={selected === choice.value} onClick={() => onSelect(choice.value)}>
        <StartingPointArt kind={choice.value} />
        <span className={styles.choiceBody}><span className={styles.choiceIcon}><choice.icon size={29} strokeWidth={1.5} /></span>
          <span className={styles.choiceTitle}>{choice.label}</span><span className={styles.description}>{choice.description}</span>
          <span className={styles.arrow}><ArrowRight size={23} /></span>
        </span>
      </button>)}
    </div>
    <div className={styles.navigation}>{selected && <p role="status">Starting point saved to your account.</p>}
      <button type="button" disabled={disabled} onClick={onBack}><ArrowLeft size={16} aria-hidden="true" />Back to recommendations</button>
    </div>
  </section>;
}

```
Postcondition: exact supplied contents.

### S5
Target: `src/client/screens/cohortCreation/components/StartingPoint.module.css`. Prerequisites: earlier steps. Original raw-byte SHA256: `7cd2f636f2430c421638c28af0fcd6286039435ede385fcd4e77393692bf369d`. Replace entire file with:

```css
.starting { position: relative; min-height: calc(100dvh - 41px); isolation: isolate; }
.heading { text-align: center; position: relative; padding: 60px 20px 32px; }
.eyebrow { text-transform: uppercase; font-size: 13px; letter-spacing: .24em; font-weight: 750; color: #8a8074; margin: 0 0 18px; }
.heading h1 { position: relative; font-family: var(--font-playfair-display), Georgia, serif; font-size: clamp(40px, 3.85vw, 64px); line-height: 1.09; letter-spacing: -.035em; font-weight: 650; margin: 0 0 24px; }
.heading h1 span { position: relative; display: inline-block; }
.underline { position: absolute; width: 84%; height: 10px; left: 8%; bottom: -8px; color: #343eff; pointer-events: none; }
.subtitle { font-family: var(--font-playfair-display), Georgia, serif; font-size: 19px; color: var(--creation-muted); margin: 0; }
.annotation { position: absolute; right: 15px; top: 65px; font-family: var(--font-caveat-next), cursive; font-size: 21px; text-align: left; line-height: 1.12; transform: rotate(-5deg); color: #444852; }
.annotation::after { content: '⤵'; display: block; text-align: right; font-size: 50px; line-height: 1; }
.cards { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 24px; position: relative; }
.choice { min-width: 0; position: relative; display: flex; flex-direction: column; border: 1px solid #eee5d7; background: color-mix(in srgb, var(--creation-surface) 72%, transparent); border-radius: 25px; text-align: left; color: var(--creation-ink); padding: 0; box-shadow: 0 3px 10px #5d40170a; overflow: visible; }
.choice[aria-pressed='true'] { outline: 2px solid var(--creation-blue); outline-offset: 4px; }
.art { position: relative; display: block; height: 270px; width: 100%; flex-shrink: 0; }
.art img { object-fit: cover; }
.choiceBody { display: flex; flex-direction: column; padding: 14px 30px 30px 35px; min-height: 195px; flex: 1; position: relative; }
.choiceIcon { position: absolute; top: -60px; left: 30px; width: 64px; height: 64px; border-radius: 50%; background: var(--creation-surface); display: grid; place-items: center; box-shadow: 0 2px 7px #4d35130d; }
.choiceTitle { font-family: var(--font-playfair-display), Georgia, serif; font-size: clamp(22px,1.7vw,28px); font-weight: 650; line-height: 1.2; text-transform: uppercase; letter-spacing: -.025em; margin-bottom: 10px; }
.description { font-size: 18px; line-height: 1.4; color: var(--creation-muted); padding-right: 28px; }
.arrow { position: absolute; right: 24px; bottom: 18px; width: 47px; height: 47px; border-radius: 50%; background: #e3e3ff; color: #263aff; display: grid; place-items: center; }
.note { position: absolute; z-index: 1; display: block; background: #f6ebd6 url('/images/hero-collage/real-paper-texture.jpg') center / cover; padding: 17px 19px; font-family: var(--font-caveat-next), cursive; font-size: 19px; font-weight: 700; line-height: 1.15; color: #44413d; box-shadow: 1px 3px 7px #513e1621; }
.star { position: absolute; right: 20px; top: 68px; z-index: 2; }
.bluePaper { position: absolute; inset: 18px 26% 20px 28%; transform: rotate(-14deg); background: #2878b8; clip-path: polygon(4% 2%,90% 0,100% 14%,96% 98%,0 95%); }
.codePaper { position: absolute; width: 64%; height: 155px; left: 9%; top: 62px; padding: 22px 18px; background: #1b212b; transform: rotate(-4deg); border: 8px solid #f9f4e9; box-shadow: 0 3px 8px #352e2925; }
.codePaper i { display: block; height: 3px; margin: 9px 0; width: 70%; background: linear-gradient(90deg,#d99b57 20%,#7c9898 20% 50%,#b4bac2 50%); }
.codePaper i:nth-child(even) { width: 45%; margin-left: 12%; }
.videoPaper { position: absolute; width: 42%; height: 100px; top: 30px; left: 28%; background: #fffdf8; border: 4px solid #f4eadc; transform: rotate(-5deg); display: grid; place-items: center; box-shadow: 0 2px 5px #604a1c20; }
.videoPaper > span { position: absolute; left: 8px; right: 8px; top: 8px; height: 28px; background: repeating-linear-gradient(#2a2b2d 0 5px,#eee8dd 5px 10px); }
.videoPaper svg { margin-top: 34px; color: #f52c1c; }
.pdfPaper { position: absolute; width: 32%; height: 142px; top: 81px; right: 8%; background: #fbf3e5; padding: 16px; transform: rotate(9deg); box-shadow: 0 2px 6px #604a1c20; color: #ba7e57; }
.pdfPaper b { position: absolute; font-size: 17px; left: 13px; top: 40px; color: #fff; background: #c99a75; padding: 1px 4px; }
.pdfPaper i { display: block; height: 3px; width: 80%; background: #c6baaa; margin-top: 9px; }
.smallPhoto { position: absolute; width: 36%; height: 94px; bottom: 8px; right: 12%; border: 7px solid #fffaf1; transform: rotate(7deg); box-shadow: 0 2px 7px #604a1c25; }
.art[data-kind='have_material'] .note { left: 1%; top: 0; transform: rotate(-5deg); }
.paintPaper { position: absolute; inset: 32px 7% 4px; background: #444d58; clip-path: polygon(4% 9%,94% 0,97% 93%,9% 100%,0 45%); transform: rotate(4deg); }
.galaxyPhoto { position: absolute; width: 43%; height: 137px; left: 13%; top: 43px; border: 7px solid #fffbf2; transform: rotate(-12deg); box-shadow: 0 2px 7px #604a1c25; }
.mountainPhoto { position: absolute; width: 38%; height: 142px; right: 10%; top: 100px; border: 7px solid #fffbf2; transform: rotate(6deg); box-shadow: 0 2px 7px #604a1c25; }
.cathedralPhoto { position: absolute; width: 48%; height: 127px; bottom: 2px; left: 25%; border: 7px solid #fffbf2; transform: rotate(-4deg); box-shadow: 0 2px 7px #604a1c25; }
.art[data-kind='find_material'] .note { right: 8%; top: 4px; transform: rotate(7deg); }
.goalPhoto { position: absolute; inset: 60px 6% 8px; clip-path: polygon(1% 0,95% 4%,100% 92%,89% 99%,8% 97%,0 85%); transform: rotate(-3deg); }
.moon { position: absolute; width: 91px; height: 91px; top: 10px; left: 34%; border-radius: 50%; background: #a7b9c7; opacity: .8; }
.art[data-kind='have_goal'] .note { right: -4%; top: -28px; transform: rotate(3deg); }
.art[data-kind='have_goal'] .star { right: 7%; top: 95px; }
.decorations { pointer-events: none; position: absolute; inset: -26px -48px -15px -44px; z-index: -1; overflow: hidden; }
.edgePhoto { position: absolute; width: 165px; height: 260px; top: 20px; left: -35px; border: 9px solid #fffcf6; box-shadow: 0 3px 8px #604a1c20; transform: rotate(-9deg); }
.edgePhoto img, .bottomPhoto img { object-fit: cover; }
.edgeNote { position: absolute; top: 80px; left: 80px; background: #f6ebd6 url('/images/hero-collage/real-paper-texture.jpg') center / cover; transform: rotate(-6deg); padding: 20px; font-family: var(--font-caveat-next), cursive; font-size: 21px; line-height: 1.1; box-shadow: 0 3px 8px #604a1c20; }
.bottomPhoto { position: absolute; right: -45px; bottom: -20px; width: 250px; height: 190px; transform: rotate(12deg); border: 9px solid #fffaf1; box-shadow: 0 2px 8px #604a1c20; }
.bottomNote { position: absolute; right: 200px; bottom: 0; padding: 23px; background: #f6ebd6 url('/images/hero-collage/real-paper-texture.jpg') center / cover; font-family: var(--font-caveat-next), cursive; font-size: 22px; line-height: 1.15; transform: rotate(-6deg); }
.bottomLine { position: absolute; width: 65%; height: 140px; bottom: 70px; left: 15%; border-bottom: 2px solid #4b4eff; border-radius: 0 0 50% 50%; transform: rotate(10deg); }
.navigation { display: flex; align-items: center; justify-content: space-between; position: relative; margin-top: 20px; gap: 12px; }
.navigation p { color: var(--creation-muted); font-size: 12px; }
.navigation button { display: inline-flex; gap: 7px; align-items: center; border: 0; color: var(--creation-muted); background: none; padding: 8px 0; font-size: 12px; }
.note, .edgeNote, .bottomNote { background-blend-mode: multiply; }
.compact { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 14px 140px 10px 0; position: relative; z-index: 2; }
.compact button { border: 1px solid var(--creation-border); border-radius: 22px; padding: 7px 12px; background: var(--creation-surface); color: var(--creation-muted); font-size: 11px; }
.compact button[aria-pressed='true'] { color: var(--creation-blue); border-color: var(--creation-blue); }
@media (max-width: 820px) { .compact { padding-right: 0; } }
@media (max-width: 1300px) { .heading { padding-top: 70px; } .annotation, .edgePhoto, .edgeNote { display: none; } .cards { gap: 18px; } .art { height: 230px; } .choiceBody { padding: 16px 22px 65px; min-height: 220px; } .choiceIcon { left: 20px; } .description { font-size: 16px; padding-right: 0; } .note { font-size: 17px; padding: 14px; } }
@media (max-width: 1100px) { .cards { grid-template-columns: 1fr; } .choice { display: grid; grid-template-columns: 44% minmax(0,1fr); } .art { height: 270px; } .choiceBody { justify-content: center; padding: 26px 22px 60px; min-height: 0; } .choiceIcon { position: static; width: 45px; height: 45px; margin-bottom: 12px; } .choiceTitle { font-size: 25px; } .heading { padding-inline: 0; } .subtitle { font-size: 18px; } .decorations { display: none; } .starting { min-height: 0; } }
@media (max-width: 820px) { .heading { padding-top: 12px; padding-bottom: 30px; } .heading h1 { font-size: 45px; } .eyebrow { font-size: 11px; } }
@media (max-width: 520px) { .choice { display: flex; } .art { height: 260px; } .choiceBody { padding: 20px 28px 54px; } .choiceIcon { position: absolute; top: -58px; left: 26px; width: 64px; height: 64px; } .description { font-size: 18px; padding-right: 24px; } .heading h1 { font-size: 40px; } .navigation { flex-wrap: wrap; } .note { font-size: 20px; } }
@media (prefers-reduced-motion: no-preference) { .choice { transition: transform .2s ease, box-shadow .2s ease; } .choice:hover:not(:disabled) { transform: translateY(-3px); box-shadow: 0 9px 20px #604a1c10; } .choice:active:not(:disabled) { transform: translateY(0); } }

```
Postcondition: exact supplied contents.

### S6
Target: `src/client/screens/cohortBuilder/CohortWorkspacePane.tsx`. Prerequisites: earlier steps. Original raw-byte SHA256: `4b6e0ac226507cdff82427c2546dcaf7dc6563367da72f806f763dc070299b66`. Replace entire file with:

```tsx
'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Check, AlertCircle, ArrowLeft } from 'lucide-react';
import { useWorkspaceView, useDispatchAction, useInteractionState } from '@/src/client/interaction/hooks';
import { cohortWorkspaceSchema, type CohortWorkspace, type CohortAction } from '@/src/shared/cohort-builder/contracts';
import type { EntityRef } from 'interaction-builder/core';
import styles from './CohortBuilder.module.css';
import startingStyles from '@/src/client/screens/cohortCreation/components/StartingPoint.module.css';

import { UnderstandingStageView } from './stages/UnderstandingStageView';
import { ChunkingStageView } from './stages/ChunkingStageView';
import { AnalysisStageView } from './stages/AnalysisStageView';
import { AssemblyStageView } from './stages/AssemblyStageView';
import { CurriculumStageView } from './stages/CurriculumStageView';
import { IntakeStageView } from './stages/IntakeStageView';
import { RecommendationsStageView } from './stages/RecommendationsStageView';
import { StartingPointStageView } from './stages/StartingPointStageView';
import { MaterialStageView } from './stages/MaterialStageView';
import { DiscoveryStageView } from './stages/DiscoveryStageView';
import { CohortDraftProvider, useCohortDrafts } from './draft-context';
import { getActiveStage, getEffectiveStage, type BuilderStage } from './stage-selectors';

import { ReadyStageView } from './stages/ReadyStageView';

const PublicationStageView = dynamic(
  () => import('./stages/PublicationStageView').then((m) => m.PublicationStageView),
  { ssr: false }
);

export type Stage = BuilderStage;
export { getActiveStage, getEffectiveStage };

export interface ProcessingStep {
  label: 'Understanding' | 'Chunking' | 'Analyzing' | 'Building';
  isComplete: boolean;
  isCurrent: boolean;
  isFailed: boolean;
}

export interface ProcessingProgress {
  currentStepIndex: number;
  steps: ProcessingStep[];
  needsRebuild: boolean;
}

export function getProcessingProgress(workspace: CohortWorkspace): ProcessingProgress {
  const stepLabels: Array<ProcessingStep['label']> = ['Understanding', 'Chunking', 'Analyzing', 'Building'];

  const status = workspace.processing.status as string;
  const stage = workspace.processing.stage as string;
  const error = workspace.processing.error;
  const sources = workspace.sources ?? [];
  const jobs = workspace.processing.jobs ?? [];
  const isCanceled = error === 'PROCESSING_CANCELED' || jobs.some(j => j.status === 'canceled');

  // 1. Fresh empty workspace (sources.length === 0 or idle with no sourceFingerprint and no jobs)
  if (sources.length === 0 || (status === 'idle' && workspace.processing.sourceFingerprint === null && jobs.length === 0)) {
    return {
      currentStepIndex: -1,
      steps: stepLabels.map(label => ({
        label,
        isComplete: false,
        isCurrent: false,
        isFailed: false,
      })),
      needsRebuild: false,
    };
  }

  // 2. Canonical Job-driven evaluation when jobs array is present
  if (jobs.length > 0) {
    const isSourceStageAccepted = (sourceId: string, stageName: 'understanding' | 'chunking' | 'analysis') => {
      return jobs.some(j => j.sourceId === sourceId && j.stage === stageName && j.status === 'accepted');
    };

    const isSourceStageFailed = (sourceId: string, stageName: 'understanding' | 'chunking' | 'analysis') => {
      if (stageName === 'understanding') {
        return jobs.some(
          j => j.sourceId === sourceId && ['acquisition', 'extraction', 'understanding'].includes(j.stage) && j.status === 'failed'
        );
      }
      return jobs.some(j => j.sourceId === sourceId && j.stage === stageName && j.status === 'failed');
    };

    const isSourceStageActive = (sourceId: string, stageName: 'understanding' | 'chunking' | 'analysis') => {
      if (stageName === 'understanding') {
        return jobs.some(
          j =>
            j.sourceId === sourceId &&
            ['acquisition', 'extraction', 'understanding'].includes(j.stage) &&
            (j.status === 'running' || j.status === 'queued')
        );
      }
      return jobs.some(j => j.sourceId === sourceId && j.stage === stageName && (j.status === 'running' || j.status === 'queued'));
    };

    const assemblyJob = jobs.find(j => j.stage === 'assembly' || j.sourceId === null);
    const assemblyAccepted = assemblyJob?.status === 'accepted';
    const assemblyFailed = assemblyJob?.status === 'failed';
    const assemblyActive = assemblyJob?.status === 'running' || assemblyJob?.status === 'queued';

    // Step 0: Understanding - requires ALL sources to have accepted understanding
    const step0Complete = sources.length > 0 && sources.every(s => isSourceStageAccepted(s.id, 'understanding'));
    const step0Failed = sources.some(s => isSourceStageFailed(s.id, 'understanding'));
    const step0Active = !step0Complete && !step0Failed && sources.some(s => isSourceStageActive(s.id, 'understanding'));

    // Step 1: Chunking - requires Step 0 complete AND ALL sources accepted chunking
    const step1Complete = step0Complete && sources.every(s => isSourceStageAccepted(s.id, 'chunking'));
    const step1Failed = step0Complete && sources.some(s => isSourceStageFailed(s.id, 'chunking'));
    const step1Active = step0Complete && !step1Complete && !step1Failed && sources.some(s => isSourceStageActive(s.id, 'chunking'));

    // Step 2: Analyzing - requires Step 1 complete AND ALL sources accepted analysis
    const step2Complete = step1Complete && sources.every(s => isSourceStageAccepted(s.id, 'analysis'));
    const step2Failed = step1Complete && sources.some(s => isSourceStageFailed(s.id, 'analysis'));
    const step2Active = step1Complete && !step2Complete && !step2Failed && sources.some(s => isSourceStageActive(s.id, 'analysis'));

    // Step 3: Building (Assembly) - requires Step 2 complete AND assembly job accepted
    const step3Complete = step2Complete && assemblyAccepted;
    const step3Failed = step2Complete && assemblyFailed;
    const step3Active = step2Complete && !step3Complete && !step3Failed && assemblyActive;

    const anySourcePending = sources.some(s => (s.state as string) === 'pending');
    const needsRebuild = anySourcePending || isCanceled || Boolean(step0Failed || step1Failed || step2Failed || step3Failed);

    let currentStepIndex = -1;
    if (!isCanceled && !step0Failed && !step1Failed && !step2Failed && !step3Failed) {
      if (step0Active) currentStepIndex = 0;
      else if (step1Active) currentStepIndex = 1;
      else if (step2Active) currentStepIndex = 2;
      else if (step3Active) currentStepIndex = 3;
    }

    return {
      currentStepIndex,
      steps: [
        { label: 'Understanding', isComplete: step0Complete, isCurrent: !isCanceled && currentStepIndex === 0, isFailed: Boolean(step0Failed) },
        { label: 'Chunking', isComplete: step1Complete, isCurrent: !isCanceled && currentStepIndex === 1, isFailed: Boolean(step1Failed) },
        { label: 'Analyzing', isComplete: step2Complete, isCurrent: !isCanceled && currentStepIndex === 2, isFailed: Boolean(step2Failed) },
        { label: 'Building', isComplete: Boolean(step3Complete), isCurrent: !isCanceled && currentStepIndex === 3, isFailed: Boolean(step3Failed) },
      ],
      needsRebuild,
    };
  }

  // 3. Conservative Fallback when jobs are omitted (legacy snapshots or initial mock workspaces)
  const stageToIndex = (st: string): number => {
    switch (st) {
      case 'acquisition':
      case 'extraction':
      case 'understanding':
        return 0;
      case 'chunking':
        return 1;
      case 'analysis':
        return 2;
      case 'assembly':
      case 'building':
      case 'done':
        return 3;
      default:
        return 0;
    }
  };

  if (isCanceled) {
    return {
      currentStepIndex: -1,
      steps: stepLabels.map(label => ({
        label,
        isComplete: false,
        isCurrent: false,
        isFailed: false,
      })),
      needsRebuild: true,
    };
  }

  if (status === 'failed') {
    const failingIndex = stageToIndex(stage);
    return {
      currentStepIndex: -1,
      steps: stepLabels.map((label, index) => ({
        label,
        isComplete: index < failingIndex,
        isCurrent: false,
        isFailed: index === failingIndex,
      })),
      needsRebuild: true,
    };
  }

  if (status === 'running' || status === 'queued' || status === 'processing') {
    const activeIndex = stageToIndex(stage);
    return {
      currentStepIndex: activeIndex,
      steps: stepLabels.map((label, index) => ({
        label,
        isComplete: index < activeIndex,
        isCurrent: index === activeIndex,
        isFailed: false,
      })),
      needsRebuild: false,
    };
  }

  const anySourceNotReady = sources.some(s => (s.state as string) === 'pending' || s.state !== 'ready');
  if (anySourceNotReady || (status === 'idle' && sources.length > 0)) {
    return {
      currentStepIndex: -1,
      steps: stepLabels.map(label => ({
        label,
        isComplete: false,
        isCurrent: false,
        isFailed: false,
      })),
      needsRebuild: true,
    };
  }

  if (status === 'ready' && sources.length > 0 && sources.every(s => (s.state as string) === 'ready')) {
    return {
      currentStepIndex: -1,
      steps: stepLabels.map(label => ({
        label,
        isComplete: true,
        isCurrent: false,
        isFailed: false,
      })),
      needsRebuild: false,
    };
  }

  return {
    currentStepIndex: -1,
    steps: stepLabels.map(label => ({
      label,
      isComplete: false,
      isCurrent: false,
      isFailed: false,
    })),
    needsRebuild: sources.length > 0,
  };
}

interface CohortWorkspacePaneProps {
  workspaceId?: string;
  ownerId?: string;
  onSelectLessonForChat: (attached: { entity: EntityRef; label: string }) => void;
  onNavigateToDestination?: (url: string) => void;
}

export function CohortWorkspacePane(props: CohortWorkspacePaneProps) {
  const interactionState = useInteractionState<CohortWorkspace>();
  const workspaceId = props.workspaceId ?? interactionState?.workspaceId ?? '';
  return (
    <CohortDraftProvider workspaceId={workspaceId} ownerId={props.ownerId}>
      <InnerCohortWorkspacePane {...props} />
    </CohortDraftProvider>
  );
}

function InnerCohortWorkspacePane({
  workspaceId: propWorkspaceId,
  ownerId: propOwnerId,
  onSelectLessonForChat,
  onNavigateToDestination,
}: CohortWorkspacePaneProps) {
  const drafts = useCohortDrafts();
  const interactionState = useInteractionState<CohortWorkspace>();
  const workspaceId = propWorkspaceId ?? interactionState?.workspaceId ?? '';
  const rawWorkspace = useWorkspaceView<CohortWorkspace>();
  const parsed = rawWorkspace ? cohortWorkspaceSchema.safeParse(rawWorkspace) : null;
  const workspace = parsed?.success ? parsed.data : (rawWorkspace as CohortWorkspace | null);
  const dispatchAction = useDispatchAction<CohortAction>();

  const [inspectedStage, setInspectedStage] = useState<Stage | null>(null);

  if (!workspace) {
    return <div className={styles.rightPane}>Loading workspace state...</div>;
  }

  const progress = getProcessingProgress(workspace);
  const activeStage = getActiveStage(workspace);
  const effectiveStage = getEffectiveStage(workspace, inspectedStage, drafts);
  const isJourneyInitialStep =
    effectiveStage === 'recommendations' ||
    effectiveStage === 'starting_point' ||
    effectiveStage === 'material_input' ||
    effectiveStage === 'discovery' ||
    effectiveStage === 'goal_setup';
  const hideStepper = isJourneyInitialStep || effectiveStage === 'published';

  const stepToStageMap: Record<ProcessingStep['label'], Stage> = {
    Understanding: 'understanding',
    Chunking: 'chunking',
    Analyzing: 'analysis',
    Building: 'assembly',
  };

  useEffect(() => {
    if (inspectedStage) {
      const inspectedStep = progress.steps.find(s => stepToStageMap[s.label] === inspectedStage);
      if (!inspectedStep || (!inspectedStep.isComplete && !inspectedStep.isCurrent && !inspectedStep.isFailed)) {
        setInspectedStage(null);
      }
    }
  }, [activeStage, progress.steps, inspectedStage]);

  return (
    <main className={styles.rightPane} aria-label="Cohort Curriculum Workspace">
      {/* Stepper Navigation */}
      {!hideStepper && (
        <div className={styles.stepperNav}>
          <ol className={styles.creationSteps} aria-label="Creation journey progress">
            {progress.steps.map((step, index) => {
              const stepStage = stepToStageMap[step.label];
              const isInspected = inspectedStage === stepStage;
              const isCurrent = inspectedStage ? isInspected : step.isCurrent;
              const isAccessible = step.isComplete || step.isCurrent || step.isFailed;
              return (
                <li
                  key={step.label}
                  role="button"
                  tabIndex={isAccessible ? 0 : -1}
                  aria-disabled={!isAccessible || undefined}
                  data-disabled={!isAccessible || undefined}
                  aria-current={isCurrent ? 'step' : undefined}
                  data-complete={step.isComplete}
                  data-failed={step.isFailed || undefined}
                  data-inspected={isInspected || undefined}
                  onClick={() => {
                    if (!isAccessible) return;
                    setInspectedStage(current => (current === stepStage ? null : stepStage));
                  }}
                  onKeyDown={e => {
                    if (!isAccessible) return;
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setInspectedStage(current => (current === stepStage ? null : stepStage));
                    }
                  }}
                  style={{
                    cursor: isAccessible ? 'pointer' : 'not-allowed',
                    opacity: isAccessible ? 1 : 0.45,
                  }}
                >
                  <span>
                    {step.isComplete ? (
                      <Check size={13} aria-label="Complete" />
                    ) : step.isFailed ? (
                      <AlertCircle size={13} aria-label="Failed" />
                    ) : (
                      index + 1
                    )}
                  </span>
                  {step.label}
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {/* Stage Inspection Banner */}
      {!hideStepper && inspectedStage && (
        <div
          data-testid="stage-inspection-banner"
          className={styles.inspectingBanner}
          role="status"
        >
          <span>
            Inspecting <strong>{inspectedStage}</strong> stage.
          </span>
          <button
            type="button"
            className={styles.resetStageBtn}
            aria-label="Reset to active stage"
            onClick={() => setInspectedStage(null)}
          >
            Return to active stage
          </button>
        </div>
      )}

      {/* Top starting point tabs for material_input */}
      {effectiveStage === 'material_input' && (
        <nav aria-label="Starting point" className={startingStyles.compact}>
          <button
            type="button"
            onClick={() => void dispatchAction({ type: 'back_to_starting_point' })}
            aria-label="Back to starting point"
          >
            <ArrowLeft size={16} />
          </button>
          {[
            { value: 'have_material' as const, label: 'I already have material' },
            { value: 'find_material' as const, label: 'Start with a goal' },
          ].map(choice => (
            <button
              key={choice.value}
              type="button"
              aria-pressed={(workspace.journey?.branch ?? 'have_material') === choice.value}
              onClick={async () => {
                if (workspace.journey?.branch === choice.value) return;
                await dispatchAction({ type: 'back_to_starting_point' });
                await dispatchAction({ type: 'choose_starting_point', choice: choice.value });
              }}
            >
              {choice.label}
            </button>
          ))}
        </nav>
      )}

      {/* Stage Specific Views */}
      {effectiveStage === 'recommendations' && (
        <RecommendationsStageView workspace={workspace} dispatchAction={dispatchAction} />
      )}
      {effectiveStage === 'starting_point' && (
        <StartingPointStageView workspace={workspace} dispatchAction={dispatchAction} />
      )}
      {effectiveStage === 'material_input' && (
        <MaterialStageView
          workspace={workspace}
          workspaceId={workspaceId}
          revision={interactionState?.revision}
          ownerId={propOwnerId}
          dispatchAction={dispatchAction}
        />
      )}
      {effectiveStage === 'discovery' && (
        <DiscoveryStageView workspace={workspace} dispatchAction={dispatchAction} />
      )}
      {effectiveStage === 'goal_setup' && (
        <DiscoveryStageView workspace={workspace} dispatchAction={dispatchAction} />
      )}
      {effectiveStage === 'intake' && (
        <IntakeStageView workspace={workspace} needsRebuild={progress.needsRebuild} dispatchAction={dispatchAction} />
      )}
      {effectiveStage === 'understanding' && (
        <UnderstandingStageView workspace={workspace} dispatchAction={dispatchAction} />
      )}
      {effectiveStage === 'chunking' && (
        <ChunkingStageView workspace={workspace} dispatchAction={dispatchAction} />
      )}
      {effectiveStage === 'analysis' && (
        <AnalysisStageView workspace={workspace} dispatchAction={dispatchAction} />
      )}
      {effectiveStage === 'assembly' && (
        <AssemblyStageView workspace={workspace} dispatchAction={dispatchAction} />
      )}
      {effectiveStage === 'ready' && (
        <ReadyStageView workspace={workspace} dispatchAction={dispatchAction} />
      )}
      {(effectiveStage === 'curriculum' || effectiveStage === 'review') && (
        <CurriculumStageView
          workspace={workspace}
          workspaceId={workspaceId}
          revision={interactionState?.revision}
          needsRebuild={progress.needsRebuild}
          dispatchAction={dispatchAction}
          onSelectLessonForChat={onSelectLessonForChat}
          onNavigateToDestination={onNavigateToDestination}
        />
      )}
      {effectiveStage === 'published' && (
        <PublicationStageView
          workspace={workspace}
          dispatchAction={dispatchAction}
          onNavigateToDestination={onNavigateToDestination}
        />
      )}
    </main>
  );
}

```
Postcondition: exact supplied contents.

### S7
Target: `src/shared/cohort-builder/contracts.ts`. Prerequisites: earlier steps. Original raw-byte SHA256: `ae908cefdeadf4fddf77de86b8e5d6402bbdd86de1e112e1ff1cd436341767be`. Replace entire file with:

```tsx
import { z } from 'zod';
import { entityRefSchema, type DomainActionPlan } from 'interaction-builder/core';
import { youtubeVideoUrlSchema, youtubeTrackSchema, youtubeTimeScopeSchema } from './youtube-transcript';
import { githubRepoUrlSchema, githubRefSchema, githubPathsSchema } from './github-source';
import { cohortSeoSchema } from './seo';
import { sha256 } from './hash';
import { canRunDeterministicPipeline, runDeterministicPipeline } from './client-pipeline';

const text = z.string().trim().min(1).max(4_000);
const id = z.string().min(1).max(200);
const sourceText = z.string().min(1).max(200_000).refine(value => value.trim().length > 0, 'Source text must contain non-whitespace content');
export const publicSourceUrlSchema = z.string().max(2048).url().refine(value => {
  const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password && !url.port;
}, 'Use a public HTTPS URL without credentials or a custom port');
export const sourceInputSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('generated_guide'), goal: text, audience: z.string().max(500), dailyMinutes: z.number().int().min(1).max(1_440), intentVersion: z.number().int().nonnegative() }),
  z.strictObject({ kind: z.literal('pdf'), uploadId: z.uuid(), pages: z.array(z.number().int().min(1).max(200)).min(1).max(200).optional() }),
  z.strictObject({ kind: z.literal('web'), url: publicSourceUrlSchema }),
  z.strictObject({
    kind: z.literal('youtube'),
    url: youtubeVideoUrlSchema,
    mode: z.enum(['transcript', 'video_observation']).optional(),
    track: youtubeTrackSchema.optional(),
    scope: youtubeTimeScopeSchema.optional(),
  }).superRefine((data, ctx) => {
    if ((!data.mode || data.mode === 'transcript') && !data.track) {
      ctx.addIssue({ code: 'custom', message: 'Transcript mode requires a track' });
    }
  }),
  z.strictObject({ kind: z.literal('github'), repoUrl: githubRepoUrlSchema, ref: githubRefSchema, commitSha: z.string().regex(/^[a-f0-9]{40}$/).optional(), paths: githubPathsSchema.optional() }),
]);

export const cohortSourceProvenanceSchema = z.strictObject({
  parserVersion: z.string().max(128),
  rawChecksum: z.string().regex(/^[a-f0-9]{64}$/),
  scope: z.enum(['selected_pages', 'main_article', 'full_text_response', 'transcript_only', 'selected_files', 'video_observation', 'ai_authored_guide']),
  finalUrl: z.string().max(2048).optional(),
  pageCount: z.number().int().positive().max(200).optional(),
  videoId: z.string().optional(),
  videoTitle: z.string().max(500).optional(),
  videoDurationMs: z.number().int().positive().optional(),
  track: youtubeTrackSchema.optional(),
  timeScope: youtubeTimeScopeSchema.optional(),
  repoUrl: z.string().max(2048).optional(),
  ref: z.string().max(100).optional(),
  commitSha: z.string().regex(/^[a-f0-9]{40}$/).optional(),
  fileCount: z.number().int().positive().max(25).optional(),
  model: z.strictObject({
    provider: z.string().max(256),
    modelId: z.string().max(256),
    adapterVersion: z.string().max(128),
  }).optional(),
  contentOrigin: z.enum(['external', 'ai']).optional(),
  limitations: z.array(z.string().max(1000)).max(20).optional(),
  estimatedIntervals: z.boolean().optional(),
});
export type CohortSourceProvenance = z.infer<typeof cohortSourceProvenanceSchema>;

export const cohortSourceSchema = z.strictObject({
  id,
  version: z.number().int().nonnegative(),
  label: z.string().trim().min(1).max(300),
  text: z.union([sourceText, z.literal('')]),
  input: sourceInputSchema.optional(),
  retainedInputId: z.uuid().optional(),
  extractionId: z.uuid().optional(),
  locations: z.array(z.strictObject({
    start: z.number().int().nonnegative(),
    end: z.number().int().positive(),
    page: z.number().int().positive().optional(),
    startMs: z.number().int().nonnegative().optional(),
    endMs: z.number().int().nonnegative().optional(),
    segmentId: z.string().optional(),
    filePath: z.string().optional(),
    startLine: z.number().int().positive().optional(),
    endLine: z.number().int().positive().optional(),
  })).max(1000).optional(),
  provenance: cohortSourceProvenanceSchema.optional(),
  checksum: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  isRestricted: z.boolean().optional(),
  state: z.enum(['queued', 'ready', 'processing', 'failed', 'stale']),
}).superRefine((source,ctx) => { if (!source.input && !source.text.trim()) ctx.addIssue({ code:'custom',message:'Text sources require retained text' }); });
export type CohortSource = z.infer<typeof cohortSourceSchema>;

export const clientSourceExtractionSchema = z.strictObject({
  text: z.string().min(1).max(200_000),
  locations: z.array(z.strictObject({
    start: z.number().int().nonnegative(),
    end: z.number().int().positive(),
    page: z.number().int().positive().optional(),
    startMs: z.number().int().nonnegative().optional(),
    endMs: z.number().int().nonnegative().optional(),
    segmentId: z.string().optional(),
    filePath: z.string().optional(),
    startLine: z.number().int().positive().optional(),
    endLine: z.number().int().positive().optional(),
  })).min(1).max(1000),
  provenance: cohortSourceProvenanceSchema.optional(),
  checksum: z.string().regex(/^[a-f0-9]{64}$/).optional(),
});
export type ClientSourceExtraction = z.infer<typeof clientSourceExtractionSchema>;

export const MAX_COHORT_SOURCES = 100;

export const cohortChunkSchema = z.strictObject({
  id,
  sourceId: id,
  sourceVersion: z.number().int().nonnegative(),
  start: z.number().int().nonnegative(),
  end: z.number().int().positive(),
  text: z.string().min(1).max(24 * 1024),
  checksum: z.string().regex(/^[a-f0-9]{64}$/),
});
export type CohortChunk = z.infer<typeof cohortChunkSchema>;

export const cohortLessonSchema = z.strictObject({
  id,
  version: z.number().int().nonnegative(),
  title: text,
  objective: text,
  sourceChunkIds: z.array(id).max(200),
  pinned: z.boolean(),
  manualOverride: z.boolean().optional(),
  evidenceStatus: z.enum(['valid', 'orphaned']).optional(),
});
export type CohortLesson = z.infer<typeof cohortLessonSchema>;

export const cohortTextJobViewSchema = z.strictObject({
  id, sourceId: id.nullable(), stage: z.enum(['acquisition', 'extraction', 'understanding', 'chunking', 'analysis', 'assembly']),
  status: z.enum(['queued', 'running', 'accepted', 'failed', 'canceled', 'superseded']),
  attempts: z.number().int().nonnegative(), error: z.string().max(100).nullable(), retryable: z.boolean(),
});

export const cohortReleaseReceiptSchema = z.strictObject({
  effectKey: z.string().regex(/^[a-f0-9]{64}$/),
  cohortId: z.string().min(1),
  workspaceId: z.string().min(1),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  mode: z.enum(['private_activation', 'public_publish']),
  releasedAt: z.string(),
  destinationUrl: z.string().min(1),
});
export type CohortReleaseReceipt = z.infer<typeof cohortReleaseReceiptSchema>;

export const cohortReleaseStateSchema = z.strictObject({
  status: z.enum(['draft', 'prepared', 'released']),
  mode: z.enum(['private_activation', 'public_publish']).optional(),
  candidateHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  effectKey: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  cohortId: z.string().min(1).optional(),
  preparedAt: z.string().optional(),
  releasedAt: z.string().optional(),
  receipt: cohortReleaseReceiptSchema.optional(),
});
export type CohortReleaseState = z.infer<typeof cohortReleaseStateSchema>;

export const cohortJourneySchema = z.strictObject({
  version: z.literal(1),
  step: z.enum(['chat', 'recommendations', 'starting_point', 'material_input', 'discovery', 'goal_setup', 'processing', 'ready', 'review', 'published']),
  branch: z.enum(['have_material', 'find_material', 'have_goal']).nullable(),
  processingStarted: z.boolean(),
  intentVersion: z.number().int().nonnegative(),
});
export type CohortJourney = z.infer<typeof cohortJourneySchema>;
const journeyResultFields = {
  requestId: id, fingerprint: z.string().min(1).max(200),
  status: z.enum(['queued', 'running', 'ready', 'failed', 'canceled']),
  resultId: id.optional(), generation: z.number().int().nonnegative(),
};
export const cohortRecommendationItemSchema = z.strictObject({
  id,
  label: z.string().trim().min(1).max(300),
  url: publicSourceUrlSchema,
  description: z.string().max(10000).optional(),
  coverImage: z.string().max(2048).nullable().optional(),
  creatorName: z.string().max(200).nullable().optional(),
  difficulty: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']).optional(),
  categories: z.array(z.string().max(200)).max(100).optional(),
  estimatedCompletionTime: z.string().max(200).nullable().optional(),
  memberCount: z.number().int().nonnegative().optional(),
  lessonCount: z.number().int().nonnegative().optional(),
  reason: z.string().max(600).optional(),
  isBestMatch: z.boolean().optional(),
});
export const cohortDiscoveryItemSchema = z.strictObject({ id, label: z.string().trim().min(1).max(300), kind: z.literal('web'), url: publicSourceUrlSchema });
export const cohortRecommendationsSchema = z.strictObject({ ...journeyResultFields, items: z.array(cohortRecommendationItemSchema).max(20) });
export type CohortRecommendations = z.infer<typeof cohortRecommendationsSchema>;
export type CohortRecommendationItem = z.infer<typeof cohortRecommendationItemSchema>;
export const cohortDiscoverySchema = z.strictObject({ ...journeyResultFields, items: z.array(cohortDiscoveryItemSchema).max(20) });
export type CohortDiscovery = z.infer<typeof cohortDiscoverySchema>;
export type CohortDiscoveryItem = z.infer<typeof cohortDiscoveryItemSchema>;

export const cohortWorkspaceSchema = z.strictObject({
  schemaVersion: z.literal(1),
  title: z.string().max(300),
  description: z.string().max(4_000).optional(),
  presentation: z.strictObject({
    coverImage: publicSourceUrlSchema.optional(),
    subtitle: z.string().trim().max(500).optional(),
    difficulty: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']).optional(),
    categories: z.array(z.string().trim().min(1).max(80)).max(12).optional(),
    learningOutcomes: z.array(z.string().trim().min(1).max(500)).max(20).optional(),
    requirements: z.array(z.string().trim().min(1).max(500)).max(20).optional(),
    seasonTitles: z.record(z.string().min(1).max(200), z.string().trim().min(1).max(300)).optional(),
  }).optional(),
  intent: text,
  audience: z.string().max(500),
  dailyMinutes: z.number().int().min(1).max(1_440),
  lessons: z.array(cohortLessonSchema).max(1_000),
  sources: z.array(cohortSourceSchema).max(MAX_COHORT_SOURCES).default([]),
  chunks: z.array(cohortChunkSchema).max(2_000).default([]),
  understanding: z.array(z.strictObject({ sourceId: id, sourceVersion: z.number().int().nonnegative(), topics: z.array(z.string().max(120)).max(40) })).default([]),
  analyses: z.array(z.strictObject({ chunkId: id, summary: z.string().max(500), question: z.string().max(500) })).default([]),
  processing: z.strictObject({
    status: z.enum(['idle', 'queued', 'processing', 'ready', 'failed']),
    stage: z.enum(['acquisition', 'extraction', 'understanding', 'chunking', 'analysis', 'assembly', 'done']).default('done'),
    generation: z.number().int().nonnegative().default(0),
    sourceFingerprint: z.string().nullable(),
    error: z.string().nullable(),
    jobs: z.array(cohortTextJobViewSchema).max(505).optional(),
    driver: z.enum(['snapshot', 'durable']).optional(),
  }).default({ status: 'idle', stage: 'done', generation: 0, sourceFingerprint: null, error: null }),
  release: cohortReleaseStateSchema.optional(),
  journey: cohortJourneySchema.optional(),
  recommendations: cohortRecommendationsSchema.optional(),
  discovery: cohortDiscoverySchema.optional(),
  seo: cohortSeoSchema.optional(),
});
export type CohortWorkspace = z.infer<typeof cohortWorkspaceSchema>;

export const youtubeBatchItemSchema = z.strictObject({
  url: youtubeVideoUrlSchema,
  label: z.string().trim().min(1).max(300),
  mode: z.enum(['transcript', 'video_observation']).optional(),
  track: youtubeTrackSchema.optional(),
  scope: youtubeTimeScopeSchema.optional(),
  extraction: clientSourceExtractionSchema.optional(),
});
export type YoutubeBatchItem = z.infer<typeof youtubeBatchItemSchema>;

export const cohortActionSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('start_search'), query: z.string().trim().min(1).max(400) }),
  z.strictObject({ type: z.literal('close_panel') }),
  z.strictObject({ type: z.literal('return_to_planning') }),
  z.strictObject({ type: z.literal('create_own_cohort') }),
  z.strictObject({ type: z.literal('choose_starting_point'), choice: z.enum(['have_material', 'find_material', 'have_goal']) }),
  z.strictObject({ type: z.literal('back_to_recommendations') }),
  z.strictObject({ type: z.literal('back_to_starting_point') }),
  z.strictObject({ type: z.literal('start_discovery') }),
  z.strictObject({ type: z.literal('select_discovery_resources'), resultId: id, candidateIds: z.array(id).min(1).max(20).refine(ids => new Set(ids).size === ids.length, 'Duplicate candidate') }),
  z.strictObject({ type: z.literal('start_goal_generation') }),
  z.strictObject({ type: z.literal('begin_material_processing') }),
  z.strictObject({ type: z.literal('open_review') }),
  z.strictObject({ type: z.literal('add_pdf_source'), sourceId: id.optional(), label: z.string().trim().min(1).max(300), uploadId: z.uuid().optional(), extraction: clientSourceExtractionSchema.optional() }).superRefine((v, ctx) => { if (!v.uploadId && !v.extraction) ctx.addIssue({ code: 'custom', message: 'PDF source requires uploadId or client extraction' }); }),
  z.strictObject({ type: z.literal('add_web_source'), sourceId: id.optional(), label: z.string().trim().min(1).max(300), url: publicSourceUrlSchema, extraction: clientSourceExtractionSchema.optional() }),
  z.strictObject({
    type: z.literal('add_youtube_source'),
    sourceId: id.optional(),
    label: z.string().trim().min(1).max(300),
    url: youtubeVideoUrlSchema,
    mode: z.enum(['transcript', 'video_observation']).optional(),
    track: youtubeTrackSchema.optional(),
    scope: youtubeTimeScopeSchema.optional(),
    extraction: clientSourceExtractionSchema.optional(),
  }).superRefine((data, ctx) => {
    if (!data.extraction && data.mode === 'transcript' && !data.track) {
      ctx.addIssue({ code: 'custom', message: 'Transcript mode requires a track' });
    }
  }),
  z.strictObject({
    type: z.literal('add_youtube_sources_batch'),
    videos: z.array(youtubeBatchItemSchema).min(1).max(MAX_COHORT_SOURCES),
  }),
  z.strictObject({
    type: z.literal('set_youtube_mode'),
    sourceId: id,
    mode: z.enum(['transcript', 'video_observation']),
    track: youtubeTrackSchema.optional(),
  }).superRefine((data, ctx) => {
    if (data.mode === 'transcript' && !data.track) {
      ctx.addIssue({ code: 'custom', message: 'Transcript mode requires a track' });
    }
  }),
  z.strictObject({ type: z.literal('add_github_source'), sourceId: id.optional(), label: z.string().trim().min(1).max(300), repoUrl: githubRepoUrlSchema, ref: githubRefSchema.default('main'), paths: githubPathsSchema.optional(), extraction: clientSourceExtractionSchema.optional() }),
  z.strictObject({ type: z.literal('set_pdf_pages'), sourceId: id, pages: z.array(z.number().int().min(1).max(200)).min(1).max(200) }),
  z.strictObject({ type: z.literal('refresh_web_source'), sourceId: id, url: publicSourceUrlSchema.optional() }),
  z.strictObject({ type: z.literal('set_youtube_scope'), sourceId: id, scope: youtubeTimeScopeSchema.optional() }),
  z.strictObject({ type: z.literal('set_github_scope'), sourceId: id, paths: githubPathsSchema }),
  z.strictObject({ type: z.literal('set_intent'), intent: text }),
  z.strictObject({ type: z.literal('set_audience'), audience: z.string().trim().max(500) }),
  z.strictObject({ type: z.literal('set_daily_minutes'), dailyMinutes: z.number().int().min(1).max(1_440) }),
  z.strictObject({ type: z.literal('edit_presentation'), title: text.optional(), description: z.string().trim().max(4_000).optional(), coverImage: publicSourceUrlSchema.nullable().optional(), subtitle: z.string().trim().max(500).optional(), difficulty: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']).optional(), categories: z.array(z.string().trim().min(1).max(80)).max(12).optional(), learningOutcomes: z.array(z.string().trim().min(1).max(500)).max(20).optional(), requirements: z.array(z.string().trim().min(1).max(500)).max(20).optional() }).refine(value => Object.keys(value).length > 1, 'Presentation edit needs a field'),
  z.strictObject({ type: z.literal('set_season_title'), seasonKey: z.string().min(1).max(200), title: z.string().trim().min(1).max(300) }),
  z.strictObject({ type: z.literal('edit_lesson'), lessonId: id, title: text.optional(), objective: text.optional() }).refine(value => value.title !== undefined || value.objective !== undefined, 'Lesson edit needs title or objective'),
  z.strictObject({ type: z.literal('add_lesson'), lessonId: id.optional(), title: text, objective: text }),
  z.strictObject({ type: z.literal('remove_lesson'), lessonId: id }),
  z.strictObject({ type: z.literal('reorder_lessons'), lessonIds: z.array(id).min(1).max(200) }),
  z.strictObject({ type: z.literal('set_lesson_pin'), lessonId: id, pinned: z.boolean() }),
  z.strictObject({ type: z.literal('add_text_source'), sourceId: id.optional(), label: z.string().trim().min(1).max(300), text: sourceText, extraction: clientSourceExtractionSchema.optional() }),
  z.strictObject({ type: z.literal('edit_text_source'), sourceId: id, label: z.string().trim().min(1).max(300), text: sourceText }),
  z.strictObject({ type: z.literal('remove_source'), sourceId: id }),
  z.strictObject({ type: z.literal('retry_recommendations') }),
  z.strictObject({ type: z.literal('cancel_discovery') }),
  z.strictObject({ type: z.literal('retry_processing') }),
  z.strictObject({ type: z.literal('retry_text_job'), jobId: id }),
  z.strictObject({ type: z.literal('cancel_text_processing') }),
  z.strictObject({ type: z.literal('cancel_source_processing'), sourceId:id }),
  z.strictObject({ type: z.literal('prepare_release'), mode: z.enum(['private_activation', 'public_publish']).default('private_activation'), candidateHash: z.string().regex(/^[a-f0-9]{64}$/).optional() }),
  z.strictObject({ type: z.literal('commit_release'), mode: z.enum(['private_activation', 'public_publish']), candidateHash: z.string().regex(/^[a-f0-9]{64}$/), receipt: cohortReleaseReceiptSchema.optional() }),
]);
export type CohortAction = z.infer<typeof cohortActionSchema>;

export interface CohortActionContext {
  actionId: string;
  workspaceId: string;
  expectedRevision: number;
  currentRevision: number;
  entityVersions: ReadonlyMap<string, number>;
  /** Trusted repository proof loaded from an owned accepted discovery artifact. Never client supplied. */
  discoveryResult?: { resultId: string; fingerprint: string; items: z.infer<typeof cohortDiscoveryItemSchema>[] };
}

function ref(workspaceId: string, lesson: CohortLesson) {
  return entityRefSchema.parse({ kind: 'lesson', id: lesson.id, version: lesson.version });
}

export function planCohortAction(state: CohortWorkspace, actionInput: unknown, context: CohortActionContext): DomainActionPlan<CohortWorkspace> {
  const action = cohortActionSchema.parse(actionInput);
  if (context.expectedRevision !== context.currentRevision) throw new Error('STALE_WORKSPACE');
  const next = cohortWorkspaceSchema.parse(structuredClone(state));
  const changed: ReturnType<typeof ref>[] = [];
  const invalidated: string[] = [];
  const touch = (lesson: CohortLesson) => { lesson.version += 1; changed.push(ref(context.workspaceId, lesson)); };
  const invalidateRelease = () => {
    if (next.release && next.release.status !== 'draft') {
      next.release = { status: 'draft' };
      if (!invalidated.includes('release')) invalidated.push('release');
    }
  };
  const navigationResult = (summary: string): DomainActionPlan<CohortWorkspace> => ({ nextState: next, changed, invalidated, summary, undoable: false });
  const journey = () => {
    if (!next.journey) next.journey = { version: 1, step: 'recommendations', branch: null, processingStarted: next.sources.length > 0 || next.lessons.length > 0, intentVersion: 0 };
    return next.journey;
  };
  const requireStep = (...steps: CohortJourney['step'][]) => {
    const current = journey();
    if (!steps.includes(current.step)) throw new Error('INVALID_JOURNEY_TRANSITION');
    return current;
  };
  if (action.type === 'start_search') {
    const current = journey();
    if (current.step === 'published') throw new Error('INVALID_JOURNEY_TRANSITION');
    next.intent = action.query;
    current.intentVersion = (current.intentVersion ?? 0) + 1;
    current.step = 'recommendations';
    delete next.recommendations;
    delete next.discovery;
    return navigationResult(`Searching cohorts for "${action.query}".`);
  }
  if (action.type === 'close_panel' || action.type === 'return_to_planning') {
    const current = journey();
    current.step = 'chat';
    delete next.recommendations;
    delete next.discovery;
    if (next.processing.status === 'queued' || next.processing.status === 'processing') {
      next.processing = {
        status: 'idle',
        stage: 'done',
        generation: next.processing.generation + 1,
        sourceFingerprint: null,
        error: null,
        driver: 'durable',
      };
    }
    return navigationResult('Workspace panel closed; returned to chat.');
  }
  if (action.type === 'create_own_cohort') {
    const current = journey();
    if (current.step === 'chat' || current.step === 'recommendations') {
      current.step = 'starting_point';
      return navigationResult('Starting point opened.');
    }
    if (['starting_point', 'material_input', 'discovery', 'goal_setup', 'ready', 'review'].includes(current.step)) {
      return navigationResult('Starting point already active.');
    }
    throw new Error('INVALID_JOURNEY_TRANSITION');
  }
  if (action.type === 'choose_starting_point') {
    const current = journey();
    if (['starting_point', 'recommendations', 'chat'].includes(current.step)) {
      current.branch = action.choice === 'have_material' ? 'have_material' : 'find_material';
      current.step = action.choice === 'have_material' ? 'material_input' : 'discovery';
      return navigationResult('Starting point selected.');
    }
    if (current.step === 'material_input' && action.choice === 'have_material') {
      return navigationResult('Material input already active.');
    }
    if (current.step === 'discovery' && action.choice === 'find_material') {
      return navigationResult('Discovery already active.');
    }
    if (current.step === 'goal_setup' && action.choice === 'have_goal') {
      return navigationResult('Goal setup already active.');
    }
    if (['material_input', 'discovery', 'goal_setup'].includes(current.step)) {
      current.branch = action.choice === 'have_material' ? 'have_material' : 'find_material';
      current.step = action.choice === 'have_material' ? 'material_input' : 'discovery';
      return navigationResult('Starting point switched.');
    }
    throw new Error('INVALID_JOURNEY_TRANSITION');
  }
  if (action.type === 'back_to_recommendations' || action.type === 'back_to_starting_point') {
    const current = journey(); if (current.step === 'published') throw new Error('INVALID_JOURNEY_TRANSITION');
    current.step = action.type === 'back_to_recommendations' ? 'recommendations' : 'starting_point';
    return navigationResult('Journey navigation updated.');
  }
  if (action.type === 'retry_recommendations') {
    const current = requireStep('recommendations');
    const prevGen = next.recommendations?.generation ?? 0;
    const nextGen = prevGen + 1;
    next.recommendations = {
      requestId: context.actionId,
      fingerprint: `pending:${current.intentVersion}:${context.actionId}:${nextGen}`,
      status: 'queued',
      generation: nextGen,
      items: [],
    };
    return navigationResult('Recommendations queued for retry.');
  }
  if (action.type === 'cancel_discovery') {
    const current = requireStep('discovery');
    if (current.branch !== 'find_material') throw new Error('INVALID_JOURNEY_BRANCH');
    if (!next.discovery || !['queued', 'running'].includes(next.discovery.status)) {
      throw new Error('NO_ACTIVE_DISCOVERY');
    }
    next.discovery = {
      ...next.discovery,
      status: 'canceled',
    };
    return navigationResult('Resource discovery canceled.');
  }
  if (action.type === 'start_discovery') {
    const current = requireStep('discovery', 'chat', 'review', 'goal_setup', 'material_input');
    current.branch = 'find_material'; current.step = 'discovery';
    if (current.branch !== 'find_material') throw new Error('INVALID_JOURNEY_BRANCH');
    if (next.discovery && ['queued', 'running'].includes(next.discovery.status)) return navigationResult('Existing discovery retained.');
    next.discovery = { requestId: context.actionId, fingerprint: `pending:${current.intentVersion}:${context.actionId}`, status: 'queued', generation: (next.discovery?.generation ?? -1) + 1, items: [] };
    return navigationResult('Resource discovery requested.');
  }
  if (action.type === 'select_discovery_resources') {
    const current = requireStep('discovery');
    const projection = next.discovery; const proof = context.discoveryResult;
    if (current.branch !== 'find_material' || projection?.status !== 'ready' || projection.resultId !== action.resultId || !proof || proof.resultId !== action.resultId || proof.fingerprint !== projection.fingerprint) throw new Error('INVALID_DISCOVERY_RESULT');
    const candidates = z.array(cohortDiscoveryItemSchema).max(20).parse(proof.items);
    if (new Set(candidates.map(item => item.id)).size !== candidates.length) throw new Error('INVALID_DISCOVERY_RESULT');
    const selected = action.candidateIds.map(candidateId => {
      const candidate = candidates.find(item => item.id === candidateId);
      if (!candidate || !projection.items.some(item => item.id === candidate.id && item.url === candidate.url && item.kind === candidate.kind)) throw new Error('INVALID_DISCOVERY_CANDIDATE');
      return candidate;
    });
    if (next.sources.length + selected.length > MAX_COHORT_SOURCES) throw new Error('TOO_MANY_SOURCES');
    selected.forEach((candidate, index) => {
      const sourceId = `${context.actionId}:discovery:${index}`;
      if (sourceId.length > 200 || next.sources.some(item => item.id === sourceId)) throw new Error('DUPLICATE_SOURCE');
      next.sources.push({ id: sourceId, version: 0, label: candidate.label, text: '', input: { kind: 'web', url: candidate.url }, checksum: null, state: 'queued' });
    });
    invalidateRelease(); current.step = 'material_input'; invalidated.push('sources', 'curriculum');
    if (current.processingStarted) next.processing = { status: 'queued', stage: 'acquisition', generation: next.processing.generation + 1, sourceFingerprint: null, error: null };
    return navigationResult('Selected resources retained.');
  }
  if (action.type === 'start_goal_generation' || action.type === 'begin_material_processing') {
    const current = requireStep('goal_setup', 'material_input', 'chat', 'review');
    if (action.type === 'start_goal_generation') {
      current.branch = 'have_goal';
      next.dailyMinutes ??= 30;
      if (!next.intent.trim() || next.dailyMinutes < 1) throw new Error('GOAL_NOT_CONFIRMED');
      const sourceId = `generated-guide:${current.intentVersion}`;
      const input = { kind: 'generated_guide' as const, goal: next.intent, audience: next.audience, dailyMinutes: next.dailyMinutes, intentVersion: current.intentVersion };
      const existing = next.sources.find(item => item.id === sourceId);
      if (existing && existing.input?.kind !== 'generated_guide') throw new Error('DUPLICATE_SOURCE');
      if (!existing) {
        if (next.sources.length >= MAX_COHORT_SOURCES) throw new Error('TOO_MANY_SOURCES');
        next.sources.push({ id: sourceId, version: 0, label: 'Generated learning guide', text: '', input, checksum: null, state: 'queued' });
      } else if (JSON.stringify(existing.input) !== JSON.stringify(input)) {
        existing.input = input; existing.version++; existing.text = ''; existing.state = 'queued'; existing.checksum = null;
        delete existing.retainedInputId; delete existing.extractionId; delete existing.locations; delete existing.provenance;
      }
    } else {
      if (!next.sources.length) throw new Error('NO_SOURCES');
      current.branch ??= 'have_material';
    }
    current.processingStarted = true; invalidateRelease();
    if (canRunDeterministicPipeline(next)) {
      const processed = runDeterministicPipeline(next);
      return {
        nextState: processed,
        changed,
        invalidated: ['sources', 'chunks', 'analysis', 'curriculum', 'release'],
        summary: 'Curriculum generated and ready for review.',
        undoable: false,
      };
    }
    current.step = 'processing';
    next.processing = { status: 'queued', stage: 'acquisition', generation: next.processing.generation + 1, sourceFingerprint: null, error: null };
    return navigationResult('Source processing requested.');
  }
  if (action.type === 'open_review') {
    const current = requireStep('ready', 'chat');
    if (current.step === 'ready') {
      if (next.processing.status !== 'ready' || !next.processing.sourceFingerprint || !next.lessons.length) {
        throw new Error('ASSEMBLY_NOT_READY');
      }
    } else {
      if (!next.lessons.length) throw new Error('NO_LESSONS');
      if (['queued', 'processing'].includes(next.processing.status) ||
          next.processing.jobs?.some(job => ['queued', 'running'].includes(job.status))) {
        throw new Error('PROCESSING_ACTIVE');
      }
      if (next.processing.status !== 'ready') {
        next.processing = { ...next.processing, status: 'ready', stage: 'done', error: null };
      }
    }
    current.step = 'review';
    return navigationResult('Curriculum review opened.');
  }
  if (next.journey && !next.journey.processingStarted && (action.type === 'retry_processing' || action.type === 'retry_text_job')) throw new Error('PROCESSING_NOT_STARTED');
  if (action.type === 'retry_text_job') {
    const job = next.processing.jobs?.find(item => item.id === action.jobId);
    if (!job || job.status !== 'failed' || !job.retryable) throw new Error('JOB_NOT_RETRYABLE');
    next.processing.status = 'queued'; next.processing.error = null;
    return { nextState: next, changed: [], invalidated: [], summary: 'Failed source job queued for retry.', undoable: false };
  }
  if (action.type === 'cancel_text_processing') {
    next.processing.status = 'idle';
    next.processing.error = null;
    return { nextState: next, changed: [], invalidated: [], summary: 'Source processing canceled.', undoable: false };
  }
  if(action.type==='cancel_source_processing') {
    const source=next.sources.find(item=>item.id===action.sourceId);if(!source) throw new Error('UNKNOWN_SOURCE');
    const expected=context.entityVersions.get(source.id);if(expected!==undefined && expected!==source.version) throw new Error('STALE_ENTITY');
    if(!next.processing.jobs?.some(job=>job.sourceId===source.id && ['queued','running','failed'].includes(job.status))) throw new Error('NO_ACTIVE_SOURCE_JOBS');
    return {nextState:next,changed:[],invalidated:[],summary:'Selected source processing stopped; other sources continue.',undoable:false};
  }
  const queueAfterPreferenceChange = (readyStage: 'analysis' | 'assembly') => {
    invalidateRelease();
    if (!next.sources.length || (next.journey && !next.journey.processingStarted)) return;
    const stage = next.processing.status === 'ready' ? readyStage : next.processing.status === 'failed' ? 'acquisition' : next.processing.stage;
    next.processing = { ...next.processing, status: 'queued', stage, generation: next.processing.generation + 1, error: null };
  };

  if (action.type === 'set_intent') { invalidateRelease(); if (next.intent !== action.intent && next.journey) { next.journey.intentVersion++; delete next.recommendations; delete next.discovery; } next.intent = action.intent; invalidated.push('curriculum'); queueAfterPreferenceChange('assembly'); return { nextState: next, changed: [], invalidated, summary: 'Learning intent updated.', undoable: true }; }
  if (action.type === 'set_audience') { invalidateRelease(); next.audience = action.audience; invalidated.push('analysis', 'curriculum'); queueAfterPreferenceChange('analysis'); return { nextState: next, changed: [], invalidated, summary: 'Audience updated.', undoable: true }; }
  if (action.type === 'set_daily_minutes') { invalidateRelease(); next.dailyMinutes = action.dailyMinutes; invalidated.push('curriculum'); queueAfterPreferenceChange('assembly'); return { nextState: next, changed: [], invalidated, summary: 'Daily learning time updated.', undoable: true }; }
  if (action.type === 'edit_presentation') {
    invalidateRelease();
    const { type: actionType, title, description, coverImage, ...presentation } = action;
    void actionType;
    if (title !== undefined) next.title = title;
    if (description !== undefined) next.description = description;
    const current = next.presentation ?? {};
    next.presentation = { ...current, ...presentation, ...(coverImage === null ? { coverImage: undefined } : coverImage !== undefined ? { coverImage } : {}) };
    return { nextState: next, changed: [], invalidated: ['release'], summary: 'Cohort presentation updated.', undoable: true };
  }
  if (action.type === 'set_season_title') {
    invalidateRelease();
    next.presentation = { ...(next.presentation ?? {}), seasonTitles: { ...(next.presentation?.seasonTitles ?? {}), [action.seasonKey]: action.title } };
    return { nextState: next, changed: [], invalidated: ['release'], summary: 'Season title updated.', undoable: true };
  }

  const queueProcessing = () => {
    if (next.journey && !next.journey.processingStarted) {
      next.processing = { ...next.processing, status: 'idle', stage: 'done', error: null };
      return;
    }
    if (canRunDeterministicPipeline(next)) {
      const processed = runDeterministicPipeline(next);
      Object.assign(next, processed);
      return;
    }
    next.processing = { status: 'queued', stage: 'acquisition', generation: next.processing.generation + 1, sourceFingerprint: null, error: null };
  };

  if (action.type === 'add_text_source') {
    invalidateRelease();
    const sourceId = action.sourceId ?? context.actionId;
    if (next.sources.some(source => source.id === sourceId)) throw new Error('DUPLICATE_SOURCE');
    if (next.sources.length >= MAX_COHORT_SOURCES) throw new Error('TOO_MANY_SOURCES');
    if (new TextEncoder().encode(action.text).byteLength > 200_000) throw new Error('SOURCE_TOO_LARGE');
    if (action.extraction) {
      next.sources.push({
        id: sourceId,
        version: 0,
        label: action.label,
        text: action.extraction.text,
        locations: action.extraction.locations,
        provenance: action.extraction.provenance,
        checksum: action.extraction.checksum ?? sha256(action.extraction.text),
        state: 'ready',
      });
    } else {
      next.sources.push({ id: sourceId, version: 0, label: action.label, text: action.text, checksum: null, state: 'queued' });
    }
    queueProcessing();
    return { nextState: next, changed: [], invalidated: ['sources', 'chunks', 'analysis', 'curriculum'], summary: `Added source: ${action.label}`, undoable: true };
  }
  if (action.type === 'add_pdf_source' || action.type === 'add_web_source' || action.type === 'add_youtube_source' || action.type === 'add_github_source') {
    invalidateRelease();
    const sourceId = action.sourceId ?? context.actionId;
    if (next.sources.some(source => source.id === sourceId)) throw new Error('DUPLICATE_SOURCE');
    if (next.sources.length >= MAX_COHORT_SOURCES) throw new Error('TOO_MANY_SOURCES');
    const input = action.type === 'add_pdf_source'
      ? (action.uploadId ? { kind: 'pdf' as const, uploadId: action.uploadId } : undefined)
      : action.type === 'add_web_source'
      ? { kind: 'web' as const, url: new URL(action.url).href.split('#')[0] }
      : action.type === 'add_youtube_source'
      ? {
          kind: 'youtube' as const,
          url: action.url,
          mode: action.mode ?? (action.track ? 'transcript' : 'video_observation'),
          ...(action.track ? { track: action.track } : {}),
          ...(action.scope ? { scope: action.scope } : {}),
        }
      : { kind: 'github' as const, repoUrl: action.repoUrl, ref: action.ref, ...(action.paths ? { paths: action.paths } : {}) };
    if (action.extraction) {
      next.sources.push({
        id: sourceId,
        version: 0,
        label: action.label,
        text: action.extraction.text,
        locations: action.extraction.locations,
        provenance: action.extraction.provenance,
        checksum: action.extraction.checksum ?? sha256(action.extraction.text),
        state: 'ready',
        ...(input ? { input } : {}),
      });
    } else {
      next.sources.push({ id: sourceId, version: 0, label: action.label, text: '', checksum: null, state: 'queued', input });
    }
    queueProcessing();
    const labelKind = action.type === 'add_pdf_source' ? 'PDF' : action.type === 'add_web_source' ? 'web' : action.type === 'add_youtube_source' ? 'YouTube' : 'GitHub';
    return { nextState: next, changed: [], invalidated: ['sources', 'curriculum'], summary: `Added ${labelKind} source: ${action.label}`, undoable: true };
  }
  if (action.type === 'add_youtube_sources_batch') {
    invalidateRelease();
    if (next.sources.length + action.videos.length > MAX_COHORT_SOURCES) throw new Error('TOO_MANY_SOURCES');
    action.videos.forEach((video, index) => {
      const sourceId = action.videos.length === 1 && index === 0
        ? context.actionId
        : `${context.actionId}:yt:${index}`;
      if (next.sources.some(source => source.id === sourceId)) throw new Error('DUPLICATE_SOURCE');
      const input = {
        kind: 'youtube' as const,
        url: video.url,
        mode: video.mode ?? (video.track ? 'transcript' : 'video_observation'),
        ...(video.track ? { track: video.track } : {}),
        ...(video.scope ? { scope: video.scope } : {}),
      };
      if (video.extraction) {
        next.sources.push({
          id: sourceId,
          version: 0,
          label: video.label,
          text: video.extraction.text,
          locations: video.extraction.locations,
          provenance: video.extraction.provenance,
          checksum: video.extraction.checksum ?? sha256(video.extraction.text),
          state: 'ready',
          input,
        });
      } else {
        next.sources.push({ id: sourceId, version: 0, label: video.label, text: '', checksum: null, state: 'queued', input });
      }
    });
    queueProcessing();
    return { nextState: next, changed: [], invalidated: ['sources', 'curriculum'], summary: `Added ${action.videos.length} YouTube sources`, undoable: true };
  }
  if (action.type === 'set_youtube_mode') {
    invalidateRelease();
    const source = next.sources.find(item => item.id === action.sourceId);
    if (!source) throw new Error('UNKNOWN_SOURCE');
    const expected = context.entityVersions.get(source.id);
    if (expected !== undefined && expected !== source.version) throw new Error('STALE_ENTITY');
    if (source.input?.kind !== 'youtube') throw new Error('INVALID_YOUTUBE_SOURCE');
    const currentMode = source.input.mode ?? 'transcript';
    if (currentMode === action.mode && (action.mode !== 'transcript' || JSON.stringify(source.input.track) === JSON.stringify(action.track))) {
      return { nextState: next, changed: [], invalidated: [], summary: 'YouTube acquisition mode unchanged.', undoable: false };
    }
    source.input = {
      ...source.input,
      mode: action.mode,
      track: action.mode === 'transcript' ? (action.track ?? source.input.track ?? { id: 'en', language: 'en', kind: 'manual', translated: false }) : undefined,
    };
    source.version++; source.text = ''; source.state = 'queued'; source.checksum = null;
    delete source.retainedInputId; delete source.extractionId; delete source.locations; delete source.provenance;
    next.chunks = next.chunks.filter(chunk => chunk.sourceId !== source.id);
    next.understanding = next.understanding.filter(item => item.sourceId !== source.id);
    const valid = new Set(next.chunks.map(chunk => chunk.id)); next.analyses = next.analyses.filter(item => valid.has(item.chunkId));
    next.lessons = next.lessons.filter(lesson => lesson.pinned || lesson.manualOverride || lesson.sourceChunkIds.every(id => valid.has(id)));
    next.lessons.forEach(lesson => { if (lesson.sourceChunkIds.some(id => !valid.has(id))) lesson.evidenceStatus = 'orphaned'; });
    queueProcessing();
    return { nextState: next, changed: [], invalidated: ['sources', 'curriculum'], summary: `YouTube acquisition mode updated to ${action.mode}.`, undoable: true };
  }
  if (action.type === 'set_pdf_pages' || action.type === 'refresh_web_source' || action.type === 'set_youtube_scope' || action.type === 'set_github_scope') {
    invalidateRelease();
    const source = next.sources.find(item => item.id === action.sourceId);
    if (!source) throw new Error('UNKNOWN_SOURCE');
    const expected = context.entityVersions.get(source.id);
    if (expected !== undefined && expected !== source.version) throw new Error('STALE_ENTITY');
    if (action.type === 'set_pdf_pages') {
      if (source.input?.kind !== 'pdf' || new Set(action.pages).size !== action.pages.length) throw new Error('INVALID_PDF_SCOPE');
      source.input.pages = [...action.pages].sort((a,b) => a-b);
    } else if (action.type === 'refresh_web_source') {
      if (source.input?.kind !== 'web') throw new Error('INVALID_WEB_SOURCE');
      source.input.url = new URL(action.url ?? source.input.url).href.split('#')[0]; delete source.retainedInputId;
    } else if (action.type === 'set_youtube_scope') {
      if (source.input?.kind !== 'youtube') throw new Error('INVALID_YOUTUBE_SOURCE');
      if (action.scope) source.input.scope = action.scope;
      else delete source.input.scope;
    } else {
      if (source.input?.kind !== 'github') throw new Error('INVALID_GITHUB_SOURCE');
      source.input.paths = action.paths;
    }
    source.version++; source.text = ''; source.state = 'queued'; source.checksum = null;
    delete source.extractionId; delete source.locations; delete source.provenance;
    next.chunks = next.chunks.filter(chunk => chunk.sourceId !== source.id);
    next.understanding = next.understanding.filter(item => item.sourceId !== source.id);
    const valid = new Set(next.chunks.map(chunk => chunk.id)); next.analyses = next.analyses.filter(item => valid.has(item.chunkId));
    next.lessons = next.lessons.filter(lesson => lesson.pinned || lesson.manualOverride || lesson.sourceChunkIds.every(id => valid.has(id)));
    next.lessons.forEach(lesson => { if (lesson.sourceChunkIds.some(id => !valid.has(id))) lesson.evidenceStatus = 'orphaned'; });
    queueProcessing();
    return { nextState: next, changed: [], invalidated: ['sources', 'curriculum'], summary: 'Source scope updated.', undoable: true };
  }

  if (action.type === 'edit_text_source') {
    invalidateRelease();
    const source = next.sources.find(item => item.id === action.sourceId);
    if (!source) throw new Error('UNKNOWN_SOURCE');
    if (source.input) throw new Error('SOURCE_REQUIRES_SCOPE_ACTION');
    const expectedVersion = context.entityVersions.get(source.id);
    if (expectedVersion !== undefined && expectedVersion !== source.version) throw new Error('STALE_ENTITY');
    if (new TextEncoder().encode(action.text).byteLength > 200_000) throw new Error('SOURCE_TOO_LARGE');
    source.version += 1;
    source.label = action.label;
    source.text = action.text;
    source.checksum = null;
    source.state = 'queued';
    next.chunks = next.chunks.filter(chunk => chunk.sourceId !== source.id);
    next.understanding = next.understanding.filter(unit => unit.sourceId !== source.id);
    const validChunks = new Set(next.chunks.map(chunk => chunk.id));
    next.analyses = next.analyses.filter(item => validChunks.has(item.chunkId));
    next.lessons = next.lessons.filter(lesson => lesson.pinned || lesson.manualOverride || lesson.sourceChunkIds.every(chunkId => validChunks.has(chunkId)));
    next.lessons.forEach(lesson => { if (lesson.sourceChunkIds.some(chunkId => !validChunks.has(chunkId))) lesson.evidenceStatus = 'orphaned'; });
    queueProcessing();
    return { nextState: next, changed: [], invalidated: ['sources', 'chunks', 'analysis', 'curriculum'], summary: `Updated source: ${source.label}`, undoable: true };
  }
  if (action.type === 'remove_source') {
    invalidateRelease();
    const source = next.sources.find(item => item.id === action.sourceId);
    if (!source) throw new Error('UNKNOWN_SOURCE');
    const expectedVersion = context.entityVersions.get(source.id);
    if (expectedVersion !== undefined && expectedVersion !== source.version) throw new Error('STALE_ENTITY');
    next.sources = next.sources.filter(item => item.id !== action.sourceId);
    next.chunks = next.chunks.filter(chunk => chunk.sourceId !== action.sourceId);
    next.understanding = next.understanding.filter(unit => unit.sourceId !== action.sourceId);
    const validChunks = new Set(next.chunks.map(chunk => chunk.id));
    next.analyses = next.analyses.filter(item => validChunks.has(item.chunkId));
    next.lessons = next.lessons.filter(lesson => lesson.pinned || lesson.manualOverride || lesson.sourceChunkIds.every(chunkId => validChunks.has(chunkId)));
    next.lessons.forEach(lesson => { if (lesson.sourceChunkIds.some(chunkId => !validChunks.has(chunkId))) lesson.evidenceStatus = 'orphaned'; });
    if (next.journey && !next.journey.processingStarted) {
      next.processing = { ...next.processing, status: 'idle', stage: 'done', error: null };
    } else {
      next.processing = { status: next.sources.length ? 'queued' : 'idle', stage: next.sources.length ? 'acquisition' : 'done', generation: next.processing.generation + 1, sourceFingerprint: null, error: null };
    }
    return { nextState: next, changed: [], invalidated: ['sources', 'chunks', 'analysis', 'curriculum'], summary: `Removed source: ${source.label}`, undoable: true };
  }
  if (action.type === 'retry_processing') {
    if (next.sources.length === 0) throw new Error('NO_SOURCES');
    if (next.journey) {
      next.journey.processingStarted = true;
      next.journey.step = 'processing';
    }
    next.processing = { status: 'queued', stage: 'acquisition', generation: next.processing.generation + 1, sourceFingerprint: null, error: null };
    return { nextState: next, changed: [], invalidated: [], summary: 'Source processing queued.', undoable: false };
  }

  if (action.type === 'add_lesson') {
    invalidateRelease();
    const newLesson: CohortLesson = {
      id: action.lessonId ?? crypto.randomUUID(),
      version: 0,
      title: action.title,
      objective: action.objective,
      sourceChunkIds: [],
      pinned: false,
    };
    next.lessons.push(newLesson);
    touch(newLesson);
    invalidated.push('curriculum');
    return { nextState: next, changed, invalidated, summary: `Added lesson: ${newLesson.title}`, undoable: true };
  }

  if (action.type === 'remove_lesson') {
    invalidateRelease();
    const targetIdx = next.lessons.findIndex(item => item.id === action.lessonId);
    if (targetIdx === -1) throw new Error('UNKNOWN_LESSON');
    const target = next.lessons[targetIdx];
    const expectedVersion = context.entityVersions.get(target.id);
    if (expectedVersion !== undefined && expectedVersion !== target.version) throw new Error('STALE_ENTITY');
    if (target.pinned) throw new Error('PINNED_LESSON_LOCKED');
    next.lessons.splice(targetIdx, 1);
    invalidated.push('curriculum');
    return { nextState: next, changed, invalidated, summary: `Removed lesson: ${target.title}`, undoable: true };
  }

  if (action.type === 'prepare_release') {
    if (next.processing.status === 'processing' || next.processing.status === 'queued') {
      throw new Error('PROCESSING_NOT_COMPLETE');
    }
    if (next.lessons.length === 0) {
      throw new Error('NO_LESSONS');
    }
    if (next.lessons.some(l => !l.title.trim() || !l.objective.trim())) {
      throw new Error('INCOMPLETE_LESSONS');
    }
    if (action.mode === 'public_publish') {
      if (next.lessons.some(l => l.evidenceStatus === 'orphaned')) {
        throw new Error('PUBLIC_RELEASE_ORPHANED_EVIDENCE');
      }
      if (next.sources.some(s => s.isRestricted)) {
        throw new Error('PUBLIC_RELEASE_RESTRICTED_SOURCE');
      }
    }
    next.release = {
      status: 'prepared',
      mode: action.mode,
      candidateHash: action.candidateHash,
      preparedAt: new Date().toISOString(),
    };
    return {
      nextState: next,
      changed: [],
      invalidated: ['release'],
      summary: `Workspace prepared for ${action.mode === 'public_publish' ? 'public publication' : 'private activation'}.`,
      undoable: true,
    };
  }

  if (action.type === 'commit_release') {
    next.release = {
      status: 'released',
      mode: action.mode,
      candidateHash: action.candidateHash,
      effectKey: action.receipt?.effectKey,
      cohortId: action.receipt?.cohortId,
      releasedAt: action.receipt?.releasedAt ?? new Date().toISOString(),
      receipt: action.receipt,
    };
    if (next.journey) next.journey.step = 'published';
    return {
      nextState: next,
      changed: [],
      invalidated: ['release'],
      summary: `Workspace released as ${action.mode === 'public_publish' ? 'public cohort' : 'private cohort'}.`,
      undoable: false,
    };
  }

  const lessonId = action.type === 'reorder_lessons' ? null : action.lessonId;
  const lesson = lessonId === null ? undefined : next.lessons.find(item => item.id === lessonId);
  if (action.type !== 'reorder_lessons' && !lesson) throw new Error('UNKNOWN_LESSON');
  if (lesson) {
    const expectedVersion = context.entityVersions.get(lesson.id);
    if (expectedVersion !== undefined && expectedVersion !== lesson.version) throw new Error('STALE_ENTITY');
  }
  if (action.type === 'edit_lesson' && lesson) {
    invalidateRelease();
    if (action.title !== undefined) lesson.title = action.title;
    if (action.objective !== undefined) lesson.objective = action.objective;
    lesson.manualOverride = true;
    touch(lesson); return { nextState: next, changed, invalidated, summary: `Lesson ${lesson.id} updated.`, undoable: true };
  }
  if (action.type === 'set_lesson_pin' && lesson) { invalidateRelease(); lesson.pinned = action.pinned; touch(lesson); return { nextState: next, changed, invalidated, summary: action.pinned ? `Lesson ${lesson.id} pinned.` : `Lesson ${lesson.id} unpinned.`, undoable: true }; }
  if (action.type === 'reorder_lessons') {
    invalidateRelease();
    const current = new Set(next.lessons.map(item => item.id));
    if (action.lessonIds.length !== next.lessons.length || action.lessonIds.some(item => !current.has(item)) || new Set(action.lessonIds).size !== action.lessonIds.length) throw new Error('INVALID_LESSON_ORDER');
    const byId = new Map(next.lessons.map(item => [item.id, item]));
    next.lessons = action.lessonIds.map(item => byId.get(item)!);
    next.lessons.forEach(touch); invalidated.push('curriculum-order');
    return { nextState: next, changed, invalidated, summary: 'Lesson order updated.', undoable: true };
  }
  throw new Error('UNSUPPORTED_ACTION');
}

```
Postcondition: exact supplied contents.

## E. Verification
Author: generated full payloads from observed source and preserved URL acquisition handler. No source files changed. Tests/build not run. Exact automated test migrations remain outstanding; this is a material limitation, not a pass.

Run after tests are supplied: npx tsc --noEmit --incremental false; npm run build; npx vitest run src/client/screens/cohortBuilder/__tests__/material-stage-view.test.tsx src/client/screens/cohortBuilder/__tests__/journey-checkpoint4-branch.test.tsx. All must exit zero. Old expectations for default upload/three choices/replacement need semantic updates, not blanket removal.

Required tests: failed URL preserves value; playlist respects capacity; rapid submit dispatches once; no source deletion on failed remove; zero sources disables Continue; previews precede form in DOM; no file input or textarea; disabled alternate modes; only Remove button in preview; goal save false prevents search; failed search retains input; new result ID resets selection; selection commit false preserves checks; old have_goal draft can enter search; old generated guides remain readable.

Browser: 1440x900 and390x844, 0/1/5/100sources, long titles, missing thumbnail; confirm sticky Continue is within actual scroll owner and clears account controls; no page overflow. Processing recovery must be tested with G before release. Existing raw error messages and image lint need review; do not claim completed validation.

## F. Completion report
Report applied IDs, changed paths, actual commands/results, skipped tests and G blockers. These are proposed payloads; authoring is not application.

## G. Added incident: premature ready screen and dead actions

User reproduction: NLP planning conversation → ask for sources and cohort creation → AI claims community cohort search → user manually adds one YouTube video → Continue → All set, with Build not complete; feed/review disabled; Back appears enabled but does nothing. Screenshot is evidence of inconsistent UI, not proof that all processing was skipped on the server.

### G1. Verified findings

1. `src/shared/cohort-builder/contracts.ts`, begin_material_processing, invokes `runDeterministicPipeline` synchronously when `canRunDeterministicPipeline(next)` is true. `src/shared/cohort-builder/client-pipeline.ts` accepts sources with nonempty text and an array of locations. This can bypass visible intermediate screens by design. Its analysis uses text prefixes and a templated question; that is not equivalent evidence of a thorough AI analysis. Inspect source content/locations and accepted projection before deciding whether this shortcut is valid for a video.
2. `ReadyStageView.tsx` displays the success heading unconditionally, while its local ready predicate requires processing.status ready and a lesson. This permits contradictory success copy with disabled actions when this component is selected prematurely.
3. The same component's act wrapper rejects every action when !ready. Back's button only disables for pending/disabled, so it appears actionable but its handler immediately returns. This is a confirmed source-level defect.
4. Back dispatches back_to_starting_point, which does not implement its displayed Back to material destination.
5. Go to my feed dispatches prepare_release followed by open_review. It neither checks the first result nor performs activation/navigation. Do not label a preparation action as completed activation.
6. `stage-selectors.ts` allows inspectedStage to override active processing stages. Audit stale inspection state and saved journey state alongside processing status. The screenshot alone does not identify which path selected ready.
7. The conversation describes community cohort search rather than external learning-resource discovery. Trace actual tool journal events before asserting which tools ran. Tool success claims must refer to accepted results, not intentions.

### G2. Exact independent repair: Back must remain usable

Target: `src/client/screens/cohortBuilder/stages/ReadyStageView.tsx`.
Prerequisite: unique old blocks; preserve any concurrent notification changes. Apply these three replacements sequentially. These edits repair navigation only; they do not establish overall build readiness.

Old:
```tsx
  const act = async (action: () => Promise<boolean | void>) => {
    if (disabled || !ready || lock.current) return;
```
New:
```tsx
  const act = async (action: () => Promise<boolean | void>, requiresReady = true) => {
    if (disabled || (requiresReady && !ready) || lock.current) return;
```

Old:
```tsx
  const handleBack = async () => {
    await dispatchAction({ type: 'back_to_starting_point' });
  };
```
New:
```tsx
  const handleBack = async () => {
    const opened = await dispatchAction({ type: 'back_to_starting_point' });
    if (!opened) return;
    await dispatchAction({ type: 'choose_starting_point', choice: 'have_material' });
  };
```

Old:
```tsx
                onClick={() => void act(handleBack)}
```
New:
```tsx
                onClick={() => void act(handleBack, false)}
```

Postcondition: incomplete build does not block Back; failed first transition does not dispatch second; accepted transitions enter material_input while preserving sources. Existing action dispatcher must surface rejected actions through its current error mechanism. Do not apply this in isolation as a full incident fix.

### G3. Additional required implementation coverage

R9: Success screen only after current source versions have valid completed assembly and reviewable lessons. Share the readiness contract between stage selection, screen copy and action availability. Preserve server release guards. No unconditional ready screen for failed/queued processing or stale inspection.

R10: Continue must expose genuine processing or completed results consistently. If synchronous processing is retained, show completed stages derived from its accepted output. Do not manufacture delays or fake queued jobs to animate stages. Audit the quality of the deterministic analysis against the promised learning experience before treating it as equivalent to the worker pipeline.

R11: Back works for incomplete, failed and completed builds, preserving materials. Source changes invalidate only affected downstream work. Navigation must not silently cancel jobs or create duplicate processing generations.

R12: Feed action must follow the real private activation flow and navigate only after a confirmed persisted destination. If user review is required first, label the action Review and activate and expose an honest completion path. Never ignore a false prepare_release result or route to a nonexistent feed item.

R13: Review availability and displayed completion state must agree. Missing assembly is a processing/failure state with recovery, not a success screen with unexplained disabled buttons.

R14: External-resource requests use discovery, not community cohort recommendations. Existing community search remains for explicit requests for existing cohorts. Assistant says search started only after accepted discovery request; says resources found only after results. An explicit request to handle creation should not trigger repeated redundant permission questions. Preserve the user's original NLP intent when a video is added.

Required connected inspection: stage-selectors computeActiveStage; client-pipeline final ready/job projection; contract begin/retry/open_review actions; text assembly acceptance; ReleasePanel private activation and destination callback; AI context/tools and tool journal; progress selectors and ChatPane checklist. Record exact workspace run IDs and source versions if production evidence is available. Do not invent production evidence from screenshot text.

### G4. Regression matrix to supply as executable tests

- Incomplete ReadyStageView: Back dispatches both transitions; review/feed cannot run; no misleading success view after selector correction.
- Back first action returns false: no second dispatch; materials remain.
- prepare_release returns false: no open_review, activation or navigation.
- Continue with retained extracted video: chosen processing path and progress representation agree; current output satisfies readiness before success view.
- Queued/running/failed jobs plus historical lessons: no premature ready view.
- Old inspected ready stage plus new processing generation: stale success inspection cannot mask active build.
- Successful assembly: review and activation are enabled and navigate to valid persisted destinations.
- Source change during processing: stale output cannot mark new source version ready.
- NLP resource request: tool routing selects resource discovery; community search does not count as material acquisition; assistant claims match accepted actions.
- Reload at each transition reproduces the same honest stage without losing materials.

### G5. Readiness and author validation

The three G2 old blocks were read directly from current source; no application changes or tests were run. This append expands the existing BLOCKED guide. Full exact payloads and tests for G3/G4 and the earlier redesign remain outstanding. The guide must not be marked READY merely because the Back-button defect has an exact patch.

END OF EXPANDED HANDOFF
