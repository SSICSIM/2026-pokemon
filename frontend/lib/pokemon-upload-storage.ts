import { mkdir, open, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  PokemonUploadError, assetKey, checkSize, headerMatches, parseExtension, parseFacing, parseName, parseTrainer, withPokemon,
  type Role,
} from "./pokemon-validate";

export { PokemonUploadError };

type Upload = { extension: string; bytes: Buffer; facing: "left" | "right" };

async function readUpload(form: FormData, role: Role): Promise<Upload | undefined> {
  const file = form.get(role);
  if (file === null || (file instanceof File && !file.name && !file.size)) {
    if (role === "battle") throw new PokemonUploadError("Choose a battle animation.");
    return;
  }
  if (!(file instanceof File) || !file.size) throw new PokemonUploadError(`Choose a nonempty ${role} file.`);
  checkSize(file.size, role);
  const facing = parseFacing(form.get(`${role}Facing`), role);
  const extension = parseExtension(file.name, role);
  const bytes = Buffer.from(await file.arrayBuffer());
  if (!headerMatches(extension, bytes)) throw new PokemonUploadError(`Unsupported or invalid ${role} file. Use PNG, GIF, JPEG, WebP, MP4, or WebM.`);
  return { extension, bytes, facing };
}

export async function savePokemonUpload(form: FormData, directory: string) {
  const name = parseName(form.get("name"));
  const trainer = parseTrainer(form.get("trainer"));
  const battle = (await readUpload(form, "battle"))!;
  const victory = await readUpload(form, "victory");
  await mkdir(directory, { recursive: true });
  // A filesystem lock also serializes writers across separate Next.js workers.
  const lock = path.join(directory, ".upload-lock");
  try { await mkdir(lock); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new PokemonUploadError("Another upload is being saved. Please try again.", 409);
    throw error;
  }
  const created: string[] = [];
  const configPath = path.join(directory, "orientations.json");
  const temporaryConfig = path.join(directory, `.orientations-${randomUUID()}.tmp`);
  try {
    for (const role of ["battle", "victory"] as const) {
      await mkdir(path.join(directory, role), { recursive: true });
      const entries = await readdir(path.join(directory, role));
      if (entries.some(file => assetKey(file, role) === name.toLowerCase())) {
        throw new PokemonUploadError("A Pokémon with this name already exists. Choose a different name.", 409);
      }
    }
    const contents = await readFile(configPath, "utf8").catch(error => {
      if (error.code === "ENOENT") return '{"default":"left","pokemon":{}}';
      throw error;
    });
    const updated = withPokemon(contents, name, { battle: battle.facing, victory: victory?.facing, trainer });
    for (const [role, media] of [["battle", battle], ["victory", victory]] as const) {
      if (!media) continue;
      const destination = path.join(directory, role, `${name}_${role}${media.extension}`);
      // Exclusive creation ensures an existing file can never be overwritten.
      const handle = await open(destination, "wx");
      created.push(destination);
      try { await handle.writeFile(media.bytes); } finally { await handle.close(); }
    }
    await writeFile(temporaryConfig, updated, { flag: "wx" });
    await rename(temporaryConfig, configPath);
    return name;
  } catch (error) {
    await Promise.all(created.map(file => rm(file, { force: true })));
    throw error;
  } finally {
    await rm(temporaryConfig, { force: true });
    await rm(lock, { recursive: true, force: true });
  }
}
