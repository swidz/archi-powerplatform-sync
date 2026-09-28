/* Desktop workflow: selection -> collection -> review -> apply. Cancellation before apply is read-only. */
var PPApp=(function(){
    "use strict";
    var C=PPCore,P=C.PREFIX;
    function stored(m,key,fallback){var value=m.prop(P+key);if(!value)return fallback;try{return JSON.parse(String(value));}catch(e){throw new Error("Invalid saved "+key+" configuration.");}}
    function run(mode,options){
        var auth=null,applying=false;
        try{
            C.assert(model.isSet(),"Select an Archi model before running this script.");
            console.show();var opts=C.options(options),io=PPCliJava.createIo();auth=PPAuth.create(io);
            var http=PPHttp.create(PPJava.io,auth,function(s){console.log(s);}),tenant=auth.tenantId;
            var oldTenant=C.text(model.prop(P+"TenantId")),same=!oldTenant||oldTenant===tenant;
            if(!same && !window.confirm("The signed-in tenant differs from this model's previous Power Platform session. Continue with a fresh environment selection?"))return;
            var saved=same?stored(model,"EnvironmentIds",[]):[],settings=same?stored(model,"EnvironmentSettings",{}):{};
            opts.environmentSettings=Object.assign({},settings,opts.environmentSettings);
            var discovery=PPInventory.create(http,tenant).discover();discovery.warnings.forEach(function(w){console.log("[WARNING] "+w);});
            C.assert(discovery.environments.length,"No environments could be discovered. Run the connection diagnostic and check your active Power Platform admin role.");
            var chosen=PPUI.environments(discovery,saved,opts.environmentSettings);if(chosen===null)return;
            chosen.forEach(function(e){opts.environmentSettings[e.id]={stage:e.stage||""};});
            function saveSelection(){model.prop(P+"TenantId",tenant);model.prop(P+"EnvironmentIds",JSON.stringify(chosen.map(function(e){return e.id;})));model.prop(P+"EnvironmentSettings",JSON.stringify(opts.environmentSettings));}
            if(mode==="select"){saveSelection();window.alert("Environment selection saved in the model. Save the model to retain it.");return;}
            var existing=PPArchi.elements(model),snapshot=PPService.collect(http,tenant,chosen,existing,opts,function(line){console.log(line);});
            snapshot.warnings=discovery.warnings.concat(snapshot.warnings);snapshot.partial=snapshot.partial||discovery.partial;
            var savedRoles=same?stored(model,"RoleSelectionKeys",[]):[],roleKeys=[];
            if(opts.includeRoles && snapshot.roleCandidates.length){var roles=PPUI.roles(snapshot.roleCandidates,savedRoles);if(roles===null)return;roleKeys=roles.map(function(r){return r.id;});}
            // Unreadable, missing and deselected environment scopes retain remembered role choices.
            var candidateKeys=snapshot.roleCandidates.map(function(c){return c.object.key;});
            roleKeys=C.unique(roleKeys.concat(savedRoles.filter(function(k){return candidateKeys.indexOf(k)<0;})));
            PPService.finish(snapshot,roleKeys);PPMetadata.create(http).enrich(snapshot,chosen,opts);snapshot.warnings.forEach(function(w){console.log("[WARNING] "+w);});
            if(mode==="export" || mode==="diagnose"){
                var counts={};snapshot.objects.forEach(function(o){counts[o.kind]=(counts[o.kind]||0)+1;});
                console.log(JSON.stringify({counts:counts,coverage:snapshot.coverage,dependencies:snapshot.edges.length,unresolved:snapshot.unresolved.length},null,2));
                if(mode==="export"){var file=window.promptSaveFile({title:"Save sanitized Power Platform inventory",filterExtensions:["*.json"]});if(file)PPJava.write(file,JSON.stringify(snapshot,null,2)+"\n");}
                window.alert("Read-only "+mode+" finished. See Scripts output for coverage and warnings.");return;
            }
            var plan=PPPlanner.plan(existing,PPArchi.relationships(model),snapshot,opts,PPArchi.isAllowed),prepared=PPArchi.prepare(model,plan);
            plan.operations.forEach(function(op){console.log("["+op.action.toUpperCase()+"] "+(op.name||op.key));});
            snapshot.unresolved.forEach(function(r){console.log("[UNRESOLVED] "+JSON.stringify(r));});
            if(!PPUI.preview(plan))return;
            applying=true;PPArchi.apply(model,plan,prepared);saveSelection();model.prop(P+"RoleSelectionKeys",JSON.stringify(roleKeys));
            console.log("Power Platform sync finished: "+JSON.stringify(plan.counts));
            window.alert("Power Platform synchronization "+(plan.partial?"completed with warnings":"complete")+".\n\nReview the model, then save and commit through your normal Archi/coArchi workflow.");
        }catch(e){console.log("[ERROR] "+C.text(e.message));window.alert("Power Platform operation stopped.\n\n"+C.text(e.message)+(applying?"\n\nModel application had started. Use Edit > Undo before retrying.":"\n\nThe model was not changed."));}
        finally{if(auth)auth.clear();}
    }
    return {run:run};
}());
