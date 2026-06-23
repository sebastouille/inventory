# Specification technique - F0 L01 modele cible spatial equipements immobilisations

## Objectif

Definir le modele cible de haut niveau a implementer pour les fondations avant les workflows. Ce document couvre la structure spatiale, le noyau equipements, l entite comptable d immobilisation, le journal de mouvements unitaires, et la trajectoire de migration depuis le modele actuel.

## Etat existant

- `Location` est actuellement un objet plat avec `code`, `name` et `description`
- `Equipment` existe deja comme noyau patrimonial unitaire
- `EquipmentAssignment` gere les affectations mais pas un vrai journal de mouvements unitaire
- aucune entite comptable dediee aux immobilisations n existe
- `products` et `stock-movements` couvrent le stock et non les equipements unitaires

## Conception proposee

### 1. Modele spatial cible

Le referentiel spatial cible repose sur un noeud hierarchique normalise plutot que sur des tables separees par niveau.

Entite cible proposee : `SpatialNode`

Champs minimaux :

- `id`
- `organizationId`
- `type` : `SITE | BUILDING | FLOOR | ZONE | ROOM | LOCATION`
- `code`
- `label`
- `description`
- `path`
- `parentId`
- `externalSource`
- `externalRef`
- `importProfileId`
- `lastImportJobId`
- `isActive`
- `createdAt`
- `updatedAt`

Proposition Prisma cible :

```prisma
enum SpatialNodeType {
  SITE
  BUILDING
  FLOOR
  ZONE
  ROOM
  LOCATION
}

model SpatialNode {
  id                String          @id @default(uuid())
  organizationId    String
  type              SpatialNodeType
  code              String
  label             String
  description       String?
  path              String
  depth             Int
  sortOrder         Int?            @default(0)
  parentId          String?
  legacyLocationId  String?
  externalSource    ImportSourceKind? @default(LEGACY)
  externalRef       String?
  importProfileId   String?
  lastImportJobId   String?
  isActive          Boolean         @default(true)
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt

  organization      Organization    @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  parent            SpatialNode?    @relation("SpatialNodeTree", fields: [parentId], references: [id], onDelete: SetNull)
  children          SpatialNode[]   @relation("SpatialNodeTree")
  importProfile     ImportProfile?  @relation(fields: [importProfileId], references: [id], onDelete: SetNull)
  lastImportJob     ImportJob?      @relation(fields: [lastImportJobId], references: [id], onDelete: SetNull)

  @@unique([organizationId, parentId, code])
  @@unique([organizationId, path])
  @@index([organizationId, type])
  @@index([organizationId, parentId])
  @@index([organizationId, code])
  @@index([organizationId, legacyLocationId])
  @@index([organizationId, externalRef])
}
```

Regles :

- le modele V1 repose sur une table unique `SpatialNode`
- l unicite technique est portee par `organizationId + parentId + code`
- `path` est un identifiant logique unique par organisation pour la navigation, les imports et l audit
- `parentId` est nullable pour permettre une migration progressive et pour les racines
- la relation parent/enfant doit respecter l ordre de profondeur
- le lien ETL parent cible repose sur `parentPath`, avec reconstruction possible via `path`
- `parentInternalCode` n est pas retenu en V1 comme cle d import de reference
- `externalSource` permet de distinguer `LEGACY`, `CSV`, `XLSX`, plus tard `IFC4`
- il n y a pas de versioning fort du referentiel spatial en V1 ; la tracabilite repose sur la provenance d import et l audit des changements

Contraintes metier recommandees :

- `SITE` ne peut pas avoir de parent
- `BUILDING` ne peut avoir comme parent que `SITE`
- `FLOOR` ne peut avoir comme parent que `BUILDING`
- `ZONE` ne peut avoir comme parent que `FLOOR` ou `BUILDING` si une organisation n utilise pas le niveau `FLOOR`
- `ROOM` peut avoir comme parent `ZONE`, `FLOOR` ou `BUILDING` selon la profondeur reelle de l organisation
- `LOCATION` reste un type de transition pour la migration des anciennes `Location`
- `depth` est derive de la profondeur du parent et controle a chaque import ou mutation
- `path` est normalise en ASCII majuscule, sans espace de bord, avec separateur `/`
- `path` est reconstruit applicativement et ne doit pas etre saisi librement dans l UI d edition
- un equipement peut etre importe initialement sous un noeud `ZONE`, puis etre relocalise ulterieurement vers un noeud `ROOM` via correction ou mouvement metier sans contrainte de reimport complet

