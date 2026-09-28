#!/usr/bin/env node
/* Explicit, read-only environment/solution diagnostics for the context-specific collectors. */
const C=require('../lib/core.js'),A=require('../lib/auth.js'),H=require('../lib/http.js'),I=require('../lib/inventory.js'),S=require('../lib/scoped.js'),fs=require('node:fs'),path=require('node:path');
function argument(name){const i=process.argv.indexOf(name);return i<0?undefined:process.argv[i+1];}
let auth;
try{
 const io=require('./node-io.cjs').create();auth=A.create(io);const http=H.create(io,auth),environmentId=C.envId(argument('--environment'));
 const discovery=I.create(http,auth.tenantId).discover(),env=discovery.environments.find(e=>e.id===environmentId);C.assert(env&&env.available,'Environment is unavailable.');
 const collector=S.create(http,auth.tenantId,line=>console.log(line));
 if(process.argv.includes('--list-solutions'))console.log(JSON.stringify(collector.solutions(env).map(o=>({id:o.id,name:o.name,version:o.version,managed:o.isManaged})),null,2));
 else{
  const table=argument('--table'),solution=table?undefined:C.guid(argument('--solution')),groups=process.argv.includes('--all')?Object.keys(S.GROUPS):[argument('--kind')];
  let existing=[];const snapshots=[];
  for(const group of groups){C.assert(!table||group==='plugins','Table context supports only --kind plugins.');const snapshot=table?collector.collectMany([{environment:env,tableId:C.guid(table)}],group,existing,{}):collector.collect(env,solution,group,existing,{});require('../lib/metadata.js').create(http).enrich(snapshot,[env],{});snapshots.push(snapshot);
   console.log(JSON.stringify({scope:snapshot.scope,counts:snapshot.objects.reduce((a,o)=>(a[o.kind]=(a[o.kind]||0)+1,a),{}),edges:snapshot.edges.length,coverage:snapshot.coverage,warnings:snapshot.warnings}));
   snapshot.objects.forEach(o=>{existing=existing.filter(e=>e.key!==o.key);existing.push({...o,properties:{...C.properties(o),IsDeleted:'no'}});});
  }
  const file=argument('--save');if(file){const target=path.resolve(file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,JSON.stringify(snapshots,null,2)+'\n');console.log('Normalized scoped snapshots saved.');}
 }
}catch(e){console.error(e.message);process.exitCode=1;}finally{if(auth)auth.clear();}
