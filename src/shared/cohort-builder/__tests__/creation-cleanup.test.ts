import { describe, it, expect } from 'vitest';
import { initialCohort } from '../intake';
import { runDeterministicPipeline } from '../client-pipeline';
import { isBuildComplete, isBuildStale } from '../creation-state';
import { deriveProcessingProgress } from '../creation-view';
import { deriveStageProgress, CREATION_STAGES } from '../creation-progress';
import { validateCohortReadiness } from '../readiness';
import { planCohortAction } from '../contracts';
import { projectAcceptedBuildCompletion } from '../creation-machine';
import { textJobStatus } from '@/src/server/domain/cohort-builder/text-job-status';
import { planTextJobs } from '@/src/server/domain/cohort-builder/text-job-plan';
function ready() {
  const ws=initialCohort('Learn distributed systems');
  const text='Distributed systems coordinate multiple computers using messages and shared protocols.';
  ws.sources=[{id:'s',version:0,label:'Notes',text,checksum:null,state:'ready',locations:[{start:0,end:text.length}]}];
  return runDeterministicPipeline(ws);
}
const context={actionId:'test',workspaceId:'w',expectedRevision:0,currentRevision:0,entityVersions:new Map<string,number>()};
describe('creation cleanup invariants',()=>{
  it('rejects stale content and preferences at both UI and release boundaries',()=>{
    for(const mutate of [(ws:ReturnType<typeof ready>)=>{ws.sources[0].text+=' changed';},(ws:ReturnType<typeof ready>)=>{ws.audience='Experts';},(ws:ReturnType<typeof ready>)=>{ws.dailyMinutes++;}]){
      const ws=ready();expect(isBuildComplete(ws)).toBe(true);mutate(ws);
      expect(isBuildComplete(ws)).toBe(false);expect(isBuildStale(ws)).toBe(true);
      expect(validateCohortReadiness(ws,'private_activation').ready).toBe(false);
      expect(deriveProcessingProgress(ws).steps[3].isComplete).toBe(false);
    }
  });
  it('retains legacy snapshots without pretending to know unrecorded build inputs',()=>{
    const ws=ready();delete ws.processing.buildInputFingerprint;
    expect(isBuildComplete(ws)).toBe(true);
    ws.sources[0].version++;expect(isBuildComplete(ws)).toBe(false);
  });
  it('closing or opening materials preserves the active build',()=>{
    for(const type of ['close_panel','return_to_planning','open_materials'] as const){
      const ws=ready();ws.processing.status='queued';ws.processing.stage='analysis';
      const next=planCohortAction(ws,{type},context).nextState;
      expect(next.processing).toEqual(ws.processing);expect(next.sources).toEqual(ws.sources);
      expect(next.journey?.step).toBe(type==='open_materials'?'material_input':'chat');
    }
  });
  it('every displayed stage reads the same progress decision',()=>{
    const ws=ready();
    for(const status of ['queued','processing','ready','failed','idle'] as const){
      ws.processing.status=status;
      const detail=deriveStageProgress(ws),progress=deriveProcessingProgress(ws);
      CREATION_STAGES.forEach((stage,i)=>expect(progress.steps[i].isComplete).toBe(detail[stage].status==='complete'));
    }
  });
  it('rejects an accepted-source omission rather than synthesizing proof',()=>{
    const ws=ready();
    expect(()=>projectAcceptedBuildCompletion(ws,{sources:[],understanding:ws.understanding,chunks:ws.chunks,analyses:ws.analyses,generatedLessons:ws.lessons,generation:1})).toThrow('INVALID_ACCEPTED_SOURCE');
  });
  it('rejects an accepted-chunk corruption rather than accepting fabricated ranges',()=>{
    const ws=ready();
    const corruptedChunks=[{...ws.chunks[0],start:-1,end:999999}];
    expect(()=>projectAcceptedBuildCompletion(ws,{sources:ws.sources.map(s=>({id:s.id,version:s.version,checksum:s.checksum??''})),understanding:ws.understanding,chunks:corruptedChunks,analyses:ws.analyses,generatedLessons:ws.lessons,generation:1})).toThrow('INVALID_ACCEPTED_CHUNK');
  });
  it('projects the entire 100-source job graph',async()=>{
    const ws=ready();ws.sources=Array.from({length:100},(_,i)=>({...ws.sources[0],id:'s'+i}));
    const plan=planTextJobs(ws);expect(plan.length).toBeGreaterThan(101);
    const tx={query:async(sql:string)=>{
      const limit=Number(sql.match(/LIMIT (\d+)/)?.[1]??0);
      return {rows:plan.slice(0,limit).map((job,i)=>({id:'job'+i,sourceId:job.sourceId,stage:job.stage,status:'accepted',attempts:1,errorCode:null}))};
    }};
    const result=await textJobStatus(tx,'w',ws);
    expect(result.processing.jobs).toHaveLength(plan.length);expect(result.processing.status).toBe('ready');
  });
});