Politique de migration depuis `Location` :

- conserver `Location` pendant la transition
- creer un `SpatialNode` de type `LOCATION` pour chaque `Location` legacy
- remplir `legacyLocationId` pour garder la tracabilite de migration
- basculer ensuite les dependances applicatives vers `SpatialNode`
- supprimer progressivement les usages legacy une fois les imports et les lectures stabilises

### Proposition de migration Prisma exacte pour F1-L02

Objectif : introduire `SpatialNode` sans casser les usages existants de `Location`, puis rendre possible la migration progressive des lectures.

#### Etape 1 - enrichir le schema

Ajouter :

```prisma
enum SpatialNodeType {
  SITE
  BUILDING
  FLOOR
  ZONE
  ROOM
  LOCATION
}
```

Ajouter a `Organization` :

```prisma
  spatialNodes      SpatialNode[]
```

Ajouter les relations d import :

```prisma
  spatialNodes      SpatialNode[]    @relation("ImportProfileSpatialNodes")
```

sur `ImportProfile`, et :

```prisma
  spatialNodes      SpatialNode[]    @relation("ImportJobSpatialNodes")
```

sur `ImportJob`.

Ajouter le modele :

```prisma
model SpatialNode {
  id               String            @id @default(uuid()) @db.Uuid
  organizationId   String            @db.Uuid
  type             SpatialNodeType
  code             String
  label            String
  description      String?
  path             String
  depth            Int
  sortOrder        Int               @default(0)
  parentId         String?           @db.Uuid
  legacyLocationId String?           @db.Uuid
  externalSource   ImportSourceKind?
  externalRef      String?
  importProfileId  String?           @db.Uuid
  lastImportJobId  String?           @db.Uuid
  isActive         Boolean           @default(true)
  createdAt        DateTime          @default(now())
  updatedAt        DateTime          @updatedAt

  organization     Organization      @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  parent           SpatialNode?      @relation("SpatialNodeTree", fields: [parentId], references: [id], onDelete: SetNull)
  children         SpatialNode[]     @relation("SpatialNodeTree")
  importProfile    ImportProfile?    @relation("ImportProfileSpatialNodes", fields: [importProfileId], references: [id], onDelete: SetNull)
  lastImportJob    ImportJob?        @relation("ImportJobSpatialNodes", fields: [lastImportJobId], references: [id], onDelete: SetNull)

  @@unique([organizationId, parentId, code])
  @@unique([organizationId, path])
  @@unique([legacyLocationId])
  @@index([organizationId, type])
  @@index([organizationId, parentId])
  @@index([organizationId, code])
  @@index([organizationId, externalRef])
  @@map("spatial_nodes")
}
```

#### Etape 2 - migration SQL de creation

La migration Prisma cree :

- le nouvel enum `SpatialNodeType`
- la table `spatial_nodes`
- les index
- les contraintes d unicite
- les cles etrangeres vers :
  - `organizations`
  - `spatial_nodes`
  - `locations`
  - `import_profiles`
  - `import_jobs`

#### Etape 3 - backfill depuis `Location`

Dans la meme vague `F1-L02`, executer un script de migration applicatif :

- pour chaque `Location`
  - creer un `SpatialNode`
  - `type = LOCATION`
  - `code = Location.code`
  - `label = Location.name`
  - `description = Location.description`
  - `path = Location.code`
  - `depth = 0`
  - `legacyLocationId = Location.id`
  - `externalSource = null`
  - `externalRef = null`
  - `isActive = true`

Contrainte :

- si plusieurs `Location.code` legacy entrent en conflit dans une meme organisation, arreter le backfill et produire un rapport de correction avant reprise

#### Etape 4 - coexistence transitoire

Apres backfill :

- `Location` reste en place
- les nouveaux imports spatiaux alimentent `SpatialNode`
- les API existantes peuvent continuer a lire `Location` tant que `F1-L03` n est pas termine
- les nouveaux usages fondation lisent `SpatialNode`

#### Etape 5 - preconditions pour F2

Avant `F2-L01` :

- chaque `Location` legacy doit avoir son `SpatialNode` correspondant
- les imports spatiaux doivent cibler uniquement `SpatialNode`
- les parcours arborescents et recherches par `path` doivent etre operationnels

### 2. Noyau equipements cible

`Equipment` reste le noyau patrimonial unitaire, avec les evolutions suivantes :

- `internalCode` devient la seule cle terrain a encoder et scanner
- `barcode` et `qrCode` sont supprimes du schema cible
- `serialNumber` reste une donnee constructeur optionnelle selon le contexte de reception
- ajout d une liaison vers la localisation courante normalisee :
  - `currentSpatialNodeId`
