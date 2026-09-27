/* Public jArchi model API only. Never creates diagrams, writes remote data, or saves the user's model. */
var PPArchi=(function(){
    "use strict";
    var C=PPCore,P=C.PREFIX;
    function props(e){var p={};e.prop().forEach(function(k){p[String(k)]=C.text(e.prop(k));});return p;}
    function elements(m){
        var seen=Object.create(null),out=[];
        $(m).find("element").each(function(item){var e=item.concept||item,id=String(e.id);if(seen[id])return;seen[id]=true;
            if(C.text(e.prop(P+"ManagedBy"))!==C.OWNER)return;
            var p=props(e);out.push({elementId:id,key:p[P+"Key"],tenantId:p[P+"TenantId"],environmentId:p[P+"EnvironmentId"],kind:p[P+"ObjectType"],id:p[P+"ObjectId"],name:String(e.name),base:String(e.type),properties:p});
        });return out;
    }
    function relationships(m){
        var seen=Object.create(null),out=[];
        $(m).find("relationship").each(function(item){var e=item.concept||item,id=String(e.id);if(seen[id])return;seen[id]=true;
            var source=C.text(e.source.prop(P+"Key")),target=C.text(e.target.prop(P+"Key"));if(!source||!target)return;
            var p=props(e),managed=p[P+"ManagedBy"]===C.OWNER,evidence=[];
            if(managed){try{evidence=JSON.parse(p[P+"Evidence"]||"[]");}catch(error){throw new Error("Managed relationship evidence is malformed.");}
                C.assert(Array.isArray(evidence)&&evidence.every(function(x){return x.owner&&x.source&&x.field&&x.interaction;}),"Invalid relationship evidence.");}
            out.push({id:id,source:source,target:target,type:String(e.type),managed:managed,evidence:evidence,properties:p});
        });return out;
    }
    function layer(e){var f=$(e).parent().first(),a=$(f).parent().first();while(a&&String(a.type)==="folder"){f=a;a=$(f).parent().first();}C.assert(f&&String(f.type)==="folder","Concept has no layer folder.");return f;}
    function context(items,level){
        var records=[];function add(item){var e=item.concept||item,p=props(e),folder=p[P+"FolderKey"]||"",parts=folder.split("|");
            records.push({managed:p[P+"ManagedBy"]===C.OWNER,tenantId:p[P+"TenantId"]||(parts[0]==="environment"?parts[1]:undefined),
                environmentId:p[P+"EnvironmentId"]||(parts[0]==="environment"?parts[2]:undefined),kind:p[P+"ObjectType"],id:p[P+"ObjectId"]});
        }if(Array.isArray(items))items.forEach(add);else $(items).each(add);return PPContext.resolve(records,level);
    }
    function prepare(m,plan){
        var folders=Object.create(null),conflicts=[];
        $(m).find("folder").each(function(f){if(C.text(f.prop(P+"ManagedBy"))!==C.OWNER)return;
            var parent=$(f).parent().first(),key=String(parent.id)+"|"+C.text(f.prop(P+"FolderKey"));C.assert(!folders[key],"Duplicate managed folder identity.");folders[key]=f;});
        // Root names may already be used by a manual folder. Do not claim or move that folder.
        $(m).children("folder").each(function(category){$(category).children("folder").each(function(f){if(String(f.name)===plan.options.rootFolderName&&C.text(f.prop(P+"ManagedBy"))!==C.OWNER)conflicts.push(String(category.name));});});
        C.assert(!conflicts.length,"PowerPlatform root name conflicts with a manual folder in: "+conflicts.join(", ")+". Rename that folder or configure another root.");
        return {folders:folders};
    }
    function apply(m,plan,prepared){
        var folders=(prepared||prepare(m,plan)).folders,index=Object.create(null),rels=Object.create(null),envNames=Object.create(null),profiles=Object.create(null);
        $(m).find("element").each(function(item){var e=item.concept||item;if(C.text(e.prop(P+"ManagedBy"))===C.OWNER)index[C.text(e.prop(P+"Key"))]=e;});
        $(m).find("relationship").each(function(item){var e=item.concept||item;rels[String(e.id)]=e;});
        plan.operations.forEach(function(op){if(op.object)envNames[op.object.environmentId]=op.object.environmentName;});
        function folder(parent,key,name){var id=String(parent.id)+"|"+key,f=folders[id];
            if(!f){$(parent).children("folder").each(function(child){C.assert(String(child.name)!==name,"Folder name conflict: "+name+". Use Undo if application has started.");});
                f=parent.createFolder(name);f.prop(P+"ManagedBy",C.OWNER);f.prop(P+"FolderKey",key);folders[id]=f;}
            if(String(f.name)!==name)f.name=name;return f;
        }
        function destination(e,category,relationship){
            var root=folder(category||layer(e),"root",plan.options.rootFolderName),id=C.text(e.prop(P+"EnvironmentId")),tenant=C.text(e.prop(P+"TenantId"));
            var name=envNames[id]||C.text(e.prop(P+"EnvironmentName"))||id;
            var env=folder(root,"environment|"+tenant+"|"+id,name+" ["+id.slice(0,8)+"]");
            var rule=C.TYPES[C.text(e.prop(P+"ObjectType"))];C.assert(rule,"Unknown managed element type.");
            return relationship||!rule.folder?env:folder(env,"kind-folder|"+rule.folder,rule.folder);
        }
        function update(e,properties){Object.keys(properties).forEach(function(k){if(C.text(e.prop(k))!==properties[k]||e.prop(k)===null)e.prop(k,properties[k]);});}
        plan.operations.forEach(function(op){
            var e=index[op.key];if(op.elementId)C.assert(e&&String(e.id)===op.elementId,"Model changed after preview. Abort and Undo.");
            if(!e){e=m.createElement(op.base,op.name);index[op.key]=e;}
            if(op.name!==undefined)e.name=op.name;update(e,op.properties);
            if(op.action!=="missing"){
                var dest=destination(e);if(String($(e).parent().first().id)!==String(dest.id))dest.add(e);
                if(plan.options.useSpecializations&&op.object){var rule=C.TYPES[op.object.kind],key=rule.base+"|"+rule.label;
                    if(!profiles[key])profiles[key]=m.findSpecialization(rule.label,rule.base)||m.createSpecialization(rule.label,rule.base);
                    e.specialization=rule.label;}
            }
        });
        plan.relationships.forEach(function(op){
            var source=index[op.source],target=index[op.target];C.assert(source&&target,"Relationship endpoint disappeared after preview.");
            var r=op.id?rels[op.id]:m.createRelationship(op.type,"",source,target);
            C.assert(r&&String(r.source.id)===String(source.id)&&String(r.target.id)===String(target.id),"Relationship changed after preview. Abort and Undo.");
            r.name="";update(r,op.properties);r.prop(P+"SourceElementId",String(source.id));r.prop(P+"TargetElementId",String(target.id));
            var dest=destination(source,layer(r),true);if(String($(r).parent().first().id)!==String(dest.id))dest.add(r);
        });
        m.prop(P+"LastSyncScope",plan.scope?JSON.stringify(plan.scope):"environment-inventory");
        m.prop(P+"LastSyncAttemptAt",plan.time.iso);m.prop(P+"LastSyncStatus",plan.partial?"partial":"complete");
        m.prop(P+"LastSyncWarningCount",String(plan.warnings.length));if(!plan.partial)m.prop(P+"LastSuccessfulSyncAt",plan.time.iso);
    }
    return {elements:elements,relationships:relationships,context:context,prepare:prepare,apply:apply,isAllowed:function(type,source,target){return $.model.isAllowedRelationship(type,source,target);}};
}());
