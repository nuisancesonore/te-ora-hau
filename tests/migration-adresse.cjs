const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const {stripTypeScriptTypes}=require('node:module');
(async()=>{
 let n=0;const root=path.resolve(__dirname,'..');
 for(const name of ['diffusion-email','rappel-cotisation']){
  let handler;const sandbox={Request,Response,console,Date,Set,
   Deno:{env:{get:()=>''},serve:f=>{handler=f}},createClient:()=>({})};
  const text=fs.readFileSync(path.join(root,'supabase/functions',name,'index.ts'),'utf8').replace(/^import .*;$/mg,'');
  vm.runInNewContext(stripTypeScriptTypes(text),sandbox);
  for(const origin of ['https://teorahau.github.io','https://nuisancesonore.github.io']){
   const r=await handler(new Request('https://example.invalid',{method:'OPTIONS',headers:{Origin:origin}}));
   assert.equal(r.status,200);assert.equal(r.headers.get('Access-Control-Allow-Origin'),origin);assert.equal(r.headers.get('Vary'),'Origin');n+=3;
  }
  const r=await handler(new Request('https://example.invalid',{method:'OPTIONS',headers:{Origin:'https://example.invalid'}}));assert.equal(r.status,403);n++;
  assert.notEqual(r.headers.get('Access-Control-Allow-Origin'),'https://example.invalid');n++;
 }
 const source=fs.readFileSync(path.join(root,'sw.js'),'utf8');
 for(const scope of ['https://teorahau.github.io/','https://nuisancesonore.github.io/te-ora-hau/']){
  const listeners={};let shown,opened,waiting;
  const self={addEventListener:(name,fn)=>{listeners[name]=fn},registration:{scope,showNotification:async(t,o)=>{shown=o}},clients:{matchAll:async()=>[],openWindow:async url=>{opened=url}}};
  vm.runInNewContext(source,{self,URL});
  listeners.push({data:{json:()=>({})},waitUntil:p=>{waiting=p}});await waiting;
  assert.equal(shown.data.url,new URL('espace.html',scope).href);n++;
  for(const target of ['espace.html','/te-ora-hau/espace.html','https://example.invalid/phishing']){
   listeners.notificationclick({notification:{close(){},data:{url:target}},waitUntil:p=>{waiting=p}});await waiting;
   assert.equal(opened,new URL('espace.html',scope).href);n++;
  }
 }
 const config={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'js/config.js'),'utf8'),config);
 assert.equal(config.window.TOH_CONFIG.SUPABASE_URL,'https://alaesbkvfprgpngrowbt.supabase.co');n++;
 assert(fs.readFileSync(path.join(root,'js/app.js'),'utf8').includes('emailRedirectTo: new URL("connexion.html", location.href).href'));n++;
 assert(fs.existsSync(path.join(root,'.nojekyll')));n++;
 console.log(`MIGRATION OK : ${n} contrôles, deux origines, CORS fermé, notification ancienne/nouvelle, base et confirmation conservées.`);
})().catch(e=>{console.error(e);process.exitCode=1;});
