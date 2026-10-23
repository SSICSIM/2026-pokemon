import assert from "node:assert/strict";
import test from "node:test";
import { completeDirectUpload, prepareDirectUpload } from "../lib/pokemon-direct-upload";
import { PokemonUploadError } from "../lib/pokemon-validate";
import { StorageError, type SupabaseStorage } from "../lib/supabase-storage";

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64");

// An in-memory bucket with Supabase's rules: no overwrite without upsert.
function fakeStorage(seed: Record<string, Buffer | string> = {}) {
  const objects = new Map<string, { bytes: Buffer; created: string }>();
  const now = () => new Date().toISOString();
  for (const [p, v] of Object.entries(seed)) objects.set(p, { bytes: Buffer.from(v), created: now() });
  const storage: SupabaseStorage = {
    bucket: "test",
    async list(prefix) {
      return [...objects.entries()]
        .filter(([p]) => (prefix ? p.startsWith(`${prefix}/`) && !p.slice(prefix.length + 1).includes("/") : !p.includes("/")))
        .map(([p, o]) => ({ name: prefix ? p.slice(prefix.length + 1) : p, created_at: o.created }));
    },
    async download(p, range) {
      const o = objects.get(p);
      if (!o) return null;
      const end = range ? Number(range.split("-")[1]) + 1 : undefined;
      return new Uint8Array(o.bytes.subarray(0, end));
    },
    async upload(p, body, _type, upsert = false) {
      if (objects.has(p) && !upsert) throw new StorageError("exists", 409);
      objects.set(p, { bytes: Buffer.from(body as string | Buffer), created: now() });
    },
    async remove(paths) { for (const p of paths) objects.delete(p); },
    async signedUrls(paths) { return new Map(paths.map(p => [p, `signed://${p}`])); },
    async signedUploadUrl(p) { return `put://${p}`; },
  };
  // What the browser does with a one-time link.
  const put = (url: string, bytes: Buffer) => {
    const p = url.replace("put://", "");
    if (objects.has(p)) throw new Error("exists");
    objects.set(p, { bytes, created: now() });
  };
  return { storage, objects, put };
}

const request = (name = "Eevee", victory = true) => ({
  name,
  trainer: "Ash",
  battle: { fileName: "original.png", size: png.length, facing: "right" },
  ...(victory && { victory: { fileName: "won.PNG", size: png.length, facing: "left" } }),
});

test("prepare hands out one link per file at the Pokémon's own paths", async () => {
  const { storage } = fakeStorage();
  const prepared = await prepareDirectUpload(storage, request());
  assert.deepEqual(prepared, {
    name: "Eevee",
    uploads: {
      battle: { url: "put://battle/Eevee_battle.png", contentType: "image/png" },
      victory: { url: "put://victory/Eevee_victory.png", contentType: "image/png" },
    },
  });
});

test("complete records the Pokémon and keeps existing orientations", async () => {
  const { storage, objects, put } = fakeStorage({ "orientations.json": '{"default":"right","pokemon":{"Pikachu":"left"}}' });
  const { uploads } = await prepareDirectUpload(storage, request());
  put(uploads.battle!.url, png);
  put(uploads.victory!.url, png);
  assert.equal(await completeDirectUpload(storage, request()), "Eevee");
  assert.deepEqual(JSON.parse(objects.get("orientations.json")!.bytes.toString()), {
    default: "right",
    pokemon: { Pikachu: "left", Eevee: { battle: "right", victory: "left", trainer: "Ash" } },
  });
  assert.ok(!objects.has(".upload-lock"));
});

test("prepare rejects names already in storage, case-insensitively", async () => {
  const { storage } = fakeStorage({ "battle/eevee_battle.gif": "GIF89a" });
  await assert.rejects(prepareDirectUpload(storage, request()), (e: unknown) => e instanceof PokemonUploadError && e.status === 409);
});

test("complete deletes a disguised file and leaves the configuration alone", async () => {
  const { storage, objects, put } = fakeStorage({ "orientations.json": '{"pokemon":{}}' });
  const { uploads } = await prepareDirectUpload(storage, request("Eevee", false));
  put(uploads.battle!.url, Buffer.from("not really a png"));
  await assert.rejects(completeDirectUpload(storage, request("Eevee", false)), /Unsupported or invalid battle file/);
  assert.ok(!objects.has("battle/Eevee_battle.png"));
  assert.equal(objects.get("orientations.json")!.bytes.toString(), '{"pokemon":{}}');
  assert.ok(!objects.has(".upload-lock"));
});

test("complete never deletes files of a name that is already recorded", async () => {
  const { storage, objects } = fakeStorage({
    "orientations.json": '{"pokemon":{"Eevee":"left"}}',
    "battle/Eevee_battle.png": png,
  });
  await assert.rejects(completeDirectUpload(storage, request("eevee", false)), (e: unknown) => e instanceof PokemonUploadError && e.status === 409);
  assert.ok(objects.has("battle/Eevee_battle.png"));
});

test("a fresh lock blocks a second upload; a stale one is cleared", async () => {
  const { storage, objects, put } = fakeStorage({ ".upload-lock": "busy" });
  const { uploads } = await prepareDirectUpload(storage, request("Eevee", false));
  put(uploads.battle!.url, png);
  await assert.rejects(completeDirectUpload(storage, request("Eevee", false)), /Another upload is being saved/);
  assert.ok(objects.has("battle/Eevee_battle.png"), "a blocked upload keeps its files for the retry");
  objects.get(".upload-lock")!.created = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  assert.equal(await completeDirectUpload(storage, request("Eevee", false)), "Eevee");
});

test("prepare applies the same rules as the form upload", async () => {
  const { storage } = fakeStorage();
  const bad = [
    { ...request(), name: "../escape" },
    { ...request(), battle: undefined },
    { ...request(), battle: { fileName: "a.exe", size: 10, facing: "left" } },
    { ...request(), battle: { fileName: "a.png", size: 60 * 1024 * 1024, facing: "left" } },
    { ...request(), battle: { fileName: "a.png", size: 10, facing: "up" } },
  ];
  for (const body of bad) await assert.rejects(prepareDirectUpload(storage, body), PokemonUploadError);
});
