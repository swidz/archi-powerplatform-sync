/* Synthetic Dataverse server shared by Node and the real Archi smoke test. */
var PPPluginFixture=(function(){
    var C=typeof PPCore!=="undefined"?PPCore:require("../lib/core.js");
    var tenant="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",env={id:"11111111-1111-1111-1111-111111111111",name:"Test",url:"https://test.crm.dynamics.com",available:true};
    var ids={solution:"88888888-8888-8888-8888-888888888888",solution2:"99999999-9999-9999-9999-999999999999",plugin:"33333333-3333-3333-3333-333333333333",assembly:"44444444-4444-4444-4444-444444444444",table:"55555555-5555-5555-5555-555555555555",table2:"66666666-6666-6666-6666-666666666666",step:"77777777-7777-7777-7777-777777777777",step2:"aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"};
    function create(options){
        var opts=options||{},calls=[],current=ids.solution;
        var plugin={plugintypeid:ids.plugin,typename:"Contoso.AccountPlugin",name:"Account plug-in",isworkflowactivity:!!opts.workflowActivity,_pluginassemblyid_value:ids.assembly,ismanaged:false,
            pluginassemblyid:{pluginassemblyid:ids.assembly,name:"Contoso.Plugins",version:"1.2.0.0",isolationmode:2,content:"SECRET-ASSEMBLY"}};
        var tables=[{MetadataId:ids.table,LogicalName:"account",SchemaName:"Account"},{MetadataId:ids.table2,LogicalName:"contact",SchemaName:"Contact"}];
        var steps=[{sdkmessageprocessingstepid:ids.step,name:"Update account",stage:20,mode:0,statecode:0,rank:1,filteringattributes:"name",configuration:"SECRET-CONFIG",eventhandler_plugintype:{plugintypeid:ids.plugin},sdkmessagefilterid:{primaryobjecttypecode:"account"},sdkmessageid:{name:"Update"}},
            {sdkmessageprocessingstepid:ids.step2,name:"Read contact",stage:40,mode:1,statecode:1,rank:2,eventhandler_plugintype:{plugintypeid:ids.plugin},sdkmessagefilterid:{primaryobjecttypecode:"contact"},sdkmessageid:{name:"Retrieve"}}];
        if(opts.global)steps[0].sdkmessagefilterid=null;if(opts.empty)steps=[];
        var http={request:function(method,url){calls.push(url);if(url.indexOf("solutions(")>=0){current=url.match(/solutions\(([^)]+)\)/)[1];return {solutionid:current,friendlyname:"Solution "+current};}
            var id=url.match(/EntityDefinitions\(([^)]+)\)/)[1];return tables.filter(function(t){return t.MetadataId===id;})[0];
        },pages:function(url,resource,callback){
            calls.push(url);var decoded=decodeURIComponent(url),path=decoded.split("/api/data/v9.2/")[1],filter=decoded.split("&$filter=")[1]||"",collection=path.split("?")[0],rows=[];
            if(opts.fail===collection)throw C.readError("Denied",403);
            if(collection==="solutioncomponents")rows=[{componenttype:opts.memberType||90,objectid:opts.memberType===91?ids.assembly:opts.memberType===92?ids.step:ids.plugin,rootcomponentbehavior:opts.shell?2:0,_solutionid_value:current}];
            if(collection==="plugintypes")rows=opts.missingPlugin?[]:[plugin];
            if(collection==="sdkmessageprocessingsteps")rows=steps.filter(function(s){
                if(filter.indexOf("primaryobjecttypecode")>=0)return filter.indexOf("'"+(s.sdkmessagefilterid||{}).primaryobjecttypecode+"'")>=0;
                if(filter.indexOf("sdkmessageprocessingstepid eq")>=0)return filter.indexOf(s.sdkmessageprocessingstepid)>=0;
                return true;
            });
            if(collection==="EntityDefinitions")rows=tables.filter(function(t){return filter.indexOf("'"+t.LogicalName+"'")>=0;});
            if(opts.missingTable&&collection==="EntityDefinitions")rows=[];
            callback(JSON.parse(JSON.stringify(rows)));
        }};
        return {http:http,calls:calls,steps:steps,plugin:plugin,tables:tables};
    }
    return {create:create,tenant:tenant,env:env,ids:ids};
}());
if(typeof module!=="undefined")module.exports=PPPluginFixture;
