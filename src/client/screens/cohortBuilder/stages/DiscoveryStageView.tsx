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
