import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
import { readFile } from "node:fs/promises";
export const ownerId = "00000000-0000-4000-8000-000000000001";
export async function database() {
  const db = new PGlite({ extensions: { vector } });
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);`,
  );
  for (const file of [
    "202609140001_initial.sql",
    "202609140002_working_pipeline.sql",
    "202609140003_retry_budget.sql",
  ])
    await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
  await db.query("insert into auth.users(id) values($1)", [ownerId]);
  await db.query(
    "insert into owner_profiles(id,display_name) values($1,'Test owner')",
    [ownerId],
  );
  return db;
}
