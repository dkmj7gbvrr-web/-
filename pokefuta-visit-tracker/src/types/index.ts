export interface Pokefuta {
  id: string;
  name: string;
  prefecture: string;
  city: string;
  address?: string;
  lat: number;
  lng: number;
  pokemons: string[];
  note?: string;
  /** 位置情報・ポケモン名などの情報が公式サイト等で確認済みかどうか */
  verified: boolean;
}

export interface VisitInfo {
  visited: boolean;
  visitedDate?: string;
  memo?: string;
}

export type PokefutaEntry = Pokefuta & { visit: VisitInfo };

export interface ExportedData {
  version: number;
  exportedAt: string;
  entries: PokefutaEntry[];
}
