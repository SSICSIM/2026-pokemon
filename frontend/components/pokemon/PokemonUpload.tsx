"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { MAX_POKEMON_FILE_BYTES, POKEMON_UPLOAD_ACCEPT } from "@/lib/pokemon-upload";

function MediaField({ role, required }: { role: "battle" | "victory"; required?: boolean }) {
  const [file, setFile] = useState<File>();
  const [preview, setPreview] = useState("");
  useEffect(() => {
    if (!file) { setPreview(""); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return (
    <div className="space-y-3">
      <Label htmlFor={`upload-${role}`}>{role === "battle" ? "Battle animation" : "Victory animation (optional)"}</Label>
      <Input id={`upload-${role}`} name={role} type="file" required={required} accept={POKEMON_UPLOAD_ACCEPT} onChange={event => {
        const selected = event.target.files?.[0];
        event.target.setCustomValidity(selected && selected.size > MAX_POKEMON_FILE_BYTES ? "Choose a file of 50 MB or smaller." : "");
        setFile(selected);
      }} />
      {preview && <div className="aspect-video overflow-hidden rounded-md bg-muted">
        {/\.(mp4|m4v|webm)$/i.test(file?.name ?? "")
          ? <video className="h-full w-full object-contain" src={preview} controls muted playsInline />
          : <img className="h-full w-full object-contain" src={preview} alt={`Original ${role} animation`} />}
      </div>}
      <Label htmlFor={`upload-${role}-facing`}>Original facing direction</Label>
      <NativeSelect id={`upload-${role}-facing`} name={`${role}Facing`} defaultValue="left" className="w-full">
        <NativeSelectOption value="left">Faces left ←</NativeSelectOption>
        <NativeSelectOption value="right">Faces right →</NativeSelectOption>
      </NativeSelect>
    </div>
  );
}

async function postJson(url: string, payload: unknown) {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Upload failed. Please try again.");
  return result;
}

// In production files go straight to storage (prepare → upload → complete);
// locally the form posts to the app, which writes to backend/pokemon.
async function upload(body: FormData, trainer: string): Promise<string> {
  const files = { battle: body.get("battle"), victory: body.get("victory") };
  const meta = (role: "battle" | "victory") => {
    const file = files[role];
    return file instanceof File && file.size ? { fileName: file.name, size: file.size, facing: body.get(`${role}Facing`) } : undefined;
  };
  const request = { name: body.get("name"), trainer, battle: meta("battle"), victory: meta("victory") };
  const prepared = await postJson("/api/pokemon/upload/prepare", request);
  if (prepared.mode === "local") {
    const response = await fetch("/api/pokemon/upload", { method: "POST", body });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Upload failed. Please try again.");
    return result.name;
  }
  for (const role of ["battle", "victory"] as const) {
    const target = prepared.uploads?.[role];
    if (!target) continue;
    const response = await fetch(target.url, {
      method: "PUT", body: files[role] as File, headers: { "Content-Type": target.contentType, "x-upsert": "false" },
    });
    if (!response.ok) throw new Error(`The ${role} file could not be uploaded. Please try again.`);
  }
  return (await postJson("/api/pokemon/upload/complete", request)).name;
}

export function PokemonUpload({ trainers = [], onUploaded }: { trainers?: string[]; onUploaded: (name: string) => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [formKey, setFormKey] = useState(0);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const body = new FormData(event.currentTarget);
    const trainer = String(body.get("trainer") ?? "").trim();
    setBusy(true); setError(""); setSuccess("");
    try {
      const name = await upload(body, trainer);
      setSuccess(`${name}${trainer ? ` — ${trainer}` : ""} added to the Pokémon library.`);
      setFormKey(key => key + 1);
      onUploaded(name);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed. Please try again.");
    } finally { setBusy(false); }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Upload className="size-4" /> Add Pokémon</CardTitle>
        <CardDescription>Upload an animation and choose which way the Pokémon faces in the original. Without a victory animation, the battle animation plays again.</CardDescription>
      </CardHeader>
      <CardContent>
        <form key={formKey} onSubmit={submit} className="space-y-4" aria-busy={busy}>
          <fieldset disabled={busy} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="upload-pokemon-name">Pokémon name</Label>
              <Input id="upload-pokemon-name" name="name" placeholder="e.g. Eevee" required maxLength={80} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="upload-trainer">Trainer (optional)</Label>
              <Input id="upload-trainer" name="trainer" list="upload-trainers" placeholder="Choose or enter a trainer" maxLength={80} />
              <datalist id="upload-trainers">
                {trainers.map(trainer => <option key={trainer} value={trainer} />)}
              </datalist>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <MediaField role="battle" required />
              <MediaField role="victory" />
            </div>
            <p className="text-xs text-muted-foreground">PNG, GIF, JPEG, WebP, MP4, or WebM · Up to 50 MB per file</p>
            <Button type="submit" disabled={busy}><Upload /> {busy ? "Uploading…" : "Add Pokémon"}</Button>
          </fieldset>
        </form>
        {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
        {success && <p role="status" className="mt-3 text-sm">{success}</p>}
      </CardContent>
    </Card>
  );
}
