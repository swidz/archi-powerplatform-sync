// Diagnostic-only synchronous adapter. HTTP credentials travel through stdin, never process arguments.
const cp=require('node:child_process'),fs=require('node:fs'),path=require('node:path');
const Auth=require('../lib/auth.js');
function locate(){
 const override=process.env.ARCHI_POWERPLATFORM_AZ;
 const dirs=(process.env.PATH||'').split(path.delimiter).concat(process.platform==='win32'?[path.join(process.env.ProgramFiles||'C:\\Program Files','Microsoft SDKs/Azure/CLI2/wbin')]:['/opt/homebrew/bin','/usr/local/bin','/usr/bin']);
 const files=override?[override]:dirs.filter(path.isAbsolute).flatMap(d=>(process.platform==='win32'?['az.cmd','az.exe']:['az']).map(n=>path.join(d,n)));
 const file=files.find(f=>path.isAbsolute(f)&&fs.existsSync(f));if(!file)throw Error('Azure CLI not found. Set ARCHI_POWERPLATFORM_AZ.');return file;
}
function create(){
 const executable=locate();
 return {now:Date.now,sleep:ms=>Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,ms),
 run(args){
  const command=Auth.command(executable,args,process.platform==='win32',process.env.ComSpec);
  const r=cp.spawnSync(command[0],command.slice(1),{encoding:'utf8',windowsHide:true,windowsVerbatimArguments:process.platform==='win32'&&/cmd\.exe$/i.test(command[0]),timeout:90000,maxBuffer:1024*1024,env:{...process.env,AZURE_CORE_COLLECT_TELEMETRY:'false',PYTHONIOENCODING:'utf-8'}});
  if(r.error)throw Error('CLI execution failed.');return {exitCode:r.status,stdout:r.stdout,stderr:r.stderr};
 },
 request(method,url,headers,body){
  const r=cp.spawnSync(process.execPath,[__filename,'--http-worker'],{input:JSON.stringify({method,url,headers,body}),encoding:'utf8',timeout:95000,maxBuffer:34*1024*1024,windowsHide:true});
  if(r.status!==0)throw Error('HTTP transport failed.');return JSON.parse(r.stdout);
 }};
}
if(process.argv[2]==='--http-worker'){
 (async()=>{
  const input=JSON.parse(fs.readFileSync(0,'utf8'));
  const r=await fetch(input.url,{method:input.method,headers:input.headers,body:input.body,redirect:'error',signal:AbortSignal.timeout(90000)});
  let size=0;const chunks=[];for await(const chunk of r.body){size+=chunk.length;if(size>32*1024*1024)throw Error('Too large');chunks.push(chunk);}
  let body;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{body=null;}
  process.stdout.write(JSON.stringify({status:r.status,body,headers:{'retry-after':r.headers.get('retry-after'),'x-ms-retry-after-ms':r.headers.get('x-ms-retry-after-ms')}}));
 })().catch(()=>{process.exitCode=1;});
}
module.exports={create};
