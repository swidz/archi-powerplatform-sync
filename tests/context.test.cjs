const test=require('node:test'),assert=require('node:assert/strict'),C=require('../lib/core.js'),Context=require('../lib/context.js'),F=require('./fixtures.cjs');
function selected(kind='solution',id=F.ids.app,env=F.env){return {...F.existing(F.object(kind,id,env)),managed:true,inModel:true};}
test('Multiple solutions resolve across environments and duplicate diagram occurrences collapse',()=>{
 const a=selected(),b=selected('solution',F.ids.flow),copy=selected('solution',F.ids.app,F.env2);
 const contexts=Context.resolve([a,b,a,copy],'solution');assert.equal(contexts.length,3);
 assert.deepEqual(contexts.map(c=>[c.environmentId,c.solutionId]),[[F.env,F.ids.app],[F.env,F.ids.flow],[F.env2,F.ids.app]]);
});
test('Multiple environment Nodes resolve to distinct contexts',()=>{
 const contexts=Context.resolve([selected('environment',F.env),selected('environment',F.env2,F.env2)],'environment');assert.equal(contexts.length,2);
});
test('Every selected object must match both the source kind and ArchiMate type',()=>{
 for(const level of ['solution','environment']){
  const valid=selected(level,level==='environment'?F.env:F.ids.app);
  for(const wrong of [{...valid,kind:'flow'},{...valid,base:'data-object'},{...valid,base:'folder'},{...valid,base:'association-relationship'}])assert.throws(()=>Context.resolve([valid,wrong],level),/wrong type/);
 }
});
test('Selection rejects empty, unmanaged, deleted and other-model objects',()=>{
 assert.throws(()=>Context.resolve([],'solution'),/one or more imported/);
 const o=selected();for(const [patch,error] of [[{managed:false},/not managed/],[{deleted:true},/marked deleted/],[{inModel:false},/active model/]])assert.throws(()=>Context.resolve([o,{...o,...patch}],'solution'),error);
});
test('Selection rejects identity corruption and mixed tenants before collection',()=>{
 const o=selected();assert.throws(()=>Context.resolve([{...o,id:F.ids.flow}],'solution'),/inconsistent/);
 const env=selected('environment',F.env);assert.throws(()=>Context.resolve([{...env,id:F.env2,key:C.key(F.tenant,F.env,'environment',F.env2)}],'environment'),/inconsistent environment/);
 const tenant=F.ids.agent,other={...o,tenantId:tenant,key:C.key(tenant,F.env,'solution',o.id)};assert.throws(()=>Context.resolve([o,other],'solution'),/same tenant/);
});
