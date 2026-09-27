/* Validate model-tree or diagram selection without falling back to a stale remembered context. */
var PPContext=(function(){
    "use strict";
    var C=typeof PPCore!=="undefined"?PPCore:require("./core.js");
    function resolve(items,level){
        C.assert(items.length,"Select an imported "+(level==="solution"?"solution":"environment")+" in the model tree or a diagram first.");
        var contexts=Object.create(null);
        items.forEach(function(e){
            C.assert(e.managed,"The selection contains an object not managed by Power Platform Sync.");
            var tenant=C.guid(e.tenantId),environment=C.envId(e.environmentId),id=tenant+"|"+environment;
            if(level==="solution"){C.assert(e.kind==="solution","Select a solution Application Component before retrieving its components.");id+="|"+C.guid(e.id);}
            contexts[id]={tenantId:tenant,environmentId:environment,solutionId:level==="solution"?C.guid(e.id):undefined};
        });
        var keys=Object.keys(contexts);C.assert(keys.length===1,"Select exactly one "+level+" context.");return contexts[keys[0]];
    }
    return {resolve:resolve};
}());
if(typeof module!=="undefined")module.exports=PPContext;
