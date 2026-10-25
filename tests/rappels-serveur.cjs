const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert');
const {stripTypeScriptTypes}=require('node:module');
(async()=>{
 let handler,scenario={},sends=[],updates=[];let n=0;
 const source=fs.readFileSync(path.join(__dirname,'..','supabase/functions/rappel-cotisation/index.ts'),'utf8').replace(/^import .*;$/mg,'');
 class Horloge extends Date{constructor(...args){super(...(args.length?args:['2026-10-25T09:30:00Z']))}static now(){return Date.parse('2026-10-25T09:30:00Z')}}
 const data=[{id:'a',email:'a@example.invalid',cotisation_payee:true,cotisation_echeance:'2026-11-23'},{id:'b',email:'b@example.invalid',cotisation_payee:true,cotisation_echeance:'2026-12-23'},{id:'c',email:'c@example.invalid',cotisation_payee:true,cotisation_echeance:'2026-12-24'},{id:'d',email:'d@example.invalid',cotisation_payee:true,cotisation_echeance:'2026-11-23',rappel_30j_pour:'2026-11-23'},{id:'e',email:'e@example.invalid',cotisation_payee:true,cotisation_echeance:'2026-11-23',acces_suspendu:true}];
 const sandbox={Request,Response,console,Date:Horloge,
 Deno:{serve:f=>{handler=f},env:{get:k=>k==='SUPABASE_SERVICE_ROLE_KEY'?'service':k==='RESEND_API_KEY'?(scenario.notReady?undefined:'fake'):k==='MAIL_FROM'?(scenario.notReady?undefined:'test@example.invalid'):'test'}},
 fetch:async(url,req)=>{sends.push(JSON.parse(req.body));return new Response('{"id":"fake-id"}',{status:200})},
 createClient:(url,key)=>key==='service'?{from(){const q={select(){return q},not(){return q},update(p){updates.push(p);return q},eq(){return q},then(a,b){return Promise.resolve({data,error:null}).then(a,b)}};return q}}:{auth:{getUser:async()=>({data:{user:scenario.noUser?null:{id:'test'}},error:null})},rpc:async()=>({data:scenario.notBureau?false:true})}
 };
 vm.runInNewContext(stripTypeScriptTypes(source),sandbox);
 async function call(body,method='POST'){sends=[];updates=[];const r=await handler(new Request('https://example.invalid',{method,headers:{Authorization:'Bearer user'},body:method==='POST'?JSON.stringify(body):undefined}));return {status:r.status,data:await r.json()}}
 let r=await call({},'GET');assert.equal(r.status,405);n++;
 scenario={noUser:true};r=await call({});assert.equal(r.status,401);n++;
 scenario={notBureau:true};r=await call({});assert.equal(r.status,403);n++;
 scenario={};r=await call({});assert.equal(r.data.simulation,true);assert.equal(r.data.rappels,2);assert.equal(sends.length,0);n+=3;
 scenario={notReady:true};r=await call({dry_run:false});assert.equal(r.status,503);assert.equal(sends.length,0);n+=2;
 scenario={};r=await call({dry_run:false});assert.equal(r.data.envoyes,2);assert.equal(updates.length,2);n+=2;
 console.log('RAPPELS OK : '+n+' contrôles simulés; authentification, paliers 30/60 jours, doublons, suspension et expéditeur. Aucun e-mail réel envoyé.');
})().catch(e=>{console.error(e);process.exitCode=1});
