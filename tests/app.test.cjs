const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),C=require('../lib/core.js'),F=require('./fixtures.cjs');
function harness(config={}){
 const properties={...(config.properties||{})},writes=[],alerts=[],calls=[],role=F.object('role'),snapshot=F.snapshot();snapshot.roleCandidates=[{object:role,selected:false}];snapshot.coverage=[{collector:'role',environmentId:F.env,complete:true}];
 const chosen=[{id:F.env,name:'Environment',available:true,stage:'PROD'}];
 const context={PPCore:C,PPMetadata:{create:()=>({enrich(){}})},console:{show(){},log(){}},model:{isSet:()=>true,prop(key,value){if(arguments.length===1)return properties[key];writes.push(key);properties[key]=value;}},
  window:{confirm:()=>true,alert:s=>alerts.push(s),promptSaveFile:()=>null},
  PPCliJava:{createIo:()=>({})},PPJava:{io:{}},PPAuth:{create:()=>({tenantId:F.tenant,clear(){calls.push('clear');}})},PPHttp:{create:()=>({})},
  PPInventory:{create:()=>({discover:()=>({environments:chosen,warnings:[],partial:false})})},
  PPService:{collect(){calls.push('collect');return snapshot;},finish(s,keys){s.roleSelectionKeys=keys;calls.push('finish');}},
  PPArchi:{elements:()=>[],relationships:()=>[],prepare:()=>({}),isAllowed:()=>true,apply(){calls.push('apply');if(config.applyError)throw Error('Apply failed');}},
  PPPlanner:{plan:()=>({operations:[],counts:{},partial:false})},
  PPUI:{environments:()=>config.cancel==='environment'?null:chosen,roles:()=>config.cancel==='roles'?null:(config.selectRole?[{id:role.key}]:[]),preview:()=>config.cancel!=='preview'}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../lib/app.js'),'utf8'),context);
 context.PPApp.run(config.mode||'sync',{});return {properties,writes,alerts,calls,snapshot,role};
}
test('Cancel at environment selection performs no metadata collection or model writes',()=>{const h=harness({cancel:'environment'});assert.deepEqual(h.writes,[]);assert.ok(!h.calls.includes('collect'));assert.ok(h.calls.includes('clear'));});
test('Cancel at role review or preview leaves the model untouched',()=>{for(const cancel of ['roles','preview']){const h=harness({cancel});assert.deepEqual(h.writes,[]);assert.ok(!h.calls.includes('apply'));assert.ok(h.calls.includes('clear'));}});
test('Successful apply saves environment IDs, stages and explicit role choices',()=>{const h=harness({selectRole:true});assert.ok(h.calls.includes('apply'));assert.deepEqual(JSON.parse(h.properties['PowerPlatform-EnvironmentIds']),[F.env]);assert.equal(JSON.parse(h.properties['PowerPlatform-EnvironmentSettings'])[F.env].stage,'PROD');assert.deepEqual(JSON.parse(h.properties['PowerPlatform-RoleSelectionKeys']),[h.role.key]);});
test('Role choices from unavailable or deselected environments are retained',()=>{const foreign=F.object('role',F.ids.role,F.env2).key;const h=harness({properties:{'PowerPlatform-TenantId':F.tenant,'PowerPlatform-RoleSelectionKeys':JSON.stringify([foreign])}});assert.deepEqual(JSON.parse(h.properties['PowerPlatform-RoleSelectionKeys']),[foreign]);});
test('Diagnostic and export never mutate the model',()=>{for(const mode of ['diagnose','export']){const h=harness({mode});assert.deepEqual(h.writes,[]);assert.ok(!h.calls.includes('apply'));}});
test('Apply failure does not save selections and clearly requests Undo',()=>{const h=harness({applyError:true});assert.deepEqual(h.writes,[]);assert.ok(h.alerts.some(s=>s.includes('Edit > Undo')));assert.ok(h.calls.includes('clear'));});
