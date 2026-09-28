const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),C=require('../lib/core.js'),S=require('../lib/scoped.js'),Context=require('../lib/context.js'),F=require('./fixtures.cjs');
function run(config={}){
 const writes=[],calls=[],alerts=[],properties={'PowerPlatform-EnvironmentIds':JSON.stringify([F.env2]),'PowerPlatform-RoleSelectionKeys':'["remembered"]'};
 const envs=[{id:F.env,name:'First',url:'https://first.crm.dynamics.com',available:true},{id:F.env2,name:'Second',url:'https://second.crm.dynamics.com',available:!config.unavailable}];
 const action=config.action||'tables',kind=config.selectionKind||(action==='solutions'?'environment':'solution');
 const selected=envs.map(e=>({...F.existing(F.object(kind,kind==='environment'?e.id:F.ids.app,e.id)),managed:true,inModel:true}));
 if(config.invalid)selected[1].kind='flow';if(config.wrongTenant)selected.forEach(e=>{e.tenantId=F.ids.agent;e.key=C.key(e.tenantId,e.environmentId,e.kind,e.id);});
 const candidates=envs.map(e=>S.normalize(F.tenant,e,'solution',{solutionid:F.ids.app,friendlyname:'Copied solution'}));
 const collector={solutions(env){calls.push('solutions:'+env.id);if(config.failLast&&env.id===F.env2)throw Error('Second context failed');return candidates.filter(o=>o.environmentId===env.id);},
  selectedSolutions:S.create({},F.tenant).selectedSolutions,
  collectMany(requests,group){requests.forEach(r=>{calls.push(r.tableId?{env:r.environment.id,table:r.tableId,group}:{env:r.environment.id,solution:r.solutionId,group});if(config.failLast&&r.environment.id===F.env2)throw Error('Second context failed');});
   const s=S.environments(F.tenant,envs);s.scope={action:'get-'+group,contexts:requests.map(r=>({environmentId:r.environment.id,solutionId:r.solutionId,tableId:r.tableId}))};
   s.objects.push(...envs.map(e=>F.object(S.GROUPS[group][0],F.ids.child,e.id)));return s;}};
 let previewPlan,pickerArgs,componentPickerArgs,enriched;
 const context={PPCore:C,PPMetadata:{create:()=>({localize(){calls.push('localize');},enrich(s){calls.push('enrich');enriched=s;}})},console:{show(){},log(){}},model:{isSet:()=>true,prop(key,value){if(arguments.length===1)return properties[key];properties[key]=value;writes.push(key);}},window:{alert:s=>alerts.push(s)},
  PPArchi:{context:(items,level)=>Context.resolve(items,level),elements:()=>[F.existing(candidates[0])],relationships:()=>[],prepare:()=>({}),isAllowed:()=>true,apply(){calls.push('apply');}},
  PPCliJava:{createIo:()=>({})},PPJava:{io:{}},PPAuth:{create(){calls.push('auth');return {tenantId:F.tenant,clear(){calls.push('clear');}};}},PPHttp:{create:()=>({})},
  PPInventory:{create:()=>({discover(){calls.push('discovery');return {environments:envs,warnings:[],partial:false};}})},PPScoped:{...S,create:()=>collector},
  PPPlanner:{plan(old,rels,snapshot){previewPlan=snapshot;return {operations:[],counts:{},partial:false};}},PPUI:{environments:()=>[envs[0]],solutions(...args){pickerArgs=args;return config.cancelSolutions?null:[candidates[1]];},
   components(...args){componentPickerArgs=args;calls.push('component-picker');return config.cancelComponents?null:config.emptyComponents?[]:[args[1][0]];},preview(){calls.push('preview');return !config.cancel;}}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../lib/scoped-app.js'),'utf8'),context);context.PPScopedApp.run(action,{},selected);return {calls,writes,alerts,properties,previewPlan,pickerArgs,candidates,componentPickerArgs,enriched};
}
test('A wrong type anywhere in a multi-selection is rejected before authentication or discovery',()=>{
 for(const action of ['solutions',...Object.keys(S.GROUPS)]){const h=run({invalid:true,action});assert.deepEqual(h.calls,[]);assert.deepEqual(h.writes,[]);assert.match(h.alerts[0],/wrong type/);}
});
test('Cross-tenant selection is rejected before metadata discovery',()=>{const h=run({wrongTenant:true});assert.ok(!h.calls.includes('discovery'));assert.ok(h.calls.includes('clear'));assert.deepEqual(h.writes,[]);});
test('Every component script shows a picker and enriches only checked components before one preview and apply',()=>{
 for(const group of Object.keys(S.GROUPS)){const h=run({action:group});assert.deepEqual(h.calls.filter(c=>typeof c==='object'),[F.env,F.env2].map(env=>({env,solution:F.ids.app,group})));
  assert.equal(h.componentPickerArgs[0],group);assert.equal(h.componentPickerArgs[1].length,2);assert.equal(h.calls.filter(c=>c==='component-picker').length,1);
  const components=h.enriched.objects.filter(o=>S.GROUPS[group].includes(o.kind));assert.equal(components.length,1);assert.equal(components[0].environmentId,F.env);
  assert.ok(h.calls.indexOf('component-picker')<h.calls.indexOf('enrich'));assert.ok(h.calls.indexOf('enrich')<h.calls.indexOf('preview'));
  assert.equal(h.calls.filter(c=>c==='preview').length,1);assert.equal(h.calls.filter(c=>c==='apply').length,1);assert.deepEqual(h.writes,[]);assert.equal(h.properties['PowerPlatform-RoleSelectionKeys'],'["remembered"]');}
});
test('An unavailable later environment is rejected before any per-context collection',()=>{
 for(const action of ['solutions','tables']){const h=run({unavailable:true,action});assert.ok(!h.calls.some(c=>typeof c==='object'||String(c).startsWith('solutions:')));assert.ok(!h.calls.includes('apply'));assert.match(h.alerts[0],/unavailable/);}
});
test('A fatal error in the final context leaves the entire model unchanged',()=>{
 for(const action of ['solutions','tables']){const h=run({failLast:true,action});assert.ok(!h.calls.includes('apply'));assert.ok(!h.calls.includes('preview'));assert.ok(h.calls.includes('clear'));assert.deepEqual(h.writes,[]);assert.match(h.alerts[0],/Second context failed/);}
});
test('Cancelling a context preview or solution picker performs no model writes',()=>{for(const config of [{cancel:true},{action:'solutions',cancelSolutions:true}]){const h=run(config);assert.ok(!h.calls.includes('apply'));assert.deepEqual(h.writes,[]);assert.ok(h.calls.includes('clear'));}});
test('get-solutions uses one combined picker with environment-qualified keys and applies only chosen solutions',()=>{
 const h=run({action:'solutions'});assert.equal(h.pickerArgs[0].length,2);assert.equal(h.pickerArgs[1].length,2);assert.deepEqual(Array.from(h.pickerArgs[2]),[h.candidates[0].key]);
 const objects=h.previewPlan.objects.filter(o=>o.kind==='solution');assert.equal(objects.length,1);assert.equal(objects[0].environmentId,F.env2);assert.equal(h.previewPlan.scope.contexts.length,2);
});
test('get-environments does not invoke solution or component collectors',()=>{const h=run({action:'environments'});assert.ok(!h.calls.some(c=>typeof c==='object'||String(c).startsWith('solutions:')));assert.deepEqual(JSON.parse(h.properties['PowerPlatform-EnvironmentIds']),[F.env]);});

test('get-plugins forwards every selected table and shows one combined preview',()=>{
 const h=run({action:'plugins',selectionKind:'table'});assert.deepEqual(h.calls.filter(c=>typeof c==='object'),[F.env,F.env2].map(env=>({env,table:F.ids.app,group:'plugins'})));assert.equal(h.calls.filter(c=>c==='preview').length,1);assert.ok(h.calls.includes('apply'));
});
test('Invalid table selection for get-plugins is rejected before authentication',()=>{const h=run({action:'plugins',selectionKind:'table',invalid:true});assert.deepEqual(h.calls,[]);assert.match(h.alerts[0],/wrong type/);});

test('Cancelling or clearing any component picker stops before enrichment, preview, and model writes',()=>{
 for(const action of Object.keys(S.GROUPS))for(const config of [{cancelComponents:true},{emptyComponents:true}]){const h=run({action,...config});assert.ok(h.calls.includes('component-picker'));assert.ok(h.calls.includes('clear'));assert.ok(!h.calls.includes('enrich'));assert.ok(!h.calls.includes('preview'));assert.ok(!h.calls.includes('apply'));assert.deepEqual(h.writes,[]);}
});
