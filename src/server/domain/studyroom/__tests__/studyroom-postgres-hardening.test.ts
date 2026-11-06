import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import { roomManagementService as management } from '../room-management.service';
import { roomGovernanceService as governance } from '../room-governance.service';
import { studyRoomService as rooms } from '../studyroom.service';
import { sprintService } from '../sprint.service';
import { hasRoomAccess } from '../room-access';

vi.mock('server-only',()=>({}));
describe.runIf(process.env.STUDYROOM_PG_GATE === '1')('Studyroom PostgreSQL release gate',()=>{
  it('serializes slot, quota, revision and transfer races and fences old assignments',async()=>{
    const url = new URL(process.env.DATABASE_URL || '');
    if (!['localhost','127.0.0.1','[::1]'].includes(url.hostname) || url.pathname !== '/studyroom_handoff_test') {
      throw Error('Use a disposable loopback database named studyroom_handoff_test');
    }
    const marker = 'handoff-'+randomUUID();
    const ids = ['owner','a','b','c'].map(role=>marker+'-'+role);
    const [owner,a,b,c]=ids;
    await prisma.user.createMany({data:ids.map(id=>({id,name:id}))});
    try {
      const intent={title:marker,requestId:marker,scopeKind:'STANDALONE' as const,publishImmediately:true,capacity:2};
      const [one,two]=await Promise.all([management.createRoom(intent,owner),management.createRoom(intent,owner)]);
      expect(two.id).toBe(one.id);
      const host=await rooms.joinRoom({roomId:one.id,userId:owner,tabId:'host'});
      const seats=await Promise.allSettled([a,b].map(userId=>rooms.joinRoom({roomId:one.id,userId,tabId:'tab'})));
      expect(seats.filter(r=>r.status==='fulfilled')).toHaveLength(1);
      const guest=seats[0].status==='fulfilled'?a:b;
      const outsider=guest===a?b:a;
      await governance.setController(one.id,guest,'HOST',owner);
      expect(await hasRoomAccess(one.id,guest,true)).toBe(true);
      expect(await hasRoomAccess(one.id,outsider)).toBe(false);
      await rooms.updateParticipantGoal({roomId:one.id,userId:owner,tabId:'host',generation:host.generation,publicGoal:'Review'});
      expect((await rooms.getRoomRoster(one.id,guest)).find(p=>p.userId===owner)?.publicGoal).toBe('Review');
      const edits=await Promise.allSettled(['first','second'].map(title=>management.updateRoomSettings(one.slug,{title,expectedRevision:1},owner)));
      expect(edits.filter(r=>r.status==='fulfilled')).toHaveLength(1);
      expect((await sprintService.resolveRoom(one.slug))?.id).toBe(one.id);
      const offer=await governance.proposeOwnershipTransfer(one.id,c,2,owner);
      const handoff=await Promise.allSettled([governance.acceptOwnershipTransfer(one.id,offer.id,c),governance.cancelOwnershipTransfer(one.id,offer.id,owner)]);
      expect(handoff.filter(r=>r.status==='fulfilled')).toHaveLength(1);
      const transfer=await prisma.roomOwnershipTransfer.findUniqueOrThrow({where:{id:offer.id}});
      expect((await prisma.studyRoom.findUniqueOrThrow({where:{id:one.id}})).ownerId).toBe(transfer.status==='ACCEPTED'?c:owner);
      await prisma.roomLease.updateMany({where:{studyRoomId:one.id,userId:guest},data:{expiresAt:new Date(0)}});
      expect(await hasRoomAccess(one.id,guest,true)).toBe(false);
      expect((await rooms.renewLease({roomId:one.id,userId:guest,tabId:'tab',generation:1})).success).toBe(false);
      await rooms.reconcileExpiredLeases();
      expect(await prisma.roomParticipant.findUnique({where:{userId:guest}})).toBeNull();
      const quota=await Promise.allSettled(Array.from({length:4},(_,index)=>management.createRoom({...intent,title:marker+'-'+index,requestId:marker+'-'+index},outsider)));
      expect(quota.filter(r=>r.status==='fulfilled')).toHaveLength(3);
    } finally {
      await prisma.studyRoom.deleteMany({where:{ownerId:{in:ids}}});
      await prisma.user.deleteMany({where:{id:{in:ids}}});
    }
  });
});
