// One short supervised TEST-1 job; refuse dry run or unrestricted printer modes.
import {randomUUID} from "node:crypto";
import readline from "node:readline/promises";
import {stdin as input,stdout as output} from "node:process";
const url="http://127.0.0.1:8788";
const head={Origin:"http://localhost:8787"};
const rl=readline.createInterface({input,output});
try {
 const response=await fetch(url+"/health",{headers:head,signal:AbortSignal.timeout(5000)});
 const health=await response.json();
 if(!response.ok||!health.ready)throw Error("Bridge not ready");
 if(health.dryRun!==false||health.testOnly!==true)
  throw Error("Safety stop: run start-thermal-physical-test.cmd and confirm YES-TEST first");
 console.log("Selected printer:",health.printer);
 console.log("Physical mode:",!health.dryRun,"Test-only mode:",health.testOnly);
 console.log("This will print ONE 1-product fake test receipt, NO real customer data.");
 console.log("If the printer begins feeding blank paper, cancel print job / power off.");
 const typed=(await rl.question("Type PRINT-ONE to send ONE test receipt, or Enter to cancel: ")).trim();
 if(typed!=="PRINT-ONE"){console.log("CANCELLED - no job sent");process.exitCode=0;}
 else {
  const receipt={
   invoice:"TEST-1",date:"2026-10-09",customer:"TEST ONLY",createdBy:"Kashif Traders",
   paidBy:"Kashif Traders",payment:"Cash",
   items:[{name:"THERMAL PRINTER TEST",qty:1,unit:"pcs",rate:10,amount:10}],
   subtotal:10,discount:0,total:10,received:10,due:0,status:"Paid"
  };
  const result=await fetch(url+"/print",{
   method:"POST",headers:{...head,"Content-Type":"application/json"},
   body:JSON.stringify({jobId:randomUUID(),confirmPrint:"PRINT-ONE-TEST",receipt}),
   signal:AbortSignal.timeout(24000)
  });
  const data=await result.json();
  if(!result.ok||!data.ok||data.dryRun!==false||data.duplicate)throw Error(data.error||"Print job not accepted");
  console.log("Test job accepted by Windows spooler. This does NOT confirm paper output.");
  console.log("Check printer. Note whether text, length, and blank feed look correct.");
 }
}catch(error){console.error("TEST FAILED:",error.message);process.exitCode=1;}
finally{rl.close();}
