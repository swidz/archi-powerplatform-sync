const test=require('node:test'),assert=require('node:assert/strict'),C=require('../lib/core.js'),S=require('../lib/scoped.js'),P=require('../lib/planner.js'),Context=require('../lib/context.js'),F=require('./plugins-fixture.js');
function collect(options={},requests=[{environment:F.env,solutionId:F.ids.solution}],old=[]){const fx=F.create(options),snapshot=S.create(fx.http,F.tenant).collectMany(requests,'plugins',old,{});return {snapshot,fx};}
function existing(s){return s.objects.map(o=>({...o,elementId:o.key,base:C.TYPES[o.kind].base,properties:{...C.properties(o),IsDeleted:'no'}}));}
function rels(s){return s.edges.map((e,i)=>({...e,id:'r'+i,managed:true,evidence:[e.evidence],properties:{IsDeleted:'no'}}));}
test('Solution plug-ins create Application Functions and Access links to registered Data Objects',()=>{
 const {snapshot:s}=collect(),plugin=s.objects.find(o=>o.kind==='plugin');assert.equal(C.TYPES.plugin.base,'application-function');assert.equal(s.objects.filter(o=>o.kind==='table').length,2);
 assert.equal(s.edges.filter(e=>e.type==='access-relationship').length,2);assert.equal(s.edges.filter(e=>e.type==='association-relationship').length,1);
 const p=P.plan([],[],s);assert.ok(p.relationships.some(r=>r.type==='access-relationship'));assert.equal(plugin.registrations.length,2);
 assert.equal(plugin.registrations[1].statecode,'1');assert.equal(C.properties(plugin)['PowerPlatform-Metadata-Assembly-isolationmode'],'2');
 assert.ok(!JSON.stringify(s).includes('SECRET-'));
});
test('Assembly and processing-step solution membership both discover plug-in types',()=>{for(const memberType of [91,92]){const {snapshot:s}=collect({memberType});assert.equal(s.objects.filter(o=>o.kind==='plugin').length,1);assert.equal(s.edges.filter(e=>e.type==='access-relationship').length,2);}});
test('Shell-only assembly membership does not expand unselected plug-in types',()=>{const {snapshot:s}=collect({memberType:91,shell:true});assert.equal(s.objects.filter(o=>o.kind==='plugin').length,0);});
test('Multi-table selection reuses shared plug-ins and combines registration properties',()=>{
 const requests=[F.ids.table,F.ids.table2].map(tableId=>({environment:F.env,tableId})),{snapshot:s,fx}=collect({},requests);
 assert.equal(s.objects.filter(o=>o.kind==='plugin').length,1);assert.equal(s.objects.filter(o=>o.kind==='solution').length,0);assert.equal(s.scope.contexts.length,2);
 assert.equal(s.objects.find(o=>o.kind==='plugin').registrations.length,2);assert.equal(s.edges.filter(e=>e.type==='access-relationship').length,2);
 assert.ok(!fx.calls.some(url=>url.includes('solutioncomponents')));assert.equal(s.partial,false);
});
test('Copied tables and plugins remain separate across environments',()=>{
 const copy={...F.env,id:'22222222-2222-2222-2222-222222222222'},requests=[F.env,copy].map(environment=>({environment,tableId:F.ids.table})),{snapshot:s}=collect({},requests);
 assert.equal(s.objects.filter(o=>o.kind==='plugin').length,2);assert.ok(s.edges.every(e=>e.source.split('|')[1]===e.target.split('|')[1]));
});
test('Mixed table and solution requests abort before any API read',()=>{
 const fx=F.create(),requests=[{environment:F.env,tableId:F.ids.table},{environment:F.env,solutionId:F.ids.solution}];assert.throws(()=>S.create(fx.http,F.tenant).collectMany(requests,'plugins',[],{}),/not a mixture/);assert.equal(fx.calls.length,0);
});
test('get-plugins validates homogeneous source types, including every selected table',()=>{
 const table={...existing(S.environments(F.tenant,[F.env]))[0],kind:'table',base:'data-object',id:F.ids.table,key:C.key(F.tenant,F.env.id,'table',F.ids.table),managed:true};
 const solution={...table,kind:'solution',base:'application-component',id:F.ids.solution,key:C.key(F.tenant,F.env.id,'solution',F.ids.solution)};
 assert.equal(Context.resolve([table,table],'plugins')[0].tableId,F.ids.table);assert.equal(Context.resolve([solution],'plugins')[0].solutionId,F.ids.solution);
 for(const selected of [[table,solution],[solution,table],[{...table,kind:'view'}],[table,{...table,base:'application-component'}]])assert.throws(()=>Context.resolve(selected,'plugins'));
});
test('Global registrations remain properties and never fabricate a table Access link',()=>{
 const {snapshot:s}=collect({global:true});assert.equal(s.edges.filter(e=>e.type==='access-relationship').length,1);assert.equal(s.objects.find(o=>o.kind==='plugin').registrations.length,2);assert.equal(s.partial,false);
});
test('Workflow activities are excluded from plug-in elements',()=>{const {snapshot:s}=collect({workflowActivity:true});assert.equal(s.objects.filter(o=>o.kind==='plugin').length,0);assert.equal(s.ignored.plugin,1);});
test('A complete table refresh can retire a removed registration first imported through a solution',()=>{
 const before=collect().snapshot,old=existing(before),after=collect({empty:true},[{environment:F.env,tableId:F.ids.table}],old).snapshot,p=P.plan(old,rels(before),after);
 const removed=p.relationships.filter(r=>r.action==='deleted');assert.equal(removed.length,1);assert.ok(removed[0].target.endsWith(F.ids.table));assert.ok(!p.operations.some(o=>o.action==='deleted'));
});
test('Incomplete plug-in or step reads cannot retire earlier Access links',()=>{
 const before=collect().snapshot,old=existing(before);
 for(const options of [{fail:'sdkmessageprocessingsteps'},{missingPlugin:true}]){const after=collect(options,[{environment:F.env,tableId:F.ids.table}],old).snapshot;assert.equal(after.partial,true);assert.ok(!P.plan(old,rels(before),after).relationships.some(r=>r.action==='deleted'));}
});
test('Unavailable registered tables are reported without unresolved relationship endpoints',()=>{const {snapshot:s}=collect({missingTable:true});assert.equal(s.partial,true);assert.equal(s.unresolved.length,2);assert.doesNotThrow(()=>P.plan([],[],s));});
test('Bulk inventory preserves plug-in observation states outside its scope',()=>{const s=collect().snapshot,old=existing(s),bulk=S.environments(F.tenant,[F.env]);delete bulk.scope;bulk.coverage=[{environmentId:F.env.id,collector:'inventory',complete:true}];assert.ok(!P.plan(old,[],bulk).operations.some(op=>op.key.includes('|plugin|')));});
test('Legacy plug-ins migrate only on observation, preserving membership IDs and hosting evidence',()=>{
 const before=collect().snapshot,old=existing(before);old.find(o=>o.kind==='plugin').base='application-component';
 const links=rels(before).map(r=>r.type==='association-relationship'?{...r,type:'aggregation-relationship'}:r),membership=links.find(r=>r.type==='aggregation-relationship');
 const after=collect({},[{environment:F.env,tableId:F.ids.table}],old).snapshot,p=P.plan(old,links,after);
 assert.equal(p.counts.typeChanges,1);assert.equal(p.counts.relationshipTypeChanges,1);assert.equal(p.relationshipTypeChanges[0].id,membership.id);
 const plugin=old.find(o=>o.kind==='plugin'),op=p.operations.find(o=>o.key===plugin.key);assert.equal(op.previousBase,'application-component');assert.equal(op.base,'application-function');assert.equal(op.elementId,plugin.elementId);
 assert.ok(p.relationships.some(r=>r.target===plugin.key&&r.type==='serving-relationship'));assert.ok(!p.relationships.some(r=>r.id===membership.id&&r.action==='deleted'));
 const empty=collect({empty:true},[{environment:F.env,tableId:F.ids.table}],old).snapshot;assert.equal(P.plan(old,links,empty).counts.typeChanges,0);
});
test('Function migration does not accept unrelated unexpected source types',()=>{
 const s=collect().snapshot,old=existing(s);old.find(o=>o.kind==='plugin').base='application-service';assert.throws(()=>P.plan(old,[],s),/unexpected ArchiMate type/);
});
