# F2-L03 - equipment movements

## Objectif

Introduire un journal metier de mouvements dedie aux equipements unitaires, distinct des mouvements de stock `products`.

## Perimetre

- dans le scope :
  - schema `EquipmentMovement`
  - contrats partages
  - API de lecture
  - emission automatique depuis `assets`
  - timeline dans la fiche equipement
  - page web de liste des mouvements equipements
- hors scope :
  - creation manuelle de mouvement
  - reconstruction historique avant F2-L03
  - rollback de mouvement
  - branchement des imports F2-L04

## Contexte initial

- `Equipment.currentSpatialNodeId` est la source de verite de localisation courante.
- `EquipmentAssignment` gere les affectations `PERSON` et `ASSET`.
- `stock-movements` reste reserve au stock `products`.
- `AuditLog` existe deja mais reste un journal technique, pas une timeline metier exploitable.

## Plan

1. Ajouter le schema, les enums et la migration.
2. Ajouter les types partages.
3. Ajouter le module API `equipment-movements`.
4. Brancher l emission automatique dans `AssetsService`.
5. Ajouter la timeline dans la fiche equipement web.
6. Ajouter la page `/equipment-movements`.
7. Renommer la navigation stock en `Mouvements stock`.
8. Mettre a jour les documents racine.
9. Executer les validations.

## Questions ouvertes

- Aucune question bloquante.

## Hypotheses

- Une entree initiale est creee lors de la creation d un equipement si une localisation ou une affectation existe.
- Une entree est creee par changement d affectation.
- `LOCATION` reste legacy et ne cree pas de mouvement courant.
- Les imports futurs reutiliseront le meme service avec `source=IMPORT`.

## Zones impactees

- backend :
  - `apps/api/src/equipment-movements`
  - `apps/api/src/assets`
- frontend :
  - `apps/web/app/equipment-movements`
  - `apps/web/components/assets/asset-editor-page.tsx`
  - `apps/web/components/app-shell.tsx`
- base de donnees :
  - `prisma/schema.prisma`
  - migration `f2_l03_equipment_movements`
- documentation :
  - ADR 0013
  - documents racine

## Tests prevus

- `npx prisma validate --schema prisma/schema.prisma`
- `npm run build --workspace @inventory/shared`
- `npm run build --workspace api`
- `npm run test --workspace api`
- `npm run build --workspace web`
- `npm run test --workspace web`

## Criteres d acceptation

- La creation d un equipement avec localisation ou affectation cree un mouvement initial.
- Le changement de localisation cree un mouvement `LOCATION_CHANGED`.
- L ajout, retrait ou changement d affectation `PERSON` ou `ASSET` cree un mouvement dedie.
- La sauvegarde sans changement ne cree pas de mouvement.
- La fiche equipement affiche la timeline metier.
- La page globale des mouvements equipements est consultable.

## Decisions prises

- Le journal `EquipmentMovement` complete `AuditLog`, il ne le remplace pas.
- Aucun endpoint de creation manuelle n est expose en V1.
- Les mouvements stock et les mouvements equipements restent separes.

## Notes d implementation

- Schema ajoute :
  - enums `EquipmentMovementType`, `EquipmentMovementTriggerType`, `EquipmentMovementSource`
  - table `equipment_movements`
  - relations vers organisation, equipement, spatial source/cible et utilisateur createur
- Backend ajoute :
  - module `equipment-movements`
  - endpoints `GET /api/v1/equipment-movements`, `GET /api/v1/equipment-movements/:id`, `GET /api/v1/assets/:assetId/movements`
  - service `recordForAssetMutation` reutilisable par les futurs imports
  - emission depuis `AssetsService.create` et `AssetsService.update`
- UI ajoutee :
  - panneau `Mouvements equipement` dans la fiche equipement
  - page `/equipment-movements`
  - navigation separee `Mouvements stock` et `Mouvements equipements`
- Tests ajoutes :
  - derivation de l etat initial
  - changement de localisation
  - changement et retrait d affectation
  - absence de mouvement si aucun changement utile

## Tests executes

- `npx prisma validate --schema prisma/schema.prisma`
- `npx prisma generate --schema prisma/schema.prisma`
- `npm run build --workspace @inventory/shared`
- `npm run build --workspace api`
- `npm run test --workspace api`
- `npm run build --workspace web`
- `npm run test --workspace web`
- `npm run build --workspace admin`
- `npm run db:migrate --workspace api`

## Suivi

- F2-L04 reutilisera le service pour les mouvements issus d imports.
