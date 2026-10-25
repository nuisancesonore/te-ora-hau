const fs=require('fs'),path=require('path'),assert=require('assert');
const {chromium}=require(path.join(process.env.TOH_QA_NODE_MODULES || path.join(process.env.TEMP,'toh-qa/node_modules'),'playwright'));
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 let n=0;
 try {
  const context=await browser.newContext({acceptDownloads:true,serviceWorkers:'block'});
  const page=await context.newPage();
  await page.route('http://127.0.0.1/**',r=>r.fulfill({contentType:'text/html',body:'<div id="nav-espace-trigger"></div><div id="nav-forum"></div><div id="contenu"></div>'}));
  await page.goto('http://127.0.0.1/qa');
  await page.addScriptTag({content:fs.readFileSync(path.join(__dirname,'..','js/app.js'),'utf8')});
  let r=await page.evaluate(async()=>{
    const a={id:'compte-A'},b={id:'compte-B'};
    noterLecture('forum',a,123);
    const iso=luJusqua('forum',a)===123&&luJusqua('forum',b)===0;
    compterNonLus=async()=>({annonces:1,forum:3,missions:2,total:6});
    await verifierNotifications(a);
    const a1=document.getElementById('nav-espace-trigger').textContent==='3';
    const a2=document.getElementById('nav-forum').textContent==='3';
    compterNonLus=async()=>({annonces:0,forum:0,missions:0,total:0});
    await rafraichirBadge(a);
    return {iso,a1,a2,efface:document.querySelectorAll('.notif-dot,.notif-point').length===0};
  });
  assert(Object.values(r).every(Boolean));n+=4;
  await page.addScriptTag({content:fs.readFileSync(path.join(__dirname,'..','js/parcours.js'),'utf8')});
  r=await page.evaluate(()=>{
    const a=sujetForum('[Entraide] Besoin de conseil');
    const b=sujetForum('Message historique');
    return a.sujet==='Entraide'&&a.texte==='Besoin de conseil'&&b.sujet==='Général'&&b.texte==='Message historique';
  });assert(r);n++;
  await page.evaluate(()=>{document.body.innerHTML='<button id="export">Exporter</button>';window.alert=msg=>{window.alerte=msg};window.boutonOccupe=btn=>{btn.disabled=true;return()=>{btn.disabled=false}};});
  await page.addScriptTag({content:fs.readFileSync(path.join(__dirname,'..','js/sauvegarde.js'),'utf8')});
  await page.evaluate(()=>{sb={rpc:async()=>({error:{message:'Non autorisé'}})};});
  await page.evaluate(()=>exporterDonneesAssociation(document.getElementById('export')));
  assert((await page.evaluate(()=>window.alerte)).includes('n’est pas disponible'));assert.equal(await page.locator('#export').isEnabled(),true);n+=2;
  await page.evaluate(()=>{sb={rpc:async()=>({data:{format:'te-ora-hau-donnees-v1',tables:{profils:[]},volumes:{profils:0}}})};});
  await page.evaluate(()=>exporterDonneesAssociation(document.getElementById('export')));
  assert((await page.evaluate(()=>window.alerte)).includes('incomplet'));n++;
  await page.evaluate(()=>{
    const noms=["profils","signalements","journal_bruit","demarches","forum_messages","missions","missions_commentaires","annonces","messages_contact","cotisations","bureau_emails","assesseur_emails"];
    const tables={},volumes={};noms.forEach(t=>{tables[t]=[];volumes[t]=0});
    sb={rpc:async()=>({data:{format:'te-ora-hau-donnees-v1',tables,volumes,limites:['Auth et Storage exclus']}})};
  });
  const dl=page.waitForEvent('download');
  await page.evaluate(()=>exporterDonneesAssociation(document.getElementById('export')));
  const download=await dl, file=await download.path();
  const saved=JSON.parse(fs.readFileSync(file,'utf8'));
  assert.equal(Object.keys(saved.tables).length,12);assert.equal(saved.format,'te-ora-hau-donnees-v1');n+=2;
  await context.close(); console.log('FONCTIONS OK : '+n+' contrôles, lectures isolées, pastilles actualisées, sujets rétrocompatibles, export complet et erreurs.');
 } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
