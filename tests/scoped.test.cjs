const test=require('node:test'),assert=require('node:assert/strict'),C=require('../lib/core.js'),S=require('../lib/scoped.js'),P=require('../lib/planner.js'),Context=require('../lib/context.js'),F=require('./fixtures.cjs');
const solutionId='88888888-8888-8888-8888-888888888888',otherId='99999999-9999-9999-9999-999999999999';
const env={id:F.env,name:'Environment',url:'https://test.crm4.dynamics.com',apiUrl:'https://test.api.crm4.dynamics.com',available:true};
function member(type,id,behavior=1){return {componenttype:type,objectid:id,_solutionid_value:solutionId,rootcomponentbehavior:behavior};}
function fixture(config={}){
 const calls=[],rows=config.rows||{},members=config.members||[];
 const http={request(method,url){calls.push(url);return {solutionid:solutionId,friendlyname:'Solution A',uniquename:'a',version:'1.0.0.0'};},pages(url,resource,callback){
  calls.push(url);const decoded=decodeURIComponent(url),collection=decoded.split('/api/data/v9.2/')[1].split('?')[0];
  if(config.fail===collection)throw C.readError('Forbidden',403);
  if(collection==='solutioncomponentdefinitions')return callback([{primaryentityname:'bot',solutioncomponenttype:10106}]);
  if(collection==='solutioncomponents'){callback(members.filter(m=>decoded.includes('componenttype eq '+m.componenttype)));if(config.partial)throw C.readError('Page failed',500);return;}
  callback(rows[collection]||[]);
 }};
 const collector=S.create(http,F.tenant);return {collect:(kind,existing=[],options={})=>collector.collect(env,solutionId,kind,existing,{discoverDependencies:false,...options}),calls,collector};
}
test('Environment retrieval creates only Node metadata',()=>{const s=S.environments(F.tenant,[env]);assert.equal(s.objects.length,1);assert.equal(s.objects[0].kind,'environment');assert.equal(s.scope.action,'get-environments');});
test('Solution discovery shows visible solutions by default with an explicit hidden-solution option',()=>{
 const fx=fixture();fx.collector.solutions(env);assert.ok(decodeURIComponent(fx.calls[0]).includes('isvisible eq true'));
 const all=fixture();all.collector.solutions(env,{includeHiddenSolutions:true});assert.ok(!all.calls[0].includes('$filter'));
});
test('A non-GUID optional canvas alias is not used as a source identity',()=>{
 const o=S.normalize(F.tenant,env,'canvasapp',{canvasappid:F.ids.app,uniquecanvasappid:'logical-name-only',name:'App'});assert.deepEqual(o.aliases,[F.ids.app]);
});
test('Solution-context selection validates ownership, distinct contexts and kind',()=>{
 const o={managed:true,tenantId:F.tenant,environmentId:F.env,kind:'solution',id:solutionId};assert.equal(Context.resolve([o,o],'solution').solutionId,solutionId);
 assert.throws(()=>Context.resolve([],'solution'),/Select an imported/);assert.throws(()=>Context.resolve([{...o,kind:'flow'}],'solution'),/Select a solution/);
 assert.throws(()=>Context.resolve([o,{...o,id:otherId}],'solution'),/exactly one/);assert.throws(()=>Context.resolve([{...o,managed:false}],'environment'),/not managed/);
});
test('get-applications queries only requested solution component types and preserves legacy canvas aliases',()=>{
 const fx=fixture({members:[member(300,F.ids.child)],rows:{canvasapps:[{canvasappid:F.ids.child,uniquecanvasappid:F.ids.app,name:'canvas',displayname:'App',canvasapptype:0}]}});
 const old=F.existing(F.object('canvasapp',F.ids.app));const s=fx.collect('applications',[old]);assert.equal(s.objects.find(o=>o.kind==='canvasapp').key,old.key);
 assert.ok(fx.calls.every(url=>!url.includes('workflows?')&&!url.includes('bots?')&&!url.includes('EntityDefinitions?')));
 assert.ok(decodeURIComponent(fx.calls.find(url=>url.includes('solutioncomponents?'))).includes('_solutionid_value eq '+solutionId));
 assert.equal(s.edges[0].type,'aggregation-relationship');
});
test('Shared components in two solutions reuse the same Archi concept and retain the other membership',()=>{
 const fx=fixture({members:[member(300,F.ids.app)],rows:{canvasapps:[{canvasappid:F.ids.app,name:'App'}]}}),s=fx.collect('applications');
 const old=s.objects.map(F.existing),sol=s.objects.find(o=>o.kind==='solution'),other=F.existing(F.object('solution',otherId)),app=s.objects.find(o=>o.kind==='canvasapp');
 const links=[sol,other].map((source,i)=>({id:'r'+i,source:source.key,target:app.key,type:'aggregation-relationship',managed:true,evidence:[{owner:source.key+'|members|canvasapp',source:'solutioncomponent',field:'objectid',interaction:'solution-member'}],properties:{IsDeleted:'no'}}));
 const empty=fixture().collect('applications',[...old,other]),p=P.plan([...old,other],links,empty);
 assert.equal(p.relationships.find(r=>r.id==='r0').action,'deleted');assert.ok(!p.relationships.some(r=>r.id==='r1'));assert.ok(!p.operations.some(o=>o.key===app.key));
 assert.equal(p.counts.deleted,0);
});
test('Partial membership and unreadable member metadata preserve existing membership',()=>{
 for(const config of [{partial:true},{members:[member(300,F.ids.app)],fail:'canvasapps'}]){
  const s=fixture(config).collect('applications');const sol=s.objects.find(o=>o.kind==='solution');assert.ok(!s.completedOwners[sol.key+'|members|canvasapp']);assert.equal(s.partial,true);
 }
});
test('Tables are Data Objects and table definitions never include attribute expansion',()=>{
 const fx=fixture({members:[member(1,F.ids.app)],rows:{EntityDefinitions:[{MetadataId:F.ids.app,LogicalName:'account',DisplayName:{UserLocalizedLabel:{Label:'Account'}},SchemaName:'Account',EntitySetName:'accounts'}]}}),s=fx.collect('tables');
 const table=s.objects.find(o=>o.kind==='table');assert.equal(C.TYPES[table.kind].base,'data-object');assert.equal(table.name,'Account');assert.ok(!fx.calls.some(url=>url.includes('Attributes')));assert.equal(s.edges[0].type,'association-relationship');
});
test('Views include all subcomponents only for explicitly include-all table roots',()=>{
 const rows={EntityDefinitions:[{MetadataId:F.ids.app,LogicalName:'account'}],savedqueries:[{savedqueryid:F.ids.child,name:'Active accounts',returnedtypecode:'account',fetchxml:'never retained'}]};
 const fx=fixture({members:[member(1,F.ids.app,0)],rows}),s=fx.collect('views');assert.equal(s.objects.filter(o=>o.kind==='view').length,1);assert.ok(!JSON.stringify(s).includes('never retained'));
 const shell=fixture({members:[member(1,F.ids.app,2)],rows}).collect('views');assert.equal(shell.objects.filter(o=>o.kind==='view').length,0);
});
test('Explicit view retrieval links to an existing table without updating its metadata',()=>{
 const table=F.object('table',F.ids.app);table.logicalName='account';const old=F.existing(table);
 const fx=fixture({members:[member(26,F.ids.child)],rows:{savedqueries:[{savedqueryid:F.ids.child,name:'Accounts',returnedtypecode:'account'}]}}),s=fx.collect('views',[old],{discoverDependencies:true});
 const p=P.plan([old],[],s);assert.ok(p.relationships.some(r=>r.target===old.key&&r.type==='association-relationship'));assert.ok(!p.operations.some(o=>o.key===old.key));
});
test('Agent component code is discovered per organization rather than guessed',()=>{
 const fx=fixture({members:[member(10106,F.ids.agent)],rows:{bots:[{botid:F.ids.agent,name:'Agent'}]}}),s=fx.collect('agents');
 assert.ok(fx.calls.some(url=>url.includes('solutioncomponentdefinitions')));assert.equal(s.objects.filter(o=>o.kind==='agent').length,1);
});
test('Missing agent component definition permission cannot retire prior memberships',()=>{
 const s=fixture({fail:'solutioncomponentdefinitions'}).collect('agents');assert.equal(s.partial,true);assert.equal(s.coverage[0].complete,false);
});
test('Classic workflows and component libraries are distinguished from unreadable solution members',()=>{
 for(const [group,type,id,collection,row] of [['workflows',29,F.ids.flow,'workflows',{workflowid:F.ids.flow,category:0,type:1}],['applications',300,F.ids.app,'canvasapps',{canvasappid:F.ids.app,canvasapptype:1}]]){
  const s=fixture({members:[member(type,id)],rows:{[collection]:[row]}}).collect(group);
  assert.ok(s.coverage.every(c=>c.complete));assert.equal(s.unresolved.length,0);assert.equal(Object.values(s.ignored)[0],1);
 }
});
test('Targeted workflows retain static calls to previously imported flows without importing other kinds',()=>{
 const target=F.existing(F.object('flow',F.ids.child)),definition=JSON.stringify({properties:{definition:{actions:{call:{type:'Workflow',inputs:{host:{workflowReferenceName:F.ids.child}}}}}}});
 const fx=fixture({members:[member(29,F.ids.flow)],rows:{workflows:[{workflowid:F.ids.flow,name:'Parent',clientdata:definition}]}}),s=fx.collect('workflows',[target],{discoverDependencies:true});
 const p=P.plan([target],[],s);assert.ok(p.relationships.some(r=>r.type==='triggering-relationship'&&r.target===target.key));assert.ok(!p.operations.some(o=>o.key===target.key));assert.ok(!JSON.stringify(s).includes('"clientdata":'));
});
test('Context runs do not overwrite role selection or use selected-out roles as reference endpoints',()=>{
 const role=F.existing(F.object('role')),s=fixture().collect('applications',[role]);assert.ok(!s.referenceKeys.includes(role.key));assert.doesNotThrow(()=>P.plan([role],[],s));
});
test('Bulk environment sync leaves solution, table and view observation states untouched',()=>{
 const old=['solution','table','view'].map((kind,i)=>F.existing(F.object(kind,[solutionId,F.ids.app,F.ids.child][i]))),s=F.snapshot();s.coverage=[{environmentId:F.env,collector:'inventory',complete:true}];
 assert.ok(P.plan(old,[],s).operations.every(op=>!old.some(e=>e.key===op.key)));
});
