const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
(async()=>{
 const html=fs.readFileSync(path.join(__dirname,'..','admin.html'),'utf8');
 for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
 const source=html.slice(html.indexOf('async function testerServicesTOH('),html.indexOf('const GROUPES_EMAIL'));
 const zone={textContent:''},btn={disabled:false};let called,reply={},failure=false,n=1;
 const ctx={document:{getElementById:()=>zone},boutonOccupe:b=>{b.disabled=true;return()=>{b.disabled=false}},sb:{functions:{invoke:async(name,options)=>{called={name,...options};return {data:reply,error:failure?{}:null}}}}};
 vm.createContext(ctx);vm.runInContext(source,ctx);
 reply={simulation:true,envoyes:0,rappels:0,expediteur_pret:false};
 await ctx.testerServicesTOH('rappels',btn);
 assert.equal(called.name,'rappel-cotisation');assert.equal(called.body.dry_run,true);assert(zone.textContent.includes('n’est pas configuré'));assert.equal(btn.disabled,false);n+=4;
 reply={test_personnel:true,envoyes:1,echecs:0};await ctx.testerServicesTOH('push',btn);
 assert.equal(called.name,'envoi-push');assert.deepStrictEqual(Object.keys(called.body),['action']);assert.equal(called.body.action,'test_perso');assert(zone.textContent.includes('Vérifiez'));n+=4;
 failure=true;await ctx.testerServicesTOH('rappels',btn);assert(zone.textContent.includes('indisponible'));assert.equal(btn.disabled,false);n+=2;
 console.log('CONTROLES BUREAU OK : '+n+' vérifications; aucun destinataire arbitraire, vérification e-mail sans envoi.');
})().catch(e=>{console.error(e);process.exitCode=1});
