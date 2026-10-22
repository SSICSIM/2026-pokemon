import { BattleAnimator } from "@/components/pokemon/BattleAnimator";
import { getPokemon } from "@/lib/pokemon";
export const dynamic = "force-dynamic";
export default async function BattlePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  return <BattleAnimator pokemon={await getPokemon()} initialLeft={typeof query.left === "string" ? query.left : undefined} initialRight={typeof query.right === "string" ? query.right : undefined} initialWinner={query.winner === "right" ? "right" : "left"} autoplay />;
}
