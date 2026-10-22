import { auth } from "@/auth";
import { prepareDirectUpload } from "@/lib/pokemon-direct-upload";
import { PokemonUploadError } from "@/lib/pokemon-validate";
import { supabaseStorage } from "@/lib/supabase-storage";

export const runtime = "nodejs";

// Step 1 of a direct upload: validate, then hand back one-time upload links.
// Without Supabase configured (local Docker) the form posts to /api/pokemon/upload.
export async function POST(request: Request) {
  if (!(await auth())) return Response.json({ error: "Please sign in to upload Pokémon." }, { status: 401 });
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return Response.json({ error: "Upload from this site's battle setup page." }, { status: 403 });
  }
  const storage = supabaseStorage();
  if (!storage) return Response.json({ mode: "local" });
  let body: unknown;
  try { body = await request.json(); }
  catch { return Response.json({ error: "Invalid upload. Please choose your files again." }, { status: 400 }); }
  try {
    return Response.json({ mode: "direct", ...(await prepareDirectUpload(storage, body)) });
  } catch (error) {
    if (error instanceof PokemonUploadError) return Response.json({ error: error.message }, { status: error.status });
    console.error("Pokémon upload prepare failed", error);
    return Response.json({ error: "Could not start the upload. Please try again." }, { status: 500 });
  }
}
