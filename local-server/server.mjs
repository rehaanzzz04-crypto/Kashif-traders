import http from "node:http";
import { createHash, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const DATA_DIR = process.env.KT_LOCAL_DATA_DIR || path.join(HERE, "data");
const STORE_FILE = path.join(DATA_DIR, "local-billing.json");
const PORT = Number(process.env.KT_LOCAL_PORT || 8787);
const CLOUD_ORIGIN = String(process.env.KT_CLOUD_ORIGIN || "https://kashif-traders-git-work-ocr-item-92cef3-milkestone-enterprises.vercel.app").replace(/\/$/, "");
const HOST = process.env.KT_LOCAL_HOST || "0.0.0.0";
const emptyStore = () => ({ version: 1, nextLocalId: -1, bills: [], sessions: {}, getCache: {}, lastCloudSync: null });
let store = emptyStore(), writeChain = Promise.resolve(), syncing = false;

async function loadStore() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try { store = { ...emptyStore(), ...JSON.parse(await fs.readFile(STORE_FILE, "utf8")) }; }
  catch (error) { if (error.code !== "ENOENT") throw error; await saveStore(); }
}
function saveStore() {
  writeChain = writeChain.then(async () => { const temp = STORE_FILE + ".tmp"; await fs.writeFile(temp, JSON.stringify(store, null, 2), { mode: 0o600 }); await fs.rename(temp, STORE_FILE); });
  return writeChain;
}
function json(res, status, data, extraHeaders = {}) {
  const body = JSON.stringify(data); res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Content-Length": Buffer.byteLength(body), "Cache-Control": "no-store", ...extraHeaders }); res.end(body);
}
async function readBody(req) {
  const chunks = []; let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size > 2 * 1024 * 1024) throw new Error("Request bohat bari hai"); chunks.push(chunk); }
  const raw = Buffer.concat(chunks).toString("utf8"); if (!raw) return {};
  try { return JSON.parse(raw); } catch { throw new Error("Invalid JSON"); }
}
const cookieKey = req => createHash("sha256").update(String(req.headers.cookie || "anonymous")).digest("hex");
async function cloudFetch(req, requestPath, body, timeout = 6000) {
  const headers = {}; for (const name of ["cookie", "content-type", "x-kt-offline-id", "x-kt-offline-owner"]) if (req.headers[name]) headers[name] = req.headers[name];
  return fetch(CLOUD_ORIGIN + requestPath, { method: req.method, headers, body: ["GET", "HEAD"].includes(req.method) ? undefined : JSON.stringify(body || {}), redirect: "manual", signal: AbortSignal.timeout(timeout) });
}
async function responseData(response) { const text = await response.text(); try { return JSON.parse(text); } catch { return { error: text || `Cloud response ${response.status}` }; } }
function rememberSession(req, data) { if (data?.user) store.sessions[cookieKey(req)] = { user: data.user, cookie: String(req.headers.cookie || ""), saved_at: new Date().toISOString() }; }
function rememberLoginSession(setCookie, data) {
  if (!data?.user || !setCookie) return;
  const cookie = setCookie.split(";", 1)[0];
  const requestLike = { headers: { cookie } };
  store.sessions[cookieKey(requestLike)] = { user: data.user, cookie, saved_at: new Date().toISOString() };
}
function localUser(req) { return store.sessions[cookieKey(req)]?.user || null; }
function publicBill(entry) { return { ...entry.record, _local_server: true, _sync_state: entry.syncState }; }
function filterBills(records, status) { if (status === "all") return records; if (status === "credit_open") return records.filter(row => ["credit", "partial"].includes(row.status)); return records.filter(row => row.status === status); }
function mergeBills(cloudRecords, status) {
  const rows = new Map(cloudRecords.map(row => [String(row.id), row]));
  for (const entry of store.bills) { if (entry.cloudId && rows.has(String(entry.cloudId))) continue; rows.set("local:" + entry.localId, publicBill(entry)); }
  return filterBills([...rows.values()], status).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
}
function calculate(body) {
  const items = Array.isArray(body.items) ? body.items : [];
  const subtotal = items.reduce((sum, item) => sum + Math.max(0, Number(item.qty) || 0) * Math.max(0, Number(item.rate) || 0), 0);
  const discount = Math.min(subtotal, Math.max(0, Number(body.discount) || 0)); return { items, subtotal, discount, total: subtotal - discount };
}
async function createLocalBill(req, body) {
  const user = localUser(req); if (!user) throw Object.assign(new Error("Offline login session nahi mili. Internet ke sath aik dafa login karein."), { status: 401 });
  const totals = calculate(body); if (!totals.items.length) throw Object.assign(new Error("Kam az kam aik product add karein"), { status: 400 });
  const localId = store.nextLocalId--, now = new Date().toISOString();
  const record = { id: localId, invoice_number: `LOCAL-${Date.now()}-${Math.abs(localId)}`, created_by_id: user.id, created_by_name: user.full_name || user.employee_code, customer_id: body.customer_id || null, customer_name: body.customer_name || "Walk-in Customer", sale_date: body.sale_date || now.slice(0, 10), ...totals, status: "pending", amount_received: 0, payments: [], created_at: now, updated_at: now };
  store.bills.push({ key: req.headers["x-kt-offline-id"] || randomUUID(), localId, cloudId: null, syncState: "pending", cookie: String(req.headers.cookie || ""), createBody: body, patches: [], record });
  await saveStore(); return record;
}
function applyPatch(entry, body, user, cookie) {
  const record = entry.record, action = String(body.action || "");
  if (action === "receive_payment") {
    const due = Math.max(0, Number(record.total) - Number(record.amount_received || 0)), amount = Math.min(due, Math.max(0, Number(body.amount_received) || 0));
    if (!amount) throw Object.assign(new Error("Valid received amount required hai"), { status: 400 });
    record.amount_received = Number(record.amount_received || 0) + amount; record.status = record.amount_received + 0.005 >= Number(record.total) ? "paid" : "partial"; record.payment_method = body.payment_method || "Cash";
    record.payments = [...(record.payments || []), { amount, payment_method: record.payment_method, received_by_name: user.full_name || user.employee_code, received_at: new Date().toISOString() }];
  } else {
    if (Array.isArray(body.items) || body.discount !== undefined) Object.assign(record, calculate({ ...record, ...body }));
    if (body.status) record.status = body.status; if (body.payment_method) record.payment_method = body.payment_method; if (body.amount_received !== undefined) record.amount_received = Math.max(0, Number(body.amount_received) || 0);
  }
  record.updated_at = new Date().toISOString(); entry.patches.push({ body, cookie }); entry.syncState = "pending"; return record;
}
async function syncEntry(entry) {
  const fakeReq = { method: "POST", headers: { cookie: entry.cookie, "content-type": "application/json", "x-kt-offline-id": entry.key } };
  if (!entry.cloudId) {
    const response = await cloudFetch(fakeReq, "/api/data?resource=cash_sales", entry.createBody, 8000), data = await responseData(response);
    if (!response.ok) throw new Error(data.error || `Cloud sync ${response.status}`); entry.cloudId = data.record?.id; if (!entry.cloudId) throw new Error("Cloud invoice id missing"); entry.record = { ...entry.record, ...data.record, id: entry.cloudId };
  }
  while (entry.patches.length) {
    const queuedPatch = entry.patches[0], patchBody = queuedPatch.body || queuedPatch;
    fakeReq.method = "PATCH"; fakeReq.headers.cookie = queuedPatch.cookie || entry.cookie;
    const response = await cloudFetch(fakeReq, `/api/data?resource=cash_sales&id=${entry.cloudId}`, patchBody, 8000), data = await responseData(response);
    if (!response.ok) throw new Error(data.error || `Cloud patch ${response.status}`); entry.record = { ...entry.record, ...data.record }; entry.patches.shift();
  }
  entry.syncState = "synced"; entry.syncError = null;
}
async function syncAll() {
  if (syncing) return; syncing = true;
  try { for (const entry of store.bills.filter(item => item.syncState !== "synced")) { try { await syncEntry(entry); } catch (error) { entry.syncError = error.message; break; } } store.lastCloudSync = new Date().toISOString(); await saveStore(); }
  finally { syncing = false; }
}
async function handleAuth(req, res, url, body) {
  try {
    const response = await cloudFetch(req, url.pathname + url.search, body), data = await responseData(response);
    const headers = {}, setCookie = response.headers.get("set-cookie");
    if (response.ok && data.user) { rememberSession(req, data); rememberLoginSession(setCookie, data); await saveStore(); }
    if (setCookie) headers["Set-Cookie"] = setCookie.replace(/;\s*Secure/gi, ""); return json(res, response.status, data, headers);
  } catch { const user = localUser(req); if (req.method === "GET" && user) return json(res, 200, { user, offline_session: true, local_server: true }); return json(res, 503, { error: "Internet nahi hai. Is device par pehle login hona zaroori hai." }); }
}
async function handleCashSales(req, res, url, body) {
  const status = url.searchParams.get("status") || "pending";
  if (req.method === "GET") {
    let cloudRecords = [];
    try { const response = await cloudFetch(req, url.pathname + url.search, null, 1500), data = await responseData(response); if (response.ok) { cloudRecords = data.records || []; store.getCache[url.pathname + url.search] = cloudRecords; syncAll().catch(() => {}); } else if ([401, 403].includes(response.status)) return json(res, response.status, data); }
    catch { cloudRecords = store.getCache[url.pathname + url.search] || []; }
    return json(res, 200, { records: mergeBills(cloudRecords, status), local_server: true });
  }
  if (!localUser(req)) return json(res, 401, { error: "Login required" });
  if (req.method === "POST") {
    const duplicateKey = req.headers["x-kt-offline-id"], duplicate = duplicateKey && store.bills.find(item => item.key === duplicateKey); if (duplicate) return json(res, 200, { record: publicBill(duplicate), local_server: true });
    try { const record = await createLocalBill(req, body); syncAll().catch(() => {}); return json(res, 201, { record, local_server: true, pending_cloud_sync: true }); } catch (error) { return json(res, error.status || 500, { error: error.message }); }
  }
  if (req.method === "PATCH") {
    const id = Number(url.searchParams.get("id")), entry = store.bills.find(item => item.localId === id || item.cloudId === id);
    if (entry) { try { const record = applyPatch(entry, body, localUser(req), String(req.headers.cookie || "")); await saveStore(); syncAll().catch(() => {}); return json(res, 200, { record, local_server: true, pending_cloud_sync: true }); } catch (error) { return json(res, error.status || 500, { error: error.message }); } }
  }
  return proxyApi(req, res, url, body);
}
async function proxyApi(req, res, url, body) {
  const key = url.pathname + url.search;
  try { const response = await cloudFetch(req, key, body), data = await responseData(response); if (req.method === "GET" && response.ok) { store.getCache[key] = data; await saveStore(); } return json(res, response.status, data); }
  catch { if (req.method === "GET" && store.getCache[key]) return json(res, 200, store.getCache[key]); return json(res, 503, { error: "Internet available nahi. Yeh action local server par supported nahi hai." }); }
}
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json" };
async function serveStatic(req, res, url) {
  const relative = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname).replace(/^\/+/, ""), file = path.resolve(ROOT, relative); if (!file.startsWith(ROOT + path.sep)) return json(res, 403, { error: "Forbidden" });
  try { const stat = await fs.stat(file), target = stat.isDirectory() ? path.join(file, "index.html") : file, body = await fs.readFile(target); res.writeHead(200, { "Content-Type": mime[path.extname(target).toLowerCase()] || "application/octet-stream", "Content-Length": body.length, "Cache-Control": "no-cache" }); res.end(body); }
  catch { json(res, 404, { error: "Page not found" }); }
}
async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  if (url.pathname === "/api/local-status") { const pending = store.bills.filter(item => item.syncState !== "synced"); return json(res, 200, { local_server: true, cloud_origin: CLOUD_ORIGIN, pending: pending.length, last_cloud_sync: store.lastCloudSync, errors: pending.filter(item => item.syncError).map(item => ({ invoice: item.record.invoice_number, error: item.syncError })) }); }
  let body = {}; if (!["GET", "HEAD"].includes(req.method)) { try { body = await readBody(req); } catch (error) { return json(res, 400, { error: error.message }); } }
  if (url.pathname === "/api/auth") return handleAuth(req, res, url, body);
  if (url.pathname === "/api/data" && url.searchParams.get("resource") === "cash_sales") return handleCashSales(req, res, url, body);
  if (url.pathname.startsWith("/api/")) return proxyApi(req, res, url, body);
  return serveStatic(req, res, url);
}
await loadStore();
const server = http.createServer((req, res) => handler(req, res).catch(error => { console.error(error); if (!res.headersSent) json(res, 500, { error: "Local server error" }); else res.end(); }));
server.listen(PORT, HOST, () => { console.log(`Kashif Traders local server: http://localhost:${PORT}`); console.log(`Cash Sale devices ko laptop ke Wi-Fi IP par port ${PORT} open karein.`); console.log(`Cloud sync: ${CLOUD_ORIGIN}`); });
setInterval(() => syncAll().catch(() => {}), 15000).unref();
