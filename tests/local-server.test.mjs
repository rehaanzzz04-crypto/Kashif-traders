import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const listen = server => new Promise(resolve => server.listen(0, "127.0.0.1", () => resolve(server.address().port)));
const close = server => new Promise(resolve => server.close(resolve));
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

test("offline invoice reaches cashier locally and syncs once", async t => {
  let cloudOnline = true, posts = 0;
  const cloud = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://cloud");
    const send = (status, data, headers = {}) => { const body = JSON.stringify(data); res.writeHead(status, { "content-type": "application/json", ...headers }); res.end(body); };
    if (url.pathname === "/api/auth" && url.searchParams.get("action") === "login") return send(200, { user: { id: 7, employee_code: "SLM-7", full_name: "Test Salesman", designation: "salesman" } }, { "set-cookie": "kt_session=test-token; Path=/; Secure; HttpOnly; SameSite=Lax" });
    if (url.pathname === "/api/auth") return send(200, { user: { id: 7, employee_code: "SLM-7", full_name: "Test Salesman", designation: "salesman" } });
    if (!cloudOnline) return req.socket.destroy();
    if (url.pathname === "/api/data" && url.searchParams.get("resource") === "cash_sales" && req.method === "POST") { posts++; return send(201, { record: { id: 501, invoice_number: "CS-501", status: "pending", total: 480, created_at: new Date().toISOString() } }); }
    if (url.pathname === "/api/data" && url.searchParams.get("resource") === "cash_sales") return send(200, { records: [] });
    return send(404, { error: "not found" });
  });
  const cloudPort = await listen(cloud);
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "kt-local-test-"));
  const localPort = 18000 + Math.floor(Math.random() * 1000);
  const child = spawn(process.execPath, ["local-server/server.mjs"], { cwd: path.resolve("."), env: { ...process.env, KT_LOCAL_PORT: String(localPort), KT_LOCAL_HOST: "127.0.0.1", KT_LOCAL_DATA_DIR: dataDir, KT_CLOUD_ORIGIN: `http://127.0.0.1:${cloudPort}` }, stdio: ["ignore", "pipe", "pipe"] });
  t.after(async () => { child.kill(); await close(cloud); await rm(dataDir, { recursive: true, force: true }); });
  await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error("local server start timeout")), 4000); child.stdout.on("data", chunk => { if (String(chunk).includes("Kashif Traders local server")) { clearTimeout(timer); resolve(); } }); child.once("exit", code => reject(new Error(`local server exited ${code}`))); });
  const base = `http://127.0.0.1:${localPort}`;
  const login = await fetch(base + "/api/auth?action=login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ employee_code: "SLM-7", pin: "1234" }) });
  assert.equal(login.status, 200);
  const cookie = login.headers.get("set-cookie").split(";", 1)[0];
  cloudOnline = false;
  const created = await fetch(base + "/api/data?resource=cash_sales", { method: "POST", headers: { cookie, "content-type": "application/json", "x-kt-offline-id": "fixed-operation-1" }, body: JSON.stringify({ items: [{ name: "Test", qty: 2, rate: 240 }], discount: 0 }) });
  assert.equal(created.status, 201);
  const createdData = await created.json();
  assert.match(createdData.record.invoice_number, /^LOCAL-/);
  const cashier = await fetch(base + "/api/data?resource=cash_sales&status=pending", { headers: { cookie } });
  const cashierData = await cashier.json();
  assert.equal(cashierData.records.length, 1);
  assert.equal(cashierData.records[0].total, 480);
  cloudOnline = true;
  await fetch(base + "/api/data?resource=cash_sales&status=pending", { headers: { cookie } });
  for (let i = 0; i < 20 && posts === 0; i++) await delay(100);
  assert.equal(posts, 1);
  const duplicate = await fetch(base + "/api/data?resource=cash_sales", { method: "POST", headers: { cookie, "content-type": "application/json", "x-kt-offline-id": "fixed-operation-1" }, body: JSON.stringify({ items: [{ name: "Test", qty: 2, rate: 240 }] }) });
  assert.equal(duplicate.status, 200);
  assert.equal(posts, 1);
});
