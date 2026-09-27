/* Context-sensitive entry points: environment discovery, then solution/component retrieval. */
var PPScopedApp=(function(){
    "use strict";
    var C=PPCore,P=C.PREFIX;
    function saved(key,fallback){var raw=model.prop(P+key);if(!raw)return fallback;try{return JSON.parse(String(raw));}catch(e){throw new Error("Invalid saved "+key+" configuration.");}}
    function run(action,options,selected){
        var auth=null,applying=false;
        try{
            C.assert(model.isSet(),"Select an Archi model before running this script.");
            var context=action==="environments"?null:PPArchi.context(selected,action==="solutions"?"environment":"solution");
            console.show();var opts=C.options(options);auth=PPAuth.create(PPCliJava.createIo());
            if(context)C.assert(context.tenantId===auth.tenantId,"The selected object belongs to another tenant. Sign in to its tenant before retrieving components.");
            var http=PPHttp.create(PPJava.io,auth,function(line){console.log(line);}),tenant=auth.tenantId;
            var same=!model.prop(P+"TenantId")||C.text(model.prop(P+"TenantId"))===tenant;
            opts.environmentSettings=Object.assign({},same?saved("EnvironmentSettings",{}):{},opts.environmentSettings);
            var discovery=PPInventory.create(http,tenant).discover(),collector=PPScoped.create(http,tenant,function(line){console.log(line);}),existing=PPArchi.elements(model),snapshot,chosen;
            if(action==="environments"){
                C.assert(discovery.environments.length,"No environments could be discovered. Verify the CLI sign-in and administrator access.");
                chosen=PPUI.environments(discovery,same?saved("EnvironmentIds",[]):[],opts.environmentSettings);if(chosen===null)return;
                snapshot=PPScoped.environments(tenant,chosen);C.preserveIdentities(snapshot,existing);
            }else{
                var env=discovery.environments.filter(function(e){return e.id===context.environmentId;})[0];
                C.assert(env&&env.available,"The selected environment is unavailable to this session. Refresh get-environments and check access.");
                env=Object.assign({},env,{stage:(opts.environmentSettings[env.id]||{}).stage||""});
                if(action==="solutions"){
                    var candidates=collector.solutions(env,opts),previous=existing.filter(function(e){return e.tenantId===tenant&&e.environmentId===env.id&&e.kind==="solution"&&e.properties.IsDeleted!=="yes";}).map(function(e){return e.id;});
                    var solutions=PPUI.solutions(env,candidates,previous);if(solutions===null)return;
                    snapshot=collector.selectedSolutions(env,solutions,existing);
                }else snapshot=collector.collect(env,context.solutionId,action,existing,opts);
            }
            snapshot.warnings=discovery.warnings.concat(snapshot.warnings);snapshot.partial=discovery.partial||snapshot.partial;
            snapshot.warnings.forEach(function(w){console.log("[WARNING] "+w);});snapshot.unresolved.forEach(function(r){console.log("[UNRESOLVED] "+JSON.stringify(r));});
            var plan=PPPlanner.plan(existing,PPArchi.relationships(model),snapshot,opts,PPArchi.isAllowed),prepared=PPArchi.prepare(model,plan);
            plan.operations.forEach(function(op){console.log("["+op.action.toUpperCase()+"] "+(op.name||op.key));});
            if(!PPUI.preview(plan))return;
            applying=true;PPArchi.apply(model,plan,prepared);
            if(action==="environments"){
                chosen.forEach(function(e){opts.environmentSettings[e.id]={stage:e.stage||""};});
                model.prop(P+"TenantId",tenant);model.prop(P+"EnvironmentIds",JSON.stringify(chosen.map(function(e){return e.id;})));model.prop(P+"EnvironmentSettings",JSON.stringify(opts.environmentSettings));
            }
            console.log("get-"+action+" finished: "+JSON.stringify(plan.counts));
            window.alert("get-"+action+" completed"+(plan.partial?" with warnings":"")+".\n\n"+
                (action==="environments"?"Select an environment Node and run get-solutions.":action==="solutions"?"Select a solution Application Component and run a component retrieval script.":"Solution membership and readable metadata have been updated.")+"\n\nReview and save the model through your normal Archi workflow.");
        }catch(e){console.log("[ERROR] "+C.text(e.message));window.alert("Power Platform retrieval stopped.\n\n"+C.text(e.message)+(applying?"\n\nUse Edit > Undo before retrying.":"\n\nThe model was not changed."));}
        finally{if(auth)auth.clear();}
    }
    return {run:run};
}());
