const test=require('node:test'),assert=require('node:assert/strict'),C=require('../lib/core.js'),S=require('../lib/scoped.js'),P=require('../lib/planner.js'),F=require('./fixtures.cjs');
const ids=['88888888-8888-8888-8888-888888888888','99999999-9999-9999-9999-999999999999'];
const env={id:F.env,name:'First',url:'https://first.crm.dynamics.com',available:true},copy={...env,id:F.env2,name:'Second',url:'https://second.crm.dynamics.com'};
function fixture(config={}){
 const calls=[];let current,reads=0;
 const http={request(method,url){calls.push(url);current=ids.find(id=>url.includes(id));return {solutionid:current,friendlyname:'Solution '+ids.indexOf(current)};},pages(url,resource,cb){
  calls.push(url);const decoded=decodeURIComponent(url),collection=decoded.split('/api/data/v9.2/')[1].split('?')[0];
  if(collection==='solutioncomponents')return cb([{componenttype:29,objectid:config.shared||current===ids[0]?F.ids.flow:F.ids.child,_solutionid_value:current}]);
  if(collection==='workflows'){
   const id=config.shared||current===ids[0]?F.ids.flow:F.ids.child,actions=id===F.ids.flow&&!config.shared?{call:{type:'Workflow',inputs:{host:{workflowReferenceName:F.ids.child}}}}:{};
   let clientdata=JSON.stringify({properties:{definition:{actions}}});if(config.partial&&++reads===2)clientdata='malformed';
   return cb([{workflowid:id,name:'Flow '+id,category:5,type:1,clientdata}]);
  }cb([]);
 }};
 const collector=S.create(http,F.tenant);return {calls,collector,collect:(requests=ids.map(solutionId=>({environment:env,solutionId})),existing=[])=>collector.collectMany(requests,'workflows',existing,{})};
}
test('Batch retrieval deduplicates shared components while retaining both solution memberships',()=>{
 const s=fixture({shared:true}).collect();assert.equal(s.objects.filter(o=>o.kind==='flow').length,1);assert.equal(s.objects.filter(o=>o.kind==='solution').length,2);assert.equal(s.objects.filter(o=>o.kind==='environment').length,1);
 assert.equal(s.edges.filter(e=>e.evidence.interaction==='solution-member').length,2);assert.equal(s.scope.contexts.length,2);
 const p=P.plan([],[],s);assert.equal(p.counts.create,4);assert.equal(p.relationships.filter(r=>r.type==='aggregation-relationship').length,2);
});
test('Cross-solution child-flow references resolve in either selection order on the first batch',()=>{
 for(const order of [ids,ids.slice().reverse()]){const s=fixture().collect(order.map(solutionId=>({environment:env,solutionId})));assert.equal(s.unresolved.length,0);assert.equal(s.partial,false);assert.equal(s.edges.filter(e=>e.type==='triggering-relationship').length,1);}
});
test('Copied solution and component IDs remain distinct across selected environments',()=>{
 const s=fixture({shared:true}).collect([env,copy].map(environment=>({environment,solutionId:ids[0]})));assert.equal(s.objects.length,6);assert.equal(new Set(s.objects.map(o=>o.key)).size,6);
 const p=P.plan([],[],s);assert.equal(p.counts.create,6);assert.ok(p.relationships.every(r=>r.source.split('|')[1]===r.target.split('|')[1]));
});
test('Duplicate requests do not repeat collection or inflate preview counts',()=>{
 const fx=fixture({shared:true}),request={environment:env,solutionId:ids[0]},s=fx.collect([request,request]);assert.equal(s.scope.contexts.length,1);assert.equal(s.objects.length,3);assert.equal(fx.calls.filter(url=>url.includes('solutions(')).length,1);
});
test('Invalid later request fails preflight without reading earlier solutions',()=>{
 const fx=fixture();assert.throws(()=>fx.collect([{environment:env,solutionId:ids[0]},{environment:{...copy,url:''},solutionId:ids[1]}]),/Dataverse/);assert.equal(fx.calls.length,0);
});
test('Incomplete overlapping reads preserve prior dependency evidence',()=>{
 const flow=F.existing(F.object('flow',F.ids.flow)),target=F.existing(F.object('flow',F.ids.child)),owner=flow.key+'|flow-definition';
 const prior={id:'old-call',source:flow.key,target:target.key,type:'triggering-relationship',managed:true,evidence:[{owner,source:'workflow.clientdata',field:'workflowReferenceName',interaction:'child-flow'}],properties:{IsDeleted:'no'}};
 const s=fixture({shared:true,partial:true}).collect(undefined,[flow,target]);assert.equal(s.partial,true);assert.equal(s.protectedOwners[owner],true);assert.ok(!P.plan([flow,target],[prior],s).relationships.some(r=>r.id==='old-call'&&r.action==='deleted'));
});
test('Batch reference resolution reuses existing identities without refreshing external endpoints',()=>{
 const target=F.existing(F.object('flow',F.ids.child)),s=fixture().collect([{environment:env,solutionId:ids[0]}],[target]);assert.equal(s.unresolved.length,0);assert.ok(s.referenceKeys.includes(target.key));assert.ok(!P.plan([target],[],s).operations.some(o=>o.key===target.key));
});
test('Cross-solution resolution cannot bind a child flow from another environment',()=>{
 const s=fixture().collect([{environment:env,solutionId:ids[0]},{environment:copy,solutionId:ids[1]}]);assert.equal(s.edges.filter(e=>e.type==='triggering-relationship').length,0);assert.equal(s.unresolved.length,1);
});
test('Batch refresh retires only selected solution memberships, preserving shared objects and other solutions',()=>{
 const before=fixture({shared:true}).collect(),old=before.objects.map(F.existing),app=old.find(o=>o.kind==='flow');
 const links=before.edges.map((e,i)=>({...e,id:'membership-'+i,managed:true,evidence:[e.evidence],properties:{IsDeleted:'no'}}));
 const sol=old.find(o=>o.kind==='solution'&&o.id===ids[0]);const empty=S.create({},F.tenant).selectedSolutions(env,[sol],[]);empty.scope={action:'get-workflows',environmentId:env.id,solutionId:sol.id};empty.completedOwners[sol.key+'|members|flow']=true;
 const p=P.plan(old,links,S.merge([empty],old));assert.equal(p.relationships.filter(r=>r.action==='deleted').length,1);assert.ok(!p.operations.some(o=>o.key===app.key));assert.equal(p.counts.deleted,0);
});
