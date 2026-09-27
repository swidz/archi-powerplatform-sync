/* Focused Dataverse retrieval. Membership changes never imply object deletion. */
var PPScoped=(function(){
    "use strict";
    var C=typeof PPCore!=="undefined"?PPCore:require("./core.js"),I=typeof PPInventory!=="undefined"?PPInventory:require("./inventory.js"),
        DV=typeof PPDataverse!=="undefined"?PPDataverse:require("./dataverse.js"),D=typeof PPDependencies!=="undefined"?PPDependencies:require("./dependencies.js");
    var GROUPS={applications:["canvasapp","modelapp"],workflows:["flow"],agents:["agent"],tables:["table"],views:["view"]};
    var IDS={solution:"solutionid",canvasapp:"canvasappid",modelapp:"appmoduleid",flow:"workflowid",agent:"botid",table:"MetadataId",view:"savedqueryid"};
    var TYPES={table:1,view:26,flow:29,modelapp:80,canvasapp:300};
    var QUERIES=Object.assign({},DV.QUERIES,{
        solution:"solutions?$select=solutionid,friendlyname,uniquename,description,version,ismanaged,isvisible,createdon,modifiedon&$expand=publisherid($select=friendlyname,customizationprefix)",
        table:"EntityDefinitions?$select=MetadataId,LogicalName,SchemaName,EntitySetName,DisplayName,Description,IsCustomEntity,IsManaged",
        view:"savedqueries?$select=savedqueryid,name,description,returnedtypecode,querytype,statecode,ismanaged,iscustom,createdon,modifiedon"
    });
    function snapshot(tenant,environments,scope){return {schemaVersion:2,tenantId:C.guid(tenant),environmentIds:environments.map(function(e){return C.envId(e.id);}),
        collectedAt:new Date().toISOString(),scope:scope,objects:[],edges:[],warnings:[],coverage:[],partial:false,confirmedMissing:[],unresolved:[],
        completedOwners:{},protectedOwners:{},roleCandidates:[],roleSelectionKeys:[],pendingReferences:[],referenceKeys:[],ignored:{}};}
    function node(tenant,env){var o=I.base(tenant,env,"environment",env.id,env.name);o.url=env.url;o.dataverseUrl=env.url;o.status=env.state;o.createdAt=env.createdAt;o.sourceType=env.source;return o;}
    function environments(tenant,envs){var s=snapshot(tenant,envs,{action:"get-environments"});s.objects=envs.map(function(e){return node(tenant,e);});return s;}
    function label(value,fallback){return C.safeMetadata(value&&value.UserLocalizedLabel?value.UserLocalizedLabel.Label:value&&value.LocalizedLabels&&value.LocalizedLabels.length?value.LocalizedLabels[0].Label:fallback);}
    function normalize(tenant,env,kind,row){
        var id=C.guid(row[IDS[kind]]),name=kind==="table"?label(row.DisplayName,row.LogicalName):row.friendlyname||row.displayname||row.name;
        var o=I.base(tenant,env,kind,id,name);o.dataverseId=id;o.sourceType="dataverse/"+QUERIES[kind].split("?")[0];
        o.logicalName=C.safeMetadata(row.LogicalName||row.uniquename||row.schemaname||row.name);o.description=kind==="table"?label(row.Description,""):C.safeMetadata(row.description);
        o.isManaged=kind==="table"?row.IsManaged:row.ismanaged;o.createdAt=row.createdon||row.createdtime;o.modifiedAt=row.modifiedon||row.lastmodifiedtime;
        if(row.statecode!==undefined)o.status=kind==="flow"?(row.statecode===1?"On":"Off"):String(row.statecode);
        if(kind==="canvasapp"&&/^[0-9a-f-]{36}$/i.test(row.uniquecanvasappid||""))o.aliases=C.unique([id,C.guid(row.uniquecanvasappid)]);
        if(kind==="flow"&&row.workflowidunique)o.aliases=C.unique([id,C.guid(row.workflowidunique)]);
        if(kind==="solution"){o.version=C.safeMetadata(row.version);o.publisher=C.safeMetadata(row.publisherid&&row.publisherid.friendlyname);o.url="https://make.powerapps.com/environments/"+env.id+"/solutions/"+id;}
        if(kind==="modelapp")o.url=env.url+"/main.aspx?appid="+id;
        if(kind==="canvasapp")o.url="https://make.powerapps.com/environments/"+env.id+"/apps/"+id;
        if(kind==="flow")o.url="https://make.powerautomate.com/environments/"+env.id+"/flows/"+id+"/details";
        if(kind==="agent")o.url="https://copilotstudio.microsoft.com/environments/"+env.id+"/bots/"+id+"/overview";
        if(kind==="table"){o.schemaName=C.safeMetadata(row.SchemaName);o.entitySetName=C.safeMetadata(row.EntitySetName);o.isCustom=row.IsCustomEntity;}
        if(kind==="view"){o.tableLogicalName=C.safeMetadata(row.returnedtypecode);o.queryType=row.querytype;o.isCustom=row.iscustom;}
        return o;
    }
    function filtered(query,filter){return query+(query.indexOf("&$filter=")>=0?"%20and%20":"&$filter=")+encodeURIComponent("("+filter+")");}
    function chunks(ids,size,fn){for(var i=0;i<ids.length;i+=size)fn(ids.slice(i,i+size));}
    function finish(s,existing){
        var known=s.objects.slice(),keys=Object.create(null);s.objects.forEach(function(o){keys[o.key]=true;});s.referenceKeys=[];
        (existing||[]).forEach(function(e){if(e.kind!=="role"&&e.tenantId===s.tenantId&&s.environmentIds.indexOf(e.environmentId)>=0&&(e.properties||{}).IsDeleted!=="yes"&&!keys[e.key]){
            known.push(Object.assign({},e,{aliases:C.aliases(e)}));s.referenceKeys.push(e.key);keys[e.key]=true;
        }});
        D.resolve(s,s.pendingReferences||[],known);delete s.pendingReferences;
        if(s.unresolved.length)C.addWarning(s,s.unresolved.length+" references could not be resolved. Retrieve the referenced components and rerun this script to add their links.");
        s.collectedAt=new Date().toISOString();return s;
    }
    // Resolve dependencies only after all selected contexts are read, so selection order cannot hide endpoints.
    function merge(parts,existing){
        C.assert(parts.length,"No selected contexts to collect.");
        var first=parts[0],s=snapshot(first.tenantId,[],{action:first.scope.action,contexts:[],kinds:first.scope.kinds}),objects=Object.create(null),partialEnvs=Object.create(null);
        var seen={};function append(field,values){if(!seen[field])seen[field]=Object.create(null);(values||[]).forEach(function(value){var key=JSON.stringify(value);if(!seen[field][key]){seen[field][key]=true;s[field].push(value);}});}
        parts.forEach(function(part){
            C.assert(part.tenantId===s.tenantId&&part.scope.action===s.scope.action,"Cannot combine different tenants or retrieval script types.");
            s.environmentIds=C.unique(s.environmentIds.concat(part.environmentIds));s.partial=s.partial||part.partial;
            if(part.partial)part.environmentIds.forEach(function(id){partialEnvs[id]=true;});
            var context={environmentId:part.scope.environmentId,solutionId:part.scope.solutionId};
            if(!s.scope.contexts.some(function(c){return c.environmentId===context.environmentId&&c.solutionId===context.solutionId;}))s.scope.contexts.push(context);
            part.objects.forEach(function(o){var old=objects[o.key];
                C.assert(!old||C.sameSource(old,o),"Conflicting component identities across selected contexts.");
                objects[o.key]=old?Object.assign({},old,o,{aliases:C.unique(C.aliases(old).concat(C.aliases(o)))}):o;
            });
            ["edges","warnings","coverage","unresolved","pendingReferences"].forEach(function(field){append(field,part[field]);});
            Object.assign(s.completedOwners,part.completedOwners);Object.assign(s.protectedOwners,part.protectedOwners);
            Object.keys(part.ignored||{}).forEach(function(kind){s.ignored[kind]=(s.ignored[kind]||0)+part.ignored[kind];});
        });
        s.objects=Object.keys(objects).map(function(key){return objects[key];});
        // An overlapping read may fail after another solution successfully read the same object.
        // Keep prior evidence throughout that environment until a complete batch can verify removal.
        Object.keys(s.completedOwners).forEach(function(owner){if(partialEnvs[owner.split("|")[1]])s.protectedOwners[owner]=true;});
        if(Object.keys(partialEnvs).length)C.addWarning(s,"Incomplete batch reads: existing links in affected environments are preserved.");
        return finish(s,existing);
    }
    function create(http,tenant,progress){
        function access(env){C.assert(env.url,"This environment has no readable Dataverse URL. Solutions require Dataverse.");return {api:C.dvOrigin(env.apiUrl||env.url)+"/api/data/v9.2/",resource:C.dvOrigin(env.url)+"/"};}
        function solutions(env,options){var a=access(env),out=[],seen=Object.create(null),opts=C.options(options);
            var query=opts.includeHiddenSolutions?QUERIES.solution:filtered(QUERIES.solution,"isvisible eq true");
            http.pages(a.api+query,a.resource,function(rows){rows.forEach(function(r){var o=normalize(tenant,env,"solution",r);C.assert(!seen[o.key],"Duplicate solution identity.");seen[o.key]=true;out.push(o);});});
            return out.sort(function(a,b){return a.name.localeCompare(b.name);});
        }
        function selectedSolutions(env,chosen,existing){var s=environments(tenant,[env]);s.scope={action:"get-solutions",environmentId:env.id};
            chosen.forEach(function(o){C.assert(o.kind==="solution"&&o.environmentId===env.id&&o.tenantId===tenant,"Solution outside selected context.");s.objects.push(o);});C.preserveIdentities(s,existing||[]);return s;
        }
        function collect(env,solutionId,group,existing,options,deferReferences){
            C.assert(GROUPS[group],"Unknown component retrieval script.");solutionId=C.guid(solutionId);var opts=C.options(options),a=access(env),kinds=GROUPS[group],s=environments(tenant,[env]),members=[],complete={},types=Object.assign({},TYPES),memberObjects={};
            s.scope={action:"get-"+group,environmentId:env.id,solutionId:solutionId,kinds:kinds};
            function report(text){if(progress)progress(text);}
            function attempt(label,fn){return C.attempt(s,env.name+": "+label,fn);}
            var solution=http.request("GET",a.api+QUERIES.solution.replace("solutions?","solutions("+solutionId+")?"),a.resource);
            C.assert(C.guid(solution.solutionid)===solutionId,"Solution response does not match context.");s.objects.push(normalize(tenant,env,"solution",solution));
            if(kinds.indexOf("agent")>=0){var code=attempt("agent component type",function(){var found=[];
                http.pages(a.api+"solutioncomponentdefinitions?$select=primaryentityname,solutioncomponenttype&$filter=primaryentityname%20eq%20'bot'",a.resource,function(rows){rows.forEach(function(r){C.assert(r.primaryentityname==="bot","Unexpected solution component definition.");found.push(Number(r.solutioncomponenttype));});});
                found=C.unique(found);if(found.length!==1||!Number.isInteger(found[0])||found[0]<=0)throw C.readError("Cannot determine this organization's agent solution component type.");return found[0];});
                if(code.ok)types.agent=code.value;
            }
            var wantedTypes=kinds.map(function(k){return types[k];}).filter(function(t){return t!==undefined;});if(group==="views")wantedTypes.push(1);
            report("Reading "+group+" membership in "+C.safeMetadata(env.name)+" / "+C.safeMetadata(solution.friendlyname));
            var memberRead=wantedTypes.length?attempt("solution membership",function(){http.pages(a.api+filtered("solutioncomponents?$select=solutioncomponentid,objectid,componenttype,rootcomponentbehavior,rootsolutioncomponentid,_solutionid_value",
                "_solutionid_value eq "+solutionId+" and ("+C.unique(wantedTypes).map(function(t){return "componenttype eq "+t;}).join(" or ")+")"),a.resource,function(rows){rows.forEach(function(r){
                    C.assert(C.guid(r._solutionid_value)===solutionId&&wantedTypes.indexOf(r.componenttype)>=0,"Component response is outside the solution scope.");C.guid(r.objectid);members.push(r);
                });});}):{ok:false};
            function rowsByIds(kind,ids,onRow,definitions){
                var all=true;chunks(C.unique(ids.map(C.guid)),35,function(batch){var query=QUERIES[kind];
                    // Read the subtype so excluded components can be distinguished from inaccessible records.
                    if(kind==="flow"||kind==="canvasapp")query=query.split("&$filter=")[0];
                    if(definitions)query+=",clientdata";
                    var result=attempt(kind+" metadata",function(){http.pages(a.api+filtered(query,batch.map(function(id){return IDS[kind]+" eq "+id;}).join(" or ")),a.resource,function(rows){rows.forEach(function(r){C.assert(batch.indexOf(C.guid(r[IDS[kind]]))>=0,"Metadata response is outside requested component IDs.");onRow(r);});});});all=all&&result.ok;
                });return all;
            }
            function add(kind,r){var o=normalize(tenant,env,kind,r);if(!memberObjects[o.key]){memberObjects[o.key]=o;s.objects.push(o);}return memberObjects[o.key];}
            var flowRows=[];
            kinds.forEach(function(kind){
                var ids=C.unique(members.filter(function(m){return m.componenttype===types[kind];}).map(function(m){return C.guid(m.objectid);}));
                var excluded=[];
                var read=rowsByIds(kind,ids,function(r){
                    if(kind==="flow"&&(r.category!==undefined&&r.category!==5||r.type!==undefined&&r.type!==1)||kind==="canvasapp"&&r.canvasapptype!==undefined&&r.canvasapptype!==0){
                        excluded.push(C.guid(r[IDS[kind]]));s.ignored[kind]=(s.ignored[kind]||0)+1;delete r.clientdata;return;
                    }
                    add(kind,r);if(kind==="flow"&&opts.discoverDependencies){flowRows.push({id:r.workflowid,clientdata:r.clientdata});delete r.clientdata;}},kind==="flow"&&opts.discoverDependencies);
                complete[kind]=memberRead.ok&&types[kind]!==undefined&&read;
                // Primary-ID filters may omit deleted/unauthorized records. Preserve old membership until resolved.
                var returned=s.objects.filter(function(o){return o.kind===kind;}).map(function(o){return o.dataverseId;});
                ids.filter(function(id){return returned.indexOf(id)<0&&excluded.indexOf(id)<0;}).forEach(function(id){
                    complete[kind]=false;s.unresolved.push({environmentId:env.id,sourceId:solutionId,targetId:id,source:"solutioncomponent",reason:"Member is unreadable or outside the supported subtype"});
                });
                s.coverage.push({environmentId:env.id,solutionId:solutionId,collector:kind,complete:complete[kind],authoritative:false});
            });
            // Include-subcomponents roots also include table views not individually listed in solutioncomponents.
            if(group==="views"){
                var roots=C.unique(members.filter(function(m){return m.componenttype===1&&m.rootcomponentbehavior===0;}).map(function(m){return C.guid(m.objectid);})),tables=[];
                var rootRead=rowsByIds("table",roots,function(r){tables.push(r);});if(!rootRead||tables.length!==roots.length)complete.view=false;
                tables.forEach(function(t){C.assert(/^[a-z0-9_]+$/i.test(t.LogicalName),"Invalid table logical name.");
                    var result=attempt("included table views",function(){http.pages(a.api+filtered(QUERIES.view,"returnedtypecode eq '"+t.LogicalName+"'"),a.resource,function(rows){rows.forEach(function(r){C.assert(r.returnedtypecode===t.LogicalName,"View belongs to an unexpected table.");add("view",r);});});});if(!result.ok)complete.view=false;
                });
                s.coverage[s.coverage.length-1].complete=complete.view;
            }
            C.preserveIdentities(s,existing||[]);
            var sol=s.objects.filter(function(o){return o.kind==="solution";})[0];
            kinds.forEach(function(kind){var owner=sol.key+"|members|"+kind;
                if(complete[kind])s.completedOwners[owner]=true;else{s.protectedOwners[owner]=true;C.addWarning(s,"Incomplete "+kind+" membership; existing links for this solution are preserved.");}
                s.objects.filter(function(o){return o.kind===kind;}).forEach(function(o){s.edges.push({source:sol.key,target:o.key,type:C.TYPES[kind].base==="application-component"?"aggregation-relationship":"association-relationship",
                    evidence:{owner:owner,source:"solutioncomponent",field:"objectid",interaction:"solution-member"}});});
            });
            var known=s.objects.slice();(existing||[]).forEach(function(e){if(e.kind!=="role"&&e.tenantId===tenant&&e.environmentId===env.id&&e.properties.IsDeleted!=="yes"&&!known.some(function(o){return o.key===e.key;})){
                known.push(Object.assign({},e,{aliases:C.aliases(e)}));s.referenceKeys.push(e.key);
            }});
            if(opts.discoverDependencies){
                flowRows.forEach(function(r){var owner=C.key(tenant,env.id,"flow",r.id)+"|flow-definition";
                    var result=attempt("flow references",function(){var parsed=D.flowReferences(r.clientdata);parsed.references.forEach(function(ref){s.pendingReferences.push({owner:owner,environmentId:env.id,sourceKind:"flow",sourceId:r.id,targetKind:"flow",targetId:ref.id,type:ref.type,interaction:ref.interaction,evidenceSource:ref.source,field:ref.field});});
                        if(parsed.unresolved){s.protectedOwners[owner]=true;s.unresolved.push({sourceId:r.id,reason:parsed.unresolved+" dynamic child-flow references"});}});r.clientdata=null;if(result.ok)s.completedOwners[owner]=true;
                });
                var agents=s.objects.filter(function(o){return o.kind==="agent";});
                if(agents.length){var ids=agents.map(function(o){return o.dataverseId;}),read=attempt("agent flow tools",function(){
                    http.pages(a.api+"botcomponents?$select=botcomponentid,_parentbotid_value&$filter=botcomponent_workflow/any()&$expand=botcomponent_workflow($select=workflowid),bot_botcomponent($select=botid)",a.resource,function(rows){rows.forEach(function(c){
                        var bots=c.bot_botcomponent||[],flows=c.botcomponent_workflow||[],id=C.guid(c.botcomponentid);
                        C.assert(Array.isArray(bots)&&Array.isArray(flows),"Malformed agent tools expansion.");
                        if(c["bot_botcomponent@odata.nextLink"]||c["botcomponent_workflow@odata.nextLink"]){bots=[];flows=[];http.pages(a.api+"botcomponents("+id+")/bot_botcomponent?$select=botid",a.resource,function(p){bots=bots.concat(p);});http.pages(a.api+"botcomponents("+id+")/botcomponent_workflow?$select=workflowid",a.resource,function(p){flows=flows.concat(p);});}
                        C.unique(bots.map(function(b){return C.guid(b.botid);}).concat(c._parentbotid_value?[C.guid(c._parentbotid_value)]:[])).filter(function(id){return ids.indexOf(id)>=0;}).forEach(function(agent){flows.forEach(function(f){s.pendingReferences.push({owner:C.key(tenant,env.id,"agent",agent)+"|agent-flows",environmentId:env.id,sourceKind:"flow",sourceId:C.guid(f.workflowid),targetKind:"agent",targetId:agent,type:"serving-relationship",interaction:"agent-flow-tool",evidenceSource:"botcomponent_workflow",field:"botcomponentid:"+id});});});
                    });});});if(read.ok)agents.forEach(function(o){s.completedOwners[C.key(tenant,env.id,"agent",o.dataverseId)+"|agent-flows"]=true;});
                }
                var dependent=s.objects.filter(function(o){return ["canvasapp","modelapp","flow"].indexOf(o.kind)>=0;});
                chunks(dependent,20,function(batch){var read=attempt("component dependencies",function(){http.pages(a.api+filtered("dependencies?$select=dependentcomponentobjectid,dependentcomponenttype,requiredcomponentobjectid,requiredcomponenttype",
                    "("+batch.map(function(o){return "dependentcomponentobjectid eq "+o.dataverseId;}).join(" or ")+") and (requiredcomponenttype eq 1 or requiredcomponenttype eq 26 or requiredcomponenttype eq 29 or requiredcomponenttype eq 80 or requiredcomponenttype eq 300)"),a.resource,function(rows){var byType={1:"table",26:"view",29:"flow",80:"modelapp",300:"canvasapp"};rows.forEach(function(r){
                        var source=batch.filter(function(o){return o.dataverseId===C.lower(r.dependentcomponentobjectid)&&o.kind===byType[r.dependentcomponenttype];})[0];C.assert(source,"Dependency response is outside requested components.");
                        s.pendingReferences.push({owner:source.key+"|component-dependencies",environmentId:env.id,sourceKind:source.kind,sourceId:source.dataverseId,targetKind:byType[r.requiredcomponenttype],targetId:C.guid(r.requiredcomponentobjectid),type:"association-relationship",interaction:"declared-dependency",evidenceSource:"Dataverse dependency",field:"requiredcomponentobjectid"});
                    });});});if(read.ok)batch.forEach(function(o){s.completedOwners[o.key+"|component-dependencies"]=true;});
                });
                // Read the direct table name only; never execute or save the view's FetchXML.
                var tables=known.filter(function(o){return o.kind==="table";}),views=known.filter(function(o){return o.kind==="view";});
                views.forEach(function(v){var name=v.tableLogicalName||(v.properties||{})[C.PREFIX+"TableLogicalName"],matches=tables.filter(function(t){return (t.logicalName||(t.properties||{})[C.PREFIX+"LogicalName"])===name;});
                    if(matches.length===1&&s.objects.some(function(o){return o.key===v.key||o.key===matches[0].key;})){s.edges.push({source:v.key,target:matches[0].key,type:"association-relationship",evidence:{owner:v.key+"|view-table",source:"savedquery",field:"returnedtypecode",interaction:"view-of"}});s.completedOwners[v.key+"|view-table"]=true;}
                });
            }
            return deferReferences?s:finish(s,existing);
        }
        function collectMany(requests,group,existing,options){
            C.assert(GROUPS[group],"Unknown component retrieval script.");C.assert(requests.length,"Select at least one solution.");
            var seen=Object.create(null),contexts=[];
            // Validate every request before issuing the first per-solution read.
            requests.forEach(function(r){access(r.environment);var id=C.envId(r.environment.id)+"|"+C.guid(r.solutionId);if(!seen[id]){seen[id]=true;contexts.push(r);}});
            return merge(contexts.map(function(r){return collect(r.environment,r.solutionId,group,existing,options,true);}),existing);
        }
        return {solutions:solutions,selectedSolutions:selectedSolutions,collect:collect,collectMany:collectMany};
    }
    return {create:create,environments:environments,merge:merge,normalize:normalize,GROUPS:GROUPS,QUERIES:QUERIES};
}());
if(typeof module!=="undefined")module.exports=PPScoped;
