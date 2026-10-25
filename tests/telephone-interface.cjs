const fs=require('fs'),path=require('path'),assert=require('assert');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox'],executablePath:process.env.TOH_CHROMIUM||chromium.executablePath()});
 const root=path.resolve(__dirname,'..'); let n=0;
 const context=await browser.newContext({serviceWorkers:'block',viewport:{width:390,height:844}});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
   const mode=new URL(location.href).searchParams.get('mode')||'membre';
   window.fixture={mode,calls:[],popups:[],saved:null,profile:{id:'auteur',prenom:'Membre',role:mode==='bureau'?'bureau':'membre',telephone:mode==='sans-tel'?'':'87 12 34 56'},signal:{id:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',auteur:'auteur',type:'Musique',commune:'Taravao',intensite:'Forte',horaire:'Nuit',recurrence:'Régulier',lat:-17.7,lng:-149.3,afficher_telephone:false,cree_le:'2026-10-25T12:00:00Z'}};
   window.sb={from(table){
     const q={singleResult:false,op:'select',select(){return this},eq(){return this},order(){return this},single(){this.singleResult=true;return this},insert(row){this.op='insert';fixture.saved=row;return this},update(row){this.op='update';fixture.saved=row;Object.assign(fixture.signal,row);return this},then(resolve){
       fixture.calls.push(table);
       let data=table==='profils'?[fixture.profile]:table==='signalements_telephones'?(mode==='partage'?[{id:fixture.signal.id,telephone:'87 12 34 56'}]:[]):[fixture.signal];
       resolve({data:this.singleResult?data[0]:data,error:null});
     }};return q;
   }};
   window.initPage=async()=>{};window.monProfil=async()=>fixture.profile;
   window.aDroitAcces=()=>!['public','attente'].includes(mode);window.verrouAcces=()=>null;
   window.sessionActive=async()=>({user:{id:'auteur'}});
   window.echapper=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
   window.nomComplet=p=>p.prenom||'';window.moisAnnee=s=>s||'';
   window.optionsListe=(ls,selected)=>ls.map(v=>`<option ${v===selected?'selected':''}>${v}</option>`).join('');
   window.optionsCommunes=()=>'<option>Taravao</option>';window.brancherCommuneAutre=()=>()=> 'Taravao';
   window.SIG_TYPES=['Musique'];window.SIG_HORAIRES=['Nuit'];window.SIG_INTENSITES=['Forte'];window.SIG_RECURRENCES=['Régulier'];window.SIG_CONSTATS=['Signalement seul'];window.COMMUNES_DETAIL={};window.COMMUNES_PF=['Taravao'];
   window.envoiEnCours=()=>false;window.boutonOccupe=()=>()=>{};window.actionBouton=async(b,t,f)=>f();window.messageErreur=e=>e.message;window.tohSignalements=()=>{};window.reverseGeocode=async()=>null;
   const map={setView(){return this},on(ev,fn){fixture.mapClick=fn;return this},fitBounds(){},removeLayer(){}};
   window.L={map:()=>map,tileLayer:()=>({addTo(){}}),marker:()=>({addTo(){return this},setLatLng(){}}),circleMarker:()=>({addTo(){return this},bindPopup(html){fixture.popups.push(html)},getLatLng(){return {lat:-17.7,lng:-149.3}}}),latLngBounds:x=>x};
 });
 await context.route('**/*',async route=>{
   const u=new URL(route.request().url());
   if(u.hostname!=='127.0.0.1'||u.pathname.endsWith('.js'))return route.fulfill({body:'',contentType:'application/javascript'});
   const file=path.join(root,u.pathname);if(!fs.existsSync(file))return route.fulfill({status:404,body:''});
   return route.fulfill({body:fs.readFileSync(file),contentType:u.pathname.endsWith('.html')?'text/html':'text/css'});
 });
 await page.goto('http://127.0.0.1/signaler.html');const choice=page.locator('#afficher_telephone');await choice.waitFor();
 assert.equal(await choice.isChecked(),false);n++;
 assert((await page.locator('fieldset').innerText()).includes('87 12 34 56'));n++;
 await choice.check();await page.evaluate(()=>fixture.mapClick({latlng:{lat:-17.7,lng:-149.3}}));
 await page.getByRole('button',{name:'Envoyer le signalement',exact:true}).click();
 await page.waitForFunction(()=>fixture.saved);assert.equal(await page.evaluate(()=>fixture.saved.afficher_telephone),true);n++;
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));n++;
 await page.screenshot({path:'/tmp/toh-telephone-formulaire-mobile.png',fullPage:true});
 await page.goto('http://127.0.0.1/signaler.html?mode=sans-tel');await choice.waitFor();assert(await choice.isDisabled());n++;
 await page.goto('http://127.0.0.1/mes-signalements.html');await page.getByRole('button',{name:'✏️ Modifier'}).click();
 const edit=page.locator('[id^="e-telephone-"][type=checkbox]');await edit.check();await page.getByRole('button',{name:'💾 Enregistrer'}).click();
 await page.waitForFunction(()=>fixture.saved?.afficher_telephone===true);n++;
 await page.getByRole('button',{name:'✏️ Modifier'}).waitFor();await page.getByRole('button',{name:'✏️ Modifier'}).click();assert(await edit.isChecked());n++;
 await edit.uncheck();await page.getByRole('button',{name:'💾 Enregistrer'}).click();await page.waitForFunction(()=>fixture.saved?.afficher_telephone===false);n++;
 for(const mode of ['partage','membre','public','attente','bureau']){
   await page.goto('http://127.0.0.1/carte.html?mode='+mode);await page.waitForFunction(()=>document.getElementById('stats-corps'));
   const f=await page.evaluate(()=>({calls:fixture.calls,popups:fixture.popups}));
   assert.equal(f.popups.join('').includes('87 12 34 56'),['partage','bureau'].includes(mode));n++;
   assert.equal(f.calls.includes('signalements_telephones'),['partage','membre'].includes(mode));n++;
   if(mode!=='bureau'){assert(!f.calls.includes('profils'));n++;}
 }
 assert.deepStrictEqual(errors,[]);n++;await browser.close();
 console.log(`Téléphone interface : ${n} contrôles OK (création, édition, retrait, carte, mobile, visiteurs, bureau).`);
})().catch(e=>{console.error(e);process.exitCode=1;});
