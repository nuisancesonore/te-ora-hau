// Rappels : accès bureau ou clé serveur; simulation par défaut.
// Un expéditeur vérifié et une planification authentifiée restent nécessaires.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const URL_SB=Deno.env.get("SUPABASE_URL")!;
const SERVICE=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const sb=createClient(URL_SB,SERVICE);
const cors={"Access-Control-Allow-Origin":"https://nuisancesonore.github.io","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
function jourTahiti(){return new Date().toLocaleDateString("en-CA",{timeZone:"Pacific/Tahiti"});}
function joursAvant(echeance:string,today:string){return Math.round((Date.parse(echeance.slice(0,10)+"T12:00:00Z")-Date.parse(today+"T12:00:00Z"))/86400000);}
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return reply({error:"Méthode non autorisée"},405);
 try{
  const authorization=req.headers.get("Authorization")||"";
  const serveur=authorization===`Bearer ${SERVICE}`;
  if(!serveur){
   const client=createClient(URL_SB,Deno.env.get("SUPABASE_ANON_KEY")!,{global:{headers:{Authorization:authorization}}});
   const {data:user,error}=await client.auth.getUser();
   if(error||!user.user)return reply({error:"Connexion requise"},401);
   const {data:bureau}=await client.rpc("is_bureau");
   if(!bureau)return reply({error:"Réservé au bureau"},403);
  }
  let input;try{input=await req.json()}catch{return reply({error:"Requête invalide"},400)}
  const {dry_run=true}=input;
  if(typeof dry_run!=="boolean")return reply({error:"Mode invalide"},400);
  const key=Deno.env.get("RESEND_API_KEY"),from=Deno.env.get("MAIL_FROM");
  const ready=Boolean(key&&from);
  if(!dry_run&&!ready)return reply({error:"Expéditeur non configuré. Aucun rappel envoyé."},503);
  const {data,error}=await sb.from("profils").select("id,nom,prenom,email,cotisation_echeance,cotisation_payee,acces_suspendu,rappel_60j_pour,rappel_30j_pour").not("cotisation_echeance","is",null);
  if(error)return reply({error:"Lecture des échéances impossible"},503);
  const today=jourTahiti();
  const candidats=(data||[]).flatMap(m=>{
   if(m.acces_suspendu||!m.cotisation_payee||!m.email||!m.cotisation_echeance)return [];
   const j=joursAvant(m.cotisation_echeance,today),palier=j>=0&&j<=30?30:j>30&&j<=60?60:null;
   return palier&&m[`rappel_${palier}j_pour`]!==m.cotisation_echeance?[{...m,palier}]:[];
  });
  if(dry_run)return reply({simulation:true,expediteur_pret:ready,rappels:candidats.length,envoyes:0});
  let envoyes=0,echecs=0;
  for(const m of candidats){
   const ech=m.cotisation_echeance.slice(0,10),dateFr=ech.split("-").reverse().join("/");
   const site=Deno.env.get("SITE_URL")||"https://nuisancesonore.github.io/te-ora-hau";
   try{
    const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json","Idempotency-Key":`toh-rappel/${m.id}/${ech}/${m.palier}`},body:JSON.stringify({from,to:m.email,subject:`Votre cotisation Te Ora Hau arrive à échéance le ${dateFr}`,text:`Ia ora na ${[m.prenom,m.nom].filter(Boolean).join(" ")},\n\nVotre cotisation arrive à échéance le ${dateFr}. Pour la renouveler :\n${site}/cotiser.html\n\nSi votre renouvellement est en cours, merci de le signaler au bureau.\nMauruuru,\nLe bureau de Te Ora Hau`})});
    if(!response.ok)throw new Error("Envoi refusé");
    const result=await response.json();if(!result.id)throw new Error("Envoi non confirmé");
    const {error:saveError}=await sb.from("profils").update({[`rappel_${m.palier}j_pour`]:m.cotisation_echeance}).eq("id",m.id).eq("cotisation_echeance",m.cotisation_echeance);
    if(saveError)throw new Error("Suivi du rappel non enregistré");
    envoyes++;
   }catch{echecs++;}
  }
  return reply({ok:echecs===0,envoyes,echecs});
 }catch{return reply({error:"Erreur de traitement des rappels"},500)}
});
