// Copies backend/pokemon (battle/, victory/, orientations.json) into the
// private Supabase Storage bucket the production site reads from. Run once
// before the first deploy, and again after adding Pokémon locally:
//
//   cd frontend
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/upload-pokemon-assets.mjs
//
// Creates the bucket if it is missing. Files already in the bucket are
// skipped, never overwritten; pass --config to replace orientations.json too.

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const base = process.env.SUPABASE_URL?.replace(/\/+$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucket = process.env.POKEMON_BUCKET || "pokemon-assets";
if (!base || !key) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
const source = process.env.POKEMON_ASSET_DIR
  ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../backend/pokemon");
const replaceConfig = process.argv.includes("--config");
const api = `${base}/storage/v1`;
const headers = { Authorization: `Bearer ${key}`, apikey: key };
const types = {
  ".gif": "image/gif", ".png": "image/png", ".apng": "image/apng", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".mp4": "video/mp4", ".m4v": "video/mp4", ".webm": "video/webm", ".json": "application/json",
};
const encodePath = (p) => p.split("/").map(encodeURIComponent).join("/");

async function ensureBucket() {
  const existing = await fetch(`${api}/bucket/${bucket}`, { headers });
  if (existing.ok) return;
  const created = await fetch(`${api}/bucket`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ id: bucket, name: bucket, public: false, file_size_limit: 50 * 1024 * 1024 }),
  });
  if (!created.ok) throw new Error(`Could not create bucket ${bucket}: ${created.status} ${await created.text()}`);
  console.log(`Created private bucket ${bucket}.`);
}

async function put(objectPath, file, upsert) {
  const type = types[path.extname(file).toLowerCase()];
  if (!type) return "skipped (unknown type)";
  const response = await fetch(`${api}/object/${bucket}/${encodePath(objectPath)}`, {
    method: "POST",
    headers: { ...headers, "Content-Type": type, "x-upsert": String(upsert), "Cache-Control": "no-cache" },
    body: await readFile(file),
  });
  if (response.ok) return "uploaded";
  const text = await response.text();
  if (!upsert && (response.status === 409 || /already exists|Duplicate/i.test(text))) return "already there";
  throw new Error(`${objectPath}: ${response.status} ${text}`);
}

await ensureBucket();
const counts = {};
for (const role of ["battle", "victory"]) {
  for (const name of (await readdir(path.join(source, role))).sort()) {
    if (name.startsWith(".")) continue;
    const result = await put(`${role}/${name}`, path.join(source, role, name), false);
    counts[result] = (counts[result] ?? 0) + 1;
    console.log(`${result.padEnd(16)} ${role}/${name}`);
  }
}
const config = await put("orientations.json", path.join(source, "orientations.json"), replaceConfig);
console.log(`${config.padEnd(16)} orientations.json`);
console.log(Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(", "));
