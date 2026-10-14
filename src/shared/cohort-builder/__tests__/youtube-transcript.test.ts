import {describe,expect,it,vi} from 'vitest';
import {retainedYoutubeTranscriptSchema,singleYoutubeVideo,youtubeTranscriptInputSchema,youtubeTimeScopeSchema} from '../youtube-transcript';
import {youtubeTranscriptReadiness} from '@/src/server/domain/cohort-builder/youtube-transcript-policy';
const id='abcdefghijk';
export function transcriptFixture() {return {format:'youtube-transcript-v1' as const,provider:{id:'fixture',version:'1'},acquiredAt:'2026-10-14T00:00:00.000Z',
  video:{id,url:`https://www.youtube.com/watch?v=${id}`,durationMs:60_000,visibility:'public' as const,state:'complete' as const},
  track:{id:'en-manual',language:'en',kind:'manual' as const,translated:false as const},
  segments:[{startMs:0,endMs:5000,text:'Quorums overlap.'},{startMs:6000,endMs:10000,text:'Majorities retain decisions.'}]};}
describe('single video transcript contracts',()=>{
  it.each([`https://youtube.com/watch?v=${id}`,`https://youtu.be/${id}?si=share`,`https://m.youtube.com/shorts/${id}`,`https://www.youtube.com/embed/${id}`])('canonicalizes %s',url=>{
    expect(singleYoutubeVideo(url)).toEqual({videoId:id,url:`https://www.youtube.com/watch?v=${id}`});
  });
  it.each([`https://youtube.com/playlist?list=PLabc`,`https://youtube.com/watch?v=${id}&list=PLabc`,`https://youtube.com/watch?v=${id}&v=12345678901`,
    `https://youtu.be/${id}?v=12345678901`,`https://youtube.com.evil.org/watch?v=${id}`,`https://youtube.com@127.0.0.1/watch?v=${id}`,`http://youtube.com/watch?v=${id}`,
    `https://youtube.com:8443/watch?v=${id}`,`https://youtube.com/watch?v=${id}&t=10`,`https://youtube.com/watch?v=${id}#t=10`,`https://127.0.0.1/watch?v=${id}`])('rejects %s',url=>{
    expect(()=>singleYoutubeVideo(url)).toThrow('INVALID_YOUTUBE_VIDEO_URL');
  });
  it('requires explicit original track and bounded time selection',()=>{
    const retained=transcriptFixture();expect(retainedYoutubeTranscriptSchema.parse(retained)).toEqual(retained);
    expect(youtubeTranscriptInputSchema.parse({url:retained.video.url,track:retained.track,scope:{startMs:1000,endMs:9000}}).scope?.endMs).toBe(9000);
    expect(youtubeTimeScopeSchema.safeParse({startMs:1000,endMs:1000}).success).toBe(false);
    expect(retainedYoutubeTranscriptSchema.safeParse({...retained,track:{...retained.track,translated:true}}).success).toBe(false);
    expect(retainedYoutubeTranscriptSchema.safeParse({...retained,video:{...retained.video,visibility:'private'}}).success).toBe(false);
  });
  it('rejects foreign video identity, fabricated intervals, duplicates and empty segments',()=>{
    const retained=transcriptFixture();
    for(const proposal of [{...retained,video:{...retained.video,id:'12345678901'}},
      {...retained,segments:[{startMs:0,endMs:60001,text:'bad'}]}, {...retained,segments:[retained.segments[0],retained.segments[0]]},
      {...retained,segments:[...retained.segments].reverse()}, {...retained,segments:[{startMs:0,endMs:1000,text:' '}]}])
      expect(retainedYoutubeTranscriptSchema.safeParse(proposal).success).toBe(false);
  });
  it('cannot enable live intake using an environment flag without a provider',()=>{
    vi.stubEnv('INTERACTION_YOUTUBE_ENABLED','1');expect(youtubeTranscriptReadiness()).toEqual({enabled:false,code:'TRANSCRIPT_PROVIDER_REQUIRED'});vi.unstubAllEnvs();
  });
});
