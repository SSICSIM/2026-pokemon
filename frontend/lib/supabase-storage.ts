// A small client for Supabase Storage's REST API, used on the server only.
// Configured by SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY; POKEMON_BUCKET
// names the private bucket (default "pokemon-assets"). Without them the app
// keeps reading and writing backend/pokemon on disk, as in local Docker.

export type StoredObject = { name: string; created_at?: string | null };

export class StorageError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

const encodePath = (path: string) => path.split("/").map(encodeURIComponent).join("/");

export function supabaseStorage() {
  const base = process.env.SUPABASE_URL?.replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) return null;
  const bucket = process.env.POKEMON_BUCKET || "pokemon-assets";
  const api = `${base}/storage/v1`;
  const headers = { Authorization: `Bearer ${key}`, apikey: key };

  async function call(path: string, init: RequestInit = {}) {
    const response = await fetch(`${api}${path}`, { ...init, headers: { ...headers, ...init.headers }, cache: "no-store" });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new StorageError(`Supabase Storage ${init.method ?? "GET"} ${path} failed: ${response.status} ${detail}`.trim(), response.status);
    }
    return response;
  }
  const json = (body: unknown) => ({ body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });

  return {
    bucket,

    /** Files directly inside a folder ("battle", "victory", or "" for the root). */
    async list(prefix: string): Promise<StoredObject[]> {
      const out: StoredObject[] = [];
      for (let offset = 0; ; offset += 1000) {
        const page: StoredObject[] = await (await call(`/object/list/${bucket}`, {
          method: "POST", ...json({ prefix, limit: 1000, offset, sortBy: { column: "name", order: "asc" } }),
        })).json();
        out.push(...page);
        if (page.length < 1000) return out;
      }
    },

    /** The object's bytes, or null when it does not exist. */
    async download(path: string, range?: string) {
      try {
        const response = await call(`/object/authenticated/${bucket}/${encodePath(path)}`, range ? { headers: { Range: range } } : {});
        return new Uint8Array(await response.arrayBuffer());
      } catch (error) {
        if (error instanceof StorageError && (error.status === 400 || error.status === 404)) return null;
        throw error;
      }
    },

    /** Writes an object. Without upsert it fails if the object exists. */
    async upload(path: string, body: BodyInit, contentType: string, upsert = false) {
      await call(`/object/${bucket}/${encodePath(path)}`, {
        method: "POST", body, headers: { "Content-Type": contentType, "x-upsert": String(upsert), "Cache-Control": "no-cache" },
      });
    },

    async remove(paths: string[]) {
      if (!paths.length) return;
      await call(`/object/${bucket}`, { method: "DELETE", ...json({ prefixes: paths }) });
    },

    /** Short-lived read links, so the browser loads media straight from Supabase. */
    async signedUrls(paths: string[], expiresIn: number) {
      const urls = new Map<string, string>();
      for (let i = 0; i < paths.length; i += 500) {
        const batch = paths.slice(i, i + 500);
        const signed: { path: string | null; signedURL: string | null; error: string | null }[] = await (await call(
          `/object/sign/${bucket}`, { method: "POST", ...json({ expiresIn, paths: batch }) },
        )).json();
        // Storage returns the path unescaped; URL percent-encodes spaces and the like.
        for (const item of signed) if (item.path && item.signedURL) urls.set(item.path, new URL(`${api}${item.signedURL}`).href);
      }
      return urls;
    },

    /** A one-time link the browser can PUT one file to; it cannot overwrite. */
    async signedUploadUrl(path: string) {
      const { url } = await (await call(`/object/upload/sign/${bucket}/${encodePath(path)}`, { method: "POST" })).json();
      return new URL(`${api}${url}`).href;
    },
  };
}

export type SupabaseStorage = NonNullable<ReturnType<typeof supabaseStorage>>;
