"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Copy, Play, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Pokemon } from "@/lib/pokemon-media";

type Side = "left" | "right";

export function BattleAnimator({ pokemon, initialLeft, initialRight, initialWinner = "left", autoplay = false }: {
  pokemon: Pokemon[];
  initialLeft?: string;
  initialRight?: string;
  initialWinner?: Side;
  autoplay?: boolean;
}) {
  const validLeft = pokemon.find(p => p.name === initialLeft);
  const validRight = pokemon.find(p => p.name === initialRight);
  const [leftName, setLeftName] = useState(validLeft?.name ?? pokemon[0]?.name ?? "");
  const [rightName, setRightName] = useState(validRight?.name ?? pokemon[1]?.name ?? pokemon[0]?.name ?? "");
  const [winner, setWinner] = useState<Side>(initialWinner);
  // 0 menu → 1 left → 2 right → 3 battle → 4 white → 5 victory → 6 black.
  const [slide, setSlide] = useState(autoplay && validLeft && validRight ? 1 : 0);
  const [copied, setCopied] = useState(false);
  const lockedUntil = useRef(0);
  const left = pokemon.find(p => p.name === leftName);
  const right = pokemon.find(p => p.name === rightName);
  const champion = winner === "left" ? left : right;
  const battleUrl = `/battle?${new URLSearchParams({ left: leftName, right: rightName, winner })}`;

  useEffect(() => {
    for (const media of new Set([left?.battle, right?.battle, champion?.victory])) {
      if (media?.kind === "image") { const image = new Image(); image.src = media.src; }
    }
  }, [left, right, champion]);

  const returnToMenu = useCallback(() => {
    setSlide(0);
    window.history.replaceState(null, "", "/");
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  }, []);

  const advance = useCallback(() => {
    if (Date.now() < lockedUntil.current) return;
    if (slide === 6) { returnToMenu(); return; }
    if (slide === 0) return;
    const next = slide + 1;
    if (next >= 4) lockedUntil.current = Date.now() + 850;
    setSlide(next);
    // A shared URL can enter browser fullscreen on its first user gesture.
    if (!document.fullscreenElement) void document.documentElement.requestFullscreen?.().catch(() => {});
  }, [slide, returnToMenu]);

  useEffect(() => {
    if (!slide) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { returnToMenu(); return; }
      if ([" ", "Enter", "ArrowRight"].includes(event.key) && !event.repeat) {
        event.preventDefault(); advance();
      }
    };
    const previousOverflow = document.body.style.overflow;
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) returnToMenu();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, [slide, advance, returnToMenu]);

  function start() {
    if (!left || !right) return;
    window.history.pushState(null, "", battleUrl);
    setSlide(1);
    void document.documentElement.requestFullscreen?.().catch(() => {});
  }

  useEffect(() => {
    const onBack = () => { setSlide(0); if (document.fullscreenElement) void document.exitFullscreen().catch(() => {}); };
    window.addEventListener("popstate", onBack);
    return () => window.removeEventListener("popstate", onBack);
  }, []);

  function sprite(p: Pokemon, side: Side, victory = false) {
    // Left-side Pokémon face right; right-side Pokémon face left.
    const media = victory ? p.victory : p.battle;
    const style = { transform: media.facing === side ? "scaleX(-1)" : undefined };
    if (media.kind === "video") {
      return <video key={media.src} className="battle-sprite" src={media.src} aria-label={p.name} autoPlay loop muted playsInline preload="auto" disablePictureInPicture style={style} />;
    }
    return <img className="battle-sprite" src={media.src} alt={p.name} draggable={false} style={style} />;
  }

  if (slide && left && right && champion) {
    return (
      <main className="battle-stage" onClick={advance} aria-label="Battle slideshow. Click or press space to advance. Escape returns to the menu.">
        {slide === 1 && <div className="battle-solo">{sprite(left, "left")}</div>}
        {slide === 2 && <div className="battle-solo">{sprite(right, "right")}</div>}
        {(slide === 3 || slide === 4) && <div className="battle-pair">
          <div className="battle-fighter battle-shake-left">{sprite(left, "left")}</div>
          <div className="battle-fighter battle-shake-right">{sprite(right, "right")}</div>
        </div>}
        {(slide === 5 || slide === 6) && <div className="battle-solo">{sprite(champion, winner, true)}</div>}
        {slide === 4 && <div key="white-in" className="battle-curtain battle-white-in" />}
        {slide === 5 && <div key="white-out" className="battle-curtain battle-white-out" />}
        {slide === 6 && <div key="black-in" className="battle-curtain battle-black-in" />}
      </main>
    );
  }

  return (
    <main className="animator-menu">
      <div className="animator-panel">
        <div className="animator-eyebrow"><span className="pokeball-mark" /> BATTLE STUDIO</div>
        <h1>Set the stage.</h1>
        <p className="animator-subtitle">Two Pokémon. One winner. Your next battle.</p>
        {autoplay && (!validLeft || !validRight) && <p className="text-sm text-destructive mt-4">Choose two available Pokémon to start this battle.</p>}
        <div className="animator-matchup">
          {(["left", "right"] as const).map(side => {
            const selected = side === "left" ? left : right;
            return <section className="animator-pick" key={side}>
              <label htmlFor={`${side}-pokemon`}>{side === "left" ? "01 / LEFT" : "02 / RIGHT"}</label>
              <div className="animator-preview">{selected && sprite(selected, side)}</div>
              <select id={`${side}-pokemon`} value={side === "left" ? leftName : rightName} onChange={event => { (side === "left" ? setLeftName : setRightName)(event.target.value); setCopied(false); }}>
                {pokemon.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
              </select>
            </section>;
          })}
          <span className="animator-versus">VS</span>
        </div>
        <div className="animator-winner">
          <span><Trophy size={16} /> Pick the winner</span>
          <div className="animator-winner-options">
            {(["left", "right"] as const).map(side => <button key={side} type="button" aria-pressed={winner === side} onClick={() => { setWinner(side); setCopied(false); }}>
              {winner === side && <Check size={14} />} {side === "left" ? "Left" : "Right"}
            </button>)}
          </div>
        </div>
        <Button className="animator-start" onClick={start} disabled={!left || !right}><Play size={16} fill="currentColor" /> Make video <ArrowRight size={18} /></Button>
        {!pokemon.length && <p className="text-sm text-destructive">Add battle assets to backend/pokemon/battle to begin.</p>}
        <div className="animator-footer">
          <p>Click to advance · Esc to return</p>
          <button type="button" disabled={!left || !right} onClick={async () => {
            try { await navigator.clipboard.writeText(new URL(battleUrl, window.location.origin).href); setCopied(true); } catch { window.prompt("Copy battle link", new URL(battleUrl, window.location.origin).href); }
          }}><Copy size={13} /> {copied ? "Copied" : "Copy battle link"}</button>
        </div>
      </div>
    </main>
  );
}
