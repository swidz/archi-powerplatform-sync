const test=require('node:test'),assert=require('node:assert/strict'),C=require('../lib/core.js'),M=require('../lib/metadata.js'),P=require('../lib/planner.js'),F=require('./fixtures.cjs');
const env={id:F.env,name:'Test',url:'https://test.crm.dynamics.com',apiUrl:'https://test.api.crm.dynamics.com'};
const labels={LocalizedLabels:[{LanguageCode:1033,Label:'Account name'},{LanguageCode:1045,Label:'Nazwa klienta'}],UserLocalizedLabel:{LanguageCode:1045,Label:'Nazwa klienta'}};
function fixture(config={}){
 const calls=[],o=F.object('table',F.ids.app),s=F.snapshot([o]);
 const http={pages(url,resource,cb){calls.push({url,resource});cb(config.rows||[{LogicalName:'name',DisplayName:labels,AttributeType:'String',Description:'Not retained'},{LogicalName:'accountid',AttributeType:'Uniqueidentifier'}]);if(config.partial)throw C.readError('Second page denied',403);}};
 return {o,s,calls,metadata:M.create(http)};
}
test('Table field enrichment uses bounded attribute metadata and English labels independent of user language',()=>{
 const f=fixture();f.metadata.enrich(f.s,[env],{includeElementMetadata:false});assert.equal(f.s.partial,false);assert.equal(f.calls.length,1);
 assert.ok(f.calls[0].url.startsWith(env.apiUrl+'/api/data/v9.2/EntityDefinitions('+F.ids.app+')/Attributes?$select='));assert.equal(f.calls[0].resource,env.url+'/');
 assert.deepEqual(f.o.tableFields.map(f=>f.name),['accountid','name']);assert.equal(f.o.tableFields[1].displayName,'Account name');assert.equal(f.o.tableFields[1].labelLanguageCode,1033);
 assert.ok(!JSON.stringify(f.o).includes('Not retained'));assert.equal(C.properties(f.o)['PowerPlatform-TableFieldCount'],'2');
 assert.equal(C.properties(f.o)['PowerPlatform-TableFieldsLabelLanguage'],'en-US');
});
test('Field lists use configured label language, schema-name fallback and specialized data types',()=>{
 const f=fixture({rows:[{SchemaName:'FileColumn',DisplayName:labels,AttributeType:'Virtual',AttributeTypeName:{Value:'FileType'}}]});f.metadata.tableFields(f.s,[env],{labelLanguage:'pl-PL'});
 assert.equal(f.o.tableFields[0].name,'FileColumn');assert.equal(f.o.tableFields[0].displayName,'Nazwa klienta');assert.equal(f.o.tableFields[0].type,'File');
});
test('All returned fields are retained, including system and virtual definitions, and duplicate pages collapse',()=>{
 const row={LogicalName:'createdbyname',AttributeType:'Virtual',IsCustomAttribute:false,IsValidForRead:false},f=fixture({rows:[row,row]});f.metadata.tableFields(f.s,[env],{});assert.equal(f.o.tableFields.length,1);
});
test('Incomplete or malformed field reads preserve previous documentation and field-count properties',()=>{
 for(const config of [{partial:true},{rows:[{}]},{rows:[{LogicalName:'same',AttributeType:'String'},{LogicalName:'same',AttributeType:'Integer'}]}]){
  const f=fixture(config);f.o.tableFields=[{name:'stale',type:'String'}];f.metadata.tableFields(f.s,[env],{});
  assert.equal(f.s.partial,true);assert.equal(f.o.tableFields,undefined);assert.equal(C.properties(f.o)['PowerPlatform-TableFieldCount'],undefined);
  const old={...F.existing(f.o),documentation:'Keep notes and old list'},p=P.plan([old],[],f.s);assert.equal(p.counts.documentationUpdates,0);assert.equal(p.operations[0].documentation,undefined);
 }
});
test('Unavailable environments warn without clearing documentation and the field switch skips reads',()=>{
 const absent=fixture();absent.metadata.tableFields(absent.s,[],{});assert.equal(absent.s.partial,true);assert.equal(absent.o.tableFields,undefined);assert.equal(absent.calls.length,0);
 const disabled=fixture();disabled.metadata.enrich(disabled.s,[env],{includeTableFields:false,includeElementMetadata:false});assert.equal(disabled.calls.length,0);assert.equal(disabled.o.tableFields,undefined);
});
test('Markdown enumeration sorts technical names and escapes authored markup and multiline labels',()=>{
 const text=M.tableDocumentation('',[{name:'z_field',displayName:'<b>A</b>\n[link](bad) & *B*',type:'String'},{name:'a_field',displayName:'Field A',type:'Integer'}]);
 assert.ok(text.includes('1. **a\\_field** — Field A (Integer)\n2. **z\\_field**'));
 assert.ok(text.includes('&lt;b&gt;A&lt;/b&gt; \\[link\\]\\(bad\\) &amp; \\*B\\*'));assert.ok(!text.includes('<b>'));
});
test('Refresh replaces only the generated field section and preserves manual text byte-for-byte',()=>{
 const fields=[{name:'name',displayName:'Name',type:'String'}],before='Architect notes\r\n  keep spacing  ',suffix='\r\n\r\nMore notes',first=M.tableDocumentation(before,fields)+suffix;
 const second=M.tableDocumentation(first,[{name:'accountid',type:'Uniqueidentifier'}]);assert.ok(second.startsWith(before+'\n\n'));assert.ok(second.endsWith(suffix));assert.ok(!second.includes('**name**'));
 assert.equal(second.split('PowerPlatform:TableFields:begin').length,2);assert.equal(M.tableDocumentation(first,fields),first);
});
test('Empty complete field lists are explicit; damaged or duplicated section markers stop before updates',()=>{
 assert.ok(M.tableDocumentation('',[]).includes('No field definitions were returned.'));
 const block=M.tableDocumentation('',[]);for(const invalid of [block.replace('<!-- PowerPlatform:TableFields:end -->',''),block+block,'<!-- PowerPlatform:TableFields:end -->'])assert.throws(()=>M.tableDocumentation(invalid,[]),/markers/);
});
test('Planner previews table documentation updates, preserves IDs and does not rewrite an unchanged list',()=>{
 const f=fixture();f.metadata.tableFields(f.s,[env],{});const old={...F.existing(f.o),documentation:'Manual notes'},p=P.plan([old],[],f.s),op=p.operations[0];
 assert.equal(p.counts.documentationUpdates,1);assert.equal(op.elementId,old.elementId);assert.equal(op.previousDocumentation,'Manual notes');assert.ok(op.documentation.startsWith('Manual notes\n\n'));
 old.documentation=op.documentation;assert.equal(P.plan([old],[],f.s).counts.documentationUpdates,0);
 assert.equal(P.plan([old],[],f.s,{includeTableFields:false}).operations[0].documentation,undefined);
});
