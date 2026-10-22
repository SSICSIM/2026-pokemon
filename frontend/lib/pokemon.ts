import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { mediaType, type Facing, type Pokemon, type PokemonMedia } from "./pokemon-media";

export const pokemonDirectory = process.env.POKEMON_ASSET_DIR ?? path.resolve(process.cwd(), "../backend/pokemon");
type Role = "battle" | "victory";
type Orientation = Facing | Partial<Record<Role, Facing>>;
type Orientations = { default?: Facing; pokemon?: Record<string, Orientation> };

async function assets(role: Role) {
  const entries = await readdir(path.join(pokemonDirectory, role), { withFileTypes: true });
  const result = new Map<string, string>();
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isFile() || !mediaType(entry.name)) continue;
    const name = path.parse(entry.name).name.replace(new RegExp(`_${role}$`, "i"), "").trim();
    if (!name) continue;
    if (result.has(name)) throw new Error(`Multiple ${role} assets for ${name}. Keep one file per Pokémon in ${role}/.`);
    result.set(name, entry.name);
  }
  return result;
}

function facing(value: unknown, fallback: Facing): Facing {
  return value === "left" || value === "right" ? value : fallback;
}

export async function getPokemon(): Promise<Pokemon[]> {
  const [battles, victories, contents] = await Promise.all([
    assets("battle"), assets("victory"),
    readFile(path.join(pokemonDirectory, "orientations.json"), "utf8"),
  ]);
  const config: Orientations = JSON.parse(contents);
  const defaultFacing = facing(config.default, "left");
  return [...battles].map(([name, battleFile]) => {
    const entry = config.pokemon?.[name];
    const direction = (role: Role) => facing(typeof entry === "string" ? entry : entry?.[role], defaultFacing);
    const media = (file: string, role: Role): PokemonMedia => ({
      src: `/api/pokemon/${encodeURIComponent(`${role}/${file}`)}`,
      kind: mediaType(file)?.startsWith("video/") ? "video" : "image",
      facing: direction(role),
    });
    const battle = media(battleFile, "battle");
    const victoryFile = victories.get(name);
    // Fallback uses the battle file's orientation, not the missing victory's.
    return { name, battle, victory: victoryFile ? media(victoryFile, "victory") : battle };
  });
}
