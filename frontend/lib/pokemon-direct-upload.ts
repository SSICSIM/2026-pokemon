import {
  PokemonUploadError, ROLES, assetFileName, assetKey, checkSize, headerMatches, parseExtension, parseFacing, parseName,
  parseTrainer, withPokemon, type Facing, type Role,
} from "./pokemon-validate";
import { mediaType } from "./pokemon-media";
import { StorageError, type SupabaseStorage } from "./supabase-storage";

// Uploads that skip the app server: Vercel functions accept about 4.5 MB per
// request, so the browser sends each file straight to storage on a one-time
// link (prepare), then the server checks the files and records the Pokémon
// in orientations.json (complete).

type FileMeta = { fileName: string; size: number; facing: Facing };
export type DirectUploadRequest = { name: string; trainer?: string; battle: FileMeta; victory?: FileMeta };

const LOCK = ".upload-lock";
const STALE_LOCK_MS = 2 * 60 * 1000;

type Parsed = {
  name: string;
  trainer: string;
  files: Partial<Record<Role, { path: string; extension: string; facing: Facing }>>;
};

function parse(input: unknown): Parsed {
  const body = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const name = parseName(body.name);
  const trainer = parseTrainer(body.trainer);
  const files: Parsed["files"] = {};
  for (const role of ROLES) {
    const meta = body[role] as Record<string, unknown> | undefined | null;
    if (!meta) {
      if (role === "battle") throw new PokemonUploadError("Choose a battle animation.");
      continue;
    }
    checkSize(Number(meta.size), role);
    const facing = parseFacing(meta.facing, role);
    const extension = parseExtension(String(meta.fileName ?? ""), role);
    files[role] = { path: `${role}/${assetFileName(name, role, extension)}`, extension, facing };
  }
  return { name, trainer, files };
}

/** Other files already stored under this Pokémon's name, ignoring `allowed`. */
async function clashes(storage: SupabaseStorage, name: string, allowed: string[] = []) {
  for (const role of ROLES) {
    const objects = await storage.list(role);
    if (objects.some(object => assetKey(object.name, role) === name.toLowerCase() && !allowed.includes(`${role}/${object.name}`))) {
      return true;
    }
  }
  return false;
}

export async function prepareDirectUpload(storage: SupabaseStorage, input: unknown) {
  const { name, files } = parse(input);
  if (await clashes(storage, name)) {
    throw new PokemonUploadError("A Pokémon with this name already exists. Choose a different name.", 409);
  }
  const uploads: Partial<Record<Role, { url: string; contentType: string }>> = {};
  for (const role of ROLES) {
    const file = files[role];
    if (!file) continue;
    uploads[role] = {
      url: await storage.signedUploadUrl(file.path),
      contentType: mediaType(file.path) ?? "application/octet-stream",
    };
  }
  return { name, uploads };
}

async function acquireLock(storage: SupabaseStorage) {
  const take = () => storage.upload(LOCK, new Date().toISOString(), "text/plain");
  try {
    await take();
    return;
  } catch (error) {
    if (!(error instanceof StorageError) || (error.status !== 400 && error.status !== 409)) throw error;
  }
  // The lock exists. Clear it only if a crashed upload left it behind.
  const lock = (await storage.list("")).find(object => object.name === LOCK);
  const age = lock?.created_at ? Date.now() - Date.parse(lock.created_at) : Infinity;
  if (lock && age < STALE_LOCK_MS) {
    throw new PokemonUploadError("Another upload is being saved. Please try again.", 409);
  }
  await storage.remove([LOCK]);
  try { await take(); }
  catch { throw new PokemonUploadError("Another upload is being saved. Please try again.", 409); }
}

export async function completeDirectUpload(storage: SupabaseStorage, input: unknown) {
  const { name, trainer, files } = parse(input);
  const paths = ROLES.flatMap(role => (files[role] ? [files[role].path] : []));
  await acquireLock(storage);
  try {
    // A name already recorded belongs to someone else's upload: refuse, and
    // touch none of its files.
    const current = await storage.download("orientations.json");
    const contents = current ? Buffer.from(current).toString("utf8") : null;
    const recorded = Object.keys(JSON.parse(contents ?? "{}").pokemon ?? {});
    if (recorded.some(existing => existing.toLowerCase() === name.toLowerCase())) {
      throw new PokemonUploadError("A Pokémon with this name already exists. Choose a different name.", 409);
    }
    // The browser only calls complete after its uploads succeeded, and those
    // links cannot overwrite, so the files at these paths are this upload's.
    try {
      for (const role of ROLES) {
        const file = files[role];
        if (!file) continue;
        const head = await storage.download(file.path, "bytes=0-11");
        if (!head) throw new PokemonUploadError(`The ${role} file did not finish uploading. Please try again.`);
        if (!headerMatches(file.extension, head)) {
          throw new PokemonUploadError(`Unsupported or invalid ${role} file. Use PNG, GIF, JPEG, WebP, MP4, or WebM.`);
        }
      }
      if (await clashes(storage, name, paths)) {
        throw new PokemonUploadError("A Pokémon with this name already exists. Choose a different name.", 409);
      }
      const updated = withPokemon(contents, name, {
        battle: files.battle!.facing, victory: files.victory?.facing, trainer,
      });
      await storage.upload("orientations.json", updated, "application/json", true);
    } catch (error) {
      // Leave nothing half-added behind.
      await storage.remove(paths).catch(() => {});
      throw error;
    }
    return name;
  } finally {
    await storage.remove([LOCK]).catch(() => {});
  }
}
