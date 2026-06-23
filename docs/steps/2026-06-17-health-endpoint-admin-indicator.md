# Endpoint health et voyant admin

## Objectif

Ajouter un vrai endpoint `GET /api/v1/health` cote API, puis afficher un voyant de sante API dans le header de `apps/admin` uniquement.

## Perimetre

- dans le scope :
  - endpoint public de sante API
  - verification minimale de la connexion base via Prisma
  - contrat partage de reponse health
  - indicateur visuel dans le header admin
  - polling leger cote admin
- hors scope :
  - voyant dans `apps/web`
  - healthcheck Kubernetes ou Docker dedie
  - metriques avancees
  - supervision externe

## Contexte initial

- demande :
  - ajouter un vrai endpoint `GET /api/v1/health`
  - brancher un voyant de sante API dans le header du front cote admin uniquement
- etat existant :
  - aucune route health dediee
  - l admin signale deja les erreurs reseau via `ApiError`
  - le shell partage `AppShell` porte le header commun
- contraintes :
  - documentation en francais ASCII
  - changements de code et de docs dans le meme scope
  - ne pas impacter `apps/web`

## Plan

1. Ajouter un module backend `health` et exposer `GET /api/v1/health`.
2. Ajouter un contrat partage pour la reponse health.
3. Etendre le shell partage pour accepter un bloc de statut optionnel dans le header.
4. Brancher dans `apps/admin` un polling de sante API et un voyant visuel.
5. Mettre a jour la documentation d etat courant et verifier par build.

## Questions ouvertes

- aucune

## Hypotheses

- le voyant admin peut etre public et ne depend pas du token JWT
- un check `SELECT 1` Prisma est suffisant pour une V1 de health
- un statut `degraded` avec code HTTP `503` est acceptable si la base ne repond pas

## Zones impactees

- backend :
  - `apps/api/src/app.module.ts`
  - nouveau module `apps/api/src/health`
- frontend :
  - `apps/admin/components/admin-shell.tsx`
  - `apps/admin/lib/api.ts`
  - `packages/ui/src/components/app-shell.tsx`
- base de donnees :
  - aucune migration
- infrastructure :
  - aucun changement de deploiement
- documentation :
  - present fichier d etape
  - `FUNCTIONAL_SPEC.md`
  - `TECHNICAL_ARCHITECTURE.md`

## Tests prevus

- `npm run build --workspace @inventory/shared`
- `npm run build --workspace api`
- `npm run build --workspace admin`
- verification HTTP locale sur `GET /api/v1/health`

## Criteres d'acceptation

- `GET /api/v1/health` repond avec un payload explicite
- le payload indique au minimum l etat API, l etat base et un horodatage
- le header admin affiche un voyant lisible
- le voyant ne s affiche pas dans `apps/web`
- le voyant admin degrade proprement si l API est injoignable

## Decisions prises

- le healthcheck V1 est public et ne depend pas du JWT
- le healthcheck V1 verifie la base par `SELECT 1` via Prisma
- la reponse health renvoie `200` en mode `ok` et `503` en mode `degraded`
- le voyant est branche dans le header admin via une extension optionnelle du shell partage
- aucun voyant n est ajoute dans `apps/web`

## Notes d'implementation

- ajout du contrat partage `ApiHealthResponse` dans `packages/shared`
- ajout du module Nest `apps/api/src/health` avec controller et service dedies
- ajout du helper admin `fetchApiHealth()` sans token
- ajout d un polling toutes les 30 secondes dans `apps/admin/components/admin-shell.tsx`
- rendu visuel :
  - vert : `API OK`
  - ambre : `API degradee`
  - rouge : `API indisponible`
- le detail complet est expose via `title` et `aria-label` sur le voyant
- verification locale HTTP :
  - `GET http://localhost:3011/api/v1/health`
  - reponse observee : `200` avec `{\"status\":\"ok\",\"api\":\"up\",\"database\":\"up\"...}`

## Suivi

- documents mis a jour :
  - `FUNCTIONAL_SPEC.md`
  - `TECHNICAL_ARCHITECTURE.md`
- tests executes :
  - `npm run build --workspace @inventory/shared`
  - `npm run build --workspace api`
  - `npm run build --workspace admin`
  - `curl.exe -i http://localhost:3011/api/v1/health`
