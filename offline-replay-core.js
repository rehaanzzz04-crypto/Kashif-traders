import { createHash } from 'node:crypto';

// A claimed operation is never executed twice. If a process dies after making
// changes but before saving its response, retain it for reconciliation instead
// of risking a second financial posting.
export async function replayOnce({ store, owner, key, method, url, body, execute }) {
  const fingerprint = createHash('sha256').update(JSON.stringify([method, url, body])).digest('hex');
  const claimed = await store.claim(owner, key, fingerprint);
  if (!claimed) {
    const prior = await store.read(owner, key);
    if (!prior || prior.fingerprint !== fingerprint) return { status: 409, data: { error: 'Sync ID payload mismatch', sync_state: 'review' } };
    if (prior.state === 'complete') return { status: prior.http_status, data: prior.response };
    return { status: 409, data: { error: 'Is entry ka server result verify karna zaroori hai. Dobara post nahi ki gai.', sync_state: 'review' } };
  }
  const result = await execute();
  // Store the response before sending it. On a DB failure, leave the claim held.
  await store.complete(owner, key, result.status, result.data);
  return result;
}
