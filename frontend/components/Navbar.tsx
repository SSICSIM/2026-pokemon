"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users } from "lucide-react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { CharacterManagerDialog } from "@/components/crisis/CharacterManagerDialog";

export function Navbar() {
  const [charOpen, setCharOpen] = useState(false);
  const pathname = usePathname();
  if (pathname === "/login") return null;

  return (
    <>
      <header className="bg-background/95 sticky top-0 z-40 border-b backdrop-blur-md">
        <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-3 px-6 py-3">
          <Link href="/" className="text-sm font-semibold tracking-tight text-primary">
            SSICSIM <span className="ml-2 font-normal text-muted-foreground">Committee tools</span>
          </Link>
          <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setCharOpen(true)}>
            <Users className="mr-2 h-4 w-4" />
            Characters
          </Button>
          <Button variant="ghost" size="sm" onClick={() => signOut({ callbackUrl: "/login" })}>Sign out</Button>
          </div>
        </div>
      </header>
      {charOpen && <CharacterManagerDialog open={charOpen} onOpenChange={setCharOpen} />}
    </>
  );
}
