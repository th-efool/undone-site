import { expect, it, vi } from 'vitest';
import { createCohortTransport } from '../transport';
it('retries a lost canonical source response with the original envelope and receipt key',async()=>{
  const commit=vi.fn().mockRejectedValueOnce(new Error('NETWORK')).mockResolvedValue({revision:1,cursor:1,snapshot:{},receipt:{receiptId:'saved',summary:'saved'}});
  const transport=createCohortTransport('workspace',{commit} as any);
  const action={type:'add_web_source',label:'Web',url:'https://docs.example.org'};
  await expect(transport.commit({actionId:'first',expectedRevision:0,action,entityVersions:[]},'first')).rejects.toThrow('NETWORK');
  await transport.commit({actionId:'retry',expectedRevision:1,action,entityVersions:[]},'retry');
  expect(commit.mock.calls[1]).toEqual(commit.mock.calls[0]);
});
it('retries a lost message response with original message/request identity', async () => {
  const sendMessage = vi.fn().mockRejectedValueOnce(new Error('NETWORK')).mockResolvedValue({ message: {}, cursor: 1 });
  const transport = createCohortTransport('workspace', { sendMessage } as any);
  const parts = [{ type: 'text', text: 'Keep my message' }];
  await expect(transport.sendMessage({ id: 'first', parts }, 'first')).rejects.toThrow('NETWORK');
  await transport.sendMessage({ id: 'second', parts }, 'second');
  expect(sendMessage.mock.calls[1]).toEqual(sendMessage.mock.calls[0]);
  await transport.sendMessage({ id: 'third', parts }, 'third');
  expect(sendMessage.mock.calls[2][0].id).toBe('third');
});
