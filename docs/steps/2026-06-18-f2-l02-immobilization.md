# F2-L02 - Immobilization

## Objectif

Introduire le noyau comptable `Immobilization` separe de `Equipment`, avec rattachement 1 immobilisation vers n equipements, recherche par code, UI de gestion simple, et preparation des imports `immobilizations` et `equipments`.

## Perimetre

- dans le scope :
  - schema Prisma `Immobilization`
  - relation optionnelle `Equipment.immobilizationId`
  - API `/api/v1/immobilizations`
  - enrichissement du domaine `assets`
  - UI web liste assets, fiche equipement et page immobilisations
  - catalogues d import prepares
  - seed de demonstration
- hors scope :
  - rapprochement comptable automatique
  - convergence forcee `1 immobilisation = 1 equipement`
  - execution reelle ETL `immobilizations`
  - execution reelle ETL `equipments`
  - rollback des mises a jour comptables

## Contexte initial

- demande : livrer F2-L02 selon le plan utilisateur approuve.
- etat existant :
  - `Equipment` est deja aligne sur `SpatialNode` via F2-L01.
  - `internalCode` est la cle terrain.
  - `barcode` et `qrCode` sont retires du modele metier equipement.
  - le domaine imports execute seulement `spatial-nodes`.
- contraintes :
  - rester tenant-aware.
  - ne pas creer de nouvelles permissions RBAC.
  - garder les imports `immobilizations` et `equipments` en preparation, sans persistence reelle.

## Plan

1. Ajouter le schema Prisma et la migration `f2_l02_immobilizations`.
2. Ajouter les contrats partages `immobilizations` et enrichir les contrats `assets`.
3. Ajouter le backend `immobilizations` et brancher `Equipment.immobilization`.
4. Mettre a jour les catalogues imports.
5. Ajouter la UI web de rattachement et d administration simple.
6. Ajouter le seed minimal.
7. Verifier schema, builds et tests disponibles.
8. Mettre a jour les documents racine et backlog.

## Questions ouvertes

- Aucune question bloquante pour la V1.

## Hypotheses

- `Immobilization.status` reste texte libre.
- `sourceSystem` reste texte libre.
- Une immobilisation peut rester archivee tout en restant rattachee a des equipements.
- Les droits `assets.read` et `assets.update` suffisent.

## Zones impactees

- backend :
  - `apps/api/src/immobilizations`
  - `apps/api/src/assets`
  - `apps/api/src/imports`
- frontend :
  - `apps/web/app/assets`
  - `apps/web/app/immobilizations`
  - navigation web si disponible
- base de donnees :
  - `prisma/schema.prisma`
  - nouvelle migration
  - `prisma/seed.ts`
- documentation :
  - `FUNCTIONAL_SPEC.md`
  - `TECHNICAL_ARCHITECTURE.md`
  - `DATA_MODEL.md`
  - `IMPLEMENTATION_BACKLOG.md`
  - `docs/adr/0012-immobilization-comptable-distincte.md`

## Tests prevus

- `prisma validate`
- `npm run build --workspace @inventory/shared`
- `npm run build --workspace api`
- `npm run test --workspace api`
- `npm run build --workspace web`

## Criteres d acceptation

- Une immobilisation est creee, listee, modifiee et archivee par API.
- Un equipement peut etre rattache ou detache d une immobilisation.
- La liste assets affiche et recherche l immobilisation.
- La fiche equipement affiche un groupe `Comptabilite`.
- Les catalogues imports exposent les champs attendus sans execution reelle.
- Le seed contient une immobilisation partagee et un equipement sans immobilisation.

## Decisions prises

- L immobilisation est une entite comptable distincte de l equipement physique.
- La cardinalite V1 autorise une immobilisation rattachee a plusieurs equipements.
- L archivage logique d une immobilisation ne detache pas automatiquement les equipements.
- La valeur comptable est stockee en `Decimal(14,2)` et exposee comme chaine pour eviter les pertes de precision.

## Notes d implementation

- Schema ajoute :
  - table `immobilizations`
  - relation optionnelle `Equipment.immobilizationId`
  - relation `ImportJob.initializedImmobilizations`
- Backend ajoute :
  - module `immobilizations`
  - endpoints liste, detail, creation, modification et archivage
  - permissions V1 basees sur `assets.read` et `assets.update`
  - validation du rattachement immobilisation dans `assets`
  - recherche et export assets enrichis par immobilisation
- UI ajoutee :
  - colonne et filtre immobilisation dans la liste equipements
  - groupe `Comptabilite` dans la fiche equipement
  - page `/immobilizations` avec liste, edition, creation et archivage logique
  - entree de navigation web
- Import prepare :
  - catalogue `immobilizations` aligne avec le schema V1
  - `immobilizationCode` conserve dans le catalogue `equipments`
- Seed ajoute :
  - `IMMO-DEMO-001` partagee par `AST-DESK-001` et `AST-LAP-001`
  - `AST-NOIMMO-001` sans immobilisation

## Tests executes

- `npx prisma validate --schema prisma/schema.prisma`
- `npx prisma generate --schema prisma/schema.prisma`
- `npm run build --workspace @inventory/shared`
- `npm run build --workspace api`
- `npm run build --workspace web`
- `npm run test --workspace api`
- `npm run build --workspace admin`
- `npm run db:migrate --workspace api`
- `npm run db:seed`
- `npm run test --workspace web`

## Suivi

- F2-L04 branchera l import reel `immobilizations` et la resolution `immobilizationCode` dans `equipments`.
- F2-L03 introduira le journal des mouvements equipements derive des changements de localisation et d affectation.
- Un futur lot de rapprochement devra afficher les immobilisations partagees et mesurer la convergence vers `1 immobilisation = 1 equipement`.

## Ajout consultation immobilisation

### Objectif

Permettre d ouvrir une immobilisation en mode consultation depuis la liste, sans passer immediatement en edition, et afficher les equipements rattaches a cette immobilisation.

### Plan

1. Enrichir le contrat `ImmobilizationDetail` avec une liste synthetique d equipements rattaches.
2. Enrichir `GET /api/v1/immobilizations/:id` pour retourner ces equipements.
3. Ajouter un bouton `Afficher` dans la liste web des immobilisations.
4. Ajouter un mode consultation read-only avec metadonnees comptables et liste des equipements lies.
5. Garder le bouton `Modifier` comme action distincte.

### Tests prevus

- `npm run build --workspace @inventory/shared`
- `npm run build --workspace api`
- `npm run build --workspace web`

### Notes d implementation

- `ImmobilizationDetail` expose maintenant `equipments`.
- `GET /api/v1/immobilizations/:id` charge les equipements rattaches avec code interne, numero de serie, type, statut et localisation courante.
- La liste web des immobilisations propose maintenant deux actions :
  - `Afficher` : mode consultation read-only avec liste des equipements lies.
  - `Modifier` : mode edition du referentiel comptable.

### Tests executes

- `npm run build --workspace @inventory/shared`
- `npm run build --workspace api`
- `npm run build --workspace web`
- `npm run test --workspace api`
