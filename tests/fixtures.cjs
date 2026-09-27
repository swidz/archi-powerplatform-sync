const C=require('../lib/core.js'),I=require('../lib/inventory.js');
const tenant='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',env='11111111-1111-1111-1111-111111111111',env2='22222222-2222-2222-2222-222222222222';
const ids={app:'33333333-3333-3333-3333-333333333333',flow:'44444444-4444-4444-4444-444444444444',agent:'55555555-5555-5555-5555-555555555555',role:'66666666-6666-6666-6666-666666666666',child:'77777777-7777-7777-7777-777777777777'};
function object(kind,id=ids[kind]||env,environment=env){return I.base(tenant,{id:environment,name:'Environment',type:'Sandbox'},kind,id,kind+' name');}
function snapshot(objects){return {schemaVersion:1,tenantId:tenant,environmentIds:[env],collectedAt:'2026-09-27T12:00:00Z',objects:objects||[object('environment'),object('canvasapp',ids.app),object('flow')],edges:[],warnings:[],unresolved:[],partial:false,coverage:[],confirmedMissing:[],completedOwners:{},protectedOwners:{},roleCandidates:[],pendingReferences:[]};}
function existing(o,id='element-'+o.id){return {elementId:id,...o,base:C.TYPES[o.kind].base,properties:{...C.properties(o),CreatedDate:'2026-09-01',CreatedTime:'00:00:00Z',IsDeleted:'no',...{}}};}
module.exports={tenant,env,env2,ids,object,snapshot,existing};
