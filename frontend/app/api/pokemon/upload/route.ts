import { auth } from "@/auth";
import { pokemonDirectory } from "@/lib/pokemon";
import { MAX_POKEMON_FILE_BYTES } from "@/lib/pokemon-upload";
import { PokemonUploadError, savePokemonUpload } from "@/lib/pokemon-upload-storage";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!(await auth())) return Response.json({ error: "Please sign in to upload Pokémon." }, { status: 401 });
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return Response.json({ error: "Upload from this site's battle setup page." }, { status: 403 });
  }
  if (Number(request.headers.get("content-length")) > MAX_POKEMON_FILE_BYTES * 2 + 1024 * 1024) {
    return Response.json({ error: "Each file must be 50 MB or smaller." }, { status: 413 });
  }
  let form: FormData;
  try { form = await request.formData(); }
  catch { return Response.json({ error: "Invalid upload. Please choose your files again." }, { status: 400 }); }
  try {
    const name = await savePokemonUpload(form, pokemonDirectory);
    return Response.json({ name }, { status: 201 });
  } catch (error) {
    if (error instanceof PokemonUploadError) return Response.json({ error: error.message }, { status: error.status });
    console.error("Pokémon upload failed", error);
    return Response.json({ error: "Could not save the Pokémon. Please try again." }, { status: 500 });
  }
}
