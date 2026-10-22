// Shared by asset discovery, delivery, and playback so formats stay consistent.
export const mediaTypes: Record<string, string> = {
  gif: "image/gif", png: "image/png", apng: "image/apng",
  jpg: "image/jpeg", jpeg: "image/jpeg", jfif: "image/jpeg",
  webp: "image/webp", avif: "image/avif", svg: "image/svg+xml",
  bmp: "image/bmp", ico: "image/x-icon",
  mp4: "video/mp4", m4v: "video/mp4", webm: "video/webm",
  ogv: "video/ogg", mov: "video/quicktime",
};

export function mediaType(filename: string) {
  return mediaTypes[filename.split(".").pop()?.toLowerCase() ?? ""];
}

export type Facing = "left" | "right";
export type PokemonMedia = { src: string; kind: "image" | "video"; facing: Facing };
export type Pokemon = { name: string; trainer?: string; battle: PokemonMedia; victory: PokemonMedia };
