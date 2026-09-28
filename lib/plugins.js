/* Read plug-in types and explicit step registrations; never assembly content or step configuration. */
var PPPlugins=(function(){
    "use strict";
    var C=typeof PPCore!=="undefined"?PPCore:require("./core.js"),S=typeof PPScoped!=="undefined"?PPScoped:require("./scoped.js"),
        M=typeof PPMetadata!=="undefined"?PPMetadata:require("./metadata.js");
    var QUERY="plugintypes?$select=plugintypeid,name,friendlyname,typename,description,isworkflowactivity,ismanaged,createdon,modifiedon,assemblyname,version,culture,publickeytoken,_pluginassemblyid_value&$expand=pluginassemblyid($select=pluginassemblyid,name,version,culture,publickeytoken,isolationmode,sourcetype,ismanaged,description)";
    var STEPS="sdkmessageprocessingsteps?$select=sdkmessageprocessingstepid,name,description,filteringattributes,stage,mode,rank,statecode,statuscode,supporteddeployment,asyncautodelete,ismanaged,createdon,modifiedon,_eventhandler_value,_impersonatinguserid_value&$expand=eventhandler_plugintype($select=plugintypeid),plugintypeid($select=plugintypeid),sdkmessagefilterid($select=primaryobjecttypecode,secondaryobjecttypecode),sdkmessageid($select=name)";
    function filtered(query,filter){return query+"&$filter="+encodeURIComponent(filter);}
    function create(http,tenant,progress){
        function collect(request,existing,options){
            var opts=C.options(options),env=request.environment,tableMode=!!request.tableId,contextId=C.guid(request.tableId||request.solutionId),s=S.environments(tenant,[env]);
            C.assert(env.url,"Plug-in retrieval requires a readable Dataverse URL.");
            var api=C.dvOrigin(env.apiUrl||env.url)+"/api/data/v9.2/",resource=C.dvOrigin(env.url)+"/",plugins={},steps={},tables={},complete=true,excluded={},context;
            s.scope={action:"get-plugins",environmentId:env.id,solutionId:tableMode?undefined:contextId,tableId:tableMode?contextId:undefined,kinds:["plugin"]};
            if(progress)progress("Reading plug-ins in "+env.name+" / "+(tableMode?"table ":"solution ")+contextId);
            function attempt(label,fn){var r=C.attempt(s,env.name+" "+label,fn);if(!r.ok)complete=false;return r;}
            function pages(query,callback){http.pages(api+query,resource,callback);}
            function chunks(items,fn){for(var i=0;i<items.length;i+=25)fn(items.slice(i,i+25));}
            function handler(step){var p=step.eventhandler_plugintype||step.plugintypeid;return p&&p.plugintypeid?C.guid(p.plugintypeid):null;}
            function plugin(row){
                var id=C.guid(row.plugintypeid);if(row.isworkflowactivity===true){excluded[id]=true;return;}
                var o=S.normalize(tenant,env,"plugin",row,opts);M.capture(o,"Assembly",row.pluginassemblyid||{},M.fields("assembly"),opts);plugins[id]=o;
            }
            function byIds(query,field,ids,callback,label){
                chunks(C.unique(ids),function(batch){var seen={};var r=attempt(label,function(){pages(filtered(query,batch.map(function(id){return field+" eq "+C.guid(id);}).join(" or ")),function(rows){rows.forEach(function(row){var id=C.guid(row[field]);C.assert(batch.indexOf(id)>=0,"Plug-in metadata response is outside requested IDs.");seen[id]=true;callback(row);});});});
                    if(r.ok&&Object.keys(seen).length!==batch.length){complete=false;C.addWarning(s,"Some "+label+" records were unreadable; existing links are preserved.");}
                });
            }
            function addStep(row){var id=C.guid(row.sdkmessageprocessingstepid);if(handler(row))steps[id]=row;}
            if(tableMode){
                var row=http.request("GET",api+S.QUERIES.table.replace("EntityDefinitions?","EntityDefinitions("+contextId+")?"),resource);
                C.assert(C.guid(row.MetadataId)===contextId,"Table response does not match context.");
                context=S.normalize(tenant,env,"table",row,opts);C.assert(/^[a-z0-9_]+$/i.test(context.logicalName),"Invalid table logical name.");tables[context.logicalName]=context;
                attempt("table plug-in registrations",function(){pages(filtered(STEPS,"sdkmessagefilterid/primaryobjecttypecode eq '"+context.logicalName+"'"),function(rows){rows.forEach(function(step){
                    C.assert(step.sdkmessagefilterid&&step.sdkmessagefilterid.primaryobjecttypecode===context.logicalName,"Registration response is outside selected table.");addStep(step);
                });});});
                byIds(QUERY,"plugintypeid",C.unique(Object.keys(steps).map(function(id){return handler(steps[id]);})),plugin,"plug-in types");
            }else{
                var solution=http.request("GET",api+S.QUERIES.solution.replace("solutions?","solutions("+contextId+")?"),resource);
                C.assert(C.guid(solution.solutionid)===contextId,"Solution response does not match context.");context=S.normalize(tenant,env,"solution",solution,opts);s.objects.push(context);
                var members=[];attempt("plug-in solution membership",function(){pages(filtered("solutioncomponents?$select=objectid,componenttype,rootcomponentbehavior,_solutionid_value","_solutionid_value eq "+contextId+" and (componenttype eq 90 or componenttype eq 91 or componenttype eq 92)"),function(rows){rows.forEach(function(r){
                    C.assert(C.guid(r._solutionid_value)===contextId&&[90,91,92].indexOf(r.componenttype)>=0,"Plug-in membership response is outside selected solution.");C.guid(r.objectid);members.push(r);
                });});});
                var typeIds=members.filter(function(r){return r.componenttype===90;}).map(function(r){return r.objectid;});
                var stepIds=members.filter(function(r){return r.componenttype===92;}).map(function(r){return r.objectid;});
                byIds(STEPS,"sdkmessageprocessingstepid",stepIds,function(step){var id=handler(step);if(id)typeIds.push(id);},"solution steps");
                byIds(QUERY,"plugintypeid",C.unique(typeIds),plugin,"plug-in types");
                var assemblyIds=C.unique(members.filter(function(r){return r.componenttype===91&&r.rootcomponentbehavior!==2;}).map(function(r){return r.objectid;}));
                chunks(assemblyIds,function(batch){attempt("assembly plug-in types",function(){pages(filtered(QUERY,batch.map(function(id){return "_pluginassemblyid_value eq "+C.guid(id);}).join(" or ")),function(rows){rows.forEach(function(row){
                    C.assert(batch.indexOf(C.guid(row._pluginassemblyid_value))>=0,"Plug-in type belongs to an unexpected assembly.");plugin(row);
                });});});});
                // All registrations of an included type establish its table access, even if packaged separately.
                chunks(Object.keys(plugins),function(batch){attempt("plug-in registrations",function(){pages(filtered(STEPS,batch.map(function(id){return "(_eventhandler_value eq "+id+" or plugintypeid/plugintypeid eq "+id+")";}).join(" or ")),function(rows){rows.forEach(function(step){
                    var id=handler(step);C.assert(id&&batch.indexOf(id)>=0,"Registration response is outside selected plug-in types.");addStep(step);
                });});});});
                var names=C.unique(Object.keys(steps).map(function(id){return (steps[id].sdkmessagefilterid||{}).primaryobjecttypecode;}).filter(function(name){return name&&name!=="none";}));
                names.forEach(function(name){C.assert(/^[a-z0-9_]+$/i.test(name),"Invalid registered table name.");});
                chunks(names,function(batch){var seen={};var read=attempt("registered table metadata",function(){pages(filtered(S.QUERIES.table,batch.map(function(name){return "LogicalName eq '"+name+"'";}).join(" or ")),function(rows){rows.forEach(function(row){
                    C.assert(batch.indexOf(row.LogicalName)>=0,"Table metadata response is outside registered tables.");seen[row.LogicalName]=true;tables[row.LogicalName]=S.normalize(tenant,env,"table",row,opts);
                });});});
                    if(read.ok&&Object.keys(seen).length!==batch.length){complete=false;C.addWarning(s,"Some registered tables are unreadable; their Access links are unresolved and prior links are preserved.");}
                });
            }
            Object.keys(plugins).forEach(function(id){s.objects.push(plugins[id]);});Object.keys(tables).forEach(function(name){s.objects.push(tables[name]);});
            C.preserveIdentities(s,existing||[]);
            var relevantSteps=Object.keys(steps).map(function(id){return steps[id];}).filter(function(step){return !!plugins[handler(step)];});
            Object.keys(plugins).forEach(function(id){var o=plugins[id];o.registrationScope=tableMode?"selected-tables":"all-registrations-of-selected-types";o.registrations=[];
                relevantSteps.filter(function(step){return handler(step)===id;}).forEach(function(step){
                    var values={},captured=M.capture({},"Step",step,M.fields("step"),opts).metadata||{};Object.keys(captured).forEach(function(field){values[field.slice(5)]=captured[field];});
                    values.message=C.safeMetadata((step.sdkmessageid||{}).name);values.primaryTable=C.safeMetadata((step.sdkmessagefilterid||{}).primaryobjecttypecode);
                    values.secondaryTable=C.safeMetadata((step.sdkmessagefilterid||{}).secondaryobjecttypecode);o.registrations.push(values);
                    var table=tables[values.primaryTable];if(table)s.edges.push({source:o.key,target:table.key,type:"access-relationship",evidence:{owner:o.key+"|registered-table|"+table.id,source:"sdkmessageprocessingstep",field:"step:"+step.sdkmessageprocessingstepid,interaction:"registered-on"}});
                    else if(values.primaryTable&&values.primaryTable!=="none")s.unresolved.push({environmentId:env.id,sourceId:o.id,targetId:values.primaryTable,source:"sdkmessagefilter",reason:"Registered table metadata is unreadable"});
                });
            });
            var knownPlugins=(existing||[]).filter(function(e){return e.tenantId===tenant&&e.environmentId===env.id&&e.kind==="plugin";}).concat(Object.keys(plugins).map(function(id){return plugins[id];}));
            var knownTables=(existing||[]).filter(function(e){return e.tenantId===tenant&&e.environmentId===env.id&&e.kind==="table";}).concat(Object.keys(tables).map(function(name){return tables[name];}));
            function mark(owner){if(complete)s.completedOwners[owner]=true;else s.protectedOwners[owner]=true;}
            if(tableMode)knownPlugins.forEach(function(o){mark(o.key+"|registered-table|"+context.id);});
            else{
                Object.keys(plugins).forEach(function(id){knownTables.forEach(function(table){mark(plugins[id].key+"|registered-table|"+table.id);});});
                var owner=context.key+"|members|plugin";mark(owner);Object.keys(plugins).forEach(function(id){s.edges.push({source:context.key,target:plugins[id].key,type:"association-relationship",evidence:{owner:owner,source:"solutioncomponent",field:"plug-in type, assembly or step",interaction:"solution-member"}});});
            }
            if(!complete)C.addWarning(s,"Incomplete plug-in collection; existing membership and Access links are preserved.");
            s.ignored.plugin=Object.keys(excluded).length;s.coverage.push({environmentId:env.id,solutionId:tableMode?undefined:contextId,tableId:tableMode?contextId:undefined,collector:"plugin",complete:complete,authoritative:false});
            return s;
        }
        function collectMany(requests,existing,options){
            C.assert(requests.length,"Select at least one table or solution.");var tableMode=!!requests[0].tableId,seen={},unique=[];
            requests.forEach(function(r){C.assert(!!r.tableId===tableMode&&!!r.solutionId!==tableMode,"Select either tables or solutions, not a mixture.");C.dvOrigin(r.environment.url);C.dvOrigin(r.environment.apiUrl||r.environment.url);
                var key=C.envId(r.environment.id)+"|"+C.guid(r.tableId||r.solutionId);if(!seen[key]){seen[key]=true;unique.push(r);}});
            return S.merge(unique.map(function(r){return collect(r,existing,options);}),existing);
        }
        return {collect:collect,collectMany:collectMany};
    }
    return {create:create,QUERY:QUERY,STEPS:STEPS};
}());
if(typeof module!=="undefined")module.exports=PPPlugins;
