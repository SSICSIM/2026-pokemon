"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useActivePeriod } from "@/hooks/useCrisisPeriods";
import { ActiveNotesTab } from "./ActiveNotesTab";
import { AnalyticsTab } from "./AnalyticsTab";
import { ArchiveTab } from "./ArchiveTab";
import { PeriodBanner } from "./PeriodBanner";

export function CrisisTrackerPage({ embedded = false }: { embedded?: boolean }) {
  const { data: activePeriod } = useActivePeriod();

  return (
    <section className={embedded ? "space-y-4" : "page-shell space-y-4"}>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight">Crisis Tracker</h2>
        <p className="text-muted-foreground text-sm">
          Track directives and crisis notes for this committee session.
        </p>
      </div>

      <PeriodBanner />

      <Tabs defaultValue="active" className="space-y-4">
        <TabsList>
          <TabsTrigger value="active">Active Notes</TabsTrigger>
          <TabsTrigger value="archive">Archive</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-0">
          <ActiveNotesTab activePeriodId={activePeriod?.id ?? null} />
        </TabsContent>

        <TabsContent value="archive" className="mt-0">
          <ArchiveTab />
        </TabsContent>

        <TabsContent value="analytics" className="mt-0">
          <AnalyticsTab defaultPeriodId={activePeriod?.id ?? null} />
        </TabsContent>
      </Tabs>
    </section>
  );
}
