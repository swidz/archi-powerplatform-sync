const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');let count=0;
for(const dir of ['lib','scripts','config','tests','tools'])for(const f of fs.readdirSync(path.join(root,dir))){if(!/\.(js|ajs|cjs)$/.test(f))continue;new vm.Script(fs.readFileSync(path.join(root,dir,f),'utf8'),{filename:dir+'/'+f});count++;}
console.log(`Syntax verified for ${count} runtime, tooling and test files.`);
