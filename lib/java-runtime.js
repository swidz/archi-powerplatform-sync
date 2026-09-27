/* Java standard library transport; no Node, PowerShell or extra JARs at runtime. */
var PPJava=(function(){
    "use strict";
    var Files=Java.type("java.nio.file.Files"),Paths=Java.type("java.nio.file.Paths"),UTF8=Java.type("java.nio.charset.StandardCharsets").UTF_8;
    var URI=Java.type("java.net.URI"),JString=Java.type("java.lang.String");
    function request(method,url,headers,body){
        var c=null,s=null;
        try {
            c=URI.create(String(url)).toURL().openConnection();c.setConnectTimeout(30000);c.setReadTimeout(90000);
            c.setInstanceFollowRedirects(false);c.setRequestMethod(method);
            Object.keys(headers).forEach(function(k){c.setRequestProperty(k,String(headers[k]));});
            if(body!==null && body!==undefined){
                var bytes=new JString(String(body)).getBytes(UTF8);c.setDoOutput(true);c.setFixedLengthStreamingMode(bytes.length);
                var out=c.getOutputStream();try{out.write(bytes);}finally{out.close();}
            }
            var status=Number(c.getResponseCode());s=status>=400?c.getErrorStream():c.getInputStream();
            var raw=s?s.readNBytes(32*1024*1024+1):[];
            if(raw.length>32*1024*1024)throw new Error("Response exceeds maximum size.");
            var data;
            try{data=raw.length?JSON.parse(String(new JString(raw,UTF8))):null;}catch(e){data=null;}
            var h={};["retry-after","x-ms-retry-after-ms"].forEach(function(k){var v=c.getHeaderField(k);if(v!==null)h[k]=String(v);});
            return {status:status,body:data,headers:h};
        } finally {if(s)try{s.close();}catch(e){}if(c)c.disconnect();}
    }
    return {io:{request:request,now:function(){return Date.now();},sleep:function(ms){Java.type("java.lang.Thread").sleep(Math.ceil(ms));}},
        write:function(file,value){Files.writeString(Paths.get(String(file)),String(value),UTF8);},
        read:function(file){return String(Files.readString(Paths.get(String(file)),UTF8));}};
}());
