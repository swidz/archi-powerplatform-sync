const test=require('node:test'),assert=require('node:assert/strict'),C=require('../lib/core.js'),S=require('../lib/scoped.js'),P=require('../lib/planner.js'),F=require('./fixtures.cjs');
function fixture(kind='table'){
 const solution=F.object('solution','88888888-8888-8888-8888-888888888888'),a=F.object(kind,F.ids.app),b=F.object(kind,F.ids.child),s=F.snapshot([F.object('environment'),solution,a,b]);
 s.scope={action:'get-'+kind,contexts:[{environmentId:F.env,solutionId:solution.id}]};const owner=solution.key+'|members|'+kind;
 s.completedOwners[owner]=true;s.edges=[a,b].map(o=>({source:solution.key,target:o.key,type:C.TYPES[kind].base==='application-component'?'aggregation-relationship':'association-relationship',evidence:{owner,source:'solutioncomponent',field:'objectid',interaction:'solution-member'}}));
 return {s,solution,a,b,old:s.objects.map(F.existing),rels:s.edges.map((e,i)=>({...e,id:'r'+i,managed:true,evidence:[e.evidence],properties:{IsDeleted:'no'}}))};
}
test('Selecting one table or view imports only that object and preserves unchecked existing memberships',()=>{
 for(const [kind,group] of [['table','tables'],['view','views'],['canvasapp','applications'],['flow','flows'],['agent','agents']]){
  const f=fixture(kind),s=S.selectObjects(f.s,group,[f.a.key],f.old),p=P.plan(f.old,f.rels,s);
  assert.ok(!s.objects.some(o=>o.key===f.b.key));assert.ok(!p.operations.some(o=>o.key===f.b.key));assert.ok(!p.relationships.some(r=>r.id==='r1'));
  assert.equal(p.counts.relationshipsDeleted,0);assert.ok(s.referenceKeys.includes(f.b.key));assert.equal(f.s.objects.length,4);
 }
});
test('Unchecked source objects cannot retire old dependencies, even after a complete read',()=>{
 const f=fixture('flow'),owner=f.b.key+'|flow-definition',prior={id:'call',source:f.b.key,target:f.a.key,type:'triggering-relationship',managed:true,evidence:[{owner,source:'workflow.clientdata',field:'id',interaction:'child-flow'}],properties:{IsDeleted:'no'}};
 f.s.completedOwners[owner]=true;const s=S.selectObjects(f.s,'flows',[f.a.key],f.old);assert.ok(!P.plan(f.old,[...f.rels,prior],s).relationships.some(r=>r.id==='call'));
});
test('A selected source can still retire its removed dependency',()=>{
 const f=fixture('flow'),owner=f.a.key+'|flow-definition',prior={id:'call',source:f.a.key,target:f.b.key,type:'triggering-relationship',managed:true,evidence:[{owner,source:'workflow.clientdata',field:'id',interaction:'child-flow'}],properties:{IsDeleted:'no'}};
 f.s.completedOwners[owner]=true;const s=S.selectObjects(f.s,'flows',[f.a.key],f.old);assert.equal(P.plan(f.old,[...f.rels,prior],s).relationships.find(r=>r.id==='call').action,'deleted');
});
test('References to unchecked new objects are omitted without creating them or losing prior evidence',()=>{
 const f=fixture('flow'),owner=f.a.key+'|flow-definition';f.s.edges.push({source:f.a.key,target:f.b.key,type:'triggering-relationship',evidence:{owner,source:'workflow.clientdata',field:'id',interaction:'child-flow'}});f.s.completedOwners[owner]=true;
 const selected=S.selectObjects(f.s,'flows',[f.a.key],[]),p=P.plan([],[],selected);assert.equal(selected.unresolved.length,1);assert.equal(selected.protectedOwners[owner],true);
 assert.ok(!p.operations.some(o=>o.key===f.b.key));assert.ok(!p.relationships.some(r=>r.type==='triggering-relationship'));
 const existing=S.selectObjects(f.s,'flows',[f.a.key],f.old);assert.equal(existing.unresolved.length,0);assert.ok(P.plan(f.old,[],existing).relationships.some(r=>r.type==='triggering-relationship'));assert.ok(!existing.objects.some(o=>o.key===f.b.key));
});
test('A selected agent retains its flow-tool link from an already imported unselected flow',()=>{
 const f=fixture('agent'),flow=F.object('flow'),owner=f.a.key+'|agent-flows';f.s.objects.push(flow);f.s.edges.push({source:flow.key,target:f.a.key,type:'serving-relationship',evidence:{owner,source:'botcomponent_workflow',field:'id',interaction:'agent-flow-tool'}});
 const selected=S.selectObjects(f.s,'agents',[f.a.key],[...f.old,F.existing(flow)]);assert.ok(selected.edges.some(e=>e.source===flow.key&&e.target===f.a.key));assert.ok(!selected.objects.some(o=>o.key===flow.key));
});
test('Checked table retrieval can link existing views without importing unchecked views',()=>{
 const f=fixture('table'),view=F.object('view'),owner=view.key+'|view-table';f.s.edges.push({source:view.key,target:f.a.key,type:'association-relationship',evidence:{owner,source:'savedquery',field:'returnedtypecode',interaction:'view-of'}});
 const selected=S.selectObjects(f.s,'tables',[f.a.key],[...f.old,F.existing(view)]);assert.ok(selected.edges.some(e=>e.source===view.key));assert.ok(!selected.objects.some(o=>o.key===view.key));
});
test('Shared component selection retains membership in every selected solution',()=>{
 const f=fixture(),other=F.object('solution','99999999-9999-9999-9999-999999999999');f.s.objects.push(other);f.s.edges.push({...f.s.edges[0],source:other.key,evidence:{...f.s.edges[0].evidence,owner:other.key+'|members|table'}});
 const s=S.selectObjects(f.s,'tables',[f.a.key],[]);assert.equal(s.objects.filter(o=>o.kind==='table').length,1);assert.equal(s.edges.filter(e=>e.target===f.a.key).length,2);
});
test('Copied IDs in different environments are selected independently',()=>{
 const f=fixture(),copy=F.object('table',f.a.id,F.env2);f.s.objects.push(F.object('environment',F.env2,F.env2),copy);f.s.environmentIds.push(F.env2);
 const s=S.selectObjects(f.s,'tables',[copy.key],[]);assert.deepEqual(s.environmentIds,[F.env2]);assert.equal(s.objects.filter(o=>o.kind==='table').length,1);assert.ok(!s.objects.some(o=>o.key===f.a.key));
});
test('Only registered tables for checked plug-ins are included automatically',()=>{
 const f=fixture('plugin'),tableA=F.object('table',F.ids.flow),tableB=F.object('table',F.ids.agent);f.s.objects.push(tableA,tableB);
 [[f.a,tableA],[f.b,tableB]].forEach(([plugin,table])=>f.s.edges.push({source:plugin.key,target:table.key,type:'access-relationship',evidence:{owner:plugin.key+'|registered-table|'+table.id,source:'sdkmessageprocessingstep',field:'id',interaction:'registered-on'}}));
 const tables=S.relatedTables(f.s,[f.a.key]);assert.deepEqual(tables.map(o=>o.key),[tableA.key]);
 const s=S.selectObjects(f.s,'plugins',[f.a.key],[],tables.map(o=>o.key)),p=P.plan([],[],s);assert.ok(p.operations.some(o=>o.key===tableA.key));assert.ok(!p.operations.some(o=>o.key===tableB.key||o.key===f.b.key));assert.equal(p.relationships.filter(r=>r.type==='access-relationship').length,1);
});
test('Arbitrary keys or unrelated registered tables cannot escape the picker scope',()=>{
 const f=fixture();assert.throws(()=>S.selectObjects(f.s,'tables',[f.solution.key],[]),/outside/);assert.throws(()=>S.selectObjects(f.s,'tables',[f.a.key],[],[f.b.key]),/not registered/);
 const empty=S.selectObjects(f.s,'tables',[],f.old);const p=P.plan(f.old,f.rels,empty);assert.equal(p.operations.length,0);assert.equal(p.relationships.length,0);
});

