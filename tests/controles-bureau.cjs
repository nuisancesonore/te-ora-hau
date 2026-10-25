const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
(async()=>{
 const html=fs.readFileSync(path.join(__dirname,'..','admin.html'),'utf8');
 for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
 const source=html.slice(html.indexOf('async function testerServicesTOH('),html.indexOf('const GROUPES_EMAIL'));
 const zone={textContent:''},btn={disabled:false};let called,reply={},failure=false,n=1;
 const ctx={etatNotifications:async()=> 'actif',navigator:{serviceWorker:{ready:Promise.resolve({pushManager:{getSubscription:async()=>({endpoint:'https://push.example.invalid/a'})}})}},document:{getElementById:()=>zone},boutonOccupe:b=>{b.disabled=true;return()=>{b.disabled=false}},sb:{functions:{invoke:async(name,options)=>{called={name,...options};return {data:reply,error:failure?{}:null}}}}};
 vm.createContext(ctx);vm.runInContext(source,ctx);
 reply={simulation:true,envoyes:0,rappels:0,expediteur_pret:false};
 await ctx.testerServicesTOH('rappels',btn);
 assert.equal(called.name,'rappel-cotisation');assert.equal(called.body.dry_run,true);assert(zone.textContent.includes('n’est pas configuré'));assert.equal(btn.disabled,false);n+=4;
 reply={test_personnel:true,envoyes:1,echecs:0};await ctx.testerServicesTOH('push',btn);
 assert.equal(called.name,'envoi-push');assert.deepStrictEqual(Object.keys(called.body),['action','endpoint']);assert.equal(called.body.action,'test_perso');assert(zone.textContent.includes('Vérifiez'));n+=4;
 ctx.etatNotifications=async()=> 'refuse';called=null;await ctx.testerServicesTOH('push',btn);assert.equal(called,null);assert(zone.textContent.includes('bloquées'));n+=2;
 failure=true;await ctx.testerServicesTOH('rappels',btn);assert(zone.textContent.includes('indisponible'));assert.equal(btn.disabled,false);n+=2;
 const app=fs.readFileSync(path.join(__dirname,'..','js/app.js'),'utf8');let closed=[];ctx.navigator.serviceWorker.ready=Promise.resolve({getNotifications:async()=>[{tag:'toh-test',close(){closed.push('test')}},{tag:'annonce',close(){closed.push('annonce')}}]});vm.runInContext(app.slice(app.indexOf('async function fermerNotifsAffichees('),app.indexOf('async function verifierNotifications(')),ctx);await ctx.fermerNotifsAffichees();assert.deepStrictEqual(closed,['annonce']);n++;
 console.log('CONTROLES BUREAU OK : '+n+' vérifications; aucun destinataire arbitraire, vérification e-mail sans envoi.');
})().catch(e=>{console.error(e);process.exitCode=1});
