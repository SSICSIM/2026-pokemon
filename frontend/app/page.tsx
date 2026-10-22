import { BattleAnimator } from "@/components/pokemon/BattleAnimator";
import { getPokemon } from "@/lib/pokemon";
export const dynamic = "force-dynamic";
export default async function HomePage() {
  return <BattleAnimator pokemon={await getPokemon()} />;
}
