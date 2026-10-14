import type {WebTransport} from '@/src/server/domain/cohort-creation/materials/web-fetch';
/** Deterministic transport, never a localhost/SSRF allowlist. Production URL,
 * DNS and pin validation still runs; fixture can only be enabled on isolated dev DB. */
export function localSourceFixture():WebTransport|undefined {
  if(process.env.INTERACTION_LOCAL_SOURCE_FIXTURE!=='1') return undefined;
  const database=new URL(process.env.DATABASE_URL??'');
  if(process.env.NODE_ENV!=='development' || !['127.0.0.1','localhost'].includes(database.hostname) || !database.pathname.startsWith('/s3test')) throw new Error('LOCAL_SOURCE_FIXTURE_FORBIDDEN');
  const attempts=new Map<string,number>();
  return {
    resolve:async hostname=>{if(hostname!=='s4b-fixture.example.org') throw new Error('FIXTURE_HOST_FORBIDDEN');return [{address:'93.184.216.34',family:4}];},
    open:async url=>{
      if(url.hostname!=='s4b-fixture.example.org') throw new Error('FIXTURE_HOST_FORBIDDEN');
      const attempt=(attempts.get(url.href)??0)+1;attempts.set(url.href,attempt);
      return {status:url.pathname==='/retry'&&attempt===1?503:200,headers:{'content-type':'text/plain'},
        bytes:(async function*(){yield Buffer.from('Majorities overlap. Retained web evidence prevents unsupported conclusions.');})(),close:()=>{}};
    },
  };
}
