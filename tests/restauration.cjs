// Restauration du snapshot dans un PostgreSQL local isolé, sans accès réseau.
const fs=require('fs'), assert=require('assert');
const {PGlite}=require(process.env.TOH_PGLITE || '@electric-sql/pglite');
const qi=x=>'"'+String(x).replaceAll('"','""')+'"';
async function restaurer(b){
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create role supabase_auth_admin;
 create schema auth;create schema toh_private;
 grant usage on schema auth,public,toh_private to anon,authenticated,service_role,supabase_auth_admin;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,created_at timestamptz,raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;
 `);
 await db.query('insert into auth.users(id,email,email_confirmed_at,created_at) select id,email,email_confirmed_at,created_at from jsonb_populate_recordset(null::auth.users,$1::jsonb)',[JSON.stringify(b.auth_references)]);
 for(const t of Object.keys(b.data)){
  const cols=b.columns.filter(c=>c.table===t).sort((a,b)=>a.position-b.position);
  await db.exec(`create table public.${qi(t)} (${cols.map(c=>`${qi(c.name)} ${c.type}${c.default?' default '+c.default:''}${c.notnull?' not null':''}`).join(',')});`);
  await db.query(`insert into public.${qi(t)} select * from jsonb_populate_recordset(null::public.${qi(t)},$1::jsonb)`,[JSON.stringify(b.data[t])]);
 }
 for(const c of b.constraints.filter(c=>c.type!=='f').concat(b.constraints.filter(c=>c.type==='f')))
  await db.exec(`alter table public.${qi(c.table)} add constraint ${qi(c.name)} ${c.definition};`);
 for(const i of b.indexes) await db.exec(i.indexdef.replace(/^(CREATE (?:UNIQUE )?INDEX) /,'$1 IF NOT EXISTS ')+';');
 await db.exec('set check_function_bodies=off;');
 for(const f of b.functions) await db.exec(f.definition);
 for(const v of b.views) await db.exec(`create view public.${qi(v.name)}${v.options?' with ('+v.options.join(',')+')':''} as ${v.definition}`);
 for(const g of b.table_grants.filter(g=>['anon','authenticated','service_role'].includes(g.grantee)))
  await db.exec(`grant ${g.privilege_type} on public.${qi(g.table_name)} to ${qi(g.grantee)};`);
 for(const f of b.functions){
  const name=`${qi(f.schema)}.${qi(f.name)}(${f.identity})`;
  await db.exec(`revoke all on function ${name} from public;`);
  for(const acl of f.acl||['=X/postgres']){
   const grantee=acl.split('=')[0]||'PUBLIC';
   await db.exec(`grant execute on function ${name} to ${grantee==='PUBLIC'?'PUBLIC':qi(grantee)};`);
  }
 }
 for(const p of b.policies) await db.exec(`create policy ${qi(p.policyname)} on public.${qi(p.tablename)} as ${p.permissive} for ${p.cmd} to ${p.roles.map(r=>r==='public'?'PUBLIC':qi(r)).join(',')}${p.qual?' using ('+p.qual+')':''}${p.with_check?' with check ('+p.with_check+')':''};`);
 for(const t of b.rls) if(t.enabled) await db.exec(`alter table public.${qi(t.table)} enable row level security;`);
 for(const t of b.triggers) await db.exec(t.definition+';');
 let rows=0;
 for(const [table,source] of Object.entries(b.data)){
  const {rows:[{data}]}=await db.query(`select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) data from public.${qi(table)} t`);
  // JSONB is canonicalized server-side to compare every field, including dates.
  const {rows:[{same}]}=await db.query(`select $1::jsonb @> $2::jsonb and $2::jsonb @> $1::jsonb same`,[JSON.stringify(source),JSON.stringify(data)]);
  assert(same,'Données différentes : '+table);rows+=source.length;
 }
 return {db,tables:Object.keys(b.data).length,rows};
}
module.exports={restaurer};
if(require.main===module)(async()=>{
 const b=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
 const r=await restaurer(b);console.log(JSON.stringify({restauration:'OK',tables:r.tables,lignes:r.rows,auth:'Références uniquement; mots de passe et sessions exclus'}));await r.db.close();
})().catch(e=>{console.error(e);process.exitCode=1;});
