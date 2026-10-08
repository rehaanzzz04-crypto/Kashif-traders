// Kashif Traders laptop-only safe bridge verification. Never sends a physical job.
const endpoint="http://127.0.0.1:8788",origin="http://localhost:8787";
const fetchJSON=async(url,init={})=>{
 const response=await fetch(url,{...init,headers:{origin,...init.headers},signal:AbortSignal.timeout(8000)});
 const data=await response.json();
 if(!response.ok)throw Error(data.error||"HTTP "+response.status);
 return data;
};
try {
 const health=await fetchJSON(endpoint+"/health");
 if(!health.ready)throw Error("Bridge not ready");
 if(health.dryRun!==true)throw Error("SAFETY STOP: bridge is NOT in dry-run mode. Exit without sending jobs.");
 console.log("PASS: 127.0.0.1:8788 connected | DRY RUN ON | No printer output");
 console.log("Target printer:",health.printer);
 for(const count of [1,5,23,28,50]) {
  const items=Array.from({length:count},(_,i)=>({
   name:"CHOCOLATE POWDER DARK SAMPLE "+(i+1),qty:2,unit:"KG",rate:1500,amount:3000
  }));
  const data={invoice:"CS-3",date:"09-Oct-2026",customer:"DRY RUN TEST CUSTOMER",createdBy:"Cashier Test",
   paidBy:"Cashier Test",payment:"Cash",items,subtotal:count*3000,discount:0,total:count*3000,received:count*3000,due:0,status:"Paid"};
  const jobId="dryrun-"+count+"-"+Date.now();
  const result=await fetchJSON(endpoint+"/print",{
   method:"POST",headers:{"Content-Type":"application/json"},
   body:JSON.stringify({jobId,receipt:data})
  });
  if(!result.ok||!result.dryRun||result.duplicate||!(result.lines>0)||!(result.bytes>0))
   throw Error("Dry-run result invalid for "+count+" products");
  console.log("PASS:",count,"products |",result.lines,"receipt lines |",result.bytes,"bytes | NO PAPER");
 }
 console.log("");
 console.log("ALL DRY-RUN CHECKS PASSED. Close this window and send its screenshot.");
 console.log("Do not run the bridge in physical-print mode yet.");
} catch(error) {
 console.error("TEST FAILED:",error.message);
 console.error("Start start-thermal-test.cmd first. Printer not required for dry-run.");
 process.exitCode=1;
}
