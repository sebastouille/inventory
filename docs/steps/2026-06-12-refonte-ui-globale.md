# refonte-ui-globale

## Objectif

Refondre globalement l interface `admin` et `web` avec un package UI partage, des gabarits de page unifies, des listes metier paginees/exportables et une base PWA responsive pour `apps/web`.

## Perimetre

- dans le scope :
  - creation de `packages/ui`
  - theming light/dark partage
  - migration des shells et composants de page
  - migration des ecrans courants `admin` et `web`
  - extension des endpoints de listes pour pagination, tri, recherche et export `.ods`
  - bases PWA dans `apps/web`
- hors scope :
  - service worker offline
  - application mobile native separee
  - modules metier non encore implementes cote backend

## Contexte initial

- demande : implementer le plan complet de refonte UI globale fourni par l utilisateur
- etat existant : `apps/admin` et `apps/web` dupliquent leurs composants, restent orientes cartes simples, et n ont pas encore de systeme de page ni de listes metier riches
- contraintes : conserver la stack Next existante, documenter avant et apres implementation, rester compatible avec les endpoints `/api/v1`

## Plan

1. creer le package UI partage et les tokens de theme
2. etendre les contrats partages et les endpoints de listes
3. migrer les ecrans `admin`
4. migrer les ecrans `web` et les bases PWA
5. mettre a jour la documentation et valider par tests/build

## Questions ouvertes

- aucune

## Hypotheses

- le mobile sera traite comme un mode responsive / PWA dans `apps/web`
- l export OpenDocument de cette vague cible uniquement `.ods`
- les pastilles de navigation seront derivees des totaux de listes existants

## Zones impactees

- backend : endpoints de listes et exports
- frontend : `apps/admin`, `apps/web`, nouveau `packages/ui`
- base de donnees : aucune migration de schema prevue
- infrastructure : manifest PWA et build des workspaces
- documentation : dossier d etape, ADR, spec fonctionnelle et architecture

## Tests prevus

- tests unitaires du package UI
- tests unitaires `admin` et `web`
- tests API sur pagination / tri / export
- `npm run build`

## Criteres d'acceptation

- `admin` et `web` consomment un package UI partage
- toutes les listes prioritaires sont paginees, triables, filtrables et exportables en `.ods`
- `apps/web` est installable comme PWA de base
- aucun ecran courant n utilise encore l ancien shell local

## Decisions prises

- mutualiser les primitives UI dans `packages/ui`
- garder `apps/web` comme cible PWA mobile
- supporter light et dark des la premiere vague
- garder la logique de listes sur l API existante NestJS et etendre les contrats partages sans casser les routes courantes

## Notes d'implementation

- `packages/ui` cree avec tokens semantiques, themes light/dark, shells, gabarits de page, `DataGrid`, `FilterBar`, `PaginationBar`, `ActionBar`, `FormSection`, `ReadOnlyField`, `StatusBadge` et `AuthLoginCard`
- `apps/admin` et `apps/web` rebranches sur `@inventory/ui` pour les layouts, la typographie `Manrope` plus `Sora` plus `Geist Mono`, les cartes, formulaires et listes
- `apps/web` migre vers une base PWA avec `manifest.ts`, `icon.tsx`, `apple-icon.tsx`, theme color et ecrans mobile responsive
- endpoints listes et exports etendus cote API pour `iam/users`, `iam/roles`, `products`, `locations`, `suppliers`, `stock-movements`
- export `.ods` implemente via `xlsx` avec routes `/export`
- pages placeholders ajoutees pour `campaigns`, `anomalies`, `imports`, `audit`
- tests unitaires ajoutes dans `packages/ui`, `apps/admin` et `apps/web`

## Tests executes

- `npm run build`
- `npm run lint`
- `npm test`
- verification navigateur locale :
  - login `web` sur `http://localhost:3010`
  - navigation vers `products`
  - controle Network sur `/api/v1/products`, `/api/v1/locations`, `/api/v1/suppliers`, `/api/v1/stock-movements`, `/api/v1/inventory/overview`
  - login `admin` sur `http://localhost:3014`
  - navigation vers `/users`
  - controle Network sur `/api/v1/iam/users`, `/api/v1/iam/roles`, `/api/v1/iam/scopes`, `/api/v1/auth/me`

## Suivi

- documenter tout ecart entre le plan cible et le perimetre effectivement livre
- planifier la suite pour l offline reel, l optimisation SQL des listes et le nettoyage des derniers composants legacy locaux
