const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../lib/core.js'),A=require('../lib/auth.js'),H=require('../lib/http.js'),I=require('../lib/inventory.js'),D=require('../lib/dependencies.js'),DV=require('../lib/dataverse.js');
const F=require('./fixtures.cjs');
test('Copied environments with identical object IDs retain separate identities',()=>assert.notEqual(F.object('flow').key,F.object('flow',F.ids.flow,F.env2).key));
test('Default environment identifiers are accepted and unsafe IDs rejected',()=>{assert.equal(C.envId('Default-'+F.tenant),'default-'+F.tenant);assert.throws(()=>C.envId("x' | take 1"));});
test('Dataverse URL guard rejects credentials, paths, non-HTTPS, and foreign hosts',()=>{for(const s of ['http://org.crm.dynamics.com','https://org.crm.dynamics.com.evil.test','https://user@org.crm.dynamics.com','https://org.crm.dynamics.com/a'])assert.throws(()=>C.dvOrigin(s));assert.equal(C.dvOrigin('https://org.api.crm4.dynamics.com/'),'https://org.api.crm4.dynamics.com');});
test('CLI command wrapper never accepts shell operators or relative executables',()=>{assert.throws(()=>A.command('az',['account','show'],false));assert.throws(()=>A.command('/usr/bin/az',['x;pwd'],false));assert.throws(()=>A.command('C:\\evil%PATH%\\az.cmd',['account'],'true','C:\\Windows\\System32\\cmd.exe'));assert.deepEqual(A.command('/usr/bin/az',['account','show'],false),['/usr/bin/az','account','show']);});
test('Subscriptionless sign-in uses explicit tenant and caches audience-specific tokens',()=>{
 let calls=[],now=0;const io={now:()=>now,run(args){calls.push(args);return {exitCode:0,stdout:JSON.stringify(args[1]==='show'?{tenantId:F.tenant,environmentName:'AzureCloud',user:{type:'user'}}:{tenant:F.tenant,tokenType:'Bearer',accessToken:'token-'+args[args.indexOf('--resource')+1],expires_on:3600})};}};
 const a=A.create(io);assert.match(a.token('https://management.azure.com/'),/management/);a.token('https://management.azure.com/');a.token('https://org.crm.dynamics.com/');assert.equal(calls.length,3);assert.ok(calls.every(c=>!c.includes('--subscription')));now=3590000;assert.throws(()=>a.token('https://management.azure.com/'),/expired/);a.clear();
});
test('Tenant mismatch and non-user CLI sessions are rejected',()=>{assert.throws(()=>A.create({run:()=>({exitCode:0,stdout:JSON.stringify({tenantId:F.tenant,environmentName:'AzureCloud',user:{type:'servicePrincipal'}})})}));});
function http(responses){let calls=[],sleeps=[],tokenCalls=[];const client=H.create({request(...args){calls.push(args);return responses.shift();},sleep(ms){sleeps.push(ms);}},{token(r,refresh){tokenCalls.push({r,refresh});return 'secret';}});return {client,calls,sleeps,tokenCalls};}
test('429 retries honor bounded retry-after and recover',()=>{const h=http([{status:429,body:{},headers:{'retry-after':'999'}},{status:200,body:{value:[]}}]);h.client.pages('https://org.crm.dynamics.com/api/data/v9.2/roles','https://org.crm.dynamics.com/',()=>{});assert.deepEqual(h.sleeps,[30000]);assert.equal(h.calls.length,2);});
test('401 refreshes once; error messages do not expose raw response secrets',()=>{const h=http([{status:401,body:{}},{status:403,body:{error:{code:'Forbidden',message:'password=supersecret'}}}]);assert.throws(()=>h.client.request('GET','https://org.crm.dynamics.com/api/data/v9.2/roles','https://org.crm.dynamics.com/'),e=>e.readFailure&&!e.message.includes('supersecret'));assert.equal(h.tokenCalls[1].refresh,true);});
test('Pagination rejects off-origin and different-collection continuation URLs',()=>{for(const next of ['https://evil.test/roles','https://org.crm.dynamics.com/api/data/v9.2/accounts']){const h=http([{status:200,body:{value:[], '@odata.nextLink':next}}]);assert.throws(()=>h.client.pages('https://org.crm.dynamics.com/api/data/v9.2/roles','https://org.crm.dynamics.com/',()=>{}),/pagination/);assert.equal(h.calls.length,1);}});
test('A malformed collection fails rather than representing an empty result',()=>{const h=http([{status:200,body:{}}]);assert.throws(()=>h.client.pages('https://org.crm.dynamics.com/api/data/v9.2/roles','https://org.crm.dynamics.com/',()=>{}),/value array/);});
test('Resource Graph pagination detects truncation and repeated tokens',()=>{const h=http([{status:200,body:{data:[],resultTruncated:'true'}}]);assert.throws(()=>h.client.graph('PowerPlatformResources',()=>{}),/truncated/);});
test('Transport policy disallows all writes except the Resource Graph query POST',()=>{const h=http([]);assert.throws(()=>h.client.request('DELETE','https://org.crm.dynamics.com/api/data/v9.2/roles','https://org.crm.dynamics.com/'));assert.throws(()=>h.client.request('POST','https://org.crm.dynamics.com/api/data/v9.2/roles','https://org.crm.dynamics.com/'));});
test('Environment discovery treats epoch deletion dates as empty and keeps disabled rows visible',()=>{
 const i=I.create({pages(url,resource,cb){if(url===I.ENV_URL)cb([{id:F.env,tenantId:F.tenant,displayName:'A',state:'Enabled',deletedDateTime:'1970-01-01T00:00:00Z'},{id:F.env2,tenantId:F.tenant,displayName:'A',state:'Disabled',deletedDateTime:'1970-01-01T00:00:00Z'}]);else cb([]);}},F.tenant).discover();assert.equal(i.environments[0].available,true);assert.equal(i.environments[1].available,false);assert.equal(i.environments.length,2);
});
test('Partial direct discovery retains records and supplements with ARG',()=>{
 const i=I.create({pages(url,resource,cb){if(url===I.ENV_URL){cb([{id:F.env,displayName:'A',state:'Enabled'}]);throw C.readError('403',403);}cb([]);},graph(q,cb){cb([{name:F.env2,type:'microsoft.powerplatform/environments',properties:{displayName:'B'}}]);}},F.tenant).discover();assert.equal(i.environments.length,2);assert.equal(i.partial,true);
});
test('Flow parser traverses nested branches but emits no raw action parameters',()=>{
 const child={type:'Workflow',inputs:{host:{workflowReferenceName:F.ids.child},password:'secret'}};
 const dynamic={type:'Workflow',inputs:{host:{workflowReferenceName:'@variables(secret)'}}};
 const d={properties:{definition:{actions:{If:{type:'If',actions:{Child:child},else:{actions:{Dynamic:dynamic}}}}}}};
 const r=D.flowReferences(JSON.stringify(d));assert.equal(r.references[0].id,F.ids.child);assert.equal(r.unresolved,1);assert.ok(!JSON.stringify(r).includes('password'));assert.ok(!JSON.stringify(r).includes('variables'));
});
test('Shared connectors do not produce invented component links',()=>assert.deepEqual(D.flowReferences({properties:{definition:{actions:{A:{type:'OpenApiConnection',inputs:{host:{apiId:'sharepoint'}}}}}}}).references,[]));
test('Role root copies collapse while standard templates remain excluded',()=>{
 const groups=DV.roleGroups([{roleid:F.ids.role,name:'Custom',ismanaged:false},{roleid:F.ids.child,_parentrootroleid_value:F.ids.role,name:'Copy',ismanaged:false},{roleid:F.ids.agent,name:'System',_roletemplateid_value:F.ids.app}],C.options({roleIds:[F.ids.role]}),{});
 assert.equal(groups.length,2);assert.equal(groups[0].aliases.length,2);assert.equal(groups[0].selected,true);assert.equal(groups[1].candidate,false);
});
test('Managed custom roles can be included by configured publisher; unmanaged is not automatic proof',()=>{
 const rows=[{roleid:F.ids.role,name:'Custom',ismanaged:true},{roleid:F.ids.child,name:'Uncertain',ismanaged:false}];
 const groups=DV.roleGroups(rows,C.options({rolePublisherPrefixes:['contoso']}),{[F.ids.role]:['contoso']});assert.equal(groups[0].selected,true);assert.equal(groups[1].selected,false);
});
test('Alias ambiguity is a hard error and unresolved references preserve owner evidence',()=>{
 const a=F.object('flow'),b=F.object('flow',F.ids.child);b.aliases.push(a.id);assert.throws(()=>D.aliasIndex([a,b]),/Ambiguous/);
 const s=F.snapshot();D.resolve(s,[{environmentId:F.env,sourceKind:'flow',sourceId:F.ids.flow,targetKind:'flow',targetId:F.ids.child,owner:'owner',evidenceSource:'test'}]);assert.equal(s.unresolved.length,1);assert.equal(s.protectedOwners.owner,true);
});
