import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { mediaType, type Facing, type Pokemon, type PokemonMedia } from "./pokemon-media";
import { supabaseStorage } from "./supabase-storage";

// Signed links outlive a conference session; any page load or refresh renews them.
const SIGNED_URL_SECONDS = 12 * 60 * 60;

export const pokemonDirectory = process.env.POKEMON_ASSET_DIR ?? path.resolve(process.cwd(), "../backend/pokemon");
type Role = "battle" | "victory";
type Orientation = Facing | (Partial<Record<Role, Facing>> & { trainer?: string });
type Orientations = { default?: Facing; pokemon?: Record<string, Orientation> };

async function fileNames(role: Role) {
  const storage = supabaseStorage();
  if (storage) return (await storage.list(role)).map(object => object.name);
  const entries = await readdir(path.join(pokemonDirectory, role), { withFileTypes: true });
  return entries.filter(entry => entry.isFile()).map(entry => entry.name);
}

async function readConfig() {
  const storage = supabaseStorage();
  if (!storage) return readFile(path.join(pokemonDirectory, "orientations.json"), "utf8");
  const bytes = await storage.download("orientations.json");
  return bytes ? Buffer.from(bytes).toString("utf8") : '{"default":"left","pokemon":{}}';
}

async function assets(role: Role) {
  const result = new Map<string, string>();
  for (const file of (await fileNames(role)).sort((a, b) => a.localeCompare(b))) {
    if (!mediaType(file)) continue;
    const name = path.parse(file).name.replace(new RegExp(`_${role}$`, "i"), "").trim();
    if (!name) continue;
    if (result.has(name)) throw new Error(`Multiple ${role} assets for ${name}. Keep one file per Pokémon in ${role}/.`);
    result.set(name, file);
  }
  return result;
}

function facing(value: unknown, fallback: Facing): Facing {
  return value === "left" || value === "right" ? value : fallback;
}

export async function getPokemon(): Promise<Pokemon[]> {
  const [battles, victories, contents] = await Promise.all([assets("battle"), assets("victory"), readConfig()]);
  const config: Orientations = JSON.parse(contents);
  // In production the browser loads media straight from storage by signed link.
  const storage = supabaseStorage();
  const signed = storage
    ? await storage.signedUrls([
      ...[...battles.values()].map(file => `battle/${file}`),
      ...[...victories.values()].map(file => `victory/${file}`),
    ], SIGNED_URL_SECONDS)
    : null;
  const defaultFacing = facing(config.default, "left");
  return [...battles].map(([name, battleFile]) => {
    const entry = config.pokemon?.[name];
    const baseEntry = config.pokemon?.[name.replace(/-Mega$/i, "")];
    const trainer = (typeof entry === "object" && entry ? entry.trainer : undefined)
      ?? (typeof baseEntry === "object" && baseEntry ? baseEntry.trainer : undefined);
    const direction = (role: Role) => facing(typeof entry === "string" ? entry : entry?.[role], defaultFacing);
    const media = (file: string, role: Role): PokemonMedia => ({
      src: signed?.get(`${role}/${file}`) ?? `/api/pokemon/${encodeURIComponent(`${role}/${file}`)}`,
      kind: mediaType(file)?.startsWith("video/") ? "video" : "image",
      facing: direction(role),
    });
    const battle = media(battleFile, "battle");
    const victoryFile = victories.get(name);
    // Fallback uses the battle file's orientation, not the missing victory's.
    return { name, trainer, battle, victory: victoryFile ? media(victoryFile, "victory") : battle };
  });
}
