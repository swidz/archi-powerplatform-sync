/* Extract only explicit references. Never persist raw definitions, connector credentials, or action inputs. */
var PPDependencies=(function(){
    "use strict";
    var C=typeof PPCore!=="undefined"?PPCore:require("./core.js");
    function flowReferences(clientdata){
        var data;try{data=typeof clientdata==="string"?JSON.parse(clientdata):clientdata;}catch(e){throw C.readError("Flow definition is not valid JSON.");}
        if(!data || typeof data!=="object")throw C.readError("Invalid or unavailable flow definition.");
        var definition=data.properties?data.properties.definition:data.definition;
        if(!definition || !definition.actions)throw C.readError("Flow definition has no readable actions.");
        var refs=[],unresolved=0,nodes=0;
        function visit(actions){
            Object.keys(actions||{}).forEach(function(name){
                C.assert(++nodes<100000,"Flow definition exceeds the supported action count.");
                var a=actions[name]||{},inputs=a.inputs||{},target;
                // Run a Child Flow is represented as a Workflow action with an explicit workflow ID.
                if(C.lower(a.type)==="workflow"){
                    var host=inputs.host||{};target=host.workflowReferenceName || (inputs.workflow||{}).id;
                    if(typeof target==="string" && /^[0-9a-f-]{36}$/i.test(target))refs.push({kind:"flow",id:C.guid(target),type:"triggering-relationship",interaction:"child-flow",source:"workflow.clientdata",field:"workflowReferenceName"});
                    else unresolved++;
                }
                if(a.actions)visit(a.actions);
                if(a.else && a.else.actions)visit(a.else.actions);
                Object.keys(a.cases||{}).forEach(function(k){visit(a.cases[k].actions);});
                if(a.default && a.default.actions)visit(a.default.actions);
            });
        }
        visit(definition.actions);
        return {references:refs,unresolved:unresolved};
    }
    function aliasIndex(objects){
        var index=Object.create(null);
        objects.forEach(function(o){(o.aliases||[o.id]).forEach(function(id){
            var k=o.environmentId+"|"+o.kind+"|"+C.lower(id);
            C.assert(!index[k] || index[k]===o,"Ambiguous source-object aliases.");index[k]=o;
        });});return index;
    }
    function resolve(snapshot,references){
        var index=aliasIndex(snapshot.objects),seen=Object.create(null);
        snapshot.edges.forEach(function(e){seen[JSON.stringify([e.source,e.target,e.type,e.evidence.owner,e.evidence.source,e.evidence.field])]=true;});
        references.forEach(function(r){
            var source=index[r.environmentId+"|"+r.sourceKind+"|"+C.lower(r.sourceId)],target=index[r.environmentId+"|"+r.targetKind+"|"+C.lower(r.targetId)];
            if(!source||!target){snapshot.unresolved.push({environmentId:r.environmentId,sourceId:r.sourceId,targetId:r.targetId,source:r.evidenceSource,reason:"Endpoint not in selected readable inventory"});
                snapshot.protectedOwners[r.owner]=true;return;}
            if(source.key===target.key)return;
            var edge={source:source.key,target:target.key,type:r.type,evidence:{owner:r.owner,source:r.evidenceSource,field:r.field,interaction:r.interaction}};
            var k=JSON.stringify([edge.source,edge.target,edge.type,edge.evidence.owner,edge.evidence.source,edge.evidence.field]);
            if(!seen[k]){snapshot.edges.push(edge);seen[k]=true;}
        });
    }
    return {flowReferences:flowReferences,aliasIndex:aliasIndex,resolve:resolve};
}());
if(typeof module!=="undefined")module.exports=PPDependencies;
