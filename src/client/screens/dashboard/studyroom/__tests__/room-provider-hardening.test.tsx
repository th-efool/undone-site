/** @vitest-environment jsdom */
import React from 'react';
import {act,cleanup,render} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {RealtimeProvider} from '@/src/client/realtime';
import {useSharedEnvironment} from '../hooks/useSharedEnvironment';
const driver=vi.hoisted(()=>({creates:0}));
vi.mock('centrifuge',()=>({Centrifuge:class {
  handlers=new Map<string,(ctx:unknown)=>void>();
  on(name:string,callback:(ctx:unknown)=>void){this.handlers.set(name,callback);}
  connect(){this.handlers.get('connected')?.({client:'test'});}
  disconnect(){} removeSubscription(){}
  newSubscription(){driver.creates++; return {on(){},subscribe(){},unsubscribe(){},removeAllListeners(){}};}
}, UnauthorizedError:Error}));
vi.mock('@/src/client/repositories/studyRoomRepository',()=>({studyRoomRepository:{getRoomEnvironment:()=>new Promise(()=>{})}}));
function Room(){useSharedEnvironment({backgroundId:'library',music:null,ambience:{presetId:null,volume:0,isPlaying:false},updatedAt:0,updatedByUserId:'x'},'x',{roomSlug:'room',roomId:'room'});return null;}
afterEach(()=>{cleanup();driver.creates=0;});
it.each([true,false])('keeps one subscription with cold mount=%s',async cold=>{
  const ui=(show:boolean)=><RealtimeProvider userId="x">{show?<Room/>:null}</RealtimeProvider>;
  const view=render(ui(cold));
  if(!cold) view.rerender(ui(true));
  await act(async()=>{});
  expect(driver.creates).toBe(1);
});
