/* Collection orchestration shared by the desktop workflow and live diagnostics. */
var PPService=(function(){
    "use strict";
    var C=typeof PPCore!=="undefined"?PPCore:require("./core.js"),I=typeof PPInventory!=="undefined"?PPInventory:require("./inventory.js"),DV=typeof PPDataverse!=="undefined"?PPDataverse:require("./dataverse.js");
    function collect(http,tenant,environments,existing,options,progress){
        var opts=C.options(options),ids=environments.map(function(e){return C.envId(e.id);});
        C.assert(ids.length && new Set(ids).size===ids.length,"Select at least one distinct environment.");
        var s={schemaVersion:1,tenantId:tenant,environmentIds:ids,objects:[],edges:[],warnings:[],coverage:[],partial:false,
            confirmedMissing:[],unresolved:[],completedOwners:{},protectedOwners:{},roleCandidates:[],pendingReferences:[]};
        environments=environments.map(function(e){C.assert(e.available!==false,"Selected environment is unavailable.");return Object.assign({},e,{stage:(opts.environmentSettings[e.id]||{}).stage||""});});
        I.create(http,tenant,progress).collect(environments,s);
        var dv=DV.create(http,tenant,progress);environments.forEach(function(e){dv.collect(e,s,opts,existing);});
        C.preserveIdentities(s,existing||[]);s.collectedAt=new Date().toISOString();return s;
    }
    function finish(snapshot,roleKeys){
        snapshot.roleSelectionKeys=roleKeys.slice();DV.selectRoles(snapshot,roleKeys);
        if(snapshot.unresolved.length){snapshot.partial=true;snapshot.warnings.push(snapshot.unresolved.length+" dependency references are unresolved; prior evidence for affected objects is preserved.");}
        return snapshot;
    }
    return {collect:collect,finish:finish};
}());
if(typeof module!=="undefined")module.exports=PPService;
