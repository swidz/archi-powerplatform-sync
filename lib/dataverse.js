/* Supported Dataverse v9.2 metadata collectors. Tables below are sources, never EA elements themselves. */
var PPDataverse=(function(){
    "use strict";
    var C=typeof PPCore!=="undefined"?PPCore:require("./core.js"),I=typeof PPInventory!=="undefined"?PPInventory:require("./inventory.js"),D=typeof PPDependencies!=="undefined"?PPDependencies:require("./dependencies.js");
    var QUERIES={
        modelapp:"appmodules?$select=appmoduleid,name,uniquename,description,statecode,ismanaged,createdon,modifiedon",
        canvasapp:"canvasapps?$select=canvasappid,name,displayname,description,ismanaged,createdtime,lastmodifiedtime,uniquecanvasappid,canvasapptype&$filter=canvasapptype%20eq%200",
        flow:"workflows?$select=workflowid,workflowidunique,name,description,category,type,statecode,ismanaged,createdon,modifiedon&$filter=category%20eq%205%20and%20type%20eq%201",
        agent:"bots?$select=botid,name,schemaname,statecode,ismanaged,createdon,modifiedon",
        role:"roles?$select=roleid,name,_roletemplateid_value,_parentrootroleid_value,_businessunitid_value,issytemgenerated,ismanaged,createdon,modifiedon"
    };
    var KEYS={modelapp:"appmoduleid",canvasapp:"canvasappid",flow:"workflowid",agent:"botid",role:"roleid"};
    function roleGroups(rows,opts,prefixes){
        var groups=Object.create(null);
        rows.forEach(function(r){var root=C.guid(r._parentrootroleid_value||r.roleid);(groups[root]||(groups[root]=[])).push(r);});
        return Object.keys(groups).map(function(id){
            var members=groups[id],r=members.filter(function(m){return C.lower(m.roleid)===id;})[0]||members[0];
            var aliases=members.map(function(m){return C.guid(m.roleid);});if(aliases.indexOf(id)<0)aliases.push(id);
            var included=opts.roleIds.some(function(k){return aliases.indexOf(k)>=0;}),excluded=opts.excludeRoleIds.some(function(k){return aliases.indexOf(k)>=0;});
            var standard=members.some(function(m){return !!m._roletemplateid_value || m.issytemgenerated===true;});
            var matchingPrefix=aliases.some(function(k){return (prefixes[k]||[]).some(function(p){return opts.rolePublisherPrefixes.indexOf(p)>=0;});});
            var classification=standard?"standard":matchingPrefix?"configured-publisher":r.ismanaged?"unclassified-managed":"custom-candidate";
            return {id:id,row:r,aliases:C.unique(aliases),businessUnitIds:C.unique(members.map(function(m){return m._businessunitid_value||"";}).filter(Boolean)),
                classification:included?"explicitly-included":classification,selected:!excluded&&(included||!standard&&(matchingPrefix||opts.includeUnclassifiedRoles)),candidate:!excluded&&(!standard||included)};
        });
    }
    function create(http,tenant,progress){
        function collect(env,snapshot,opts,existing){
            if(!env.url){snapshot.coverage.push({environmentId:env.id,collector:"dataverse",complete:false,status:env.hasDataverse?"URL unavailable":"not applicable"});return;}
            var api=C.dvOrigin(env.apiUrl||env.url)+"/api/data/v9.2/",resource=C.dvOrigin(env.url)+"/",readRows={},complete={},refs=[];
            var map=Object.create(null);snapshot.objects.forEach(function(o){if(o.environmentId===env.id)map[o.key]=o;});
            function upsert(kind,r){
                var id=C.guid(r[KEYS[kind]]),o=I.base(tenant,env,kind,id,r.displayname||r.name),old=map[o.key];
                o.aliases=C.unique([id].concat(kind==="flow"&&r.workflowidunique?[C.guid(r.workflowidunique)]:[]).concat(kind==="canvasapp"&&/^[0-9a-f-]{36}$/i.test(r.uniquecanvasappid||"")?[C.guid(r.uniquecanvasappid)]:[]));
                if(!old){var matches=Object.keys(map).map(function(k){return map[k];}).filter(function(x){return x.kind===kind&&x.aliases.some(function(a){return o.aliases.indexOf(a)>=0;});});C.assert(matches.length<=1,"Ambiguous Dataverse identity mapping.");old=matches[0];if(old){o.id=old.id;o.key=old.key;}}
                o.dataverseId=id;o.sourceType="dataverse/"+QUERIES[kind].split("?")[0];o.description=C.safeMetadata(r.description);o.logicalName=C.safeMetadata(r.uniquename||r.schemaname||r.name);
                o.createdAt=r.createdon||r.createdtime;o.modifiedAt=r.modifiedon||r.lastmodifiedtime;o.isManaged=r.ismanaged;
                if(r.statecode!==undefined)o.status=kind==="flow"?(r.statecode===1?"On":"Off"):String(r.statecode);
                if(kind==="canvasapp")o.url="https://make.powerapps.com/environments/"+env.id+"/apps/"+id;
                if(kind==="modelapp")o.url=env.url+"/main.aspx?appid="+id;
                if(kind==="flow")o.url="https://make.powerautomate.com/environments/"+env.id+"/flows/"+id+"/details";
                if(kind==="agent")o.url="https://copilotstudio.microsoft.com/environments/"+env.id+"/bots/"+id+"/overview";
                if(old){o.aliases=C.unique(old.aliases.concat(o.aliases));Object.keys(o).forEach(function(k){if(o[k]!==undefined)old[k]=o[k];});return old;}
                map[o.key]=o;snapshot.objects.push(o);return o;
            }
            function reference(owner,sourceKind,sourceId,targetKind,targetId,type,interaction,source,field){refs.push({owner:owner,environmentId:env.id,sourceKind:sourceKind,sourceId:sourceId,targetKind:targetKind,targetId:C.guid(targetId),type:type,interaction:interaction,evidenceSource:source,field:field});}
            function parseFlow(r){
                var owner=C.key(tenant,env.id,"flow",r.workflowid)+"|flow-definition";
                var result=C.attempt(snapshot,env.name+" flow definition "+r.workflowid,function(){
                    var parsed=D.flowReferences(r.clientdata);
                    parsed.references.forEach(function(x){reference(owner,"flow",r.workflowid,x.kind,x.id,x.type,x.interaction,x.source,x.field);});
                    if(parsed.unresolved){snapshot.unresolved.push({environmentId:env.id,sourceId:r.workflowid,reason:parsed.unresolved+" dynamic or unsupported child-flow references"});snapshot.protectedOwners[owner]=true;}
                });if(result.ok)snapshot.completedOwners[owner]=true;
            }
            function read(kind){
                var rows=[],seen=Object.create(null);
                if(progress)progress(env.name+": reading "+kind+" metadata");
                var query=QUERIES[kind];if(kind==="flow"&&opts.discoverDependencies)query=query.replace("&$filter",",clientdata&$filter");
                var result=C.attempt(snapshot,env.name+" "+kind,function(){http.pages(api+query,resource,function(page){page.forEach(function(r){
                    var id=C.guid(r[KEYS[kind]]);C.assert(!seen[id],"Duplicate Dataverse object ID.");seen[id]=true;rows.push(r);
                    if(kind!=="role")upsert(kind,r);
                    if(kind==="flow"&&opts.discoverDependencies){try{parseFlow(r);}finally{delete r.clientdata;}}
                });});});
                readRows[kind]=rows;complete[kind]=result.ok;snapshot.coverage.push({environmentId:env.id,collector:kind,complete:result.ok,authoritative:!!env.isUserSysAdmin});
            }
            ["modelapp","canvasapp","flow","agent"].forEach(read);
            if(opts.includeRoles){
                read("role");var prefixes=Object.create(null);
                if(opts.rolePublisherPrefixes.length && readRows.role.length){
                    C.attempt(snapshot,env.name+" role provenance",function(){http.pages(api+"solutioncomponents?$select=objectid&$filter=componenttype%20eq%2020&$expand=solutionid($select=uniquename;$expand=publisherid($select=customizationprefix))",resource,function(rows){rows.forEach(function(r){
                        var id=C.guid(r.objectid),sol=r.solutionid,p=sol&&sol.publisherid&&sol.publisherid.customizationprefix;
                        if(p && sol.uniquename!=="Active" && sol.uniquename!=="Default") (prefixes[id]||(prefixes[id]=[])).push(p);
                    });});});
                }
                roleGroups(readRows.role,opts,prefixes).forEach(function(g){
                    if(!g.candidate)return;
                    var o=I.base(tenant,env,"role",g.id,g.row.name);o.aliases=g.aliases;o.businessUnitIds=g.businessUnitIds;o.roleClassification=g.classification;o.isManaged=g.row.ismanaged;
                    o.dataverseId=g.id;o.sourceType="dataverse/roles";o.createdAt=g.row.createdon;o.modifiedAt=g.row.modifiedon;
                    snapshot.roleCandidates.push({object:o,selected:g.selected});
                });
            }
            if(opts.discoverDependencies){
                (readRows.modelapp||[]).forEach(function(r){
                    if(!opts.includeRoles)return;
                    var owner=C.key(tenant,env.id,"modelapp",r.appmoduleid)+"|app-roles";
                    var result=C.attempt(snapshot,env.name+" app role associations "+r.appmoduleid,function(){http.pages(api+"appmodules("+C.guid(r.appmoduleid)+")/appmoduleroles_association?$select=roleid",resource,function(rows){rows.forEach(function(role){
                        reference(owner,"role",role.roleid,"modelapp",r.appmoduleid,"association-relationship","grants-access","appmoduleroles_association","roleid");
                    });});});if(result.ok&&complete.role)snapshot.completedOwners[owner]=true;
                });
                if((readRows.agent||[]).length){
                    if(progress)progress(env.name+": reading agent-to-flow references");
                    var agentResult=C.attempt(snapshot,env.name+" agent tools",function(){
                        // Bulk metadata expansion avoids a request for every topic. Never read topic content.
                        http.pages(api+"botcomponents?$select=botcomponentid,_parentbotid_value&$filter=botcomponent_workflow/any()&$expand=botcomponent_workflow($select=workflowid),bot_botcomponent($select=botid)",resource,function(rows){rows.forEach(function(c){
                            var id=C.guid(c.botcomponentid),bots=c.bot_botcomponent||[],flows=c.botcomponent_workflow||[];
                            C.assert(Array.isArray(bots)&&Array.isArray(flows),"Invalid agent dependency expansion.");
                            if(c["bot_botcomponent@odata.nextLink"] || c["botcomponent_workflow@odata.nextLink"]){
                                // Read each full navigation collection if an expansion was truncated.
                                bots=[];flows=[];
                                http.pages(api+"botcomponents("+id+")/bot_botcomponent?$select=botid",resource,function(p){bots=bots.concat(p);});
                                http.pages(api+"botcomponents("+id+")/botcomponent_workflow?$select=workflowid",resource,function(p){flows=flows.concat(p);});
                            }
                            var agents=C.unique(bots.map(function(b){return C.guid(b.botid);}).concat(c._parentbotid_value?[C.guid(c._parentbotid_value)]:[]));
                            agents.forEach(function(agent){var owner=C.key(tenant,env.id,"agent",agent)+"|agent-flows";
                                flows.forEach(function(flow){reference(owner,"flow",flow.workflowid,"agent",agent,"serving-relationship","agent-flow-tool","botcomponent_workflow","botcomponentid:"+id);});});
                        });});
                    });
                    if(agentResult.ok)(readRows.agent||[]).forEach(function(r){snapshot.completedOwners[C.key(tenant,env.id,"agent",r.botid)+"|agent-flows"]=true;});
                }
                // Solution dependencies establish declared dependency only, not proof of runtime invocation.
                var dependencyOwner=env.id+"|solution-dependencies";
                if(progress)progress(env.name+": reading application/flow solution dependencies");
                var depResult=C.attempt(snapshot,env.name+" solution dependencies",function(){
                    http.pages(api+"dependencies?$select=dependentcomponentobjectid,dependentcomponenttype,requiredcomponentobjectid,requiredcomponenttype&$filter=(dependentcomponenttype%20eq%20300%20or%20dependentcomponenttype%20eq%2080%20or%20dependentcomponenttype%20eq%2029)%20and%20(requiredcomponenttype%20eq%20300%20or%20requiredcomponenttype%20eq%2080%20or%20requiredcomponenttype%20eq%2029)",resource,function(rows){
                        var kinds={300:"canvasapp",80:"modelapp",29:"flow"};
                        rows.forEach(function(r){reference(dependencyOwner,kinds[r.dependentcomponenttype],r.dependentcomponentobjectid,kinds[r.requiredcomponenttype],r.requiredcomponentobjectid,"association-relationship","declared-dependency","Dataverse dependency","requiredcomponentobjectid");});
                    });
                });if(depResult.ok)snapshot.completedOwners[dependencyOwner]=true;
            }
            // Missing objects need a current per-ID confirmation and an unrestricted organization read context.
            (existing||[]).filter(function(e){return e.tenantId===tenant&&e.environmentId===env.id&&KEYS[e.kind]&&!Object.keys(map).some(function(k){return C.sameSource(e,map[k]);});}).forEach(function(e){
                if(!complete[e.kind] || !env.isUserSysAdmin)return;
                if(e.kind==="role"&&(readRows.role||[]).some(function(r){return C.aliases(e).indexOf(C.guid(r.roleid))>=0||r._parentrootroleid_value&&C.aliases(e).indexOf(C.guid(r._parentrootroleid_value))>=0;}))return;
                // Inventory IDs are not necessarily Dataverse primary IDs (especially canvas apps).
                var dataverseId=e.dataverseId||(e.properties||{})[C.PREFIX+"DataverseId"];if(!dataverseId)return;
                var collection=QUERIES[e.kind].split("?")[0];
                try{var row=http.request("GET",api+collection+"("+C.guid(dataverseId)+")?$select="+KEYS[e.kind]+",name",resource);if(e.kind!=="role")upsert(e.kind,row);}
                catch(error){if(!error.readFailure)throw error;if(error.status===404)snapshot.confirmedMissing.push(e.key);else C.addWarning(snapshot,env.name+" absence check: "+error.message);}
            });
            snapshot.pendingReferences=snapshot.pendingReferences.concat(refs);
        }
        return {collect:collect};
    }
    function selectRoles(snapshot,selectedKeys){
        var wanted=Object.create(null);selectedKeys.forEach(function(k){wanted[k]=true;});
        snapshot.roleCandidates.forEach(function(c){if(wanted[c.object.key])snapshot.objects.push(c.object);});
        // Associations to deliberately excluded roles are outside synchronization scope, not errors.
        var allRoles=Object.create(null);snapshot.roleCandidates.forEach(function(c){c.object.aliases.forEach(function(id){allRoles[c.object.environmentId+"|"+id]=!!wanted[c.object.key];});});
        var filtered=snapshot.pendingReferences.filter(function(r){return r.sourceKind!=="role" || allRoles[r.environmentId+"|"+C.lower(r.sourceId)]===true;});
        D.resolve(snapshot,filtered);delete snapshot.pendingReferences;
    }
    return {create:create,roleGroups:roleGroups,selectRoles:selectRoles,QUERIES:QUERIES};
}());
if(typeof module!=="undefined")module.exports=PPDataverse;
