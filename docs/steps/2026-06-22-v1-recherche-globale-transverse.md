# 2026-06-22 - V1 recherche globale et navigation transverse

## Objectif

Activer une vraie recherche globale V1 dans le header partage des applications `web` et `admin`, avec suggestions automatiques a partir de 3 caracteres et navigation directe vers les objets metier.

## Perimetre

- dans le scope :
  - endpoint backend transverse `GET /api/v1/search/global`
  - contrats partages de recherche globale
  - composant UI de recherche dans le shell partage
  - branchement du header `web` et `admin`
  - deep-link par query params pour `campaigns`, `locations`, `immobilizations`, `imports`
- hors scope :
  - recherche sur `products`, `suppliers`, `stock-movements`, `anomalies`, `reconciliation`
  - IAM admin dans la recherche globale V1
  - nouvelles routes detail dediees
  - optimisation SQL avancee ou moteur full-text

## Contexte initial

- demande : transformer le champ `Navigation et espace de travail` en vraie recherche globale generique
- etat existant :
  - le champ existe deja dans `packages/ui/src/components/app-shell.tsx`
  - aucune logique de recherche n est branchee
  - `assets` a une vraie route detail
  - `campaigns`, `locations`, `immobilizations` et `imports` reposent encore sur une page liste + etat interne
- contraintes :
  - recherche par codes et libelles metier, jamais par UUID ni identifiants internes BD
  - `inventaires` doit pointer vers les campagnes terrain, pas vers la vue stock `overview`
  - depuis `apps/admin`, un resultat doit ouvrir la cible metier dans `apps/web`

## Plan

1. Ajouter la documentation d etape, l ADR, puis les types partages de recherche globale.
2. Ajouter un module backend transverse de recherche globale filtre par permissions.
3. Ajouter un composant `GlobalSearchBox` dans `packages/ui` et l integrer au shell partage.
4. Brancher des hooks de recherche globale dans `apps/web` et `apps/admin`.
5. Ajouter les deep-links par query params sur `campaigns`, `locations`, `immobilizations` et `imports`.
6. Ajouter les tests backend et frontend cibles, puis valider avec les builds workspace.

## Questions ouvertes

- aucune question ouverte bloquante restante

## Hypotheses

- `internalCode` des equipements est un code metier terrain legitime pour la recherche
- les URLs `web` retournees par l API peuvent rester relatives, puis etre rendues absolues dans `apps/admin`
- la V1 peut s appuyer sur un scoring applicatif simple sans indexation dediee

## Zones impactees

- backend :
  - nouveau module `global-search`
  - lecture transverses `equipment`, `inventoryCampaign`, `spatialNode`, `immobilization`, `importJob`, `importProfile`
- frontend :
  - `packages/ui` shell partage
  - `apps/web/components/app-shell.tsx`
  - `apps/admin/components/admin-shell.tsx`
  - pages `campaigns`, `locations`, `immobilizations`, `imports`
- base de donnees :
  - aucune migration
  - aucune table nouvelle
- infrastructure :
  - nouvelle variable publique optionnelle `NEXT_PUBLIC_WEB_APP_URL` cote admin
- documentation :
  - nouvel ADR
  - mise a jour des specs fonctionnelle, technique et modele de donnees

## Tests prevus

- `npm run test --workspace api`
- `npm run test --workspace @inventory/ui`
- `npm run build --workspace @inventory/shared`
- `npm run build --workspace api`
- `npm run build --workspace web`
- `npm run build --workspace admin`

## Criteres d'acceptation

- la recherche globale devient active dans les headers `web` et `admin`
- les suggestions apparaissent a partir de 3 caracteres avec debounce
- les groupes sont filtres par permissions
- un clic ou `Enter` ouvre la bonne cible metier
- les pages `campaigns`, `locations`, `immobilizations` et `imports` savent s ouvrir depuis leurs query params

## Decisions prises

- `apps/admin` ouvre les resultats metier dans `apps/web`
- `inventaires` est mappe aux campagnes terrain uniquement
- aucune nouvelle permission IAM n est creee pour cette V1

## Notes d'implementation

- ajout de `packages/shared/src/global-search.ts` pour les contrats de groupes et suggestions
- ajout du module backend `apps/api/src/global-search` avec endpoint `GET /api/v1/search/global`
- scoring applicatif V1 :
  - prefixe code ou libelle favorise
  - sous-chaine secondaire
  - tri final par score puis `updatedAt`
- permissions appliquees sans nouveau droit dedie :
  - `assets.read` -> `assets`, `immobilizations`
  - `campaigns.read` -> `campaigns`
  - `spatial.read` -> `locations`
  - `imports.read` -> `imports.jobs`, `imports.profiles`
- integration du composant `GlobalSearchBox` dans `packages/ui/src/components/app-shell.tsx`
- ajout d un hook `useGlobalSearch` dans `apps/web` et `apps/admin`
- `apps/admin` recompose les URLs vers `apps/web` via `NEXT_PUBLIC_WEB_APP_URL` avec fallback dev `http://localhost:3010`
- deep-links ajoutes sur :
  - `/campaigns?campaignId=...`
  - `/locations?perimeterId=...`
  - `/immobilizations?immobilizationId=...`
  - `/imports?jobId=...`
  - `/imports?profileId=...`
- les pages Next utilisant `useSearchParams` ont ete encapsulees dans `Suspense` pour respecter Next 16 en build statique

## Suivi

- tests executes :
  - `npm run build --workspace @inventory/shared`
  - `npm run build --workspace @inventory/ui`
  - `npm run build --workspace api`
  - `npm run build --workspace web`
  - `npm run build --workspace admin`
  - `npm run test --workspace api -- src/global-search/global-search.service.spec.ts`
  - `npm run test --workspace @inventory/ui -- src/components/global-search-box.spec.tsx`
  - `npm run test --workspace web -- tests/use-global-search.unit.spec.tsx`
  - `npm run test --workspace admin -- tests/use-global-search.unit.spec.tsx`
- limites restantes :
  - pas de recherche V1 sur `products`, `suppliers`, `stock-movements`, `anomalies`, `reconciliation`
  - pas d optimisation SQL ou full-text dediee
  - pas de recherche admin dediee sur `users`, `roles`, `spatial` ou `assets-references`
