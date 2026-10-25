const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
(async()=>{
 const html=fs.readFileSync(path.join(__dirname,'..','admin.html'),'utf8');
 for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
 assert(!html.includes('testerServicesTOH'));
 assert(!html.includes('Tester mes notifications'));
 assert(!html.includes('services-toh-resultat'));
 assert(html.includes('Confirmer la relance envoyée'));
 assert(html.includes('Relances de cotisation'));
 let n=6;
 const ctx={navigator:{serviceWorker:{}}};vm.createContext(ctx);
 const app=fs.readFileSync(path.join(__dirname,'..','js/app.js'),'utf8');let closed=[];ctx.navigator.serviceWorker.ready=Promise.resolve({getNotifications:async()=>[{tag:'toh-test',close(){closed.push('test')}},{tag:'annonce',close(){closed.push('annonce')}}]});vm.runInContext(app.slice(app.indexOf('async function fermerNotifsAffichees('),app.indexOf('async function verifierNotifications(')),ctx);await ctx.fermerNotifsAffichees();assert.deepStrictEqual(closed,['annonce']);n++;
 console.log('CONTROLES BUREAU OK : '+n+' vérifications; aucun destinataire arbitraire, interface de production sans contrôles de test.');
})().catch(e=>{console.error(e);process.exitCode=1});
