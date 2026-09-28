const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../lib/core.js'),M=require('../lib/metadata.js'),S=require('../lib/scoped.js'),P=require('../lib/planner.js'),F=require('./fixtures.cjs');
const env={id:F.env,name:'Test',url:'https://test.crm.dynamics.com'};
function labels(en='Account',pl='Klient'){return {LocalizedLabels:[{LanguageCode:1045,Label:pl},{LanguageCode:1033,Label:en}],UserLocalizedLabel:{LanguageCode:1045,Label:pl}};}
function table(options){return S.normalize(F.tenant,env,'table',{MetadataId:F.ids.app,LogicalName:'new_account',SchemaName:'new_Account',DisplayName:labels(),Description:labels('Customer record','Rekord klienta')},options);}
test('Preferred labels default to en-US and ignore the user label and array order',()=>{
 assert.equal(C.options().labelLanguage,'en-US');assert.equal(C.label(labels()).text,'Account');assert.equal(C.languageCode('EN-us'),1033);
 assert.equal(C.label(labels(),{labelLanguage:'pl-PL'}).text,'Klient');assert.equal(C.languageCode(1045),1045);
 assert.throws(()=>C.options({labelLanguage:'invalid'}),/Unsupported labelLanguage/);assert.throws(()=>C.options({labelLanguage:-1}),/Invalid/);
});
test('Tables keep a technical name while display names and descriptions use the configured language',()=>{
 const en=table(),pl=table({labelLanguage:'pl-PL'}),p=C.properties(en);
 assert.equal(en.name,'new_account');assert.equal(pl.name,'new_account');assert.equal(en.key,pl.key);
 assert.equal(p['PowerPlatform-ObjectName'],'Account');assert.equal(p['PowerPlatform-DisplayName'],'Account');assert.equal(p['PowerPlatform-TechnicalName'],'new_account');
 assert.equal(en.description,'Customer record');assert.equal(pl.displayName,'Klient');assert.equal(p['PowerPlatform-Metadata-Dataverse-DisplayName'],'Account');
 assert.equal(p['PowerPlatform-DisplayNameLanguageCode'],'1033');assert.equal(p['PowerPlatform-DisplayNameLanguageStatus'],'requested');
 const schema=S.normalize(F.tenant,env,'table',{MetadataId:F.ids.app,SchemaName:'new_Account'});assert.equal(schema.name,'new_Account');
});
test('Views use unique stable technical names instead of localized display names',()=>{
 const row={savedqueryid:F.ids.child,name:'Aktywne konta',returnedtypecode:'account'},a=S.normalize(F.tenant,env,'view',row),b=S.normalize(F.tenant,env,'view',{...row,name:'Active accounts'});
 assert.equal(a.name,'account.view.'+F.ids.child);assert.equal(a.name,b.name);assert.equal(a.logicalName,'');assert.equal(C.properties(a)['PowerPlatform-ObjectName'],'Aktywne konta');
 assert.notEqual(a.name,S.normalize(F.tenant,env,'view',{...row,savedqueryid:F.ids.app}).name);
 assert.equal(S.normalize(F.tenant,env,'view',{...row,SchemaName:'new_ActiveAccounts'}).name,'new_ActiveAccounts');
});
test('Missing translations use a deterministic fallback with its real language recorded',()=>{
 const label={LocalizedLabels:[{LanguageCode:1045,Label:'Klient'},{LanguageCode:1036,Label:'Compte'}],UserLocalizedLabel:{LanguageCode:1045,Label:'Klient'}};
 assert.deepEqual(C.label(label),{text:'Compte',languageCode:1036,status:'fallback'});
 const missing=C.label({},undefined,'Source name');assert.equal(missing.text,'Source name');assert.equal(missing.languageCode,'');assert.equal(missing.status,'source');
 assert.equal(C.label(labels(),{labelLanguage:'de-DE'}).languageCode,1033);
});
test('Technical renaming updates the same existing element and preserves manual properties',()=>{
 const o=table(),old=F.existing({...o,name:'Klient'});old.properties['Architect-Notes']='Keep this';
 const p=P.plan([old],[],F.snapshot([o]));assert.equal(p.counts.create,0);assert.equal(p.operations[0].elementId,old.elementId);assert.equal(p.operations[0].name,'new_account');
 assert.equal(old.properties['Architect-Notes'],'Keep this');assert.ok(!Object.hasOwn(p.operations[0].properties,'Architect-Notes'));
});
test('Explicit read-only localized label calls cover solutions, flows, apps and views and are cached',()=>{
 const objects=['solution','flow','modelapp','view'].map(kind=>({...F.object(kind,F.ids.app),displayName:'Polski',description:'Opis',dataverseId:F.ids.app}));objects[3].name='account.view.'+F.ids.app;
 const calls=[],http={request(method,url,resource){calls.push(url);assert.equal(method,'GET');assert.equal(resource,env.url+'/');assert.ok(url.includes('IncludeUnpublished=@p3')&&url.endsWith('@p3=false'));return {Label:labels('English','Polski')};}};
 const snapshot=F.snapshot(objects),metadata=M.create(http);metadata.enrich(snapshot,[env],{includeElementMetadata:false});
 assert.equal(calls.length,7);assert.ok(objects.slice(0,3).every(o=>o.name==='English'));assert.equal(objects[3].name,'account.view.'+F.ids.app);assert.equal(objects[3].displayName,'English');
 assert.equal(objects[3].metadata['Dataverse-name'],'English');assert.equal(snapshot.partial,false);
 metadata.localize(snapshot,[env],{labelLanguage:'pl-PL'});assert.equal(calls.length,7);assert.equal(objects[0].name,'Polski');assert.equal(objects[3].displayName,'Polski');
});
test('Label read failures report partial coverage and never claim the source name is English',()=>{
 for(const response of [null,{}]){
  const o={...F.object('view',F.ids.app),name:'account.view.'+F.ids.app,displayName:'Nazwa'},s=F.snapshot([o]);
  M.create({request(){if(!response)throw C.readError('Denied',403);return response;}}).enrich(s,[env],{includeElementMetadata:false});
  assert.equal(s.partial,true);assert.equal(o.displayName,'Nazwa');assert.equal(o.displayNameLanguageStatus,'read-failed');assert.equal(o.displayNameLanguageCode,'');
 }
});
test('Solution picker names are localized before selection',()=>{
 const http={pages(url,resource,cb){cb([{solutionid:F.ids.app,friendlyname:'Rozwiazanie'}]);},request(){return {Label:labels('Solution','Rozwiazanie')};}};
 assert.equal(S.create(http,F.tenant).solutions(env)[0].name,'Solution');assert.equal(S.create(http,F.tenant).solutions(env,{labelLanguage:'pl-PL'})[0].name,'Rozwiazanie');
});
test('Untranslated authored names require no label API calls',()=>{
 const objects=['environment','canvasapp','agent','role','plugin'].map(kind=>F.object(kind,kind==='environment'?F.env:F.ids.app));
 M.create({request(){throw Error('Unexpected label request');}}).enrich(F.snapshot(objects),[env],{includeElementMetadata:false});
 for(const o of objects)assert.equal(o.name,o.kind+' name');
});
