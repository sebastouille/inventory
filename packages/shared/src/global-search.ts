export const GLOBAL_SEARCH_DOMAINS = [
  "assets",
  "campaigns",
  "locations",
  "immobilizations",
  "imports.jobs",
  "imports.profiles"
] as const;

export type GlobalSearchDomain = (typeof GLOBAL_SEARCH_DOMAINS)[number];

export const GLOBAL_SEARCH_DOMAIN_LABELS: Record<GlobalSearchDomain, string> = {
  assets: "Equipements",
  campaigns: "Campagnes",
  locations: "Localisations",
  immobilizations: "Immobilisations",
  "imports.jobs": "Jobs imports",
  "imports.profiles": "Profils imports"
};

export interface GlobalSearchItem {
  id: string;
  domain: GlobalSearchDomain;
  title: string;
  code: string | null;
  subtitle: string | null;
  href: string;
}

export interface GlobalSearchGroup {
  domain: GlobalSearchDomain;
  label: string;
  items: GlobalSearchItem[];
}

export interface GlobalSearchResponse {
  query: string;
  total: number;
  groups: GlobalSearchGroup[];
}
