import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=(file)=>readFileSync(new URL("../local-server/"+file,import.meta.url),"utf8");
const bridge=read("thermal-print-bridge.mjs");
const script=read("print-one-thermal-test.mjs");
const liveStart=read("start-thermal-physical-test.cmd");
const safeStart=read("start-thermal-test.cmd");
test("live printing needs explicit test-only opt-in and is restricted to one test item",()=>{
 assert.match(bridge,/const DRY=process\.env\.KT_PRINT_DRY_RUN!=="0"/);
 assert.match(bridge,/const TEST_ONLY=process\.env\.KT_PRINT_TEST_ONLY==="1"/);
 assert.match(bridge,/if\(!DRY&&!TEST_ONLY\)throw Error/);
 assert.match(bridge,/payload\.confirmPrint!=="PRINT-ONE-TEST"/);
 assert.match(bridge,/payload\.receipt\?\.invoice!=="TEST-1"/);
 assert.match(bridge,/payload\.receipt\?\.items\?\.length!==1/);
 assert.match(bridge,/lines\.length>30 \|\| bytes\.length>1500/);
 assert.match(bridge,/const HOST="127\.0\.0\.1"/);
});
test("operator must confirm physical job twice; dry-run launcher refuses physical mode",()=>{
 assert.match(liveStart,/YES-TEST/);
 assert.match(liveStart,/KT_PRINT_TEST_ONLY=1/);
 assert.match(liveStart,/KT_PRINT_DRY_RUN=0/);
 assert.match(script,/PRINT-ONE/);
 assert.match(script,/health\.dryRun!==false\|\|health\.testOnly!==true/);
 assert.match(script,/invoice:"TEST-1"/);
 assert.match(safeStart,/if \/I "%~1"=="print"/);
 assert.doesNotMatch(safeStart,/if \/I "%~1"=="print" set "KT_PRINT_DRY_RUN=0"/);
});

test("Windows PowerShell policy exemption is limited to spawned printer helper process",()=>{
 assert.match(bridge,/spawn\("powershell\.exe",\["-NoProfile","-NonInteractive","-ExecutionPolicy","Bypass","-File",script/);
 assert.doesNotMatch(bridge,/Set-ExecutionPolicy|MachinePolicy|LocalMachine/);
});
