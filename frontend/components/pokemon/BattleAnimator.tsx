"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BattleSetup } from "./BattleSetup";
import type { Pokemon } from "@/lib/pokemon-media";

type Side = "left" | "right";

const FRAME_MS = 1000 / 12; // On twos: hold each pose for two frames of 24 fps.
const TAKEOVER_MS = 2000;
const easeInOut = (t: number) => t * t * (3 - 2 * t);
const clamp = (t: number) => Math.max(0, Math.min(1, t));

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
  const stageRef = useRef<HTMLElement>(null);
  const battleFrame = useRef({ split: 50, time: 0 });
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
    window.history.replaceState(null, "", "/?tab=battle");
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  }, []);

  const advance = useCallback(() => {
    if (Date.now() < lockedUntil.current) return;
    if (slide === 6) { returnToMenu(); return; }
    if (slide === 0) return;
    const next = slide + 1;
    if (next >= 4) lockedUntil.current = Date.now() + (next === 4 ? TAKEOVER_MS : 850);
    setSlide(next);
    // A shared URL can enter browser fullscreen on its first user gesture.
    if (!document.fullscreenElement) void document.documentElement.requestFullscreen?.().catch(() => {});
  }, [slide, returnToMenu]);

  const retreat = useCallback(() => {
    // Back always works, including while a curtain is playing.
    lockedUntil.current = 0;
    if (slide <= 1) returnToMenu();
    else setSlide(slide - 1);
  }, [slide, returnToMenu]);

  useEffect(() => {
    if (slide !== 3 && slide !== 4) return;
    const stage = stageRef.current;
    if (!stage) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const start = performance.now();
    const initial = { ...battleFrame.current };
    let lastFrame = -1;
    let request = 0;
    const render = (now: number) => {
      const frame = Math.floor((now - start) / FRAME_MS);
      if (frame !== lastFrame) {
        lastFrame = frame;
        const elapsed = frame * FRAME_MS;
        const t = (initial.time + elapsed) / 1000;
        const progress = clamp(elapsed / TAKEOVER_MS);
        // Slow anticipation, decisive push, then a long eased settle.
        const takeover = progress < 0.2
          ? 0.06 * easeInOut(progress / 0.2)
          : 0.06 + 0.94 * (1 - Math.pow(1 - (progress - 0.2) / 0.8, 3));
        const split = slide === 4
          ? initial.split + ((winner === "left" ? 100 : 0) - initial.split) * takeover
          : reducedMotion.matches ? 50 : 50 + 15 * Math.sin(t * Math.PI / 1.5);
        stage.style.setProperty("--battle-split", `${split}%`);
        for (const [side, phase] of [["left", 0], ["right", 2.1]] as const) {
          const strength = reducedMotion.matches ? 0 : slide === 4 ? Math.pow(1 - progress, 3) : 1;
          // Sample smooth arcs at 12 fps; no CSS interpolation between held poses.
          const x = Math.sin(t * Math.PI * 6 + phase) * 1.8 * strength;
          const y = Math.sin(t * Math.PI * 4 + phase) * 1.2 * strength;
          stage.style.setProperty(`--shake-${side}`, `translate(${x}%, ${y}%) scale(${1 + 0.1 * strength})`);
        }
        stage.style.setProperty("--battle-white", `${easeInOut(clamp((progress - 0.28) / 0.72))}`);
        if (slide === 3) battleFrame.current = { split, time: t * 1000 };
      }
      if (slide === 3 || (now - start) < TAKEOVER_MS + FRAME_MS) request = requestAnimationFrame(render);
    };
    render(start);
    return () => cancelAnimationFrame(request);
  }, [slide, winner]);

  useEffect(() => {
    if (!slide) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { returnToMenu(); return; }
      if (event.key === "ArrowLeft" && !event.repeat) {
        event.preventDefault(); retreat(); return;
      }
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
  }, [slide, advance, retreat, returnToMenu]);

  function start() {
    if (!left || !right) return;
    window.history.pushState(null, "", battleUrl);
    lockedUntil.current = 0;
    battleFrame.current = { split: 50, time: 0 };
    setSlide(1);
    void document.documentElement.requestFullscreen?.().catch(() => {});
  }

  useEffect(() => {
    const onBack = () => { setSlide(0); if (document.fullscreenElement) void document.exitFullscreen().catch(() => {}); };
    window.addEventListener("popstate", onBack);
    return () => window.removeEventListener("popstate", onBack);
  }, []);

  function sprite(p: Pokemon, side: Side, victory = false) {
    // Inverted placement: left-side media faces left, right-side media faces right.
    const media = victory ? p.victory : p.battle;
    const style = { transform: media.facing !== side ? "scaleX(-1)" : undefined };
    if (media.kind === "video") {
      return <video key={media.src} className="battle-sprite" src={media.src} aria-label={p.name} autoPlay loop muted playsInline preload="auto" disablePictureInPicture style={style} />;
    }
    return <img className="battle-sprite" src={media.src} alt={p.name} draggable={false} style={style} />;
  }

  if (slide && left && right && champion) {
    return (
      <div role="region" className="battle-stage" onClick={advance} aria-label="Battle slideshow. Click or press space to advance. Escape returns to the menu.">
        {slide === 1 && <div className="battle-solo">{sprite(left, "left")}</div>}
        {slide === 2 && <div className="battle-solo">{sprite(right, "right")}</div>}
        {(slide === 3 || slide === 4) && <div className="battle-pair">
          <div className="battle-fighter battle-fighter-left"><div className="battle-motion battle-shake-left">{sprite(left, "left")}</div></div>
          <div className="battle-fighter battle-fighter-right"><div className="battle-motion battle-shake-right">{sprite(right, "right")}</div></div>
        </div>}
        {(slide === 5 || slide === 6) && <div className="battle-solo">{sprite(champion, winner, true)}</div>}
        {slide === 4 && <div key="white-in" className="battle-curtain battle-white-in" />}
        {slide === 5 && <div key="white-out" className="battle-curtain battle-white-out" />}
        {slide === 6 && <div key="black-in" className="battle-curtain battle-black-in" />}
      </div>
    );
  }

  return (
    <BattleSetup
      pokemon={pokemon}
      left={left}
      right={right}
      winner={winner}
      copied={copied}
      invalidLink={autoplay && (!validLeft || !validRight)}
      onSelect={(side, name) => {
        (side === "left" ? setLeftName : setRightName)(name);
        setCopied(false);
      }}
      onWinner={side => { setWinner(side); setCopied(false); }}
      onStart={start}
      onCopy={async () => {
        const link = new URL(battleUrl, window.location.origin).href;
        try { await navigator.clipboard.writeText(link); setCopied(true); }
        catch { window.prompt("Copy battle link", link); }
      }}
      renderMedia={sprite}
    />
  );
}
