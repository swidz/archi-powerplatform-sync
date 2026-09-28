/* Context-sensitive entry points: environment discovery, then solution/component retrieval. */
var PPScopedApp=(function(){
    "use strict";
    var C=PPCore,P=C.PREFIX;
    function saved(key,fallback){var raw=model.prop(P+key);if(!raw)return fallback;try{return JSON.parse(String(raw));}catch(e){throw new Error("Invalid saved "+key+" configuration.");}}
    function run(action,options,selected){
        var auth=null,applying=false;
        try{
            C.assert(model.isSet(),"Select an Archi model before running this script.");
            C.assert(action==="environments"||action==="solutions"||PPScoped.GROUPS[action],"Unknown retrieval script.");
            var contexts=action==="environments"?[]:PPArchi.context(selected,action==="solutions"?"environment":action==="plugins"?"plugins":"solution",model);
            console.show();var opts=C.options(options);auth=PPAuth.create(PPCliJava.createIo());
            contexts.forEach(function(context){C.assert(context.tenantId===auth.tenantId,"A selected object belongs to another tenant. Sign in to its tenant before retrieving components.");});
            var http=PPHttp.create(PPJava.io,auth,function(line){console.log(line);}),tenant=auth.tenantId;
            var same=!model.prop(P+"TenantId")||C.text(model.prop(P+"TenantId"))===tenant;
            opts.environmentSettings=Object.assign({},same?saved("EnvironmentSettings",{}):{},opts.environmentSettings);
            var discovery=PPInventory.create(http,tenant).discover(),collector=PPScoped.create(http,tenant,function(line){console.log(line);}),existing=PPArchi.elements(model),snapshot,chosen;
            var metadata=PPMetadata.create(http,function(line){console.log(line);});
            if(action==="environments"){
                C.assert(discovery.environments.length,"No environments could be discovered. Verify the CLI sign-in and administrator access.");
                chosen=PPUI.environments(discovery,same?saved("EnvironmentIds",[]):[],opts.environmentSettings);if(chosen===null)return;
                snapshot=PPScoped.environments(tenant,chosen);C.preserveIdentities(snapshot,existing);
            }else{
                var requests=contexts.map(function(context){
                    var env=discovery.environments.filter(function(e){return e.id===context.environmentId;})[0];
                    C.assert(env&&env.available,"Selected environment "+context.environmentId+" is unavailable to this session. Refresh get-environments and check access.");
                    C.assert(env.url,"Selected environment "+env.name+" has no readable Dataverse URL. Solutions require Dataverse.");C.dvOrigin(env.url);C.dvOrigin(env.apiUrl||env.url);
                    return {environment:Object.assign({},env,{stage:(opts.environmentSettings[env.id]||{}).stage||""}),solutionId:context.solutionId,tableId:context.tableId};
                });
                console.log("get-"+action+": "+requests.length+" selected "+(action==="solutions"?"environment(s)":contexts[0].tableId?"table(s)":"solution(s)"));
                if(action==="solutions"){
                    var envs=requests.map(function(r){return r.environment;}),envIds=envs.map(function(e){return e.id;}),candidates=[];
                    envs.forEach(function(env){candidates=candidates.concat(collector.solutions(env,opts));});
                    var previous=existing.filter(function(e){return e.tenantId===tenant&&envIds.indexOf(e.environmentId)>=0&&e.kind==="solution"&&e.properties.IsDeleted!=="yes";}).map(function(e){return e.key;});
                    var solutions=PPUI.solutions(envs,candidates,previous);if(solutions===null)return;
                    snapshot=PPScoped.merge(envs.map(function(env){return collector.selectedSolutions(env,solutions.filter(function(o){return o.environmentId===env.id;}),existing);}),existing);
                }else{
                    snapshot=collector.collectMany(requests,action,existing,opts);
                    // Resolve readable labels for the picker without collecting table fields or extended properties.
                    metadata.localize(snapshot,discovery.environments,opts,true);
                    chosen=PPUI.components(action,PPScoped.candidates(snapshot,action),existing);
                    if(chosen===null||!chosen.length)return;
                    var keys=chosen.map(function(o){return o.key;}),tableKeys=action==="plugins"?PPScoped.relatedTables(snapshot,keys).map(function(o){return o.key;}):[];
                    snapshot=PPScoped.selectObjects(snapshot,action,keys,existing,tableKeys);
                }
            }
            metadata.enrich(snapshot,discovery.environments,opts);
            snapshot.warnings=discovery.warnings.concat(snapshot.warnings);snapshot.partial=discovery.partial||snapshot.partial;
            snapshot.warnings.forEach(function(w){console.log("[WARNING] "+w);});snapshot.unresolved.forEach(function(r){console.log("[UNRESOLVED] "+JSON.stringify(r));});
            var plan=PPPlanner.plan(existing,PPArchi.relationships(model),snapshot,opts,PPArchi.isAllowed),prepared=PPArchi.prepare(model,plan);
            (plan.warnings||[]).filter(function(w){return snapshot.warnings.indexOf(w)<0;}).forEach(function(w){console.log("[WARNING] "+w);});
            plan.operations.forEach(function(op){console.log("["+op.action.toUpperCase()+"] "+(op.name||op.key)+(op.previousBase?" ("+op.previousBase+" -> "+op.base+")":""));});
            if(!PPUI.preview(plan))return;
            applying=true;PPArchi.apply(model,plan,prepared);
            if(action==="environments"){
                chosen.forEach(function(e){opts.environmentSettings[e.id]={stage:e.stage||""};});
                model.prop(P+"TenantId",tenant);model.prop(P+"EnvironmentIds",JSON.stringify(chosen.map(function(e){return e.id;})));model.prop(P+"EnvironmentSettings",JSON.stringify(opts.environmentSettings));
            }
            console.log("get-"+action+" finished: "+JSON.stringify(plan.counts));
            window.alert("get-"+action+" completed"+(plan.partial?" with warnings":"")+".\n\n"+
                (action==="environments"?"Select one or more environment Nodes and run get-solutions.":action==="solutions"?"Select one or more solution Application Components and run a component retrieval script.":"Solution membership and readable metadata have been updated.")+"\n\nReview and save the model through your normal Archi workflow.");
        }catch(e){console.log("[ERROR] "+C.text(e.message));window.alert("Power Platform retrieval stopped.\n\n"+C.text(e.message)+(applying?"\n\nUse Edit > Undo before retrying.":"\n\nThe model was not changed."));}
        finally{if(auth)auth.clear();}
    }
    return {run:run};
}());
