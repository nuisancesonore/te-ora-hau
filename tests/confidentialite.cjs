const fs=require('fs'),path=require('path'),assert=require('assert');
const {PGlite}=require(path.join(process.env.TOH_QA_NODE_MODULES || path.join(process.env.TEMP,'toh-qa/node_modules'),'@electric-sql/pglite'));
const a='11111111-1111-1111-1111-111111111111',b='22222222-2222-2222-2222-222222222222',bureau='33333333-3333-3333-3333-333333333333';
(async()=>{
 const db=new PGlite(); let n=0;
 await db.exec([
 "create role anon; create role authenticated; create schema auth;",
 "create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;",
 "grant usage on schema public,auth to anon,authenticated;",
 "create table public.profils(id uuid primary key,cotisation_payee boolean,cotisation_echeance date);",
 "create table public.signalements(id uuid,auteur uuid,type text,commune text,quartier text,intensite text,horaire text,recurrence text,constat text,debut text,adresse_source text,description text,lat double precision,lng double precision,cree_le timestamptz);",
 "create table public.journal_bruit(id uuid,auteur uuid);",
 "create function public.is_bureau() returns boolean language sql stable as $$select auth.uid() = '"+bureau+"'::uuid$$;",
 "alter table public.signalements enable row level security;create policy old_select on public.signalements for select using(auth.uid() is not null);",
 "alter table public.journal_bruit enable row level security;create policy own on public.journal_bruit for select using(auteur=auth.uid());",
 "insert into public.profils values ('"+a+"',true,'2099-01-01'),('"+b+"',false,null),('"+bureau+"',false,null);",
 "insert into public.signalements values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','"+a+"','Musique','Test','Lieu privé','Forte','Nuit','Régulier','Signalement seul',null,'Adresse privée','Description privée',-17.62345,-149.46456,now()),('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','"+b+"','Travaux','Test','Autre lieu','Forte',null,null,null,null,'Autre adresse','Autre description',-17.69999,-149.31111,now());",
 "insert into public.journal_bruit values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','"+a+"');"
 ].join('\n'));
 for(const t of ['demarches','forum_messages','missions','missions_commentaires','annonces','messages_contact','cotisations','bureau_emails','assesseur_emails'])await db.exec('create table public.'+t+'(id integer);');
 await db.exec('grant select on all tables in schema public to anon,authenticated;');
 await db.exec(fs.readFileSync(path.join(__dirname,'..','migration-carte-publique.sql'),'utf8'));
 await db.exec(fs.readFileSync(path.join(__dirname,'..','migration-confidentialite-v2.sql'),'utf8'));
 await db.exec(fs.readFileSync(path.join(__dirname,'..','migration-sauvegarde-v2.sql'),'utf8'));
 async function as(role,id){await db.exec("reset role;select set_config('request.jwt.claim.sub','"+(id||"")+"',false);set role "+role+";")}
 async function denied(sql){let fail=false;try{await db.query(sql)}catch{fail=true}assert(fail);n++}
 await as('anon');
 const pub=await db.query('select * from public.signalements_publics');
 assert.equal(pub.rows.length,2);n++;
 assert(pub.rows.every(r=>r.description===null&&r.adresse_source===null&&r.quartier===null));n++;
 assert.equal(pub.rows[0].lat,-17.62);assert.equal(pub.rows[0].lng,-149.46);n++;
 assert.equal((await db.query('select * from public.signalements')).rows.length,0);n++;
 await denied('select * from public.signalements_membres');
 await denied('select public.export_sauvegarde_application()');
 await as('authenticated',b);
 assert.equal((await db.query('select * from public.signalements')).rows.length,1);n++;
 assert.equal((await db.query('select * from public.signalements_membres')).rows.length,0);n++;
 await denied('select public.export_sauvegarde_application()');
 await as('authenticated',a);
 assert.equal((await db.query('select * from public.signalements')).rows.length,1);n++;
 assert.equal((await db.query('select * from public.signalements_membres')).rows.length,2);n++;
 await denied('select public.export_sauvegarde_application()');
 await as('authenticated',bureau);
 assert.equal((await db.query('select * from public.signalements')).rows.length,2);n++;
 assert.equal((await db.query('select * from public.journal_bruit')).rows.length,1);n++;
 const backup=(await db.query('select public.export_sauvegarde_application() as sauvegarde')).rows[0].sauvegarde;
 assert.equal(Object.keys(backup.tables).length,12);n++;
 assert.equal(backup.volumes.signalements,2);n++;
 assert.equal(backup.volumes.profils,3);n++;
 assert(backup.limites.length>=4);n++;
 // Rejouable : ne perd pas les données ni ne duplique les politiques.
 await db.exec('reset role');
 await db.exec(fs.readFileSync(path.join(__dirname,'..','migration-confidentialite-v2.sql'),'utf8'));
 await db.exec(fs.readFileSync(path.join(__dirname,'..','migration-sauvegarde-v2.sql'),'utf8'));
 assert.equal((await db.query('select * from public.signalements')).rows.length,2);n++;
 await db.close(); console.log('SQL OK : '+n+' contrôles PostgreSQL isolés, 4 niveaux d’accès, export interdit hors bureau.');
})().catch(e=>{console.error(e);process.exitCode=1});
