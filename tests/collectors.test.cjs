const test=require('node:test'),assert=require('node:assert/strict'),C=require('../lib/core.js'),DV=require('../lib/dataverse.js'),P=require('../lib/planner.js'),F=require('./fixtures.cjs');
const env={id:F.env,name:'Test',url:'https://test.crm4.dynamics.com',apiUrl:'https://test.api.crm4.dynamics.com',isUserSysAdmin:true};
function collect(rows={},existing=[],options={},failure){
 const s=F.snapshot([F.object('environment')]),requests=[];
 const http={pages(url,resource,page){const kind=url.split('/api/data/v9.2/')[1].split('?')[0];if(failure&&failure(kind))throw C.readError('HTTP 403',403);page(rows[kind]||[]);},request(method,url){requests.push(url);throw C.readError('HTTP 404',404);}};
 DV.create(http,F.tenant).collect(env,s,C.options({discoverDependencies:false,...options}),existing);
 return {s,requests};
}
test('Inventory aliases preserve concept identity when only Dataverse sees the next run',()=>{
 const old=F.existing(F.object('canvasapp',F.ids.app));old.properties['PowerPlatform-SourceIds']=JSON.stringify([F.ids.app,F.ids.child]);
 const o=F.object('canvasapp',F.ids.child),s=F.snapshot([F.object('environment'),o]);C.preserveIdentities(s,[old]);
 assert.equal(o.key,old.key);assert.deepEqual(o.aliases.sort(),[F.ids.app,F.ids.child].sort());assert.equal(P.plan([old],[],s).operations.find(x=>x.key===old.key).action,'update');
});
test('Ambiguous saved source aliases abort instead of joining two objects',()=>{
 const a=F.existing(F.object('canvasapp',F.ids.app)),b=F.existing(F.object('canvasapp',F.ids.child));a.properties['PowerPlatform-SourceIds']=JSON.stringify([F.ids.app,F.ids.child]);
 assert.throws(()=>C.preserveIdentities(F.snapshot([F.object('canvasapp',F.ids.child)]),[a,b]),/Multiple existing/);
});
test('Many business-unit aliases remain valid JSON rather than being truncated',()=>{
 const role=F.object('role');role.aliases=Array.from({length:150},(_,n)=>n.toString(16).padStart(8,'0')+'-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
 assert.equal(JSON.parse(C.properties(role)['PowerPlatform-SourceIds']).length,150);
});
test('Canvas primary ID, friendly metadata and secrets are normalized without raw definitions',()=>{
 const {s}=collect({canvasapps:[{canvasappid:F.ids.app,uniquecanvasappid:F.ids.child,displayname:'A canvas',name:'logical',description:'client_secret=private-value',createdtime:'2026-01-01',lastmodifiedtime:'2026-02-01'}]});
 const o=s.objects.find(x=>x.kind==='canvasapp');assert.equal(o.dataverseId,F.ids.app);assert.equal(o.createdAt,'2026-01-01');assert.ok(o.aliases.includes(F.ids.child));assert.ok(!JSON.stringify(s).includes('private-value'));
});
test('Absence is checked using saved Dataverse ID, never an inventory ID',()=>{
 const e=F.existing(F.object('canvasapp',F.ids.app));e.properties['PowerPlatform-DataverseId']=F.ids.child;
 const {s,requests}=collect({},[e]);assert.equal(s.confirmedMissing[0],e.key);assert.ok(requests[0].includes('canvasapps('+F.ids.child+')'));
 const noId=F.existing(F.object('canvasapp',F.ids.app));assert.equal(collect({},[noId]).requests.length,0);
});
test('Read aliases prevent a false missing-object probe',()=>{
 const e=F.existing(F.object('canvasapp',F.ids.app));e.properties['PowerPlatform-DataverseId']=F.ids.child;e.properties['PowerPlatform-SourceIds']=JSON.stringify([F.ids.app,F.ids.child]);
 const {requests}=collect({canvasapps:[{canvasappid:F.ids.child,name:'Present'}]},[e]);assert.equal(requests.length,0);
});
test('Failed collections never authorize missing confirmation',()=>{
 const e=F.existing(F.object('flow'));e.properties['PowerPlatform-DataverseId']=e.id;
 const {s,requests}=collect({},[e],{},kind=>kind==='workflows');assert.equal(requests.length,0);assert.equal(s.partial,true);
});
test('Unreadable roles cannot authorize retirement of app-role links',()=>{
 const {s}=collect({appmodules:[{appmoduleid:F.ids.app,name:'Model app'}]},[],{discoverDependencies:true},kind=>kind==='roles');
 assert.equal(s.completedOwners[C.key(F.tenant,F.env,'modelapp',F.ids.app)+'|app-roles'],undefined);
});
test('Missing selected roles require the same complete per-ID confirmation',()=>{
 const e=F.existing(F.object('role'));e.properties['PowerPlatform-DataverseId']=e.id;const {s}=collect({},[e]);s.roleSelectionKeys=[e.key];
 assert.deepEqual(s.confirmedMissing,[e.key]);assert.equal(P.plan([e],[],s).counts.deleted,1);
});
test('A role observed via a business-unit child is not confirmed missing',()=>{
 const e=F.existing(F.object('role'));e.properties['PowerPlatform-DataverseId']=e.id;
 const {requests}=collect({roles:[{roleid:F.ids.child,_parentrootroleid_value:e.id,name:'Copy'}]},[e]);assert.equal(requests.length,0);
});
test('Role deselection preserves the object and all existing relationships',()=>{
 const role=F.existing(F.object('role')),app=F.existing(F.object('modelapp',F.ids.app));const s=F.snapshot([F.object('environment'),F.object('modelapp',F.ids.app)]);s.completedOwners.owner=true;s.roleSelectionKeys=[];
 const relation={id:'r',source:role.key,target:app.key,type:'association-relationship',managed:true,evidence:[{owner:'owner',source:'appmoduleroles',field:'id',interaction:'grants-access'}],properties:{IsDeleted:'no'}};
 assert.ok(!P.plan([role,app],[relation],s).relationships.some(x=>x.id==='r'));
});
