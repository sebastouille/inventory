# F2-L01 - refonte du noyau Equipment autour du referentiel spatial

## Objectif

Transformer `Equipment` en vrai noyau terrain du patrimoine unitaire, aligne sur `SpatialNode`, en retirant `barcode` et `qrCode` du modele metier et en preparant les futurs lots `F2-L03` et `F2-L04`.

## Perimetre

- dans le scope :
  - schema Prisma `Equipment`
  - backfill `EquipmentAssignment LOCATION -> Equipment.currentSpatialNodeId`
  - contrats partages `assets`
  - API `assets`
  - UI web `assets`
  - documentation racine et etape
- hors scope :
  - entite `Immobilization`
  - journal `EquipmentMovement`
  - execution reelle de l import `equipments`
  - generation graphique code barre / QR

## Contexte initial

- demande :
  - implementer `F2-L01` selon le plan valide
- etat existant :
  - `Equipment` expose encore `barcode` et `qrCode`
  - `serialNumber` est obligatoire
  - la localisation courante passe encore par `EquipmentAssignment.targetLocationId -> Location`
  - le referentiel spatial `SpatialNode` est deja livre
- contraintes :
  - ne pas melanger le futur inventaire `equipements` avec le stock `products`
  - garder `internalCode` comme seule cle terrain cible
  - laisser `F2-L03` porter le vrai journal des mouvements

## Plan

1. Ajouter le lien direct `Equipment.currentSpatialNodeId` et les champs dates/provenance.
2. Supprimer `barcode` et `qrCode`, rendre `serialNumber` optionnel.
3. Backfiller depuis les affectations `LOCATION` legacy.
4. Refondre les contrats, DTO, repository et service `assets`.
5. Aligner la UI web `assets` sur `SpatialNode`.
6. Mettre a jour le seed, les docs et les tests.

## Questions ouvertes

- aucune

## Hypotheses

- `currentSpatialNodeId` devient la source de verite de la localisation courante
- `EquipmentAssignment.LOCATION` devient legacy et n est plus editable dans la UI
- les affectations `PERSON` et `ASSET` restent actives dans `F2-L01`

## Zones impactees

- backend :
  - `apps/api/src/assets/`
  - `apps/api/src/imports/imports-engine.ts`
- frontend :
  - `apps/web/app/assets/`
  - `apps/web/components/assets/`
- base de donnees :
  - `prisma/schema.prisma`
  - nouvelle migration Prisma
  - script de backfill equipment spatial
  - `prisma/seed.ts`
- documentation :
  - present fichier
  - `FUNCTIONAL_SPEC.md`
  - `TECHNICAL_ARCHITECTURE.md`
  - `DATA_MODEL.md`
  - `IMPLEMENTATION_BACKLOG.md`

## Tests prevus

- `npx prisma validate --schema prisma/schema.prisma`
- `npm run build --workspace @inventory/shared`
- `npm run test --workspace api`
- `npm run build --workspace api`
- `npm run build --workspace web`

## Criteres d'acceptation

- `Equipment` pointe directement vers `SpatialNode`
- `serialNumber` est optionnel
- `barcode` et `qrCode` ne sont plus exposes par le domaine `assets`
- le formulaire web `assets` edite la localisation via `SpatialNode`
- le backfill convertit les affectations `LOCATION` legacy en localisation courante
- le catalogue ETL `equipments` reste coherent avec la nouvelle cible spatiale

## Decisions prises

- `inventory` et `stock-movements` restent reserves a `products`
- `currentSpatialNodeId` devient la source de verite de la localisation courante
- `serialNumber` devient optionnel des `F2-L01`
- `barcode` et `qrCode` sortent du modele metier
- le rendu code barre / QR sera derive plus tard de `internalCode`

## Notes d'implementation

- schema Prisma et migration ajoutes pour :
  - `Equipment.currentSpatialNodeId`
  - `Equipment.initializedByImportJobId`
  - `Equipment.receivedAt`
  - `Equipment.commissionedAt`
  - `Equipment.lastInventoryAt`
  - `serialNumber` nullable
  - suppression `barcode` et `qrCode`
- script `prisma/backfill-equipment-spatial.ts` ajoute pour convertir les affectations `LOCATION` actives vers `currentSpatialNodeId`
- contrats partages `assets` alignes avec :
  - champs `currentSpatial*`
  - dates metier
  - suppression `barcode` / `qrCode`
- API `assets` refondue :
  - validation du `SpatialNode` courant par organisation
  - affectation `LOCATION` rejetee en ecriture comme flux legacy
  - recherche, export et lecture bases sur la localisation spatiale courante
- UI web `assets` refondue :
  - suppression des champs `barcode` et `qrCode`
  - edition de la localisation via `SpatialNode`
  - libelles metier explicites pour type, modele, statut, proprietaire et asset parent
  - rendu explicite des libelles selectionnes dans les `Select` pour eviter l affichage des UUID en place des noms metier
  - affichage enrichi des chemins complets `Categorie > Famille > Sous-famille > Type` et `Marque > Modele`
  - champs dates ramenes a un format date seule compact dans les sections metier, affectations et resume
- seed aligne :
  - `Equipment.currentSpatialNodeId` renseigne
  - plus d affectation `LOCATION` creee dans le jeu de demo

## Tests executes

- `npx prisma validate --schema prisma/schema.prisma`
- `npm run build --workspace @inventory/shared`
- `npm run db:generate --workspace api`
- `npm run build --workspace api`
- `npm run build --workspace web`
- `npm run test --workspace web -- asset-assignment-editor.spec.tsx`

## Ecarts restants

- `EquipmentAssignment.LOCATION` reste present au schema pour compatibilite historique, mais n est plus editable
- l import `equipments` n est pas encore execute reellement ; seuls les contrats de cible sont prets
- `F2-L03` doit encore introduire le journal `EquipmentMovement`
- `F2-L02` doit encore introduire `Immobilization`

## Suivi

- documenter explicitement la transition vers `F2-L03` pour le futur declenchement de `EquipmentMovement`