test('Dependency owners using Dataverse aliases still reconcile the selected canonical flow',()=>{
 const f=fixture('flow');f.a.aliases=[f.a.id,F.ids.flow];f.a.dataverseId=F.ids.flow;
 const owner=C.key(F.tenant,F.env,'flow',F.ids.flow)+'|flow-definition',edge={source:f.a.key,target:f.b.key,type:'triggering-relationship',evidence:{owner,source:'workflow.clientdata',field:'id',interaction:'child-flow'}};
 f.s.edges.push(edge);f.s.completedOwners[owner]=true;
 const s=S.selectObjects(f.s,'flows',[f.a.key],f.old);assert.ok(s.edges.some(e=>e.type==='triggering-relationship'));assert.deepEqual(s.scope.selectedObjectKeys,[f.a.key]);
 const prior={...edge,id:'alias-call',managed:true,evidence:[edge.evidence],properties:{IsDeleted:'no'}};f.s.edges.pop();
 assert.equal(P.plan(f.old,[prior],S.selectObjects(f.s,'flows',[f.a.key],f.old)).relationships.find(r=>r.id==='alias-call').action,'deleted');
});

test('Object selection excludes roles and deleted objects from reference endpoints without updating them',()=>{
 const f=fixture(),role=F.existing(F.object('role')),deleted=F.existing(F.object('flow'));deleted.properties.IsDeleted='yes';const old=[...f.old,role,deleted],s=S.selectObjects(f.s,'tables',[f.a.key],old);
 assert.ok(!s.referenceKeys.includes(role.key)&&!s.referenceKeys.includes(deleted.key));const p=P.plan(old,[],s);assert.ok(!p.operations.some(o=>o.key===role.key||o.key===deleted.key));
});
