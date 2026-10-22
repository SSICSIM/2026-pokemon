"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CharacterManagerDialog } from "@/components/crisis/CharacterManagerDialog";

export function Navbar() {
  const [charOpen, setCharOpen] = useState(false);
  const pathname = usePathname();
  if (pathname === "/" || pathname === "/battle" || pathname === "/login") return null;

  return (
    <>
      <header className="bg-background/95 sticky top-0 z-40 border-b backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <Link href="/" className="text-sm font-semibold tracking-tight">
            Crisis Tracker
          </Link>
          <Button variant="outline" size="sm" onClick={() => setCharOpen(true)}>
            <Users className="mr-2 h-4 w-4" />
            Characters
          </Button>
        </div>
      </header>
      <CharacterManagerDialog open={charOpen} onOpenChange={setCharOpen} />
    </>
  );
}
