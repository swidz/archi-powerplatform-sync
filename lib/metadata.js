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
    function scalar(value,options){
        if(value===null)return "";
        if(typeof value==="string"||typeof value==="number"||typeof value==="boolean")return C.safeMetadata(value,16384);
        if(value&&Object.prototype.hasOwnProperty.call(value,"Value"))return scalar(value.Value,options);
        if(value&&(value.UserLocalizedLabel||value.LocalizedLabels))return C.label(value,options).text;
        return undefined;
    }
    function capture(object,source,row,fields,options){
        object.metadata=object.metadata||{};
        (fields||[]).forEach(function(field){var value=row,found=true;field.split(".").forEach(function(part){if(value&&Object.prototype.hasOwnProperty.call(value,part))value=value[part];else found=false;});
            if(!found)return;var result=scalar(value,options);if(result!==undefined)object.metadata[source+"-"+field]=result;
            if(value&&(value.LocalizedLabels||value.UserLocalizedLabel)){var label=C.label(value,options);object.metadata[source+"-"+field+".LanguageCode"]=label.languageCode;object.metadata[source+"-"+field+".LanguageStatus"]=label.status;}
            var formatted=row[field+"@OData.Community.Display.V1.FormattedValue"];if(formatted!==undefined){object.metadata[source+"-"+field+".Label"]=C.safeMetadata(formatted,16384);object.metadata[source+"-"+field+".LabelLanguage"]="source-user";}
        });return object;
    }
    function tableLabels(object,row,options){
        if(Object.prototype.hasOwnProperty.call(row,"DisplayName")){var name=C.label(row.DisplayName,options);
            object.displayName=name.text;object.displayNameLanguageCode=name.languageCode;object.displayNameLanguageStatus=name.status;}
        if(Object.prototype.hasOwnProperty.call(row,"Description"))object.description=C.label(row.Description,options,"").text;
        object.labelLanguage=C.options(options).labelLanguage;
    }
    function fields(kind){return DEFINITIONS[kind]?DEFINITIONS[kind].fields:[];}
    var FIELD_SELECT="MetadataId,LogicalName,SchemaName,DisplayName,AttributeType,AttributeTypeName";
    var FIELDS_BEGIN="<!-- PowerPlatform:TableFields:begin -->",FIELDS_END="<!-- PowerPlatform:TableFields:end -->";
    function tableDocumentation(current,columns){
        C.assert(Array.isArray(columns),"Table field documentation requires a complete field list.");current=C.text(current);
        function markup(value){return C.safeMetadata(value,16384).replace(/\s+/g," ").trim().replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/[\\`*_{}\[\]()#+.!|~]/g,"\\$&");}
        var lines=columns.slice().sort(function(a,b){return a.name<b.name?-1:a.name>b.name?1:0;}).map(function(field,index){
            return (index+1)+". **"+markup(field.name)+"**"+(field.displayName&&field.displayName!==field.name?" — "+markup(field.displayName):"")+" ("+markup(field.type)+")";
        });
        var block=FIELDS_BEGIN+"\n## Available fields\n\n"+(lines.length?lines.join("\n"):"No field definitions were returned.")+"\n"+FIELDS_END;
        var start=current.indexOf(FIELDS_BEGIN),end=current.indexOf(FIELDS_END);
        if(start<0&&end<0)return current+(current?"\n\n":"")+block;
        C.assert(start>=0&&end>start&&current.indexOf(FIELDS_BEGIN,start+FIELDS_BEGIN.length)<0&&current.indexOf(FIELDS_END,end+FIELDS_END.length)<0,
            "Table documentation has incomplete or duplicate PowerPlatform field markers. Restore the marker pair before refreshing fields.");
        return current.slice(0,start)+block+current.slice(end+FIELDS_END.length);
    }
    function create(http,progress){
        var cache={},labelCache={},attributeTypes={},choiceCache={};
        function tableFields(snapshot,environments,options){
            var opts=C.options(options);if(opts.includeTableFields===false)return;
            snapshot.objects.filter(function(o){return o.kind==="table";}).forEach(function(o){
                // Never reuse a partial list if the same snapshot is enriched again.
                delete o.tableFields;
                var env=environments.filter(function(e){return e.id===o.environmentId;})[0];
                if(!env||!env.url){C.addWarning(snapshot,"Table "+o.name+" fields: Dataverse environment URL is unavailable; previous documentation is preserved.");return;}
                var api=C.dvOrigin(env.apiUrl||env.url)+"/api/data/v9.2/",resource=C.dvOrigin(env.url)+"/",id=C.guid(o.dataverseId||o.id);
                if(progress)progress(env.name+": reading fields for "+o.name);
                var result=C.attempt(snapshot,env.name+" table "+o.name+" fields",function(){var byName=Object.create(null);
                    http.pages(api+"EntityDefinitions("+id+")/Attributes?$select="+FIELD_SELECT,resource,function(rows){rows.forEach(function(row){
                        var name=C.safeMetadata(row.LogicalName||row.SchemaName),label=C.label(row.DisplayName,opts),type=C.safeMetadata(row.AttributeTypeName&&row.AttributeTypeName.Value||row.AttributeType||"Unknown").replace(/Type$/,"");
                        if(!name)throw C.readError("A field has no logical or schema name; previous documentation is preserved.");
                        var field={name:name,displayName:label.text,type:type,labelLanguageCode:label.languageCode,labelLanguageStatus:label.status};
                        if(byName[name]&&JSON.stringify(byName[name])!==JSON.stringify(field))throw C.readError("Conflicting field definitions; previous documentation is preserved.");
                        byName[name]=field;
                    });});return Object.keys(byName).sort().map(function(name){return byName[name];});
                });
                if(result.ok){o.tableFields=result.value;o.tableFieldsLabelLanguage=opts.labelLanguage;}
            });
        }
        function localize(snapshot,environments,options,namesOnly){
            var opts=C.options(options),localized={solution:["friendlyname","description"],modelapp:["name","description"],flow:["name"],view:["name","description"]},fallbacks=0;
            snapshot.objects.forEach(function(o){
                o.labelLanguage=opts.labelLanguage;
                var attrs=localized[o.kind],d=DEFINITIONS[o.kind],env=environments.filter(function(e){return e.id===o.environmentId;})[0];
                if(!attrs||!env||!env.url)return;
                var api=C.dvOrigin(env.apiUrl||env.url)+"/api/data/v9.2/",resource=C.dvOrigin(env.url)+"/",id=C.guid(o.dataverseId||o.id);
                if(progress)progress("Reading "+opts.labelLanguage+" labels: "+o.kind+" "+id);
                attrs.forEach(function(field,index){
                    if(index&&(namesOnly||!o.description))return;
                    var cacheKey=env.id+"|"+o.kind+"|"+id+"|"+field,result=C.attempt(snapshot,env.name+" "+o.kind+" "+field+" localized label",function(){
                        if(!Object.prototype.hasOwnProperty.call(labelCache,cacheKey)){
                            var moniker={"@odata.id":d.collection+"("+id+")"};
                            var response=http.request("GET",api+"RetrieveLocLabels(EntityMoniker=@p1,AttributeName=@p2,IncludeUnpublished=@p3)?@p1="+encodeURIComponent(JSON.stringify(moniker))+"&@p2='"+field+"'&@p3=false",resource);
                            if(!response.Label||!Array.isArray(response.Label.LocalizedLabels))throw C.readError("Localized label response is unavailable.");
                            labelCache[cacheKey]=response.Label;
                        }
                        return labelCache[cacheKey];
                    });
                    if(!result.ok){if(!index){o.displayNameLanguageStatus="read-failed";o.displayNameLanguageCode="";}return;}
                    var label=C.label(result.value,opts,index?o.description:o.displayName===undefined?o.name:o.displayName);
                    capture(o,"Dataverse",(function(){var row={};row[field]=result.value;return row;}()),[field],opts);
                    o.metadata["Dataverse-"+field]=label.text;
                    if(index)o.description=label.text;
                    else{
                        o.displayName=label.text;o.displayNameLanguageCode=label.languageCode;o.displayNameLanguageStatus=label.status;
                        if(o.kind!=="view")o.name=label.text;
                        if(label.status!=="requested")fallbacks++;
                    }
                });
            });
            if(fallbacks)snapshot.warnings.push(fallbacks+" object names have no "+opts.labelLanguage+" label; fallback text and language are recorded in properties.");
            return snapshot;
        }
        function supported(env,kind){
            var d=DEFINITIONS[kind],key=env.id+"|"+kind;if(cache[key])return cache[key];
            if(kind==="table")return d.fields; // Metadata properties are validated by the server, not Attributes.
            var available={},types={};http.pages(C.dvOrigin(env.apiUrl||env.url)+"/api/data/v9.2/EntityDefinitions(LogicalName='"+d.entity+"')/Attributes?$select=LogicalName,AttributeType,IsValidForRead",C.dvOrigin(env.url)+"/",function(rows){rows.forEach(function(r){
                if(!r.IsValidForRead||r.AttributeType==="Virtual")return;
                available[["Lookup","Owner","Customer"].indexOf(r.AttributeType)>=0?"_"+r.LogicalName+"_value":r.LogicalName]=true;
                types[r.LogicalName]=r.AttributeType;
            });});
            C.assert(available[d.id],"Metadata schema did not return the expected primary ID for "+d.entity+".");
            attributeTypes[key]=types;
            return cache[key]=d.fields.filter(function(field){return available[field];});
        }
        function choiceLabels(snapshot,env,kind,objects,selected,opts){
            var d=DEFINITIONS[kind],types=attributeTypes[env.id+"|"+kind]||{},api=C.dvOrigin(env.apiUrl||env.url)+"/api/data/v9.2/",resource=C.dvOrigin(env.url)+"/";
            ["Picklist","State","Status","Boolean"].forEach(function(type){
                var fields=selected.filter(function(field){return types[field]===type;});if(!fields.length)return;
                var key=env.id+"|"+kind+"|"+type,result=C.attempt(snapshot,env.name+" "+kind+" choice labels",function(){
                    if(!choiceCache[key]){var map={};http.pages(api+"EntityDefinitions(LogicalName='"+d.entity+"')/Attributes/Microsoft.Dynamics.CRM."+type+"AttributeMetadata?$select=LogicalName&$expand=OptionSet($select="+(type==="Boolean"?"TrueOption,FalseOption":"Options")+")&$filter="+encodeURIComponent(fields.map(function(f){return "LogicalName eq '"+f+"'";}).join(" or ")),resource,function(rows){rows.forEach(function(row){
                        C.assert(fields.indexOf(row.LogicalName)>=0,"Choice response is outside requested metadata fields.");
                        var set=row.OptionSet||{},choices=type==="Boolean"?[set.TrueOption,set.FalseOption]:set.Options||[];map[row.LogicalName]={};
                        choices.filter(Boolean).forEach(function(choice){map[row.LogicalName][String(choice.Value)]=choice.Label;});
                    });});choiceCache[key]=map;}
                    return choiceCache[key];
                });if(!result.ok)return;
                objects.forEach(function(o){fields.forEach(function(field){
                    var prefix="Dataverse-"+field,value=(o.metadata||{})[prefix];if(value===undefined||value==="")return;
                    var code=type==="Boolean"?(value==="true"?"1":"0"):value,labels=(result.value[field]||{})[code];if(!labels)return;
                    var label=C.label(labels,opts,o.metadata[prefix+".Label"]);
                    o.metadata[prefix+".Label"]=label.text;o.metadata[prefix+".LabelLanguage"]=label.languageCode||"source-user";o.metadata[prefix+".LabelLanguageStatus"]=label.status;
                });});
            });
        }
        function enrich(snapshot,environments,options){
            var opts=C.options(options);
            tableFields(snapshot,environments,opts);
            if(opts.includeElementMetadata===false)return localize(snapshot,environments,opts);
            var groups={};snapshot.objects.forEach(function(o){if(DEFINITIONS[o.kind]){var key=o.environmentId+"|"+o.kind;(groups[key]||(groups[key]=[])).push(o);}});
            Object.keys(groups).forEach(function(key){var objects=groups[key],kind=objects[0].kind,d=DEFINITIONS[kind],env=environments.filter(function(e){return e.id===objects[0].environmentId;})[0];
                if(!env||!env.url)return;
                var supportedResult=C.attempt(snapshot,env.name+" "+kind+" property schema",function(){return supported(env,kind);});if(!supportedResult.ok)return;
                var selected=supportedResult.value,api=C.dvOrigin(env.apiUrl||env.url)+"/api/data/v9.2/",resource=C.dvOrigin(env.url)+"/";
                for(var i=0;i<objects.length;i+=35){var batch=objects.slice(i,i+35),byId={};
                    batch.forEach(function(o){byId[C.guid(o.dataverseId||o.id)]=o;});
                    C.attempt(snapshot,env.name+" "+kind+" properties",function(){var seen={};
                        http.pages(api+d.collection+"?$select="+selected.join(",")+"&$filter="+encodeURIComponent(Object.keys(byId).map(function(id){return d.id+" eq "+id;}).join(" or ")),resource,function(rows){rows.forEach(function(row){
                            var id=C.guid(row[d.id]);C.assert(byId[id],"Property response is outside requested objects.");seen[id]=true;capture(byId[id],"Dataverse",row,selected,opts);
                            if(kind==="table")tableLabels(byId[id],row,opts);
                        });});
                        if(Object.keys(seen).length!==batch.length)C.addWarning(snapshot,"Some "+kind+" properties were unreadable; previous property values are preserved.");
                    });
                }
                choiceLabels(snapshot,env,kind,objects,selected,opts);
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
            return localize(snapshot,environments,opts);
        }
        return {enrich:enrich,supported:supported,localize:localize,tableFields:tableFields};
    }
    return {DEFINITIONS:DEFINITIONS,ENV_FIELDS:ENV_FIELDS,INVENTORY_FIELDS:INVENTORY_FIELDS,fields:fields,capture:capture,tableLabels:tableLabels,tableDocumentation:tableDocumentation,create:create};
}());
if(typeof module!=="undefined")module.exports=PPMetadata;
