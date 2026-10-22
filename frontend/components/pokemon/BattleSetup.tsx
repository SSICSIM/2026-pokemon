"use client";

import { PokemonUpload } from "./PokemonUpload";
import type { ReactNode } from "react";
import { Check, Copy, Play, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { PokemonSelector } from "./PokemonSelector";
import type { Pokemon } from "@/lib/pokemon-media";

type Side = "left" | "right";
interface Props {
  pokemon: Pokemon[];
  left?: Pokemon;
  right?: Pokemon;
  winner: Side;
  copied: boolean;
  invalidLink: boolean;
  onSelect: (side: Side, name: string) => void;
  onWinner: (side: Side) => void;
  onStart: () => void;
  onCopy: () => void;
  renderMedia: (pokemon: Pokemon, side: Side) => ReactNode;
}

export function BattleSetup({ pokemon, left, right, winner, copied, invalidLink, onSelect, onWinner, onStart, onCopy, renderMedia }: Props) {
  return (
    <section aria-labelledby="battle-generator-title" className="space-y-4">
      <div className="space-y-1">
        <h2 id="battle-generator-title" className="text-lg font-semibold tracking-tight">Battle Generator</h2>
        <p className="text-sm text-muted-foreground">Choose two Pokémon and a winner, then play the battle fullscreen.</p>
      </div>
      {invalidLink && <p role="alert" className="text-sm text-destructive">This link contains an unavailable Pokémon. Choose two Pokémon below.</p>}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {(["left", "right"] as const).map(side => {
          const selected = side === "left" ? left : right;
          return (
            <Card key={side}>
              <CardHeader>
                <CardTitle><Label htmlFor={`${side}-pokemon`}>{side === "left" ? "Left Pokémon" : "Right Pokémon"}</Label></CardTitle>
                <CardDescription>{side === "left" ? "Plays first" : "Plays second"}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="aspect-video overflow-hidden rounded-md bg-muted">{selected && renderMedia(selected, side)}</div>
                <PokemonSelector id={`${side}-pokemon`} pokemon={pokemon} selected={selected} onSelect={name => onSelect(side, name)} />
                {selected?.trainer && <p className="text-sm text-muted-foreground">Trainer: {selected.trainer}</p>}
              </CardContent>
            </Card>
          );
        })}
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Trophy className="size-4 text-primary" /> Battle outcome</CardTitle>
          <CardDescription>Choose which Pokémon appears in the victory scene.</CardDescription>
        </CardHeader>
        <CardContent>
          <div role="group" aria-label="Winner" className="flex flex-wrap gap-2">
            {(["left", "right"] as const).map(side => <Button key={side} variant={winner === side ? "default" : "outline"} aria-pressed={winner === side} onClick={() => onWinner(side)}>
              {winner === side && <Check />} {side === "left" ? `Left: ${left?.name ?? "—"}` : `Right: ${right?.name ?? "—"}`}
            </Button>)}
          </div>
        </CardContent>
        <CardFooter className="flex-wrap justify-between gap-3">
          <p className="text-xs text-muted-foreground">Click or press Space to advance. Esc returns here.</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={!left || !right} onClick={onStart}><Play /> Play video</Button>
            <Button disabled={!left || !right} onClick={onCopy}><Copy /> {copied ? "Link copied" : "Copy battle link"}</Button>
          </div>
        </CardFooter>
      </Card>
      <PokemonUpload trainers={[...new Set(pokemon.flatMap(p => p.trainer ? [p.trainer] : []))].sort((a, b) => a.localeCompare(b))} onUploaded={name => {
        onSelect("left", name);
        if (!right) onSelect("right", name);
      }} />
      {!pokemon.length && <p className="text-sm text-muted-foreground">No battle animations are available yet.</p>}
    </section>
  );
}
