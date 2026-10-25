// PostgreSQL isolé : aucun compte ni signalement de test dans la base en ligne.
const fs = require('fs'), path = require('path'), assert = require('assert');
const { PGlite } = require(path.join(process.env.TOH_QA_NODE_MODULES, '@electric-sql/pglite'));
(async () => {
  const db = new PGlite(); let n = 0;
  const ids = Array.from({length: 7}, (_, i) => `00000000-0000-0000-0000-00000000000${i+1}`);
  const [owner, reader, pending, expired, suspended, unconfirmed, bureau] = ids;
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth; CREATE SCHEMA toh_private;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    CREATE TABLE auth.users(id uuid PRIMARY KEY, email_confirmed_at timestamptz);
    CREATE TABLE public.profils(id uuid PRIMARY KEY, telephone text, cotisation_payee boolean,
      cotisation_echeance date, acces_suspendu boolean DEFAULT false);
    CREATE TABLE public.signalements(id uuid PRIMARY KEY, auteur uuid, type text);
    CREATE FUNCTION toh_private.is_bureau() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT auth.uid()='${bureau}'::uuid $$;
    CREATE FUNCTION toh_private.membre_valide() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
      SELECT auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.profils p JOIN auth.users u ON u.id=p.id
        WHERE p.id=auth.uid() AND u.email_confirmed_at IS NOT NULL AND NOT coalesce(p.acces_suspendu,false)
        AND (toh_private.is_bureau() OR (p.cotisation_payee AND (p.cotisation_echeance IS NULL OR p.cotisation_echeance>=CURRENT_DATE)))) $$;
    GRANT USAGE ON SCHEMA public, auth, toh_private TO anon,authenticated;
    GRANT SELECT, UPDATE ON public.profils,public.signalements TO authenticated;
    ALTER TABLE public.profils ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.signalements ENABLE ROW LEVEL SECURITY;
    CREATE POLICY own_profile ON public.profils FOR SELECT TO authenticated USING(id=auth.uid() OR toh_private.is_bureau());
    CREATE POLICY own_signalement ON public.signalements FOR SELECT TO authenticated USING(auteur=auth.uid() OR toh_private.is_bureau());
    CREATE POLICY update_signalement ON public.signalements FOR UPDATE TO authenticated
      USING(auteur=auth.uid() OR toh_private.is_bureau()) WITH CHECK(auteur=auth.uid() OR toh_private.is_bureau());
  `);
  for (const id of ids) {
    await db.query('INSERT INTO auth.users VALUES($1,$2)', [id,id===unconfirmed?null:new Date()]);
    await db.query('INSERT INTO public.profils VALUES($1,$2,$3,$4,$5)', [id,'87 00 00 01',id!==pending,id===expired?'2000-01-01':'2099-01-01',id===suspended]);
  }
  // Migration rejouable ; tous les anciens signalements restent privés.
  const migration = fs.readdirSync(path.join(__dirname,'../supabase/migrations')).find(f=>f.endsWith('_visibilite_telephone_carte.sql'));
  const sql = fs.readFileSync(path.join(__dirname,'../supabase/migrations',migration),'utf8');
  await db.exec(`INSERT INTO public.signalements VALUES('${owner}','${owner}','Musique'),('${reader}','${reader}','Travaux');`);
  await db.exec(sql); await db.exec(sql);
  assert((await db.query('SELECT * FROM public.signalements')).rows.every(r=>r.afficher_telephone===false)); n++;
  const as = async (id,role='authenticated') => { await db.exec('RESET ROLE'); await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[id||'']); await db.exec('SET ROLE '+role); };
  const contacts = async () => (await db.query('SELECT * FROM public.signalements_telephones')).rows;
  await as(owner); await db.exec('UPDATE public.signalements SET afficher_telephone=true');
  assert.equal((await contacts()).length,1); n++;
  await as(reader); let rows=await contacts();
  assert.deepStrictEqual(rows,[{id:owner,telephone:'87 00 00 01'}]); n++;
  assert.deepStrictEqual(Object.keys(rows[0]).sort(),['id','telephone']); n++;
  assert.equal((await db.query(`SELECT * FROM public.profils WHERE id='${owner}'`)).rows.length,0); n++;
  assert.equal((await db.query(`UPDATE public.signalements SET afficher_telephone=false WHERE id='${owner}' RETURNING id`)).rows.length,0); n++;
  for (const id of [pending,expired,suspended,unconfirmed]) { await as(id); assert.equal((await contacts()).length,0); n++; }
  await as(null,'anon'); let denied=false;try {await contacts();}catch {denied=true;}assert(denied);n++;
  await as(owner); await db.exec('UPDATE public.signalements SET afficher_telephone=false');
  await as(reader); assert.equal((await contacts()).length,0); n++;
  await as(bureau); assert.equal((await db.query(`SELECT telephone FROM public.profils WHERE id='${owner}'`)).rows[0].telephone,'87 00 00 01'); n++;
  // Le numéro vient toujours du profil actuel ; vide/suspendu => jamais exposé.
  await as(null,'postgres'); await db.exec(`UPDATE public.signalements SET afficher_telephone=true WHERE id='${owner}'; UPDATE public.profils SET telephone='87 00 00 02' WHERE id='${owner}'`);
  await as(reader); assert.equal((await contacts())[0].telephone,'87 00 00 02'); n++;
  await as(null,'postgres'); await db.exec(`UPDATE public.profils SET telephone='   ' WHERE id='${owner}'`);
  await as(reader); assert.equal((await contacts()).length,0); n++;
  await as(null,'postgres'); await db.exec(`UPDATE public.profils SET telephone='87 00 00 02',acces_suspendu=true WHERE id='${owner}'`);
  await as(reader); assert.equal((await contacts()).length,0); n++;
  await db.close(); console.log(`Téléphone carte : ${n} contrôles PostgreSQL OK (consentement, retrait, droits, bureau, profils privés).`);
})().catch(e=>{console.error(e);process.exitCode=1;});
