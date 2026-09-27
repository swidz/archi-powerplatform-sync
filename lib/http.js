/* Read-only transport policy, bounded retries, and strict pagination origin/path checks. */
var PPHttp=(function(){
    "use strict";
    var C=typeof PPCore!=="undefined"?PPCore:require("./core.js");
    function origin(url){var m=/^(https:\/\/[^/?#]+)(\/[^#]*)?$/.exec(url);C.assert(m && !/@|\\/.test(m[1]),"Invalid API URL.");return m[1].toLowerCase();}
    function create(io,auth,progress){
        function request(method,url,resource,body){
            C.assert(method==="GET" || method==="POST" && url==="https://management.azure.com/providers/Microsoft.ResourceGraph/resources?api-version=2022-10-01","Only metadata reads are allowed.");
            var host=origin(url), allowed=resource.replace(/\/$/,"");
            if(resource.indexOf("crm")>=0 && host!==allowed) C.assert(host===allowed.replace(/\.crm/,".api.crm"),"Token target mismatch.");
            else C.assert(host===allowed,"Token target mismatch.");
            var refreshed=false;
            for(var attempt=0;attempt<4;attempt++){
                var token=auth.token(resource,refreshed),r;
                try {r=io.request(method,url,{Authorization:"Bearer "+token,"Content-Type":"application/json",Accept:"application/json","OData-MaxVersion":"4.0","OData-Version":"4.0","Prefer":"odata.maxpagesize=1000"},body===undefined?null:JSON.stringify(body));}
                catch(e){throw C.readError("Network, timeout, proxy, or TLS failure.");} finally {token=null;}
                if(r.status===401 && !refreshed){refreshed=true;continue;}
                if((r.status===429 || r.status>=500) && attempt<3){
                    var seconds=Number((r.headers||{})["retry-after"]),ms=Number((r.headers||{})["x-ms-retry-after-ms"]);
                    var delay=isFinite(ms)&&ms>0?ms:isFinite(seconds)&&seconds>0?seconds*1000:Math.pow(2,attempt)*1000;
                    if(progress)progress("API throttled or temporarily unavailable; retrying.");io.sleep(Math.min(delay,30000));continue;
                }
                if(r.status<200 || r.status>=300){
                    var code=r.body && r.body.error && C.text(r.body.error.code);
                    code=code && /^[A-Za-z0-9_.-]{1,100}$/.test(code)?" ("+code+")":"";
                    throw C.readError("HTTP "+r.status+code+". "+(r.status===403?"Check active admin role and Dataverse read privileges.":"Metadata read did not complete."),r.status);
                }
                C.assert(r.body && typeof r.body==="object" && !Array.isArray(r.body),"API returned invalid JSON object.");
                return r.body;
            }
            throw C.readError("Authentication retry limit reached.");
        }
        function pages(url,resource,onPage){
            var first=url.split("?")[0],seen=Object.create(null),count=0;
            while(url){
                C.assert(url.split("?")[0]===first && origin(url)===origin(first),"Rejected pagination URL outside the collection.");
                C.assert(!seen[url] && ++count<=10000,"Repeated or excessive pagination.");seen[url]=true;
                var body=request("GET",url,resource);
                C.assert(Array.isArray(body.value),"API collection has no value array.");onPage(body.value);
                var next=body["@odata.nextLink"]||body.nextLink||"";
                C.assert(typeof next==="string","Invalid pagination link.");
                if(next.charAt(0)==="/")next=origin(first)+next;
                url=next;
            }
        }
        function graph(query,onPage){
            var skip="",seen=Object.create(null),page=0;
            do {
                C.assert(++page<=10000 && !seen[skip],"Repeated Resource Graph pagination.");seen[skip]=true;
                var opts={$top:1000,resultFormat:"objectArray"};if(skip)opts.$skipToken=skip;
                var b=request("POST","https://management.azure.com/providers/Microsoft.ResourceGraph/resources?api-version=2022-10-01","https://management.azure.com/",{query:query,options:opts});
                C.assert(Array.isArray(b.data),"Resource Graph did not return objectArray data.");onPage(b.data);
                skip=b.$skipToken||""; C.assert(typeof skip==="string","Invalid Resource Graph continuation token.");
                if((b.resultTruncated===true || b.resultTruncated==="true")&&!skip)throw C.readError("Resource Graph response was truncated without a continuation token.");
            }while(skip);
        }
        return {request:request,pages:pages,graph:graph};
    }
    return {create:create,origin:origin};
}());
if(typeof module!=="undefined")module.exports=PPHttp;
