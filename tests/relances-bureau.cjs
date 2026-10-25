const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync(require('path').join(__dirname,'../admin.html'),'utf8');
const source=html.slice(html.indexOf('function relancesEligibles('),html.indexOf('function preparerRelances('));
function fixture({role='bureau',answer=true,renewed=false,failSecond=false}={}){
 const rows=[{id:'a',email:'a@example.invalid',cotisation_echeance:'2026-11-24'}, {id:'b',email:'b@example.invalid',cotisation_echeance:'2026-11-09'}];
 const db=structuredClone(rows);if(renewed)db[0].cotisation_echeance='2027-11-24';
 const elements=Object.fromEntries(['liste-relances','nombre-relances','resume-relances','actions-relances','info-relances','btn-relancer','btn-confirmer-relances','etat-confirmation-relances'].map(id=>[id,{}]));
 const writes=[];
 const sb={from(table){return {update(patch){
   const filters={};
   const q={eq(k,v){filters[k]=v;return q},async select(){
     if(failSecond&&filters.id==='b')return {error:{message:'test'},data:null};
     const hit=db.filter(a=>Object.entries(filters).every(([k,v])=>a[k]===v));
     for(const a of hit){Object.assign(a,patch);writes.push({table,patch,filters:{...filters}})}
     return {error:null,data:hit.map(a=>({id:a.id}))};
   }};return q;
 }}}};
 const c={ADH:rows,MOI:{role},aujourdHuiISO:()=> '2026-10-25',echapper:x=>x,frDate:x=>x,confirm:()=>answer,
   document:{getElementById:id=>elements[id],querySelectorAll:()=>[{value:'a'},{value:'b'}]},
   boutonOccupe:btn=>{btn.disabled=true;return()=>btn.disabled=false},sb};
 vm.createContext(c);vm.runInContext(source,c);return {c,elements,writes,db};
}
(async()=>{
 let f=fixture();await f.c.confirmerRelancesEnvoyees(f.elements['btn-confirmer-relances']);assert.equal(f.writes.length,2);assert.equal(f.c.relancesEligibles().length,0);assert.equal(f.elements['actions-relances'].hidden,true);for(const w of f.writes){assert.deepEqual(Object.keys(w.patch),['rappel_30j_pour']);assert(w.filters.id&&w.filters.email&&w.filters.cotisation_echeance)}
 f.c.ADH[0].cotisation_echeance='2026-11-20';assert.equal(f.c.relancesEligibles().length,1);
 f=fixture({answer:false});await f.c.confirmerRelancesEnvoyees({});assert.equal(f.writes.length,0);
 f=fixture({role:'membre'});await f.c.confirmerRelancesEnvoyees({});assert.equal(f.writes.length,0);
 f=fixture({renewed:true});await f.c.confirmerRelancesEnvoyees({});assert.equal(f.writes.length,0);assert(f.elements['etat-confirmation-relances'].textContent.includes('non confirmé'));
 f=fixture({failSecond:true});await f.c.confirmerRelancesEnvoyees({});assert.equal(f.writes.length,1);assert.deepEqual(Array.from(f.c.relancesEligibles(),x=>x.a.id),['b']);assert(f.elements['etat-confirmation-relances'].textContent.startsWith('1 relance'));
 console.log('RELANCES BUREAU OK : confirmation explicite, rôle, lot partiel, échéance modifiée, arrêt des doublons et nouveau cycle. Aucun e-mail réel envoyé.');
})().catch(e=>{console.error(e);process.exitCode=1});
