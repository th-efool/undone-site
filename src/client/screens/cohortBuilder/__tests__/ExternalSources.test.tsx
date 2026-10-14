// @vitest-environment jsdom
import React from 'react';
import {afterEach,expect,it,vi} from 'vitest';
import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {cohortWorkspaceSchema,cohortSourceSchema} from '@/src/shared/cohort-builder/contracts';
const fake=vi.hoisted(()=>({dispatch:vi.fn(async()=>true),view:null as any}));
vi.mock('next-auth/react',()=>({useSession:()=>({data:{user:{id:'owner'}}})}));
vi.mock('@/src/client/interaction/hooks',()=>({useInteractionState:()=>({workspaceId:'workspace',revision:4,view:fake.view}),useDispatchAction:()=>fake.dispatch}));
import {ExternalSources,ExternalSourceScope} from '../ExternalSources';
afterEach(()=>{cleanup();vi.unstubAllGlobals();fake.dispatch.mockClear();});

it('retains PDF submission identity after lost acknowledgement and uses canonical web action',async()=>{
  fake.view=cohortWorkspaceSchema.parse({schemaVersion:1,title:'Test',intent:'Learn',audience:'',dailyMinutes:20,lessons:[]});
  const fetch=vi.fn().mockResolvedValueOnce({ok:true,json:async()=>({pdf:true,web:true,youtube:false,youtubeUnavailableReason:'TRANSCRIPT_PROVIDER_REQUIRED'})}).mockRejectedValueOnce(new Error('NETWORK')).mockResolvedValue({ok:true,json:async()=>({})});vi.stubGlobal('fetch',fetch);
  await act(async()=>{render(<ExternalSources/>);});
  expect(screen.getByText(/YouTube transcript ingestion is currently unavailable \(TRANSCRIPT_PROVIDER_REQUIRED\)/)).toBeDefined();
  fireEvent.change(screen.getByLabelText('PDF file (2 MiB maximum)'),{target:{files:[new File(['%PDF-1.4'],'notes.pdf',{type:'application/pdf'})]}});
  await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Add PDF source'}));});
  expect(screen.getByRole('alert').textContent).toContain('NETWORK');
  await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Add PDF source'}));});
  expect(fetch.mock.calls[2][1].headers).toEqual(fetch.mock.calls[1][1].headers);
  fireEvent.change(screen.getByLabelText('Public HTTPS URL'),{target:{value:'https://docs.example.org/lesson'}});
  await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Add web source'}));});
  expect(fake.dispatch).toHaveBeenCalledWith({type:'add_web_source',label:'https://docs.example.org/lesson',url:'https://docs.example.org/lesson'});
});

it('renders YouTube form and dispatches add_youtube_source when enabled',async()=>{
  fake.view=cohortWorkspaceSchema.parse({schemaVersion:1,title:'Test',intent:'Learn',audience:'',dailyMinutes:20,lessons:[]});
  const fetch=vi.fn().mockResolvedValueOnce({ok:true,json:async()=>({pdf:true,web:true,youtube:true})});vi.stubGlobal('fetch',fetch);
  await act(async()=>{render(<ExternalSources/>);});
  fireEvent.change(screen.getByLabelText('Video title'),{target:{value:'Consensus Lecture'}});
  fireEvent.change(screen.getByLabelText('Public YouTube video URL'),{target:{value:'https://www.youtube.com/watch?v=s4cVideo123'}});
  await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Add YouTube source'}));});
  expect(fake.dispatch).toHaveBeenCalledWith({
    type:'add_youtube_source',
    label:'Consensus Lecture',
    url:'https://www.youtube.com/watch?v=s4cVideo123',
    track:{id:'en',language:'en',kind:'manual',translated:false},
  });
});

it('validates page selection and submits scoped canonical entity versions',async()=>{
  fake.view=cohortWorkspaceSchema.parse({schemaVersion:1,title:'Test',intent:'Learn',audience:'',dailyMinutes:20,lessons:[]});
  const source=cohortSourceSchema.parse({id:'pdf',version:2,label:'PDF',text:'',checksum:null,state:'queued',input:{kind:'pdf',uploadId:crypto.randomUUID()}});
  render(<ExternalSourceScope source={source}/>);
  fireEvent.change(screen.getByLabelText('Physical pages (comma-separated)'),{target:{value:'1,1'}});
  fireEvent.click(screen.getByRole('button',{name:'Apply page scope'}));expect(fake.dispatch).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Physical pages (comma-separated)'),{target:{value:'2'}});
  await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Apply page scope'}));});
  expect(fake.dispatch).toHaveBeenCalledWith({type:'set_pdf_pages',sourceId:'pdf',pages:[2]},[{kind:'source',id:'pdf',version:2}]);
});

