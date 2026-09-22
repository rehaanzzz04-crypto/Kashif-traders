import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const origin = 'https://example.test';
function worker() {
  const handlers = {}, saved = new Map();
  const cache = {
    match: async key => saved.get(typeof key === 'string' ? key : key.url)?.clone(),
    put: async (key, response) => saved.set(key, response.clone()),
    addAll: async () => {}
  };
  const context = { URL, Response, fetch: async () => { throw new Error('offline'); },
    importScripts: () => {}, caches: { open: async () => cache },
    self: { location: {origin}, addEventListener: (name, cb) => handlers[name] = cb }
  };
  vm.runInNewContext(fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8'), context);
  return { context, saved, request(path, mode='navigate', method='GET') {
    let response;
    handlers.fetch({request:{url:origin+path,method,mode,destination:'script'},respondWith:r=>response=r});
    return response;
  }};
}
test('offline routes keep their own HTML including query strings', async () => {
  const w=worker(); w.saved.set('/index.html',new Response('dashboard'));
  w.saved.set('/cash-sale.html',new Response('sale'));
  assert.equal(await (await w.request('/cash-sale.html?test=1')).text(),'sale');
  assert.equal(await (await w.request('/')).text(),'dashboard');
  assert.equal((await w.request('/missing.html')).status,503);
});
test('online navigation never poisons dashboard cache or stores login redirect', async () => {
  const w=worker();w.saved.set('/index.html',new Response('dashboard'));
  w.context.fetch=async()=>new Response('sale');
  await w.request('/cash-sale.html');
  assert.equal(await w.saved.get('/index.html').text(),'dashboard');
  assert.equal(await w.saved.get('/cash-sale.html').clone().text(),'sale');
  w.context.fetch=async()=>({ok:true,redirected:true});
  await w.request('/cash-sale.html');
  assert.equal(await w.saved.get('/cash-sale.html').text(),'sale');
});
test('API and mutation requests bypass shell cache', () => {
  const w=worker();assert.equal(w.request('/api/data?resource=cash_sales'),undefined);
  assert.equal(w.request('/cash-sale.html','navigate','POST'),undefined);
});
test('offline versioned assets have a valid cached fallback', async () => {
  const w=worker();w.saved.set('/boot.js',new Response('boot'));
  assert.equal(await (await w.request('/boot.js?v=new','cors')).text(),'boot');
  assert.equal((await w.request('/missing.js','cors')).status,503);
});
test('all manifest assets exist and every HTML page is included', () => {
  const context={self:{}};
  vm.runInNewContext(fs.readFileSync(new URL('../offline-shell-manifest.js',import.meta.url),'utf8'),context);
  const assets=context.self.KT_SHELL_ASSETS;
  for(const asset of assets) assert.ok(fs.existsSync(new URL('..'+asset.split('?')[0],import.meta.url)),asset);
  for(const file of fs.readdirSync(new URL('../',import.meta.url)).filter(f=>f.endsWith('.html'))) assert.ok(assets.includes('/'+file),file);
});
