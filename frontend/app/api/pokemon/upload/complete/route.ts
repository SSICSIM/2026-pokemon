import { auth } from "@/auth";
import { completeDirectUpload } from "@/lib/pokemon-direct-upload";
import { PokemonUploadError } from "@/lib/pokemon-validate";
import { supabaseStorage } from "@/lib/supabase-storage";

export const runtime = "nodejs";

// Step 2 of a direct upload: check the stored files and add the Pokémon.
export async function POST(request: Request) {
  if (!(await auth())) return Response.json({ error: "Please sign in to upload Pokémon." }, { status: 401 });
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return Response.json({ error: "Upload from this site's battle setup page." }, { status: 403 });
  }
  const storage = supabaseStorage();
  if (!storage) return Response.json({ error: "Direct uploads are not configured." }, { status: 404 });
  let body: unknown;
  try { body = await request.json(); }
  catch { return Response.json({ error: "Invalid upload. Please choose your files again." }, { status: 400 }); }
  try {
    return Response.json({ name: await completeDirectUpload(storage, body) }, { status: 201 });
  } catch (error) {
    if (error instanceof PokemonUploadError) return Response.json({ error: error.message }, { status: error.status });
    console.error("Pokémon upload failed", error);
    return Response.json({ error: "Could not save the Pokémon. Please try again." }, { status: 500 });
  }
}
