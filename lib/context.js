/* Validate model-tree or diagram selection without falling back to a stale remembered context. */
var PPContext=(function(){
    "use strict";
    var C=typeof PPCore!=="undefined"?PPCore:require("./core.js");
    function resolve(items,level){
        C.assert(level==="solution"||level==="environment","Unknown selection context type.");
        var required=level==="solution"?"solution Application Components":"environment Nodes";
        C.assert(items.length,"Select one or more imported "+required+" in the model tree or a diagram first.");
        var contexts=Object.create(null),tenantId;
        items.forEach(function(e){
            var label='Selected item "'+C.safeMetadata(e.name||e.id||"unnamed")+'": ';
            C.assert(e.managed,label+"not managed by Power Platform Sync. Select only imported "+required+".");
            C.assert(e.kind===level&&e.base===C.TYPES[level].base,label+"wrong type. Select only imported "+required+".");
            C.assert(e.inModel!==false,label+"does not belong to the active model.");
            C.assert(!e.deleted,label+"is marked deleted. Refresh it before using it as a context.");
            var tenant=C.guid(e.tenantId),environment=C.envId(e.environmentId),id=tenant+"|"+environment;
            C.assert(e.key===C.key(tenant,environment,level,e.id),label+"has inconsistent Power Platform identity properties.");
            C.assert(level!=="environment"||C.envId(e.id)===environment,label+"has inconsistent environment identity properties.");
            C.assert(!tenantId||tenantId===tenant,"All selected contexts must belong to the same tenant.");tenantId=tenant;
            if(level==="solution")id+="|"+C.guid(e.id);
            contexts[id]={tenantId:tenant,environmentId:environment,solutionId:level==="solution"?C.guid(e.id):undefined,name:C.safeMetadata(e.name)};
        });
        return Object.keys(contexts).map(function(key){return contexts[key];});
    }
    return {resolve:resolve};
}());
if(typeof module!=="undefined")module.exports=PPContext;
