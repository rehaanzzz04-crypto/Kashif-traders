import { db, getSessionUser } from './_auth.js';
import { replayOnce } from '../offline-replay-core.js';

export function withOfflineReplay(handler) {
  return async (req, res) => {
    const key = req.headers?.['x-kt-offline-id'];
    if (!key || !['POST', 'PATCH', 'DELETE'].includes(req.method)) return handler(req, res);
    if (typeof key !== 'string' || !/^[a-zA-Z0-9-]{8,100}$/.test(key)) return res.status(400).json({ error: 'Invalid sync ID' });
    try {
      const sql = db(), user = await getSessionUser(req, sql);
      if (!user) return res.status(401).json({ error: 'Authentication required' });
      if (String(req.headers['x-kt-offline-owner']) !== String(user.id)) return res.status(403).json({ error: 'Original employee login required' });
      await sql`CREATE TABLE IF NOT EXISTS kt_offline_operations (
        owner_id BIGINT NOT NULL, operation_id TEXT NOT NULL, fingerprint TEXT NOT NULL,
        state TEXT NOT NULL DEFAULT 'claimed', http_status INTEGER, response JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(owner_id, operation_id))`;
      const store = {
        claim: async (owner, id, hash) => (await sql`INSERT INTO kt_offline_operations(owner_id,operation_id,fingerprint) VALUES(${owner},${id},${hash}) ON CONFLICT DO NOTHING RETURNING operation_id`).length > 0,
        read: async (owner,id) => (await sql`SELECT * FROM kt_offline_operations WHERE owner_id=${owner} AND operation_id=${id}`)[0],
        complete: async (owner,id,status,data) => { await sql`UPDATE kt_offline_operations SET state='complete',http_status=${status},response=${JSON.stringify(data)}::jsonb WHERE owner_id=${owner} AND operation_id=${id}`; }
      };
      const result = await replayOnce({store,owner:user.id,key,method:req.method,url:req.url,body:req.body,execute:async()=>{
        let status = 200, data, headers = {};
        const capture = {
          status(code) { status = code; return this; },
          json(value) { data = value; return this; },
          setHeader(name,value) { headers[name] = value; return this; },
          getHeader(name) { return headers[name]; }
        };
        await handler(req,capture);
        if (data === undefined) throw Error('Offline operation did not return JSON');
        return {status,data};
      }});
      res.setHeader('Cache-Control','no-store');
      return res.status(result.status).json(result.data);
    } catch(error) {
      console.error('Offline replay retained for review',error);
      return res.status(503).json({error:'Sync result verify nahi ho saka. Entry mehfooz hai; dobara create na karein.',sync_state:'review'});
    }
  };
}
