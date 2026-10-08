import http from "node:http";
import {rawReceipt,receiptLines} from "./thermal-receipt.mjs";
import {spawn} from "node:child_process";
import path from "node:path";
import {fileURLToPath} from "node:url";
const HOST="127.0.0.1",PORT=8788;
const PRINTER=process.env.KT_PRINT_PRINTER||"BlackCopper 80mm Series(1)";
const DRY=process.env.KT_PRINT_DRY_RUN!=="0";
const TEST_ONLY=process.env.KT_PRINT_TEST_ONLY==="1";
const CASHIER=process.env.KT_PRINT_CASHIER==="1";
if(!DRY && Number(TEST_ONLY)+Number(CASHIER)!==1)throw Error("Physical printing requires exactly one explicitly enabled mode");
const MODE=DRY?"dry-run":TEST_ONLY?"test-only":"cashier";
const CUT_ENABLED=process.env.KT_PRINT_AUTOCUT==="1";
const CUT_TEST=process.env.KT_PRINT_CUT_TEST==="1";
const CUT_VERIFIED=process.env.KT_PRINT_CUT_VERIFIED==="1";
if(CUT_ENABLED && !((TEST_ONLY && CUT_TEST) || (CASHIER && CUT_VERIFIED)))
 throw Error("Cutter must pass supervised test first");
const ALLOWED=new Set(["http://localhost:8787","http://127.0.0.1:8787",...(process.env.KT_PRINT_ORIGIN||"").split(",").map(x=>x.trim()).filter(Boolean)]);
if([...ALLOWED].some(o=>o==="*" || !/^https?:\/\/[^/]+$/.test(o)))throw Error("Invalid printer allowed origin");
const script=path.join(path.dirname(fileURLToPath(import.meta.url)),"win-raw-printer.ps1");
const recent=new Set();
function json(res,status,result,headers={}){res.writeHead(status,{"Content-Type":"application/json","Cache-Control":"no-store",...headers});res.end(JSON.stringify(result));}
function spool(bytes){return new Promise((resolve,reject)=>{
 const child=spawn("powershell.exe",["-NoProfile","-NonInteractive","-ExecutionPolicy","Bypass","-File",script,"-PrinterName",PRINTER],{windowsHide:true});
 let out="",err="",settled=false;
 const finish=(error)=>{if(settled)return;settled=true;clearTimeout(timeout);error?reject(error):resolve(out)};
 const timeout=setTimeout(()=>{child.kill();finish(new Error("Printer timeout"))},20000);
 child.stdout.on("data",b=>out+=b.toString().slice(0,400));
 child.stderr.on("data",b=>err+=b.toString().slice(0,600));
 child.on("error",finish);
 child.on("close",code=>finish(code?new Error(err||out||"RAW print failed"):null));
 child.stdin.on("error",()=>{});
 child.stdin.end(bytes.toString("base64"));
});}
const server=http.createServer(async(req,res)=>{
 const origin=req.headers.origin;
 if(!ALLOWED.has(origin)||!/^127\.0\.0\.1:8788$|^localhost:8788$/.test(req.headers.host||""))return json(res,403,{error:"Untrusted origin"});
 const hdr={"Access-Control-Allow-Origin":origin,"Vary":"Origin","Access-Control-Allow-Methods":"GET,POST,OPTIONS","Access-Control-Allow-Headers":"Content-Type","Access-Control-Allow-Private-Network":"true"};
 if(req.method==="OPTIONS"){res.writeHead(204,hdr);res.end();return}
 if(req.method==="GET"&&req.url==="/health")return json(res,200,{ready:true,dryRun:DRY,printer:PRINTER,testOnly:TEST_ONLY,mode:MODE,autoCut:CUT_ENABLED},hdr);
 if(req.method!=="POST"||req.url!=="/print")return json(res,404,{error:"Not found"},hdr);
 try{
  let body="";for await(const part of req){body+=part;if(body.length>65000)throw Error("Too large")}
  const payload=JSON.parse(body);
  const id=String(payload.jobId||"");if(!/^[A-Za-z0-9-]{12,80}$/.test(id))throw Error("Job ID invalid");
  const lines=receiptLines(payload.receipt),bytes=rawReceipt(payload.receipt,{cut:CUT_ENABLED && !DRY});
  if(!DRY && TEST_ONLY && (
    payload.confirmPrint!=="PRINT-ONE-TEST" ||
    payload.receipt?.invoice!=="TEST-1" ||
    payload.receipt?.items?.length!==1 ||
    lines.length>30 || bytes.length>1500
  ))throw Error("Safety lock: only one short supervised TEST-1 receipt may print");
  if(!DRY && CASHIER && (
    payload.confirmPrint!=="CASHIER-RECEIPT" ||
    !/^CS-[0-9]{1,18}$/.test(String(payload.receipt?.invoice||"")) ||
    payload.receipt?.items?.length>50 || lines.length>250 || bytes.length>16000
  ))throw Error("Cashier receipt requires valid CS-number and at most 50 products / 250 lines");
  if(recent.has(id))return json(res,200,{ok:true,duplicate:true,dryRun:DRY},hdr);
  if(recent.size>100)recent.clear();
  recent.add(id);
  if(DRY)return json(res,200,{ok:true,dryRun:true,lines:lines.length,bytes:bytes.length},hdr);
  await spool(bytes);return json(res,200,{ok:true,dryRun:false,lines:lines.length,bytes:bytes.length},hdr);
 }catch(e){return json(res,400,{error:e.message},hdr)}
});
server.listen(PORT,HOST,()=>console.log("Thermal local bridge "+HOST+":"+PORT+" DRY_RUN="+DRY));
