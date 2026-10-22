import { CommitteeWorkspace } from "@/components/CommitteeWorkspace";
import { getPokemon } from "@/lib/pokemon";

export const dynamic = "force-dynamic";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  return <CommitteeWorkspace pokemon={await getPokemon()} initialTab={tab === "battle" ? "battle" : "crisis"} />;
}
