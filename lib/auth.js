/* Reuses Azure CLI's interactive user session; never creates registrations or modifies global CLI settings. */
var PPAuth = (function () {
    "use strict";
    var C=typeof PPCore!=="undefined"?PPCore:require("./core.js");
    function audience(value) {
        if(["https://management.azure.com/","https://api.powerplatform.com/","https://globaldisco.crm.dynamics.com/"].indexOf(value)>=0)return value;
        return C.dvOrigin(value)+"/";
    }
    function command(executable,args,windows,processor) {
        C.assert(typeof executable==="string" && !/["\r\n\0]/.test(executable),"Invalid Azure CLI path.");
        C.assert(Array.isArray(args) && args.every(function(a){return typeof a==="string" && /^[A-Za-z0-9:/.=_-]+$/.test(a);}),"Invalid Azure CLI arguments.");
        if(windows) {
            C.assert(/^(?:[A-Za-z]:[\\/]|\\\\)/.test(executable) && !/[%!&^]/.test(executable),"Use a safe absolute Azure CLI path.");
            if(/\.(cmd|bat)$/i.test(executable)) {
                C.assert(processor && /^[A-Za-z]:[\\/]/.test(processor) && !/["%\r\n\0]/.test(processor),"Invalid command processor.");
                return [processor,"/d","/s","/v:off","/c",'""'+executable+'" '+args.join(" ")+'"'];
            }
        } else C.assert(executable.charAt(0)==="/","Use an absolute Azure CLI path.");
        return [executable].concat(args);
    }
    function create(io) {
        var cache=Object.create(null),account;
        function json(args) {
            var r;
            try {r=io.run(args.concat(["--output","json","--only-show-errors"]));}
            catch(e){throw C.readError("Azure CLI could not run. Check its installation and sign in with az login.");}
            if(!r || r.exitCode!==0) {
                var code=r && /AADSTS\d+/.exec(r.stderr||"");
                if(r){r.stdout="";r.stderr="";}
                throw C.readError("Azure CLI authentication failed"+(code?" ("+code[0]+")":"")+". Run az login --allow-no-subscriptions in a terminal and retry.");
            }
            try {return JSON.parse(r.stdout);} catch(e){throw C.readError("Azure CLI returned an unreadable authentication response.");} finally {r.stdout="";r.stderr="";}
        }
        account=json(["account","show"]);
        C.assert(account && account.environmentName==="AzureCloud","Only Azure public cloud is currently supported.");
        C.assert(account.user && account.user.type==="user","Use an interactive Azure CLI user session.");
        var tenant=C.guid(account.tenantId);
        function token(resource,force) {
            resource=audience(resource);
            var current=cache[resource];
            if(!force && current && current.expiresAt>io.now()+120000)return current.value;
            var r=json(["account","get-access-token","--tenant",tenant,"--resource",resource]);
            try {
                C.assert(C.guid(r.tenant)===tenant,"CLI token belongs to another tenant.");
                C.assert(C.lower(r.tokenType)==="bearer" && typeof r.accessToken==="string" && r.accessToken.length>0,"Invalid CLI bearer token.");
                C.assert(/^\d+$/.test(String(r.expires_on)),"Azure CLI 2.54+ is required (UTC expires_on).");
                var expiresAt=Number(r.expires_on)*1000;
                if(expiresAt<=io.now()+60000)throw C.readError("CLI token is expired or near expiry; sign in again.");
                cache[resource]={value:r.accessToken,expiresAt:expiresAt}; return r.accessToken;
            } finally {r.accessToken=null;}
        }
        return {tenantId:tenant,token:token,clear:function(){Object.keys(cache).forEach(function(k){cache[k].value=null;delete cache[k];});account=null;}};
    }
    return {create:create,command:command,audience:audience};
}());
if(typeof module!=="undefined")module.exports=PPAuth;
