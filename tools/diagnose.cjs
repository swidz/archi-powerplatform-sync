#!/usr/bin/env node
/* Read-only diagnostics. Output contains counts/capabilities, never API bodies or credentials. */
const C=require('../lib/core.js'),Auth=require('../lib/auth.js'),Http=require('../lib/http.js'),Inventory=require('../lib/inventory.js');
const io=require('./node-io.cjs').create();
let auth;
try {
 auth=Auth.create(io);const http=Http.create(io,auth,line=>console.log(line)),collector=Inventory.create(http,auth.tenantId);
 const discovery=collector.discover();
 console.log(JSON.stringify({environmentCount:discovery.environments.length,availableCount:discovery.environments.filter(e=>e.available).length,directComplete:discovery.directComplete,warnings:discovery.warnings,...(process.argv.includes('--list')?{environments:discovery.environments.map(e=>({id:e.id,name:e.name,type:e.type,available:e.available,dataverse:!!e.url}))}:{})},null,2));
 const idx=process.argv.indexOf('--environment');
 if(idx>=0){
  const id=C.envId(process.argv[idx+1]);const env=discovery.environments.find(e=>e.id===id);C.assert(env&&env.available,'Environment is not available.');
  const snapshot={objects:[],coverage:[],warnings:[],partial:false};collector.collect([env],snapshot);
  const counts={};snapshot.objects.forEach(o=>counts[o.kind]=(counts[o.kind]||0)+1);
  console.log(JSON.stringify({environment:env.name,inventoryCounts:counts,warnings:snapshot.warnings}));
  if(process.argv.includes('--full')){
   const Service=require('../lib/service.js');
   const collected=Service.collect(http,auth.tenantId,[env],[],{},line=>console.log(line));
   Service.finish(collected,collected.roleCandidates.filter(c=>c.selected).map(c=>c.object.key));
   const types={};collected.objects.forEach(o=>types[o.kind]=(types[o.kind]||0)+1);
   console.log(JSON.stringify({fullCounts:types,edges:collected.edges.length,roleCandidates:collected.roleCandidates.length,coverage:collected.coverage,warnings:collected.warnings,unresolved:collected.unresolved.length},null,2));
   const saveAt=process.argv.indexOf('--save');if(saveAt>=0){const fs=require('node:fs'),path=require('node:path'),file=path.resolve(process.argv[saveAt+1]);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(collected,null,2)+'\n');console.log('Sanitized snapshot written to requested path.');}
  }else if(env.url){
   const paths=['WhoAmI','appmodules?$select=appmoduleid,name&$top=1','workflows?$select=workflowid,name,category&$filter=category%20eq%205&$top=1','bots?$select=botid,name&$top=1','roles?$select=roleid,name,_roletemplateid_value,_parentrootroleid_value,issytemgenerated&$top=1'];
   for(const endpoint of paths){try{const data=http.request('GET',env.apiUrl+'/api/data/v9.2/'+endpoint,env.url+'/');console.log(JSON.stringify({probe:endpoint.split('?')[0],status:'available',rows:data.value?.length}));}catch(e){console.log(JSON.stringify({probe:endpoint.split('?')[0],status:'unavailable',reason:e.message}));}}
  }
 }
}catch(e){console.error(e.message);process.exitCode=1;}finally{if(auth)auth.clear();}