it('does not silently rebase a page scope across a concurrent source edit',()=>{
  fake.view=cohortWorkspaceSchema.parse({schemaVersion:1,title:'Test',intent:'Learn',audience:'',dailyMinutes:20,lessons:[]});
  const source=cohortSourceSchema.parse({id:'pdf',version:2,label:'PDF',text:'',checksum:null,state:'queued',input:{kind:'pdf',uploadId:crypto.randomUUID(),pages:[1]}});
  const mounted=render(<ExternalSourceScope source={source}/>);
  fireEvent.change(screen.getByLabelText('Physical pages (comma-separated)'),{target:{value:'2'}});
  mounted.rerender(<ExternalSourceScope source={{...source,version:3}}/>);
  fireEvent.click(screen.getByRole('button',{name:'Apply page scope'}));
  expect(fake.dispatch).not.toHaveBeenCalled();expect((screen.getByLabelText('Physical pages (comma-separated)') as HTMLInputElement).value).toBe('2');
  expect(screen.getByRole('button',{name:'Use current source version for my page selection'})).toBeDefined();
});

it('validates YouTube transcript scope and submits scoped canonical entity versions',async()=>{
  fake.view=cohortWorkspaceSchema.parse({schemaVersion:1,title:'Test',intent:'Learn',audience:'',dailyMinutes:20,lessons:[]});
  const source=cohortSourceSchema.parse({
    id:'yt-1',version:2,label:'YouTube Video',text:'',checksum:null,state:'queued',
    input:{kind:'youtube',url:'https://www.youtube.com/watch?v=s4cVideo123',track:{id:'en',language:'en',kind:'manual',translated:false},scope:{startMs:60_000,endMs:120_000}},
  });
  render(<ExternalSourceScope source={source}/>);
  expect(screen.getByText(/Scope: 01:00–02:00/)).toBeDefined();

  // Invalid scope: end <= start
  fireEvent.change(screen.getByLabelText('Start (seconds)'),{target:{value:'120'}});
  fireEvent.change(screen.getByLabelText('End (seconds)'),{target:{value:'60'}});
  fireEvent.click(screen.getByRole('button',{name:'Apply transcript scope'}));
  expect(fake.dispatch).not.toHaveBeenCalled();
  expect(screen.getByRole('alert').textContent).toContain('End seconds must follow start seconds');

  // Valid scope: 90s to 180s
  fireEvent.change(screen.getByLabelText('Start (seconds)'),{target:{value:'90'}});
  fireEvent.change(screen.getByLabelText('End (seconds)'),{target:{value:'180'}});
  await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Apply transcript scope'}));});
  expect(fake.dispatch).toHaveBeenCalledWith(
    {type:'set_youtube_scope',sourceId:'yt-1',scope:{startMs:90_000,endMs:180_000}},
    [{kind:'source',id:'yt-1',version:2}]
  );
});

it('does not silently rebase a YouTube transcript scope across a concurrent source edit',()=>{
  fake.view=cohortWorkspaceSchema.parse({schemaVersion:1,title:'Test',intent:'Learn',audience:'',dailyMinutes:20,lessons:[]});
  const source=cohortSourceSchema.parse({
    id:'yt-1',version:2,label:'YouTube Video',text:'',checksum:null,state:'queued',
    input:{kind:'youtube',url:'https://www.youtube.com/watch?v=s4cVideo123',track:{id:'en',language:'en',kind:'manual',translated:false}},
  });
  const mounted=render(<ExternalSourceScope source={source}/>);
  fireEvent.change(screen.getByLabelText('Start (seconds)'),{target:{value:'10'}});
  fireEvent.change(screen.getByLabelText('End (seconds)'),{target:{value:'50'}});
  mounted.rerender(<ExternalSourceScope source={{...source,version:3}}/>);
  fireEvent.click(screen.getByRole('button',{name:'Apply transcript scope'}));
  expect(fake.dispatch).not.toHaveBeenCalled();
  expect((screen.getByLabelText('Start (seconds)') as HTMLInputElement).value).toBe('10');
  expect((screen.getByLabelText('End (seconds)') as HTMLInputElement).value).toBe('50');
  expect(screen.getByRole('button',{name:'Use current source version for my transcript selection'})).toBeDefined();
});
