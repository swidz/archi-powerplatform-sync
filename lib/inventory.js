/* Environment discovery and filtered, allowlisted Resource Graph inventory. */
var PPInventory=(function(){
    "use strict";
    var C=typeof PPCore!=="undefined"?PPCore:require("./core.js");
    var ENV_URL="https://api.powerplatform.com/environmentmanagement/environments?api-version=2022-03-01-preview";
    function base(tenant,env,kind,id,name){
        id=kind==="environment"?C.envId(id):C.objectId(id);
        return {tenantId:tenant,environmentId:env.id,environmentName:env.name,kind:kind,id:id,name:C.safeMetadata(name||id),
            key:C.key(tenant,env.id,kind,id),aliases:[id],environmentType:env.type,region:env.region,stage:env.stage||""};
    }
    function create(http,tenant,progress){
        function discover(){
            var result={environments:[],warnings:[],partial:false,directComplete:false},index=Object.create(null);
            function add(e){
                C.assert(!index[e.id],"Duplicate environment ID in discovery.");index[e.id]=e;result.environments.push(e);
            }
            var read=C.attempt(result,"Environment API",function(){http.pages(ENV_URL,"https://api.powerplatform.com/",function(rows){rows.forEach(function(r){
                C.assert(!r.tenantId || C.guid(r.tenantId)===tenant,"Environment belongs to another tenant.");
                var id=C.envId(r.id),url=r.url?C.dvOrigin(r.url):"";
                // The environment API uses the Unix epoch as its non-deleted sentinel.
                var deleted=r.deletedDateTime && Date.parse(r.deletedDateTime)>0?r.deletedDateTime:"";
                add({id:id,name:C.safeMetadata(r.displayName||id),type:C.text(r.type),region:C.text(r.azureRegion||r.geo),
                    url:url,apiUrl:url,state:C.text(r.state),createdAt:r.createdDateTime,deletedAt:deleted,
                    hasDataverse:!!r.dataverseId,dataverseId:r.dataverseId||"",source:"environment-api",available:!deleted && C.lower(r.state)!=="disabled"});
            });});});
            result.directComplete=read.ok;
            if(!read.ok){
                C.attempt(result,"Resource Graph environment fallback",function(){http.graph("PowerPlatformResources | where type =~ 'microsoft.powerplatform/environments'",function(rows){rows.forEach(function(r){
                    if(r.tenantId)C.assert(C.guid(r.tenantId)===tenant,"Inventory belongs to another tenant.");
                    var id=C.envId(r.name),p=r.properties||{};
                    if(!index[id])add({id:id,name:C.safeMetadata(p.displayName||id),type:C.text(p.environmentType),region:C.text(r.location),url:"",apiUrl:"",source:"resource-graph",available:true});
                });});});
            }
            C.attempt(result,"Dataverse organization discovery",function(){http.pages("https://globaldisco.crm.dynamics.com/api/discovery/v2.0/Instances?$select=EnvironmentId,TenantId,Url,ApiUrl,IsUserSysAdmin,Id","https://globaldisco.crm.dynamics.com/",function(rows){rows.forEach(function(r){
                if(C.guid(r.TenantId)!==tenant)return;
                var e=index[C.envId(r.EnvironmentId)];if(!e)return;
                e.url=C.dvOrigin(r.Url);e.apiUrl=C.dvOrigin(r.ApiUrl);e.hasDataverse=true;e.dataverseId=C.guid(r.Id);e.isUserSysAdmin=!!r.IsUserSysAdmin;
            });});});
            result.environments.sort(function(a,b){return a.name.localeCompare(b.name)||a.id.localeCompare(b.id);});return result;
        }
        function collect(environments,snapshot){
            var known=Object.create(null);
            environments.forEach(function(e){
                var node=base(tenant,e,"environment",e.id,e.name);node.url=e.url;node.dataverseUrl=e.url;node.status=e.state;node.createdAt=e.createdAt;node.sourceType=e.source;
                snapshot.objects.push(node);known[node.key]=true;
                if(progress)progress("Inventory: "+e.name);
                var query="PowerPlatformResources | where tostring(properties.environmentId) =~ '"+C.envId(e.id)+"' | where type in~ ("+
                    Object.keys(C.RESOURCE_TYPES).filter(function(t){return C.RESOURCE_TYPES[t]!=="environment";}).map(function(t){return "'"+t+"'";}).join(",")+")";
                var read=C.attempt(snapshot,e.name+" inventory",function(){http.graph(query,function(rows){rows.forEach(function(r){
                    if(r.tenantId)C.assert(C.guid(r.tenantId)===tenant,"Resource belongs to another tenant.");
                    var p=r.properties||{},kind=C.RESOURCE_TYPES[C.lower(r.type)];
                    C.assert(C.envId(p.environmentId)===e.id && kind && kind!=="environment","Resource Graph returned an out-of-scope object.");
                    var id=r.name;
                    if(kind==="modelapp"&&p.appModuleId)id=p.appModuleId;
                    if(kind==="flow"&&p.workflowEntityId)id=p.workflowEntityId;
                    if(kind==="agent"&&(p.botId||p.name))id=p.botId||p.name;
                    var o=base(tenant,e,kind,id,p.displayName);C.assert(!known[o.key],"Duplicate inventory object identity.");known[o.key]=true;
                    o.aliases=C.unique([o.id,C.objectId(r.name)]);o.sourceType=C.lower(r.type);o.logicalName=p.logicalName||p.schemaName;
                    o.createdAt=p.createdAt;o.modifiedAt=p.lastModifiedAt;o.isManaged=p.isManaged;o.subtype=p.subType||C.text(r.type).split("/")[1];
                    // Cloud-flow ownerId currently represents creator; do not mislabel it as current owner.
                    if(kind!=="flow" && kind!=="modelapp")o.ownerId=p.ownerId;
                    if(p.isQuarantined!==undefined)o.status=p.isQuarantined?"Quarantined":"Available";
                    if(kind==="agent"&&p.lastPublishedAt)o.status="Published";
                    if(Array.isArray(p.channels))o.channels=p.channels.map(function(c){return C.safeMetadata(c,100);});
                    if(Array.isArray(p.powerPlatformConnectors))o.connectors=p.powerPlatformConnectors.map(function(c){return {id:C.safeMetadata(c.connectorId,200),operations:(c.operations||[]).map(function(op){return C.safeMetadata(op.operationId||op.OperationId,200);})};});
                    o.url="https://make.powerapps.com/environments/"+e.id+(kind==="flow"?"/flows/"+o.id:kind.indexOf("app")>=0?"/apps/"+o.id:"/home");
                    if(kind==="agent")o.url="https://copilotstudio.microsoft.com/environments/"+e.id+"/bots/"+o.id+"/overview";
                    snapshot.objects.push(o);
                });});});
                snapshot.coverage.push({environmentId:e.id,collector:"inventory",complete:read.ok,authoritative:false});
            });
        }
        return {discover:discover,collect:collect};
    }
    return {create:create,base:base,ENV_URL:ENV_URL};
}());
if(typeof module!=="undefined")module.exports=PPInventory;
