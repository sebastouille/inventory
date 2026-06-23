# Retrait du module assurances SCI du workspace inventory-app

## Objectif

Retirer du repository `inventory-app` le module assurances ajoute par erreur pour un autre projet, en supprimant ses points d entree UI, API, contrats partages, persistence Prisma, seed, migrations de nettoyage et documentation associee.

## Perimetre

- dans le scope :
  - suppression du menu et des pages web assurances
  - suppression du module API `insurances`
  - suppression des contrats partages assurances
  - suppression du schema Prisma et du seed associes
  - ajout d une migration de retrait pour nettoyer la base
  - suppression ou mise a jour de la documentation et des tickets lies aux lots assurances du 2026-06-16
- hors scope :
  - refonte d autres modules non lies aux assurances
  - purge selective de donnees hors domaine assurances
  - reecriture de l historique des anciennes migrations appliquees

## Contexte initial

- demande :
  - retirer l entree de menu `Assurance` et tout ce qui a ete genere pour les tickets `2026-06-16-assurances-sci-v1` et `2026-06-16-assurances-sci-v2-persistence-api-prisma`
- etat existant :
  - un module complet assurances existe dans `apps/web`, `apps/api`, `packages/shared`, `prisma/`, `docs/`
  - des permissions IAM et un seed de demonstration ont ete ajoutes
  - des migrations historiques ont cree la table et les permissions assurances
- contraintes :
  - garder une trace documentaire du retrait
  - ne pas casser les autres domaines ni les builds du monorepo
  - rester compatible avec l historique Prisma via une nouvelle migration de suppression, sans reecrire les anciennes migrations appliquees

## Plan

1. Documenter le retrait dans une etape et un ADR.
2. Supprimer le code assurances dans `apps/web`, `apps/api` et `packages/shared`.
3. Nettoyer `prisma/schema.prisma`, `prisma/seed.ts` et ajouter une migration SQL de retrait.
4. Supprimer ou mettre a jour les documents, backlog et questions ouvertes lies aux assurances.
5. Verifier les builds et tests des workspaces impactes.

## Questions ouvertes

- aucune a ce stade

## Hypotheses

- les fonctionnalites assurances n ont pas de dependances metier utiles a conserver dans ce workspace
- il est acceptable de conserver les anciennes migrations Prisma dans l historique tout en ajoutant une migration de retrait

## Zones impactees

- backend :
  - `apps/api/src/app.module.ts`
  - `apps/api/src/insurances/`
- frontend :
  - `apps/web/components/app-shell.tsx`
  - `apps/web/app/assurances/`
  - `apps/web/components/assurances/`
- base de donnees :
  - `prisma/schema.prisma`
  - `prisma/seed.ts`
  - `prisma/migrations/`
- infrastructure :
  - aucune
- documentation :
  - fichiers racine
  - `docs/adr/`
  - `docs/steps/`
  - `docs/api/`
  - `docs/database/`

## Tests prevus

- `npm run build --workspace @inventory/shared`
- `npm run build --workspace api`
- `npm run build --workspace web`
- `npm run build --workspace admin`
- `npm run test --workspace api`

## Criteres d'acceptation

- aucune entree `Assurances` ne reste dans la navigation web
- aucun endpoint `/api/v1/insurances` ni contrat partage assurances ne reste dans le code courant
- le schema Prisma courant ne contient plus `InsuranceContract`
- le seed ne cree plus de permissions ni de donnees assurances
- une migration de retrait supprime table et permissions assurances en base
- la documentation courante ne presente plus les assurances comme un domaine du produit

## Decisions prises

- conserver l historique des migrations appliquees et ajouter une migration de retrait plutot que reecrire le passe
- supprimer les tickets et documents assurances du 2026-06-16 car ils ne concernent pas ce workspace

## Notes d'implementation

- suppression du menu `Assurances` et des pages `apps/web/assurances`
- suppression du module API `apps/api/src/insurances`
- suppression de l export partage `packages/shared/src/insurances.ts`
- retrait des permissions assurances des contrats IAM partages et du seed
- retrait de `InsuranceContract` du schema Prisma courant
- ajout de la migration `20260617113000_remove_insurances_module`
- suppression des documents API, base, ADR et steps historiques du 2026-06-16 lies aux assurances
- mise a jour des documents racine pour retirer les assurances du perimetre courant

## Tests executes

- `npx prisma validate --schema prisma/schema.prisma`
- `npm run build --workspace @inventory/shared`
- `npm run test --workspace api`
- `npm run build --workspace api`
- `npm run build --workspace web`
- `npm run build --workspace admin`

## Suivi

- appliquer la migration Prisma de retrait sur les bases ou les migrations assurances ont deja ete executees
