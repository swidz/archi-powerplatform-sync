const test=require('node:test'),assert=require('node:assert/strict'),C=require('../lib/core.js'),M=require('../lib/metadata.js'),F=require('./fixtures.cjs');
const env={id:F.env,name:'Test',url:'https://test.crm.dynamics.com'};
test('Every supported Dataverse element kind has an explicit metadata catalogue',()=>{for(const kind of ['solution','canvasapp','modelapp','flow','agent','table','view','role','plugin'])assert.ok(M.fields(kind).length>15);assert.ok(M.INVENTORY_FIELDS.includes('properties.appVersion'));assert.ok(M.ENV_FIELDS.includes('dataverseId'));});
test('Metadata preserves false, zero, null clearing, managed flags and localized labels',()=>{
 const row={isdefault:false,statuscode:0,description:null,iscustomizable:{Value:false},DisplayName:{UserLocalizedLabel:{Label:'Accounts'}},'statuscode@OData.Community.Display.V1.FormattedValue':'Draft'};
 const o=M.capture(F.object('view',F.ids.app),'Dataverse',row,Object.keys(row).filter(k=>!k.includes('@'))),p=C.properties(o);
 assert.equal(p['PowerPlatform-Metadata-Dataverse-isdefault'],'false');assert.equal(p['PowerPlatform-Metadata-Dataverse-statuscode'],'0');assert.equal(p['PowerPlatform-Metadata-Dataverse-description'],'');
 assert.equal(p['PowerPlatform-Metadata-Dataverse-iscustomizable'],'false');assert.equal(p['PowerPlatform-Metadata-Dataverse-DisplayName'],'Accounts');assert.equal(p['PowerPlatform-Metadata-Dataverse-statuscode.Label'],'Draft');
});
test('Known payload and credential fields are excluded for every kind',()=>{
 const denied=['clientdata','xaml','definition','document','content','credentials','configuration','authenticationconfiguration','connectionreferences','fetchxml','layoutxml','offlinesqlquery','username','password'];
 for(const d of Object.values(M.DEFINITIONS))for(const field of denied)assert.ok(!d.fields.includes(field),d.entity+': '+field);
 const row={name:'Flow',clientdata:'SECRET',credentials:'SECRET',description:'password=SECRET'};
 const o=M.capture(F.object('flow'),'Dataverse',row,M.fields('flow'));assert.ok(!JSON.stringify(o).includes('SECRET'));
});
function fake(config={}){
 const calls=[],labelCalls=[];const http={request(method,url){labelCalls.push(url);return {Label:{LocalizedLabels:[{LanguageCode:1033,Label:'Flow'}]}};},pages(url,resource,cb){calls.push(url);
  if(url.includes('/Attributes/Microsoft.Dynamics.CRM.'))return cb([{LogicalName:'statecode',OptionSet:{Options:[{Value:1,Label:{LocalizedLabels:[{LanguageCode:1033,Label:'Activated'},{LanguageCode:1045,Label:'Aktywowano'}],UserLocalizedLabel:{LanguageCode:1045,Label:'Aktywowano'}}}]}}]);
  if(url.includes('/Attributes?')){if(config.schemaFailure)throw C.readError('Denied',403);return cb([{LogicalName:'workflowid',AttributeType:'Uniqueidentifier',IsValidForRead:true},{LogicalName:'name',AttributeType:'String',IsValidForRead:true},{LogicalName:'ownerid',AttributeType:'Owner',IsValidForRead:true},{LogicalName:'statecode',AttributeType:'State',IsValidForRead:true},{LogicalName:'credentials',AttributeType:'Memo',IsValidForRead:true}]);}
  if(config.readFailure)throw C.readError('Denied',403);
  cb(config.missing?[]:[{workflowid:config.foreign?F.ids.app:F.ids.flow,name:'Flow',_ownerid_value:F.ids.role,statecode:1}]);
 }};const s=F.snapshot([F.object('flow')]);return {calls,labelCalls,http,s};
}
test('Enrichment intersects allowed properties with readable schema and maps lookup field names',()=>{
 const f=fake();M.create(f.http).enrich(f.s,[env],{});assert.equal(f.calls.length,3);assert.ok(f.calls[1].includes('_ownerid_value'));assert.ok(!f.calls[1].includes('credentials')&&!f.calls[1].includes('modernflowtype'));
 assert.equal(C.properties(f.s.objects[0])['PowerPlatform-Metadata-Dataverse-_ownerid_value'],F.ids.role);assert.equal(f.s.partial,false);
 assert.equal(C.properties(f.s.objects[0])['PowerPlatform-Metadata-Dataverse-statecode.Label'],'Activated');
 assert.equal(C.properties(f.s.objects[0])['PowerPlatform-Metadata-Dataverse-statecode.LabelLanguage'],'1033');
});
test('Unsupported or denied property reads preserve existing values and report partial coverage',()=>{
 for(const config of [{schemaFailure:true},{readFailure:true},{missing:true}]){const f=fake(config);f.s.objects[0].metadata={'Dataverse-description':'Previously observed'};M.create(f.http).enrich(f.s,[env],{});assert.equal(f.s.objects[0].metadata['Dataverse-description'],'Previously observed');assert.equal(f.s.partial,true);}
});
test('Property response outside requested IDs aborts before any model application',()=>{const f=fake({foreign:true});assert.throws(()=>M.create(f.http).enrich(f.s,[env],{}),/outside requested objects/);});
test('Disabling optional properties still retrieves names in the configured language',()=>{const f=fake();M.create(f.http).enrich(f.s,[env],{includeElementMetadata:false});assert.equal(f.calls.length,0);assert.equal(f.labelCalls.length,1);assert.equal(f.s.objects[0].name,'Flow');});
test('Metadata from overlapping contexts is merged, including per-step registrations',()=>{
 const S=require('../lib/scoped.js'),a=S.environments(F.tenant,[env]),b=S.environments(F.tenant,[env]);for(const s of [a,b])s.scope={action:'get-plugins',environmentId:F.env,tableId:s===a?F.ids.app:F.ids.child};
 const plugin=F.object('plugin',F.ids.agent);a.objects.push({...plugin,metadata:{first:'a'},registrations:[{sdkmessageprocessingstepid:F.ids.app}]});b.objects.push({...plugin,metadata:{second:'b'},registrations:[{sdkmessageprocessingstepid:F.ids.child}]});
 const merged=S.merge([a,b],[]).objects.find(o=>o.kind==='plugin');assert.deepEqual(merged.metadata,{first:'a',second:'b'});assert.equal(merged.registrations.length,2);
});
