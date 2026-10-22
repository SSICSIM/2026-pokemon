import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { PokemonUploadError, savePokemonUpload } from "../lib/pokemon-upload-storage";

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64");
function upload(name = "Eevee", victory = true) {
  const form = new FormData();
  form.set("name", name);
  form.set("battle", new File([png], "original.png", { type: "image/png" }));
  form.set("battleFacing", "right");
  if (victory) {
    form.set("victory", new File([png], "victory.png", { type: "image/png" }));
    form.set("victoryFacing", "left");
  }
  return form;
}
async function fixture(run: (directory: string) => Promise<void>) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "pokemon-upload-"));
  try { await run(directory); } finally { await rm(directory, { recursive: true, force: true }); }
}

test("saves both assets and separate orientations without losing existing configuration", async () => {
  await fixture(async directory => {
    await writeFile(path.join(directory, "orientations.json"), JSON.stringify({ default: "right", pokemon: { Pikachu: "left" } }));
    assert.equal(await savePokemonUpload(upload(), directory), "Eevee");
    assert.deepEqual(await readFile(path.join(directory, "battle/Eevee_battle.png")), png);
    assert.deepEqual(await readFile(path.join(directory, "victory/Eevee_victory.png")), png);
    const config = JSON.parse(await readFile(path.join(directory, "orientations.json"), "utf8"));
    assert.deepEqual(config, { default: "right", pokemon: { Pikachu: "left", Eevee: { battle: "right", victory: "left" } } });
    assert.deepEqual((await readdir(directory)).sort(), ["battle", "orientations.json", "victory"]);
  });
});

test("battle-only upload leaves victory absent for the existing battle fallback", async () => {
  await fixture(async directory => {
    await savePokemonUpload(upload("Eevee", false), directory);
    assert.deepEqual(await readdir(path.join(directory, "victory")), []);
    const config = JSON.parse(await readFile(path.join(directory, "orientations.json"), "utf8"));
    assert.deepEqual(config.pokemon.Eevee, { battle: "right" });
  });
});

test("rejects case-insensitive duplicates without changing existing files", async () => {
  await fixture(async directory => {
    await savePokemonUpload(upload(), directory);
    const original = await readFile(path.join(directory, "orientations.json"), "utf8");
    await assert.rejects(savePokemonUpload(upload("eevee"), directory), error => error instanceof PokemonUploadError && error.status === 409);
    assert.equal(await readFile(path.join(directory, "orientations.json"), "utf8"), original);
    assert.deepEqual(await readdir(path.join(directory, "battle")), ["Eevee_battle.png"]);
  });
});

test("rejects path traversal, missing media, invalid directions, and disguised file types", async () => {
  await fixture(async directory => {
    const invalidForms = [upload("../escape"), upload(), upload(), upload()];
    invalidForms[1].delete("battle");
    invalidForms[2].set("battleFacing", "up");
    invalidForms[3].set("battle", new File(["<script>alert(1)</script>"], "fake.png"));
    for (const form of invalidForms) await assert.rejects(savePokemonUpload(form, directory), PokemonUploadError);
    assert.deepEqual(await readdir(directory), []);
  });
});

test("serializes concurrent writers with a filesystem lock", async () => {
  await fixture(async directory => {
    await mkdir(path.join(directory, ".upload-lock"));
    await assert.rejects(savePokemonUpload(upload(), directory), error => error instanceof PokemonUploadError && error.status === 409);
    assert.deepEqual(await readdir(directory), [".upload-lock"]);
  });
});

test("does not overwrite malformed configuration and releases the lock after failure", async () => {
  await fixture(async directory => {
    await writeFile(path.join(directory, "orientations.json"), "invalid json");
    await assert.rejects(savePokemonUpload(upload(), directory));
    assert.equal(await readFile(path.join(directory, "orientations.json"), "utf8"), "invalid json");
    assert.deepEqual(await readdir(path.join(directory, "battle")), []);
    assert.ok(!(await readdir(directory)).includes(".upload-lock"));
  });
});
