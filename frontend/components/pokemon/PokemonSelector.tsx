"use client";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import type { Pokemon } from "@/lib/pokemon-media";

interface Props {
  id: string;
  pokemon: Pokemon[];
  selected?: Pokemon;
  onSelect: (name: string) => void;
}

export function PokemonSelector({ id, pokemon, selected, onSelect }: Props) {
  return (
    <Combobox
      items={pokemon}
      value={selected ?? null}
      onValueChange={value => { if (value) onSelect(value.name); }}
      itemToStringLabel={item => item.trainer ? `${item.name} — ${item.trainer}` : item.name}
      itemToStringValue={item => item.name}
      isItemEqualToValue={(item, value) => item.name === value.name}
      autoHighlight
      disabled={!pokemon.length}
    >
      <ComboboxInput
        id={id}
        className="w-full min-w-0"
        placeholder={pokemon.length ? "Search Pokémon or trainer…" : "No Pokémon available"}
        disabled={!pokemon.length}
        onFocus={event => event.currentTarget.select()}
      />
      <ComboboxContent className="min-w-(--anchor-width)">
        <ComboboxEmpty>No Pokémon or trainers found.</ComboboxEmpty>
        <ComboboxList>
          {(item: Pokemon) => (
            <ComboboxItem key={item.name} value={item} className="py-2">
              <span className="min-w-0 flex-1 truncate">{item.name}</span>
              {item.trainer && <span className="ml-auto max-w-[50%] truncate text-xs text-muted-foreground">{item.trainer}</span>}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
