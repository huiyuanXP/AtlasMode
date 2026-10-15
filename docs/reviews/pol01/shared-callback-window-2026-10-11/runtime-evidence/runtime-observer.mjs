import fs from 'node:fs';import childProcess from 'node:child_process';import {syncBuiltinESMExports} from 'node:module';
const output='/tmp/atlas-pol01-callback-20261011-40dxsb3i/runtime-observer.jsonl';
const record=x=>fs.appendFileSync(output,JSON.stringify({utc:new Date().toISOString(),observerPid:process.pid,...x})+'\n');
record({event:'node-start',pid:process.pid,ppid:process.ppid,argv:process.argv,cwd:process.cwd()});
for(const name of ['spawn','fork']){
 const original=childProcess[name];childProcess[name]=function(...args){const child=Reflect.apply(original,this,args),opts=args.findLast(x=>x&&typeof x==='object'&&!Array.isArray(x));
 record({event:'child-spawn',method:name,pid:child.pid,command:args[0],args:Array.isArray(args[1])?args[1]:[],cwd:opts?.cwd??process.cwd(),port:opts?.env?.CODEMAP_PORT,data:opts?.env?.CODEMAP_DATA_DIR});
 child.once('exit',(code,signal)=>{
 record({event:'child-exit',pid:child.pid,code,signal});
 const data=opts?.env?.CODEMAP_DATA_DIR;
 if(typeof data==='string' && /^\/tmp\/atlas-e2e-[^/]+\/data$/.test(data)){
  const root=data.slice(0,-5),archive='/tmp/atlas-pol01-callback-20261011-40dxsb3i/retained-planning-fixtures/'+root.split('/').at(-1)+'-pid'+child.pid;
  try{fs.cpSync(root,archive,{recursive:true});record({event:'owned-fixture-archived-before-original-test-cleanup',pid:child.pid,root,archive});}catch(e){record({event:'owned-fixture-archive-error',pid:child.pid,message:String(e)});}
 }
 });return child;};
}
syncBuiltinESMExports();process.once('exit',code=>record({event:'node-exit',pid:process.pid,code}));
