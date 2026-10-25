const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert');
const {stripTypeScriptTypes}=require('node:module');
(async()=>{
 let handler,scenario={},sent=[],deleted=[],selected=[];let n=0;
 const source=fs.readFileSync(path.join(__dirname,'..','supabase/functions/envoi-push/index.ts'),'utf8').replace(/^import .*;$/mg,'');
 class Horloge extends Date {constructor(...args){super(...(args.length?args:['2026-10-25T09:30:00Z']))}static now(){return new Date('2026-10-25T09:30:00Z').getTime()}}
 const sandbox={Request,Response,Date:Horloge,console,
  Deno:{env:{get:k=>k==='SUPABASE_SERVICE_ROLE_KEY'?'service':'test'},serve:f=>{handler=f}},
  webpush:{setVapidDetails(){},async sendNotification(s){sent.push(s.endpoint);if(s.endpoint==='expired')throw {statusCode:410}}},
  createClient:(url,key)=>key!=='service'?{rpc:async()=>({data:scenario.bureau!==false})}:{from(table){const q={select(){return q},in(k,ids){selected=ids;return q},delete(){return q},eq(k,v){deleted.push(v);return Promise.resolve({})},then(a,b){return Promise.resolve(table==='profils'?{data:[{id:'a',cotisation_payee:true,cotisation_echeance:'2026-10-24'},{id:'b',cotisation_payee:false},{id:'c',cotisation_payee:true,acces_suspendu:true}]}:{data:selected.map(id=>({endpoint:id==='b'?'expired':'ok',subscription:{endpoint:id==='b'?'expired':'ok'}})),error:scenario.readError?{}:null}).then(a,b)}};return q}}
 };
 vm.runInNewContext(stripTypeScriptTypes(source),sandbox);
 async function call(body,method='POST'){sent=[];deleted=[];selected=[];const r=await handler(new Request('https://example.invalid',{method,body:method==='POST'?JSON.stringify(body):undefined}));return {status:r.status,data:await r.json()}}
 let r=await call({},'GET');assert.equal(r.status,405);n++;
 scenario={bureau:false};r=await call({titre:'Test',corps:'Test',cible:'tous'});assert.equal(r.status,403);assert.equal(sent.length,0);n+=2;
 scenario={};r=await call({titre:'Test',corps:'Test',cible:'inconnu'});assert.equal(r.status,400);assert.equal(sent.length,0);n+=2;
 r=await call({titre:'Test',corps:'Test',cible:'ajour',dry_run:true});assert.equal(r.status,200);assert.equal(r.data.appareils,1);assert.equal(r.data.envoyes,0);assert.equal(sent.length,0);assert.deepStrictEqual(Array.from(selected),['a']);n+=5;
 r=await call({titre:'Test',corps:'Test',cible:'tous'});assert.equal(r.data.ok,false);assert.equal(r.data.envoyes,1);assert.equal(r.data.echecs,1);assert.deepStrictEqual(deleted,['expired']);n+=4;
 scenario={readError:true};r=await call({titre:'Test',corps:'Test',cible:'tous'});assert.equal(r.status,503);assert.equal(sent.length,0);n+=2;
 console.log('PUSH OK : '+n+' contrôles simulés, aucun envoi réseau.');
})().catch(e=>{console.error(e);process.exitCode=1});
