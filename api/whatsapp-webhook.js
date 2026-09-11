function getQuery(req, key) {
  const q = req.query || {};
  const value = q[key];
  return Array.isArray(value) ? value[0] : value;
}

function bodyOf(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body;
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const mode = getQuery(req, 'hub.mode');
    const token = getQuery(req, 'hub.verify_token');
    const challenge = getQuery(req, 'hub.challenge');
    const expected = process.env.WHATSAPP_VERIFY_TOKEN;

    if (!expected) {
      console.error('WhatsApp webhook verification token is not configured');
      return res.status(503).send('Webhook verification is not configured');
    }

    if (mode === 'subscribe' && token === expected && challenge) {
      return res.status(200).send(String(challenge));
    }

    return res.status(403).send('Verification failed');
  }

  if (req.method === 'POST') {
    const payload = bodyOf(req);

    // Meta expects a fast 200 response. Processing of supplier/client messages
    // is intentionally added in a separate step so webhook verification stays
    // isolated and safe during initial production setup.
    const entryCount = Array.isArray(payload?.entry) ? payload.entry.length : 0;
    console.log('WhatsApp webhook received', { object: payload?.object || null, entryCount });

    return res.status(200).json({ received: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
