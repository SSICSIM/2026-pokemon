"use client";

import { useState } from "react";
import { ClipboardList, Swords } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CrisisTrackerPage } from "@/components/crisis/CrisisTrackerPage";
import { BattleAnimator } from "@/components/pokemon/BattleAnimator";
import type { Pokemon } from "@/lib/pokemon-media";

interface Props {
  pokemon: Pokemon[];
  initialTab?: "crisis" | "battle";
  initialLeft?: string;
  initialRight?: string;
  initialWinner?: "left" | "right";
  autoplay?: boolean;
}

export function CommitteeWorkspace({ initialTab = "crisis", ...battleProps }: Props) {
  const [tab, setTab] = useState(initialTab);
  return (
    <main className="page-shell space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Committee workspace</h1>
        <p className="text-sm text-muted-foreground">Manage crisis notes for your committee</p>
      </div>
      <Tabs value={tab} onValueChange={value => {
        setTab(value as "crisis" | "battle");
        window.history.replaceState(null, "", `/?tab=${value}`);
      }} className="space-y-4">
        <TabsList aria-label="Committee tools">
          <TabsTrigger value="crisis"><ClipboardList /> Crisis Tracker</TabsTrigger>
          <TabsTrigger value="battle"><Swords /> Battle Generator</TabsTrigger>
        </TabsList>
        <TabsContent value="crisis"><CrisisTrackerPage embedded /></TabsContent>
        <TabsContent value="battle"><BattleAnimator {...battleProps} /></TabsContent>
      </Tabs>
    </main>
  );
}
