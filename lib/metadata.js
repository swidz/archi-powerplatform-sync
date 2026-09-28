/* Explicit metadata field catalogue. Payloads, credentials and secure configuration are never selected. */
var PPMetadata=(function(){
    "use strict";
    var C=typeof PPCore!=="undefined"?PPCore:require("./core.js");
    var COMMON="createdon,modifiedon,ismanaged,componentstate,solutionid,versionnumber,introducedversion,_createdby_value,_modifiedby_value,_ownerid_value,_owningbusinessunit_value,iscustomizable";
    var DEFINITIONS={
        solution:{entity:"solution",collection:"solutions",id:"solutionid",fields:"solutionid,friendlyname,uniquename,description,version,ismanaged,isvisible,isapimanaged,createdon,modifiedon,installedon,updatedon,solutionpackageversion,solutiontype,enabledforsourcecontrolintegration,sourcecontrolsyncstatus,_publisherid_value,_parentsolutionid_value,_configurationpageid_value,versionnumber,_createdby_value,_modifiedby_value"},
        canvasapp:{entity:"canvasapp",collection:"canvasapps",id:"canvasappid",fields:"canvasappid,canvasapprowid,name,displayname,description,uniquecanvasappid,canvasapptype,canvasappsubtype,createdtime,lastmodifiedtime,lastpublishtime,appversion,minclientversion,createdbyclientversion,isfeaturedapp,isheroapp,ishidden,canconsumeapppass,hascustommiddletier,iscdsupgraded,bypassconsent,admincontrolbypassconsent,aadcreatedbyid,aadlastmodifiedbyid,aadlastpublishedbyid,status"},
        modelapp:{entity:"appmodule",collection:"appmodules",id:"appmoduleid",fields:"appmoduleid,appmoduleidunique,name,uniquename,description,appmoduleversion,clienttype,formfactor,navigationtype,optimizedfor,isdefault,isfeatured,publishedon,statecode,statuscode,_publisherid_value"},
        flow:{entity:"workflow",collection:"workflows",id:"workflowid",fields:"workflowid,workflowidunique,name,uniquename,description,category,type,statecode,statuscode,mode,modernflowtype,primaryentity,languagecode,scope,runas,ondemand,subprocess,asyncautodelete,istransacted,rank,processorder,schemaversion,triggeroncreate,triggerondelete,triggeronupdateattributelist,throttlingbehavior,planverified,_activeworkflowid_value,_parentworkflowid_value"},
        agent:{entity:"bot",collection:"bots",id:"botid",fields:"botid,componentidunique,name,schemaname,statecode,statuscode,language,authenticationmode,authenticationtrigger,accesscontrolpolicy,runtimeprovider,origin,template,publishedon,_publishedby_value"},
        view:{entity:"savedquery",collection:"savedqueries",id:"savedqueryid",fields:"savedqueryid,savedqueryidunique,name,description,returnedtypecode,querytype,statecode,statuscode,iscustom,isdefault,isprivate,isquickfindquery,isuserdefined,enablecrosspartition,queryappusage,organizationtaborder,canbedeleted"},
        role:{entity:"role",collection:"roles",id:"roleid",fields:"roleid,roleidunique,name,description,appliesto,applicationid,isautoassigned,isinherited,issytemgenerated,canbedeleted,_businessunitid_value,_parentroleid_value,_parentrootroleid_value,_roletemplateid_value"},
        plugin:{entity:"plugintype",collection:"plugintypes",id:"plugintypeid",fields:"plugintypeid,plugintypeidunique,name,friendlyname,typename,description,assemblyname,version,major,minor,culture,publickeytoken,isworkflowactivity,plugintypeexportkey,_pluginassemblyid_value"},
        assembly:{entity:"pluginassembly",collection:"pluginassemblies",id:"pluginassemblyid",fields:"pluginassemblyid,name,description,version,major,minor,culture,publickeytoken,isolationmode,sourcetype,authtype,ishidden,_packageid_value,_managedidentityid_value"},
        step:{entity:"sdkmessageprocessingstep",collection:"sdkmessageprocessingsteps",id:"sdkmessageprocessingstepid",fields:"sdkmessageprocessingstepid,name,description,filteringattributes,stage,mode,rank,statecode,statuscode,supporteddeployment,asyncautodelete,canbebypassed,canusereadonlyconnection,enablepluginprofiler,_eventhandler_value,_sdkmessagefilterid_value,_sdkmessageid_value,_impersonatinguserid_value"},
        table:{collection:"EntityDefinitions",id:"MetadataId",fields:"MetadataId,LogicalName,SchemaName,EntitySetName,LogicalCollectionName,CollectionSchemaName,DisplayName,DisplayCollectionName,Description,PrimaryIdAttribute,PrimaryNameAttribute,ObjectTypeCode,OwnershipType,IsCustomEntity,IsManaged,IsActivity,IsActivityParty,IsIntersect,DataProviderId,DataSourceId,TableType,CreatedOn,ModifiedOn,OwnerId,OwningBusinessUnit,IsSolutionAware,IsSLAEnabled,IsKnowledgeManagementEnabled,IsMSTeamsIntegrationEnabled,IsArchivalEnabled,IsRetentionEnabled,IsImportable,IsVisibleInMobile,IsOfflineInMobileClient,IsPrivate,IsAvailableOffline,IsQuickCreateEnabled,IsValidForAdvancedFind,IsAuditEnabled,IsCustomizable,IsRenameable,IsMappable,CanCreateAttributes,CanCreateForms,CanCreateViews,CanCreateCharts,CanBeRelatedEntityInRelationship,CanBePrimaryEntityInRelationship,CanBeInManyToMany,CanEnableSyncToExternalSearchIndex,ChangeTrackingEnabled,AutoRouteToOwnerQueue,IsEnabledForCharts,IsMailMergeEnabled,IsConnectionsEnabled,IsDuplicateDetectionEnabled,IsDocumentManagementEnabled,IsOneNoteIntegrationEnabled,IsOptimisticConcurrencyEnabled,IsStateModelAware,EnforceStateTransitions,HasActivities,HasNotes,IsBusinessProcessEnabled,IntroducedVersion,ExternalName,ExternalCollectionName"}
    };
    Object.keys(DEFINITIONS).forEach(function(kind){var d=DEFINITIONS[kind];d.fields=C.unique((d.fields+(kind==="table"||kind==="solution"?"":","+COMMON)).split(","));});
    var ENV_FIELDS="id,displayName,type,state,azureRegion,geo,url,createdDateTime,modifiedDateTime,deletedDateTime,dataverseId,isDefault,isManaged,isPayAsYouGo,isTeamsEnvironment,linkedEnvironmentId".split(",");
    var INVENTORY_FIELDS="id,name,type,location,kind,sku.name,sku.tier,properties.displayName,properties.environmentId,properties.logicalName,properties.schemaName,properties.createdAt,properties.lastModifiedAt,properties.lastPublishedAt,properties.isManaged,properties.subType,properties.ownerId,properties.createdBy,properties.isQuarantined,properties.state,properties.status,properties.appType,properties.appVersion,properties.version,properties.description,properties.appModuleId,properties.workflowEntityId,properties.botId,properties.name".split(",");
    function scalar(value){
        if(value===null)return "";
        if(typeof value==="string"||typeof value==="number"||typeof value==="boolean")return C.safeMetadata(value,16384);
        if(value&&Object.prototype.hasOwnProperty.call(value,"Value"))return scalar(value.Value);
        if(value&&value.UserLocalizedLabel)return scalar(value.UserLocalizedLabel.Label);
        if(value&&value.LocalizedLabels&&value.LocalizedLabels.length)return scalar(value.LocalizedLabels[0].Label);
        return undefined;
    }
    function capture(object,source,row,fields){
        object.metadata=object.metadata||{};
        (fields||[]).forEach(function(field){var value=row,found=true;field.split(".").forEach(function(part){if(value&&Object.prototype.hasOwnProperty.call(value,part))value=value[part];else found=false;});
            if(!found)return;var result=scalar(value);if(result!==undefined)object.metadata[source+"-"+field]=result;
            var formatted=row[field+"@OData.Community.Display.V1.FormattedValue"];if(formatted!==undefined)object.metadata[source+"-"+field+".Label"]=C.safeMetadata(formatted,16384);
        });return object;
    }
    function fields(kind){return DEFINITIONS[kind]?DEFINITIONS[kind].fields:[];}
    function create(http){
        var cache={};
        function supported(env,kind){
            var d=DEFINITIONS[kind],key=env.id+"|"+kind;if(cache[key])return cache[key];
            if(kind==="table")return d.fields; // Metadata properties are validated by the server, not Attributes.
            var available={};http.pages(C.dvOrigin(env.apiUrl||env.url)+"/api/data/v9.2/EntityDefinitions(LogicalName='"+d.entity+"')/Attributes?$select=LogicalName,AttributeType,IsValidForRead",C.dvOrigin(env.url)+"/",function(rows){rows.forEach(function(r){
                if(!r.IsValidForRead||r.AttributeType==="Virtual")return;
                available[["Lookup","Owner","Customer"].indexOf(r.AttributeType)>=0?"_"+r.LogicalName+"_value":r.LogicalName]=true;
            });});
            C.assert(available[d.id],"Metadata schema did not return the expected primary ID for "+d.entity+".");
            return cache[key]=d.fields.filter(function(field){return available[field];});
        }
        function enrich(snapshot,environments,options){
            if(C.options(options).includeElementMetadata===false)return snapshot;
            var groups={};snapshot.objects.forEach(function(o){if(DEFINITIONS[o.kind]){var key=o.environmentId+"|"+o.kind;(groups[key]||(groups[key]=[])).push(o);}});
            Object.keys(groups).forEach(function(key){var objects=groups[key],kind=objects[0].kind,d=DEFINITIONS[kind],env=environments.filter(function(e){return e.id===objects[0].environmentId;})[0];
                if(!env||!env.url)return;
                var supportedResult=C.attempt(snapshot,env.name+" "+kind+" property schema",function(){return supported(env,kind);});if(!supportedResult.ok)return;
                var selected=supportedResult.value,api=C.dvOrigin(env.apiUrl||env.url)+"/api/data/v9.2/",resource=C.dvOrigin(env.url)+"/";
                for(var i=0;i<objects.length;i+=35){var batch=objects.slice(i,i+35),byId={};
                    batch.forEach(function(o){byId[C.guid(o.dataverseId||o.id)]=o;});
                    C.attempt(snapshot,env.name+" "+kind+" properties",function(){var seen={};
                        http.pages(api+d.collection+"?$select="+selected.join(",")+"&$filter="+encodeURIComponent(Object.keys(byId).map(function(id){return d.id+" eq "+id;}).join(" or ")),resource,function(rows){rows.forEach(function(row){
                            var id=C.guid(row[d.id]);C.assert(byId[id],"Property response is outside requested objects.");seen[id]=true;capture(byId[id],"Dataverse",row,selected);
                        });});
                        if(Object.keys(seen).length!==batch.length)C.addWarning(snapshot,"Some "+kind+" properties were unreadable; previous property values are preserved.");
                    });
                }
            });
            // Assemblies and steps supply properties of plug-in elements, never extra model concepts.
            var attachments={},links=[];
            snapshot.objects.filter(function(o){return o.kind==="plugin";}).forEach(function(o){
                function attach(kind,id,target,source){
                    if(!id)return;id=C.guid(id);var key=o.environmentId+"|"+kind+"|"+id;
                    if(!attachments[key])attachments[key]={kind:kind,id:id,dataverseId:id,environmentId:o.environmentId};
                    links.push({object:attachments[key],target:target,source:source});
                }
                attach("assembly",(o.metadata||{})["Dataverse-_pluginassemblyid_value"],o,"Assembly");
                (o.registrations||[]).forEach(function(registration){attach("step",registration.sdkmessageprocessingstepid,registration,null);});
            });
            if(links.length){
                var nested={objects:Object.keys(attachments).map(function(key){return attachments[key];}),warnings:snapshot.warnings,partial:false};
                enrich(nested,environments,options);snapshot.partial=snapshot.partial||nested.partial;
                links.forEach(function(link){Object.keys(link.object.metadata||{}).forEach(function(key){
                    var field=key.replace(/^Dataverse-/,"");if(link.source){link.target.metadata[link.source+"-"+field]=link.object.metadata[key];}else link.target[field]=link.object.metadata[key];
                });});
            }
            return snapshot;
        }
        return {enrich:enrich,supported:supported};
    }
    return {DEFINITIONS:DEFINITIONS,ENV_FIELDS:ENV_FIELDS,INVENTORY_FIELDS:INVENTORY_FIELDS,fields:fields,capture:capture,create:create};
}());
if(typeof module!=="undefined")module.exports=PPMetadata;
