import { MAX_POKEMON_FILE_BYTES } from "./pokemon-upload";

// Upload rules shared by the local (form) and the direct-to-storage paths.

export class PokemonUploadError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export type Role = "battle" | "victory";
export type Facing = "left" | "right";
export const ROLES: readonly Role[] = ["battle", "victory"];

const EXTENSIONS = [".png", ".apng", ".gif", ".jpg", ".jpeg", ".webp", ".mp4", ".m4v", ".webm"];

export function parseName(raw: unknown) {
  const name = typeof raw === "string" ? raw.trim().normalize("NFC") : "";
  if (!/^[\p{L}\p{N}][\p{L}\p{N} '-]{0,79}$/u.test(name)) {
    throw new PokemonUploadError("Use 1–80 letters, numbers, spaces, apostrophes, or hyphens for the Pokémon name.");
  }
  return name;
}

export function parseTrainer(raw: unknown) {
  if (raw !== null && raw !== undefined && typeof raw !== "string") {
    throw new PokemonUploadError("Enter a trainer name as text.");
  }
  const trainer = typeof raw === "string" ? raw.trim().normalize("NFC") : "";
  if (trainer.length > 80 || /[\p{Cc}\p{Cf}]/u.test(trainer)) {
    throw new PokemonUploadError("Use a trainer name of 80 characters or fewer without control characters.");
  }
  return trainer;
}

export function parseFacing(raw: unknown, role: Role): Facing {
  if (raw !== "left" && raw !== "right") throw new PokemonUploadError(`Choose the ${role} animation's facing direction.`);
  return raw;
}

export function parseExtension(fileName: string, role: Role) {
  const dot = fileName.lastIndexOf(".");
  const extension = dot >= 0 ? fileName.slice(dot).toLowerCase() : "";
  if (!EXTENSIONS.includes(extension)) {
    throw new PokemonUploadError(`Unsupported or invalid ${role} file. Use PNG, GIF, JPEG, WebP, MP4, or WebM.`);
  }
  return extension;
}

export function checkSize(size: number, role: Role) {
  if (!Number.isFinite(size) || size <= 0) throw new PokemonUploadError(`Choose a nonempty ${role} file.`);
  if (size > MAX_POKEMON_FILE_BYTES) throw new PokemonUploadError("Each file must be 50 MB or smaller.", 413);
}

// Check the actual container rather than trusting the browser's MIME type.
export function headerMatches(extension: string, bytes: Uint8Array) {
  const header = Buffer.from(bytes.subarray(0, 12));
  return [".png", ".apng"].includes(extension) ? header.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    : extension === ".gif" ? ["GIF87a", "GIF89a"].includes(header.subarray(0, 6).toString())
    : [".jpg", ".jpeg"].includes(extension) ? header[0] === 255 && header[1] === 216 && header[2] === 255
    : extension === ".webp" ? header.subarray(0, 4).toString() === "RIFF" && header.subarray(8, 12).toString() === "WEBP"
    : [".mp4", ".m4v"].includes(extension) ? header.subarray(4, 8).toString() === "ftyp"
    : extension === ".webm" ? header.subarray(0, 4).equals(Buffer.from([26, 69, 223, 163]))
    : false;
}

/** The Pokémon a stored file belongs to: "Eevee_battle.png" → "eevee". */
export function assetKey(fileName: string, role: Role) {
  const dot = fileName.lastIndexOf(".");
  const stem = dot > 0 ? fileName.slice(0, dot) : fileName;
  return stem.replace(new RegExp(`_${role}$`, "i"), "").trim().toLowerCase();
}

export const assetFileName = (name: string, role: Role, extension: string) => `${name}_${role}${extension}`;

type Orientations = { default?: Facing; pokemon?: Record<string, unknown> };

/** Adds one Pokémon to orientations.json, keeping everything already there. */
export function withPokemon(contents: string | null, name: string, entry: { battle: Facing; victory?: Facing; trainer?: string }) {
  const config: Orientations = JSON.parse(contents ?? '{"default":"left","pokemon":{}}');
  if (!config || typeof config !== "object" || Array.isArray(config)
    || (config.pokemon != null && (typeof config.pokemon !== "object" || Array.isArray(config.pokemon)))) {
    throw new Error("Invalid orientations configuration");
  }
  const value = { battle: entry.battle, ...(entry.victory && { victory: entry.victory }), ...(entry.trainer && { trainer: entry.trainer }) };
  return `${JSON.stringify({ ...config, pokemon: { ...config.pokemon, [name]: value } }, null, 2)}\n`;
}
