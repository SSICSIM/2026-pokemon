import { readFile } from "node:fs/promises";
import path from "node:path";
import { auth } from "@/auth";
import { pokemonDirectory } from "@/lib/pokemon";
import { mediaType } from "@/lib/pokemon-media";

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  if (!(await auth())) return new Response("Unauthorized", { status: 401 });
  const { file } = await params;
  const contentType = mediaType(file);
  if (!/^(?:battle|victory)\/[^/\\]+$/.test(file) || file.includes("..") || !contentType) return new Response("Not found", { status: 404 });
  try {
    const data = await readFile(path.join(pokemonDirectory, file));
    return new Response(new Uint8Array(data), { headers: { "Content-Type": contentType, "Cache-Control": "private, no-cache", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
