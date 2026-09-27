/* Pure contracts shared by jArchi and the offline tests. */
var PPCore = (function () {
    "use strict";
    var PREFIX = "PowerPlatform-", OWNER = "archi-powerplatform-sync";
    var TYPES = {
        environment: {base:"node", folder:"", label:"Power Platform Environment"},
        canvasapp: {base:"application-component", folder:"Applications", label:"Canvas App"},
        modelapp: {base:"application-component", folder:"Applications", label:"Model-driven App"},
        codeapp: {base:"application-component", folder:"Applications", label:"Code App"},
        app: {base:"application-component", folder:"Applications", label:"Power App"},
        flow: {base:"application-component", folder:"Flows", label:"Power Automate Flow"},
        agent: {base:"application-component", folder:"Agents", label:"Copilot Agent"},
        role: {base:"business-role", folder:"Security Roles", label:"Dataverse Security Role"}
    };
    var RESOURCE_TYPES = {
        "microsoft.powerapps/canvasapps":"canvasapp", "microsoft.powerapps/modeldrivenapps":"modelapp",
        "microsoft.powerapps/codeapps":"codeapp", "microsoft.powerapps/apps":"app",
        "microsoft.powerautomate/cloudflows":"flow", "microsoft.powerautomate/agentflows":"flow",
        "microsoft.powerautomate/m365agentflows":"flow", "microsoft.copilotstudio/agents":"agent",
        "microsoft.powerplatform/environments":"environment"
    };
    function assert(ok, message) { if (!ok) throw new Error(message); }
    function text(v) { return v === undefined || v === null ? "" : String(v); }
    function lower(v) { return text(v).toLowerCase(); }
    function guid(v) { var s=lower(v); assert(/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(s), "Invalid GUID."); return s; }
    function envId(v) { var s=lower(v); assert(/^(default-)?[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(s), "Invalid environment ID."); return s; }
    function objectId(v) { return guid(v); }
    function key(tenant, environment, kind, id) {
        assert(TYPES[kind], "Unsupported object kind.");
        return [guid(tenant),envId(environment),kind,kind === "environment" ? envId(id) : objectId(id)].join("|");
    }
    function readError(message, status) { var e=new Error(message); e.readFailure=true; e.status=status||0; return e; }
    function stamp(value) {
        var d=new Date(value); assert(!isNaN(d.getTime()), "Invalid collection time.");
        var s=d.toISOString(); return {date:s.slice(0,10),time:s.slice(11,19)+"Z",iso:s};
    }
    function unique(values) { return Array.from(new Set(values)).sort(); }
    function options(input) {
        var o=Object.assign({rootFolderName:"PowerPlatform",useSpecializations:false,discoverDependencies:true,
            includeRoles:true,roleIds:[],excludeRoleIds:[],rolePublisherPrefixes:[],includeUnclassifiedRoles:false,
            environmentSettings:{}},input||{});
        assert(typeof o.rootFolderName === "string" && o.rootFolderName.trim(), "Root folder name is required.");
        ["roleIds","excludeRoleIds"].forEach(function(k){assert(Array.isArray(o[k]),"Invalid role configuration."); o[k]=o[k].map(guid);});
        assert(Array.isArray(o.rolePublisherPrefixes),"Invalid publisher prefix configuration.");
        return o;
    }
    function dvOrigin(url) {
        var s=text(url).replace(/\/$/,"");
        assert(/^https:\/\/[a-z0-9][a-z0-9-]*\.(?:api\.)?crm\d*\.dynamics\.com$/i.test(s), "Unrecognized Dataverse URL. Only public-cloud HTTPS organization URLs are supported.");
        return s.toLowerCase();
    }
    function safeMetadata(v, limit) {
        var s=text(v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,"");
        // Human-authored metadata is not a credential store; redact familiar accidental secret formats.
        return s.replace(/(Bearer\s+)[A-Za-z0-9._~+\/-]+=*/gi,"$1[redacted]")
            .replace(/((?:password|client_secret|accountkey|sharedaccesskey|sig)\s*[=:]\s*)[^\s;&"']+/gi,"$1[redacted]")
            .slice(0,limit||4096);
    }
    function addWarning(snapshot, message) { snapshot.warnings.push(message); snapshot.partial=true; }
    function attempt(snapshot, label, fn) {
        try { return {ok:true,value:fn()}; }
        catch(e) { if(!e.readFailure) throw e; addWarning(snapshot,label+": "+e.message); return {ok:false}; }
    }
    function properties(object) {
        var p={};
        var fields={TenantId:object.tenantId,EnvironmentId:object.environmentId,EnvironmentName:object.environmentName,
            ObjectId:object.id,ObjectType:object.kind,ObjectName:object.name,SourceType:object.sourceType,
            SourceIds:JSON.stringify(unique(object.aliases||[object.id])),URL:object.url,
            Description:object.description,Status:object.status,Subtype:object.subtype,
            SourceCreatedAt:object.createdAt,SourceModifiedAt:object.modifiedAt,OwnerId:object.ownerId,
            Region:object.region,EnvironmentType:object.environmentType,ArchitectureStage:object.stage,
            DataverseURL:object.dataverseUrl,DataverseId:object.dataverseId,LogicalName:object.logicalName,IsManaged:object.isManaged,
            RoleClassification:object.roleClassification,BusinessUnitIds:object.businessUnitIds?JSON.stringify(object.businessUnitIds):undefined,
            Connectors:object.connectors?JSON.stringify(object.connectors):undefined,
            Channels:object.channels?JSON.stringify(object.channels):undefined};
        Object.keys(fields).forEach(function(k){if(fields[k]!==undefined && fields[k]!==null){
            var serialized=["SourceIds","BusinessUnitIds","Connectors","Channels"].indexOf(k)>=0;
            if(serialized)assert(text(fields[k]).length<=1024*1024,"Serialized metadata exceeds the supported property size.");
            p[PREFIX+k]=safeMetadata(fields[k],serialized?1024*1024:4096);
        }});
        p[PREFIX+"ManagedBy"]=OWNER; p[PREFIX+"Key"]=object.key;
        return p;
    }
    function scopeKey(environment, kind) { return envId(environment)+"|"+kind; }
    function aliases(object) {
        var ids=object.aliases,raw=object.properties&&object.properties[PREFIX+"SourceIds"];
        if(raw){var saved;try{saved=JSON.parse(raw);}catch(e){throw new Error("Invalid saved source identities.");}assert(Array.isArray(saved),"Invalid saved source identities.");ids=(ids||[]).concat(saved);}
        assert(!ids||Array.isArray(ids),"Invalid source identities.");
        return unique([object.id].concat(ids||[]).map(function(id){return object.kind==="environment"?envId(id):guid(id);}));
    }
    function sameSource(a,b) {
        return a.tenantId===b.tenantId&&a.environmentId===b.environmentId&&a.kind===b.kind&&aliases(a).some(function(id){return aliases(b).indexOf(id)>=0;});
    }
    function preserveIdentities(snapshot,existing) {
        var objects=snapshot.objects.concat(snapshot.roleCandidates.map(function(c){return c.object;})),seen=Object.create(null),index=Object.create(null);
        function aliasKey(o,id){return [o.tenantId,o.environmentId,o.kind,id].join("|");}
        existing.forEach(function(e){aliases(e).forEach(function(id){var k=aliasKey(e,id);assert(!index[k]||index[k]===e,"Multiple existing elements match the same source aliases.");index[k]=e;});});
        objects.forEach(function(o){var matches=[];aliases(o).forEach(function(id){var e=index[aliasKey(o,id)];if(e&&matches.indexOf(e)<0)matches.push(e);});
            assert(matches.length<=1,"Multiple existing elements match the same source aliases.");
            if(matches.length){var old=matches[0];o.id=old.id;o.key=old.key;o.aliases=unique(aliases(o).concat(aliases(old)));}
            assert(!seen[o.key],"Multiple collected objects map to the same existing identity.");seen[o.key]=true;
        });
    }
    return {PREFIX:PREFIX,OWNER:OWNER,TYPES:TYPES,RESOURCE_TYPES:RESOURCE_TYPES,assert:assert,text:text,lower:lower,
        guid:guid,envId:envId,objectId:objectId,key:key,readError:readError,stamp:stamp,unique:unique,
        options:options,dvOrigin:dvOrigin,safeMetadata:safeMetadata,addWarning:addWarning,attempt:attempt,
        properties:properties,scopeKey:scopeKey,aliases:aliases,sameSource:sameSource,preserveIdentities:preserveIdentities};
}());
if (typeof module !== "undefined") module.exports=PPCore;