- ajout de metadonnees d initialisation et d exploitation :
  - `receivedAt`
  - `commissionedAt`
  - `lastInventoryAt`
  - `initialImportSource`
  - `importBatchId`
- les caracteristiques techniques et notes libres restent conservees

### 3. Entite immobilisation cible

Une entite comptable dediee est introduite.

Entite cible proposee : `Immobilization`

Champs minimaux :

- `id`
- `organizationId`
- `code`
- `label`
- `status`
- `costCenter`
- `purchaseValue`
- `purchaseDate`
- `serviceStartAt`
- `sourceSystem`
- `externalRef`
- `createdAt`
- `updatedAt`

Relation cible :

- `1 Immobilization -> n Equipment`

Implementation cible :

- `Equipment.immobilizationId` nullable
- recherche equipement par `Immobilization.code`
- la purge metier future vers `1 equipement = 1 immobilisation` se traite par controles et indicateurs, pas par une contrainte immediate

### 4. Journal de mouvements unitaire

Entite cible proposee : `EquipmentMovement`

Champs minimaux :

- `id`
- `organizationId`
- `equipmentId`
- `movementType`
- `triggerType`
- `fromSpatialNodeId`
- `toSpatialNodeId`
- `fromAssignmentSnapshot`
- `toAssignmentSnapshot`
- `reason`
- `source`
- `createdById`
- `createdAt`

Regles :

- une entree est creee a chaque changement de localisation
- une entree est creee a chaque changement d affectation
- les imports peuvent creer des mouvements de type `INITIAL_IMPORT` ou `RECONCILIATION`
- le journal de mouvements unitaires ne remplace pas l audit technique, il le complete

### 5. Coexistence des domaines

- `products` reste reserve au stock, accessoires, fournitures et quantites
- `assets` devient le domaine de verite pour les equipements unitaires
- `stock-movements` ne doit plus porter les deplacements d equipements
- les futurs ecrans `inventory` metier terrain et `movements` doivent basculer sur `assets`, `spatial`, `immobilizations` et `equipment-movements`

## Interfaces et contrats

- les imports metier viseront les domaines cibles :
  - `spatial-nodes`
  - `equipments`
  - `immobilizations`
- l API devra exposer une recherche croisee :
  - par `internalCode`
  - par `serialNumber`
  - par `immobilization.code`
  - par localisation spatiale

## Donnees et persistence

### Trajectoire de migration

1. Introduire `SpatialNode` sans supprimer `Location`.
2. Migrer les `Location` existantes vers `SpatialNode` de type `LOCATION`, sans parent dans un premier temps.
3. Introduire `currentSpatialNodeId` sur `Equipment` et sur les affectations pertinentes.
4. Introduire `Immobilization` et la liaison vers `Equipment`.
5. Introduire `EquipmentMovement`.
6. Basculer les lectures applicatives des equipements vers le nouveau spatial.
7. Retirer progressivement les usages de `Location` legacy.
8. Supprimer `barcode` et `qrCode` du schema cible et des contrats API une fois les migrations de lecture/ecriture appliquees.

### Contraintes de migration

- toute migration est tenant-aware
- les imports initiaux doivent etre rejouables
- les cles externes doivent permettre une initialisation partielle
- l historique d audit doit rester lisible pendant la transition
- les reimports spatiaux doivent rester deterministes a partir du `path` et de la relation `parentPath + code`

## Securite et audit

- tout acces reste filtre par `organizationId`
- les imports doivent etre journalises
- les creations et changements d immobilisation, de localisation courante et d affectation doivent etre audites
- les changements derivant un `EquipmentMovement` doivent inclure l utilisateur et la source

## Strategie de test

- tests Prisma sur les unicites et relations critiques
- tests API sur les recherches par code immobilisation et `internalCode`
- tests de migration sur la conversion `Location -> SpatialNode`
- tests d emission automatique des `EquipmentMovement`

## Risques

- migration du spatial plus lourde que prevu
- confusion transitoire entre `Location` legacy et `SpatialNode`
- qualite heterogene des imports initiaux
- besoin de scripts de nettoyage si les anciens usages `barcode` et `qrCode` sont encore branches ailleurs

## Notes de deploiement

- deployer d abord les nouvelles tables et les lectures compatibles
- faire coexister temporairement les anciennes et nouvelles structures
- planifier une vague de nettoyage finale pour retirer les anciens champs et usages
