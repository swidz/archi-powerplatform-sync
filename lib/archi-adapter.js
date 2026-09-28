/* jArchi model API plus a narrow native, undoable bridge for type migration with stable IDs. */
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
    function context(items,level,m){
        var records=[],ids=Object.create(null);elements(m||model).forEach(function(e){ids[e.elementId]=true;});
        function add(item){var e=item.concept||item,p=e.prop?props(e):{};
            records.push({managed:p[P+"ManagedBy"]===C.OWNER,tenantId:p[P+"TenantId"],environmentId:p[P+"EnvironmentId"],
                kind:p[P+"ObjectType"],id:p[P+"ObjectId"],key:p[P+"Key"],base:String(e.type),name:C.text(e.name),
                deleted:p.IsDeleted==="yes",inModel:!!ids[String(e.id)]});
        }if(Array.isArray(items))items.forEach(add);else $(items).each(add);return PPContext.resolve(records,level);
    }
    function prepareMigration(m,plan){
        var elementChanges=plan.operations.filter(function(op){return !!op.previousBase;}),relationshipChanges=plan.relationshipTypeChanges||[];
        if(!elementChanges.length&&!relationshipChanges.length)return null;
        var future={},changedRelations={},byKey={},allRelations={};
        $(m).find("element").each(function(item){var e=item.concept||item;byKey[C.text(e.prop(P+"Key"))]=e;});
        $(m).find("relationship").each(function(item){var r=item.concept||item;allRelations[String(r.id)]=r;});
        elementChanges.forEach(function(op){var e=byKey[op.key];
            C.assert(op.object&&op.object.kind==="plugin"&&op.previousBase==="application-component"&&op.base==="application-function","Unsupported element type migration.");
            C.assert(e&&String(e.id)===op.elementId&&String(e.type)===op.previousBase&&C.text(e.prop(P+"ManagedBy"))===C.OWNER,"Plug-in changed after preview. Rerun get-plugins.");future[op.elementId]=op.base;
        });
        relationshipChanges.forEach(function(op){var r=allRelations[op.id];
            C.assert(op.previousType==="aggregation-relationship"&&op.type==="association-relationship"&&r&&String(r.type)===op.previousType&&C.text(r.prop(P+"ManagedBy"))===C.OWNER&&C.text(r.source.prop(P+"Key"))===op.source&&C.text(r.target.prop(P+"Key"))===op.target,"Solution membership changed after preview. Rerun get-plugins.");
            changedRelations[op.id]=op.type;
        });
        // Include manual links and endpoints outside this tool's inventory. Never let the native
        // conversion silently turn an unrelated, newly invalid relationship into an Association.
        Object.keys(allRelations).forEach(function(id){var r=allRelations[id],sourceId=String(r.source.id),targetId=String(r.target.id);
            if(!future[sourceId]&&!future[targetId]&&!changedRelations[sourceId]&&!changedRelations[targetId]&&!changedRelations[id])return;
            C.assert($.model.isAllowedRelationship(changedRelations[id]||String(r.type),future[sourceId]||changedRelations[sourceId]||String(r.source.type),future[targetId]||changedRelations[targetId]||String(r.target.type)),
                "Cannot convert plug-ins: relationship "+id+" ("+String(r.type)+") would be invalid. Adjust that relationship in Archi and rerun get-plugins. No model changes were applied.");
        });
        var rawModel,Factory,Package,Utils,Handler,Wrapper,SetCommand;
        try{
            // jArchi exposes no ID setter. Unwrap only the selected model, then use Archi's own
            // conversion commands and jArchi's SetCommand so conversion and ID restoration undo together.
            var method=Java.type("com.archimatetool.script.dom.model.ArchimateModelProxy").class.getDeclaredMethod("getEObject",Java.to([],"java.lang.Class[]"));
            method.setAccessible(true);rawModel=method.invoke(m);
            Factory=Java.type("com.archimatetool.editor.model.commands.SetConceptTypeCommandFactory");Package=Java.type("com.archimatetool.model.IArchimatePackage");
            Utils=Java.type("com.archimatetool.model.util.ArchimateModelUtils");Handler=Java.type("com.archimatetool.script.commands.CommandHandler");
            Wrapper=Java.type("com.archimatetool.script.commands.ScriptCommandWrapper");SetCommand=Java.type("com.archimatetool.script.commands.SetCommand");
        }catch(error){throw new Error("This Archi/jArchi version cannot preserve IDs during plug-in type conversion. Update Archi and jArchi before retrying; no model changes were applied.");}
        C.assert(rawModel&&String(rawModel.getId())===String(m.id),"Type conversion resolved a different model.");
        return {apply:function(){
            function execute(command){C.assert(command&&command.canExecute(),"Archi cannot perform this type conversion. Abort and Undo.");Handler.executeCommand(new Wrapper(command,rawModel));}
            function restoreId(e,id){var raw=Utils.getObjectByID(rawModel,String(e.id));C.assert(raw,"Converted concept is missing. Abort and Undo.");Handler.executeCommand(new SetCommand(raw,Package.Literals.IDENTIFIER__ID,id));C.assert(String(e.id)===id,"Converted concept ID was not restored. Abort and Undo.");}
            relationshipChanges.forEach(function(op){execute(Factory.createSetRelationTypeCommand(Package.eINSTANCE.getAssociationRelationship(),Utils.getObjectByID(rawModel,op.id)));
                var matches=[],seen={};$(m).find("relationship").each(function(item){var r=item.concept||item,id=String(r.id);if(!seen[id]&&String(r.type)===op.type&&C.text(r.prop(P+"ManagedBy"))===C.OWNER&&C.text(r.source.prop(P+"Key"))===op.source&&C.text(r.target.prop(P+"Key"))===op.target){seen[id]=true;matches.push(r);}});
                C.assert(matches.length===1,"Converted membership is ambiguous. Abort and Undo.");restoreId(matches[0],op.id);
            });
            if(elementChanges.length){var batch=new (Java.type("java.util.LinkedHashSet"))();elementChanges.forEach(function(op){batch.add(Utils.getObjectByID(rawModel,op.elementId));});
                execute(Factory.createSetElementTypeCommand(Package.eINSTANCE.getApplicationFunction(),batch,false));
                var converted={};$(m).find("element").each(function(item){var e=item.concept||item;if(C.text(e.prop(P+"ManagedBy"))===C.OWNER)converted[C.text(e.prop(P+"Key"))]=e;});
                elementChanges.forEach(function(op){var e=converted[op.key];C.assert(e&&String(e.type)===op.base,"Converted plug-in is missing. Abort and Undo.");restoreId(e,op.elementId);});
            }
        }};
    }
    function prepare(m,plan){
        var folders=Object.create(null),conflicts=[];
        $(m).find("folder").each(function(f){if(C.text(f.prop(P+"ManagedBy"))!==C.OWNER)return;
            var parent=$(f).parent().first(),key=String(parent.id)+"|"+C.text(f.prop(P+"FolderKey"));C.assert(!folders[key],"Duplicate managed folder identity.");folders[key]=f;});
        // Root names may already be used by a manual folder. Do not claim or move that folder.
        $(m).children("folder").each(function(category){$(category).children("folder").each(function(f){if(String(f.name)===plan.options.rootFolderName&&C.text(f.prop(P+"ManagedBy"))!==C.OWNER)conflicts.push(String(category.name));});});
        C.assert(!conflicts.length,"PowerPlatform root name conflicts with a manual folder in: "+conflicts.join(", ")+". Rename that folder or configure another root.");
        var migration=prepareMigration(m,plan);
        plan.operations.filter(function(op){return !!op.previousBase;}).forEach(function(op){
            var e=$(m).find("#"+op.elementId).first();if(e&&e.specialization&&!plan.options.useSpecializations){var warning="Plug-in "+op.name+" will lose its Component specialization during conversion to Application Function.";if(plan.warnings.indexOf(warning)<0)plan.warnings.push(warning);}
        });
        return {folders:folders,migration:migration};
    }
    function apply(m,plan,prepared){
        prepared=prepared||prepare(m,plan);
        if(prepared.migration)prepareMigration(m,plan).apply(); // Revalidate after the preview, before the first mutation.
        var folders=prepared.folders,index=Object.create(null),rels=Object.create(null),envNames=Object.create(null),profiles=Object.create(null);
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
            r.name="";if(op.type==="access-relationship")r.accessType="access";update(r,op.properties);r.prop(P+"SourceElementId",String(source.id));r.prop(P+"TargetElementId",String(target.id));
            var dest=destination(source,layer(r),true);if(String($(r).parent().first().id)!==String(dest.id))dest.add(r);
        });
        m.prop(P+"LastSyncScope",plan.scope?JSON.stringify(plan.scope):"environment-inventory");
        m.prop(P+"LastSyncAttemptAt",plan.time.iso);m.prop(P+"LastSyncStatus",plan.partial?"partial":"complete");
        m.prop(P+"LastSyncWarningCount",String(plan.warnings.length));if(!plan.partial)m.prop(P+"LastSuccessfulSyncAt",plan.time.iso);
    }
    return {elements:elements,relationships:relationships,context:context,prepare:prepare,apply:apply,isAllowed:function(type,source,target){return $.model.isAllowedRelationship(type,source,target);}};
}());
