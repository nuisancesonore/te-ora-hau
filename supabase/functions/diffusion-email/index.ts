// TOH : diffusion email par groupes, réservée au bureau.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const origines=new Set(["https://nuisancesonore.github.io","https://teorahau.github.io"]);
const groupes=new Set(["tous","bureau","assesseurs","ajour","retard"]);
const validEmail=e=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
function selection(profils,cible,today){
 const ajour=p=>Boolean(p.cotisation_payee)&&(!p.cotisation_echeance||String(p.cotisation_echeance).slice(0,10)>=today);
 const retenus=profils.filter(p=>cible==="bureau"?p.role==="bureau":cible==="assesseurs"?p.role==="assesseur":cible==="ajour"?ajour(p):cible==="retard"?!ajour(p):cible==="tous");
 return [...new Set(retenus.map(p=>(p.email||"").trim().toLowerCase()).filter(validEmail))].sort();
}
Deno.serve(async req=>{
 const origine=req.headers.get("Origin");
 const cors = {
 "Access-Control-Allow-Origin":origine&&origines.has(origine)?origine:"https://teorahau.github.io","Vary":"Origin",
 "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
 "Access-Control-Allow-Methods":"POST, OPTIONS"
};
const response=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,"Content-Type":"application/json"}});
 if(origine&&!origines.has(origine))return response({error:"Origine non autorisée"},403);
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return response({error:"Méthode non autorisée"},405);
 try{
  const authorization=req.headers.get("Authorization")||"";
  const url=Deno.env.get("SUPABASE_URL"),anon=Deno.env.get("SUPABASE_ANON_KEY"),service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!url||!anon||!service)return response({error:"Configuration serveur indisponible"},503);
  const client=createClient(url,anon,{global:{headers:{Authorization:authorization}}});
  const {data:auth,error:authError}=await client.auth.getUser();
  if(authError||!auth?.user)return response({error:"Connexion requise"},401);
  const admin=createClient(url,service);
  const {data:profil,error:profilError}=await admin.from("profils").select("role").eq("id",auth.user.id).single();
  if(profilError||profil?.role!=="bureau")return response({error:"Réservé au bureau"},403);
  let input;try{input=await req.json();}catch{return response({error:"Requête invalide"},400);}
  const {action,cible,sujet,corps}=input;
  if(!groupes.has(cible)||!["preview","send"].includes(action))return response({error:"Groupe ou action invalide"},400);
  if(typeof sujet!=="string"||typeof corps!=="string"||!sujet.trim()||!corps.trim()||sujet.length>250||corps.length>50000)return response({error:"Objet ou message invalide"},400);
  const {data:profils,error}=await admin.from("profils").select("email,role,cotisation_payee,cotisation_echeance");
  if(error)return response({error:"Lecture des destinataires impossible"},503);
  const today=new Date().toLocaleDateString("en-CA",{timeZone:"Pacific/Tahiti"});
  const dest=selection(profils||[],cible,today);
  const key=Deno.env.get("RESEND_API_KEY"),from=Deno.env.get("MAIL_FROM");
  const ready=Boolean(key&&from);
  if(action==="preview")return response({destinataires:dest,ready});
  if(!ready)return response({error:"Expéditeur TOH non configuré. Aucun e-mail envoyé."},503);
  if(!dest.length)return response({error:"Aucun destinataire"},400);
  if(!/^[0-9a-f-]{36}$/i.test(input.requestId||""))return response({error:"Identifiant d'envoi requis"},400);
  if(!Array.isArray(input.emails_attendus)||JSON.stringify(input.emails_attendus)!==JSON.stringify(dest))return response({error:"Le groupe a changé : prévisualisez à nouveau. Aucun e-mail envoyé."},409);
  const payloadKey=JSON.stringify({sujet:sujet.trim(),corps:corps.trim(),dest});
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(payloadKey));
  const hash=Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,"0")).join("");
  let acceptes=0,echecs=0;const lots=[];
  for(let i=0;i<dest.length;i+=50){
   const lot=dest.slice(i,i+50);
   try{
    const r=await fetch("https://api.resend.com/emails",{
     method:"POST",headers:{"Authorization":"Bearer "+key,"Content-Type":"application/json","Idempotency-Key":"toh/"+input.requestId+"/"+hash+"/"+i},
     body:JSON.stringify({from,to:from,bcc:lot,subject:sujet.trim(),text:corps.trim()})
    });
    if(r.ok){const result=await r.json();if(result.id){acceptes+=lot.length;lots.push({index:i,acceptes:lot.length,id:result.id});}else{echecs+=lot.length;lots.push({index:i,echecs:lot.length});}}
    else{echecs+=lot.length;lots.push({index:i,echecs:lot.length,status:r.status});}
   }catch{echecs+=lot.length;lots.push({index:i,echecs:lot.length,resultat:"non confirmé"});}
  }
  return response({ok:echecs===0,acceptes,echecs,lots});
 }catch{return response({error:"Erreur serveur. Vérifiez le résultat avant toute nouvelle tentative."},500);}
});

