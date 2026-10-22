import { mkdir, open, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { MAX_POKEMON_FILE_BYTES } from "./pokemon-upload";

export class PokemonUploadError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

type Upload = { extension: string; bytes: Buffer; facing: "left" | "right" };

async function readUpload(form: FormData, role: "battle" | "victory"): Promise<Upload | undefined> {
  const file = form.get(role);
  if (file === null || (file instanceof File && !file.name && !file.size)) {
    if (role === "battle") throw new PokemonUploadError("Choose a battle animation.");
    return;
  }
  if (!(file instanceof File) || !file.size) throw new PokemonUploadError(`Choose a nonempty ${role} file.`);
  if (file.size > MAX_POKEMON_FILE_BYTES) throw new PokemonUploadError("Each file must be 50 MB or smaller.", 413);
  const facing = form.get(`${role}Facing`);
  if (facing !== "left" && facing !== "right") throw new PokemonUploadError(`Choose the ${role} animation's facing direction.`);
  const extension = path.extname(file.name).toLowerCase();
  const bytes = Buffer.from(await file.arrayBuffer());
  const header = bytes.subarray(0, 12);
  // Check the actual container rather than trusting the browser's MIME type.
  const valid = [".png", ".apng"].includes(extension) ? header.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    : extension === ".gif" ? ["GIF87a", "GIF89a"].includes(header.subarray(0, 6).toString())
    : [".jpg", ".jpeg"].includes(extension) ? header[0] === 255 && header[1] === 216 && header[2] === 255
    : extension === ".webp" ? header.subarray(0, 4).toString() === "RIFF" && header.subarray(8, 12).toString() === "WEBP"
    : [".mp4", ".m4v"].includes(extension) ? header.subarray(4, 8).toString() === "ftyp"
    : extension === ".webm" ? header.subarray(0, 4).equals(Buffer.from([26, 69, 223, 163]))
    : false;
  if (!valid) throw new PokemonUploadError(`Unsupported or invalid ${role} file. Use PNG, GIF, JPEG, WebP, MP4, or WebM.`);
  return { extension, bytes, facing };
}

export async function savePokemonUpload(form: FormData, directory: string) {
  const rawName = form.get("name");
  const name = typeof rawName === "string" ? rawName.trim().normalize("NFC") : "";
  if (!/^[\p{L}\p{N}][\p{L}\p{N} '-]{0,79}$/u.test(name)) {
    throw new PokemonUploadError("Use 1–80 letters, numbers, spaces, apostrophes, or hyphens for the Pokémon name.");
  }
  const rawTrainer = form.get("trainer");
  if (rawTrainer !== null && typeof rawTrainer !== "string") {
    throw new PokemonUploadError("Enter a trainer name as text.");
  }
  const trainer = typeof rawTrainer === "string" ? rawTrainer.trim().normalize("NFC") : "";
  if (trainer.length > 80 || /[\p{Cc}\p{Cf}]/u.test(trainer)) {
    throw new PokemonUploadError("Use a trainer name of 80 characters or fewer without control characters.");
  }
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
      if (entries.some(file => path.parse(file).name.replace(new RegExp(`_${role}$`, "i"), "").trim().toLowerCase() === name.toLowerCase())) {
        throw new PokemonUploadError("A Pokémon with this name already exists. Choose a different name.", 409);
      }
    }
    const contents = await readFile(configPath, "utf8").catch(error => {
      if (error.code === "ENOENT") return '{"default":"left","pokemon":{}}';
      throw error;
    });
    const config = JSON.parse(contents);
    if (!config || typeof config !== "object" || Array.isArray(config)
      || (config.pokemon != null && (typeof config.pokemon !== "object" || Array.isArray(config.pokemon)))) {
      throw new Error("Invalid orientations configuration");
    }
    config.pokemon = { ...config.pokemon, [name]: { battle: battle.facing, ...(victory && { victory: victory.facing }), ...(trainer && { trainer }) } };
    for (const [role, media] of [["battle", battle], ["victory", victory]] as const) {
      if (!media) continue;
      const destination = path.join(directory, role, `${name}_${role}${media.extension}`);
      // Exclusive creation ensures an existing file can never be overwritten.
      const handle = await open(destination, "wx");
      created.push(destination);
      try { await handle.writeFile(media.bytes); } finally { await handle.close(); }
    }
    await writeFile(temporaryConfig, `${JSON.stringify(config, null, 2)}\n`, { flag: "wx" });
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
