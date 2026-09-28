/* Pure reconciliation: external collection is complete before the model is touched. */
var PPPlanner=(function(){
    "use strict";
    var C=typeof PPCore!=="undefined"?PPCore:require("./core.js"),P=C.PREFIX;
    function lifecycle(previous,time,deleted,seen){
        var p={CreatedDate:previous.CreatedDate||time.date,CreatedTime:previous.CreatedTime||time.time,
            LastSyncDate:time.date,LastSyncTime:time.time,IsDeleted:deleted?"yes":"no",
            DeletedDate:deleted?(previous.DeletedDate||time.date):"",DeletedTime:deleted?(previous.DeletedTime||time.time):""};
        if(seen)p[P+"LastSeenAt"]=time.iso;return p;
    }
    function plan(existing,relationships,snapshot,options,isAllowed){
        var opts=C.options(options),time=C.stamp(snapshot.collectedAt),selected=Object.create(null),old=Object.create(null),objects=Object.create(null);
        snapshot.environmentIds.forEach(function(id){selected[C.envId(id)]=true;});C.guid(snapshot.tenantId);
        existing.forEach(function(e){
            C.assert(e.key===C.key(e.tenantId,e.environmentId,e.kind,e.id),"Managed element identity is inconsistent.");
            C.assert(!old[e.key],"Duplicate managed element identity; resolve duplicates before sync.");old[e.key]=e;
        });
        var p={tenantId:snapshot.tenantId,environmentIds:snapshot.environmentIds,time:time,operations:[],relationships:[],warnings:snapshot.warnings.slice(),partial:!!snapshot.partial,
            scope:snapshot.scope,ignored:snapshot.ignored||{},unresolved:snapshot.unresolved.slice(),counts:{create:0,update:0,restore:0,deleted:0,missing:0,relationshipsCreate:0,relationshipsUpdate:0,relationshipsDeleted:0,manualReused:0},options:opts};
        function inScope(e){return e.tenantId===snapshot.tenantId && selected[e.environmentId] && (e.kind!=="role"||opts.includeRoles&&(snapshot.roleSelectionKeys||[]).indexOf(e.key)>=0);}
        snapshot.objects.forEach(function(o){
            C.assert(inScope(o),"Snapshot contains an object outside the selected scope.");
            C.assert(o.key===C.key(o.tenantId,o.environmentId,o.kind,o.id) && !objects[o.key],"Invalid or duplicate snapshot identity.");objects[o.key]=o;
            var prev=old[o.key],properties=Object.assign({},C.properties(o),lifecycle(prev?prev.properties:{},time,false,true));
            properties[P+"ObservationStatus"]="Observed";
            if(prev)C.assert(prev.base===C.TYPES[o.kind].base,"Managed element has an unexpected ArchiMate type.");
            var action=!prev?"create":prev.properties.IsDeleted==="yes"?"restore":"update";
            p.counts[action]++;p.operations.push({action:action,key:o.key,elementId:prev&&prev.elementId,base:C.TYPES[o.kind].base,name:o.name,properties:properties,object:o});
        });
        var missing=new Set(snapshot.confirmedMissing||[]);
        existing.filter(inScope).forEach(function(e){
            if(objects[e.key])return;
            // A targeted retrieval never claims that absent environment objects have disappeared.
            if(snapshot.scope)return;
            // Role deselection and collector switches do not imply disappearance.
            if(e.kind==="role" && !(snapshot.roleSelectionKeys||[]).includes(e.key))return;
            if(missing.has(e.key)){
                var props=Object.assign({},e.properties,lifecycle(e.properties,time,true,false));props[P+"ObservationStatus"]="Confirmed missing";
                if(e.properties.IsDeleted!=="yes")p.counts.deleted++;
                p.operations.push({action:"deleted",key:e.key,elementId:e.elementId,base:e.base,properties:props});
            }else if(["role","solution","table","view","plugin"].indexOf(e.kind)<0 && e.properties.IsDeleted!=="yes"){
                var complete=snapshot.coverage.some(function(c){return c.environmentId===e.environmentId && c.collector==="inventory" && c.complete;});
                if(complete){var keep={};keep[P+"ObservationStatus"]="Missing / unverified";p.counts.missing++;p.operations.push({action:"missing",key:e.key,elementId:e.elementId,base:e.base,properties:keep});}
            }
        });
        var edges=snapshot.edges.slice(),completed=Object.assign({},snapshot.completedOwners||{}),protectedOwners=snapshot.protectedOwners||{};
        snapshot.objects.forEach(function(o){if(C.TYPES[o.kind].base!=="application-component")return;
            var env=C.key(o.tenantId,o.environmentId,"environment",o.environmentId);C.assert(objects[env],"Missing selected environment node.");
            edges.push({source:env,target:o.key,type:"serving-relationship",evidence:{owner:o.key+"|hosting",source:"environment-membership",field:"environmentId",interaction:"hosts"}});completed[o.key+"|hosting"]=true;
        });
        var edgeMap=Object.create(null),relMap=Object.create(null),byId=Object.create(null),references=Object.create(null);
        (snapshot.referenceKeys||[]).forEach(function(key){var e=old[key];C.assert(e&&inScope(e)&&e.properties.IsDeleted!=="yes","Reference endpoint is not an active in-scope model object.");references[key]=e;});
        function edgeKey(e){return JSON.stringify([e.source,e.target,e.type]);}
        function evidenceKey(e){return JSON.stringify([e.owner,e.source,e.field,e.interaction]);}
        function uniqueEvidence(list){var s=Object.create(null);return list.filter(function(e){var k=evidenceKey(e);if(s[k])return false;s[k]=true;return true;}).sort(function(a,b){return evidenceKey(a).localeCompare(evidenceKey(b));});}
        edges.forEach(function(e){
            var source=objects[e.source]||references[e.source],target=objects[e.target]||references[e.target];
            C.assert(source&&target,"Relationship has an unresolved endpoint.");
            if(isAllowed)C.assert(isAllowed(e.type,C.TYPES[source.kind].base,C.TYPES[target.kind].base),"Archi rejects relationship "+e.type+" for these element types.");
            var k=edgeKey(e);if(!edgeMap[k])edgeMap[k]={source:e.source,target:e.target,type:e.type,evidence:[]};edgeMap[k].evidence.push(e.evidence);
        });
        relationships.forEach(function(r){C.assert(!byId[r.id],"Duplicate relationship in model snapshot.");byId[r.id]=r;var k=edgeKey(r);(relMap[k]||(relMap[k]=[])).push(r);});
        var visited=Object.create(null);
        function put(edge,rel,evidence,deleted){
            var source=objects[edge.source]||old[edge.source],target=objects[edge.target]||old[edge.target];
            if(!source||!target||!inScope(source)||!inScope(target))return;
            var action=!rel?"create":deleted?"deleted":"update";
            var props=Object.assign({},lifecycle(rel?rel.properties:{},time,deleted,!deleted));
            props[P+"ManagedBy"]=C.OWNER;props[P+"Evidence"]=JSON.stringify(uniqueEvidence(evidence));
            props[P+"SourceKey"]=edge.source;props[P+"TargetKey"]=edge.target;
            props[P+"InteractionKind"]=C.unique(evidence.map(function(e){return e.interaction;})).join(", ");
            props[P+"TenantId"]=snapshot.tenantId;props[P+"EnvironmentId"]=source.environmentId;
            p.relationships.push({action:action,id:rel&&rel.id,source:edge.source,target:edge.target,type:edge.type,properties:props});
            if(!rel)p.counts.relationshipsCreate++;else if(deleted && rel.properties.IsDeleted!=="yes")p.counts.relationshipsDeleted++;else if(!deleted)p.counts.relationshipsUpdate++;
        }
        Object.keys(edgeMap).forEach(function(k){
            var edge=edgeMap[k],matches=relMap[k]||[],owned=matches.filter(function(r){return r.managed;}),manual=matches.filter(function(r){return !r.managed;});
            C.assert(owned.length<=1,"Duplicate managed relationships between the same endpoints.");
            if(!owned.length && manual.length){p.counts.manualReused++;return;}
            var rel=owned[0],evidence=edge.evidence;
            if(rel){visited[rel.id]=true;evidence=evidence.concat(rel.evidence.filter(function(e){return !completed[e.owner]||protectedOwners[e.owner];}));}
            put(edge,rel,evidence,false);
        });
        relationships.filter(function(r){return r.managed&&!visited[r.id];}).forEach(function(r){
            var source=old[r.source]||objects[r.source],target=old[r.target]||objects[r.target];
            if(!source||!target||!inScope(source)||!inScope(target))return;
            if(missing.has(r.source)||missing.has(r.target)){put(r,r,r.evidence,true);return;}
            if(!opts.discoverDependencies&&!snapshot.scope)return;
            var remaining=r.evidence.filter(function(e){return !completed[e.owner]||protectedOwners[e.owner];});
            if(remaining.length===r.evidence.length)return;
            put(r,r,remaining.length?remaining:r.evidence,!remaining.length);
        });
        return p;
    }
    return {plan:plan,lifecycle:lifecycle};
}());
if(typeof module!=="undefined")module.exports=PPPlanner;
