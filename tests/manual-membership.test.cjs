const test=require('node:test'),assert=require('node:assert/strict'),C=require('../lib/core.js'),P=require('../lib/planner.js'),F=require('./fixtures.cjs');
function fixture(kind='plugin'){
 const solution=F.object('solution',F.ids.app),target=F.object(kind,F.ids.flow),snapshot=F.snapshot([F.object('environment'),solution,target]);
 const edge={source:solution.key,target:target.key,type:'association-relationship',evidence:{owner:solution.key+'|members|'+kind,source:'solutioncomponent',field:'objectid',interaction:'solution-member'}};
 snapshot.edges=[edge];snapshot.scope={action:'get-'+(kind==='flow'?'flows':'plugins'),selectedObjectKeys:[target.key]};
 const old=snapshot.objects.map(o=>F.existing(o));old.find(o=>o.key===target.key).base='application-component';
 const link={id:'manual-link',source:solution.key,target:target.key,type:'aggregation-relationship',managed:false,evidence:[],properties:{'Architect-Notes':'Keep'}};
 return {solution,target,snapshot,old,link,plan:()=>P.plan(old,[link],snapshot)};
}
for(const kind of ['plugin','flow'])test('An unowned solution-to-'+kind+' Aggregation is proposed for explicit review without duplicate membership or ownership takeover',()=>{
 const f=fixture(kind),before=JSON.stringify(f),p=f.plan(),repair=p.relationshipTypeChanges[0];
 assert.equal(p.counts.typeChanges,1);assert.equal(p.counts.relationshipTypeChanges,1);assert.equal(repair.id,f.link.id);assert.equal(repair.manual,true);assert.equal(repair.approved,undefined);
 assert.equal(repair.sourceName,f.solution.name);assert.equal(repair.targetName,f.target.name);assert.equal(repair.targetBase,C.TYPES[kind].base);
 assert.equal(p.counts.manualReused,1);assert.ok(!p.relationships.some(r=>r.source===f.solution.key&&r.target===f.target.key));assert.equal(JSON.stringify(f),before);
});
test('Table-context retrieval can review a manual solution link without refreshing that solution',()=>{
 const f=fixture();f.snapshot.objects=f.snapshot.objects.filter(o=>o.kind!=='solution');f.snapshot.edges=[];
 const p=f.plan();assert.equal(p.relationshipTypeChanges.length,1);assert.ok(!p.operations.some(o=>o.key===f.solution.key));
});
test('Unchecked or already converted endpoints do not trigger manual link repair',()=>{
 for(const mode of ['unchecked','converted']){const f=fixture();if(mode==='unchecked'){f.snapshot.objects=f.snapshot.objects.filter(o=>o.key!==f.target.key);f.snapshot.edges=[];}else f.old.find(o=>o.key===f.target.key).base='application-function';assert.equal(f.plan().relationshipTypeChanges.length,0);}
});
test('Deleted links, deleted solutions and relationships owned by other tools are not offered for repair',()=>{
 for(const mode of ['deleted-link','deleted-solution','other-owner']){const f=fixture();if(mode==='deleted-link')f.link.properties.IsDeleted='yes';if(mode==='deleted-solution')f.old.find(o=>o.key===f.solution.key).properties.IsDeleted='yes';if(mode==='other-owner')f.link.properties[C.PREFIX+'ManagedBy']='another-tool';assert.equal(f.plan().relationshipTypeChanges.length,0);}
});
test('Cross-environment, non-solution and reversed manual Aggregations remain outside automatic repair',()=>{
 for(const mode of ['other-environment','app','reversed']){const f=fixture();if(mode==='reversed'){[f.link.source,f.link.target]=[f.link.target,f.link.source];}else{
  const source=F.object(mode==='app'?'canvasapp':'solution',F.ids.app,mode==='other-environment'?F.env2:F.env);f.old=f.old.filter(o=>o.key!==f.solution.key);f.old.push(F.existing(source));f.link.source=source.key;
 }assert.equal(P.plan(f.old,[f.link],f.snapshot).relationshipTypeChanges.length,0);}
});
test('An existing managed Association remains separate from a reviewed manual link',()=>{
 const f=fixture(),managed={...f.link,id:'managed-association',type:'association-relationship',managed:true,evidence:[f.snapshot.edges[0].evidence],properties:{IsDeleted:'no'}};
 const p=P.plan(f.old,[f.link,managed],f.snapshot);assert.equal(p.relationshipTypeChanges.length,1);assert.equal(p.counts.relationshipsCreate,2); // Only environment hosting links.
 assert.ok(p.relationships.some(r=>r.id===managed.id));assert.ok(!p.relationships.some(r=>r.id===f.link.id));
});
