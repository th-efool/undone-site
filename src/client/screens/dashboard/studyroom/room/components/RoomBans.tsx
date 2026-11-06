'use client';
import React, {useState} from 'react';
import type { RoomRestrictionDTO } from '@/src/shared/studyroom/contracts';

export function RoomBans({slug}:{slug:string}) {
  const [rows,setRows]=useState<RoomRestrictionDTO[]>([]);
  const [message,setMessage]=useState('');
  const [open,setOpen]=useState(false);
  const base='/api/studyroom/'+encodeURIComponent(slug)+'/restrictions';
  async function load() {
    try {
      const res=await fetch(base,{cache:'no-store'});
      if(!res.ok) throw Error('Unable to read restrictions');
      const data:{restrictions:RoomRestrictionDTO[]}=await res.json();
      setRows(data.restrictions.filter(r=>r.action==='BAN' && (!r.expiresAt || Date.parse(r.expiresAt)>Date.now())));
      setMessage('');
    } catch { setRows([]);setMessage('Unable to read restrictions.'); }
  }
  async function lift(id:string) {
    try {
      const res=await fetch(base+'/'+encodeURIComponent(id),{method:'DELETE'});
      if(!res.ok) throw Error();
      await load();
    } catch {setMessage('Unable to lift this ban.');}
  }
  return <div><button type="button" aria-expanded={open} onClick={()=>{setOpen(!open);if(!open)void load();}}>Room bans</button>
    {open && <div>{rows.map(r=><p key={r.id}>{r.userName} <button type="button" onClick={()=>void lift(r.userId)}>Lift ban</button></p>)}
    <p role="status">{message || (!rows.length ? 'No active bans.' : '')}</p></div>}</div>;
}
