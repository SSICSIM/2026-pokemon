// Runs against a real Supabase Storage bucket, and only when asked:
//
//   SUPABASE_TEST_URL=... SUPABASE_TEST_SERVICE_ROLE_KEY=... npx tsx --test tests/supabase-storage.integration.test.ts
//
// Use a test project or a throwaway bucket (POKEMON_BUCKET), never production:
// it adds and removes a Pokémon called "Integration Test".
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const url = process.env.SUPABASE_TEST_URL;
const key = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
const skip = !url || !key ? "set SUPABASE_TEST_URL and SUPABASE_TEST_SERVICE_ROLE_KEY" : false;
if (!skip) {
  process.env.SUPABASE_URL = url;
  process.env.SUPABASE_SERVICE_ROLE_KEY = key;
}

const NAME = "Integration Test";
const big = path.resolve(__dirname, "../../backend/pokemon/battle/Gholdengo_battle.gif"); // 6.7 MB, over Vercel's 4.5 MB

test("reads, signs, uploads directly and cleans up against real Supabase Storage", { skip }, async () => {
  const { supabaseStorage } = await import("../lib/supabase-storage");
  const { getPokemon } = await import("../lib/pokemon");
  const { prepareDirectUpload, completeDirectUpload } = await import("../lib/pokemon-direct-upload");
  const storage = supabaseStorage()!;
  const originalConfig = await storage.download("orientations.json");
  const request = { name: NAME, trainer: "Tester", battle: { fileName: "big.gif", size: 6_695_542, facing: "right" } };

  try {
    // Reading: every Pokémon comes back with a signed link that serves its bytes.
    const before = await getPokemon();
    assert.ok(before.length > 0);
    const sample = before[0].battle.src;
    assert.match(sample, /\/storage\/v1\/object\/sign\//);
    const served = await fetch(sample);
    assert.equal(served.status, 200);
    assert.ok(Number(served.headers.get("content-length") ?? (await served.arrayBuffer()).byteLength) > 0);

    // A missing object reads as null rather than an error.
    assert.equal(await storage.download("battle/does-not-exist.gif"), null);

    // Direct upload of a file larger than a Vercel request allows.
    const { uploads } = await prepareDirectUpload(storage, request);
    const bytes = await readFile(big);
    const put = await fetch(uploads.battle!.url, { method: "PUT", body: bytes, headers: { "Content-Type": "image/gif", "x-upsert": "false" } });
    assert.equal(put.status, 200, await put.text());
    // The one-time link cannot overwrite.
    const again = await fetch(uploads.battle!.url, { method: "PUT", body: bytes, headers: { "Content-Type": "image/gif", "x-upsert": "false" } });
    assert.notEqual(again.status, 200);

    assert.equal(await completeDirectUpload(storage, request), NAME);
    const added = (await getPokemon()).find(p => p.name === NAME);
    assert.ok(added, "the new Pokémon is listed");
    assert.equal(added.trainer, "Tester");
    assert.equal(added.battle.facing, "right");
    const fetched = Buffer.from(await (await fetch(added.battle.src)).arrayBuffer());
    assert.ok(fetched.equals(bytes), "served bytes match the upload");

    // Same name again is refused before any upload link is issued.
    await assert.rejects(prepareDirectUpload(storage, request), /already exists/);

    // A disguised file is rejected and removed.
    await storage.remove([`battle/${NAME}_battle.gif`]);
    const fake = { ...request, name: `${NAME} Fake`, battle: { fileName: "fake.png", size: 20, facing: "left" } };
    const { uploads: fakeUploads } = await prepareDirectUpload(storage, fake);
    await fetch(fakeUploads.battle!.url, { method: "PUT", body: "not a png at all....", headers: { "Content-Type": "image/png" } });
    await assert.rejects(completeDirectUpload(storage, fake), /Unsupported or invalid battle file/);
    assert.equal(await storage.download(`battle/${NAME} Fake_battle.png`), null);
    assert.equal(await storage.download(".upload-lock"), null, "the lock is released");
  } finally {
    await storage.remove([`battle/${NAME}_battle.gif`, `battle/${NAME} Fake_battle.png`, ".upload-lock"]);
    if (originalConfig) await storage.upload("orientations.json", Buffer.from(originalConfig), "application/json", true);
  }
});
