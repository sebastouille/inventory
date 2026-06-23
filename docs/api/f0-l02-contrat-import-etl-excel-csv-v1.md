# Documentation API - F0 L02 contrat import etl excel csv v1

## Objectif

Definir les contrats d API et les objets techniques du moteur d import V1, afin que `F1-L01` puisse etre implemente sans reinterpretation fonctionnelle.

## Perimetre

Le moteur d import V1 couvre :

- les profils d import
- les jobs d import
- les previews
- les validations
- les executions
- les rapports

Domaines cibles V1 :

- `spatial-nodes`
- `equipments`
- `immobilizations`

## Objets techniques

### ImportProfile

Profil reutilisable de mapping.

Champs minimaux :

- `id`
- `organizationId`
- `targetDomain`
- `name`
- `sourceKind` : `CSV | XLSX`
- `sheetName`
- `headerRowIndex`
- `mappings`
- `options`
- `isArchived`
- `createdAt`
- `updatedAt`

### ImportJob

Execution ou brouillon d execution.

Champs minimaux :

- `id`
- `organizationId`
- `targetDomain`
- `profileId`
- `status`
- `originalFilename`
- `storedFileRef`
- `sheetName`
- `summary`
- `createdById`
- `createdAt`
- `updatedAt`

Statuts proposes :

- `UPLOADED`
- `MAPPED`
- `VALIDATED`
- `READY`
- `RUNNING`
- `COMPLETED`
- `FAILED`
- `CANCELLED`

### ImportMapping

Une ligne de mapping relie une colonne source a un champ cible.

Champs minimaux :

- `sourceColumn`
- `targetField`
- `transformType`
- `transformConfig`
- `isRequired`
- `matchPolicy`

Transformations minimales V1 :

- `IDENTITY`
- `TRIM`
- `UPPERCASE`
- `LOWERCASE`
- `NUMBER`
- `DATE`
- `BOOLEAN`
- `CONSTANT`
- `LOOKUP_BY_CODE`
- `LOOKUP_BY_EXTERNAL_REF`

### ImportReport

Rapport d execution persistable.

Champs minimaux :

- `jobId`
- `createdCount`
- `updatedCount`
- `rejectedCount`
- `warningCount`
- `rows`

Chaque resultat de ligne doit pouvoir indiquer :

- `rowIndex`
- `status`
- `resolvedTargetKey`
- `messages`

## Catalogues de champs cibles

### Domaine `spatial-nodes`

Champs cibles V1 :

- `type`
- `code`
- `label`
- `description`
- `path`
- `parentPath`
- `externalRef`
- `isActive`

Champs obligatoires V1 :

- `type`
- `code`
- `label`
- au moins un de :
  - `path`
  - `parentPath` avec `code`

Conventions de resolution :

- `parentPath` est la cle principale de rattachement parent
- `path` peut etre fourni directement et prevaut comme identifiant logique cible de la ligne
- si `path` est absent et que `parentPath` est present, le systeme reconstruit `path = parentPath + "/" + code`
- si `parentPath` est absent et que `path` contient plusieurs segments, le systeme derive le parent du `path`
- `parentCode` n est pas une cle de resolution V1
- `parentInternalCode` n est pas supporte en V1

### Domaine `equipments`

Champs cibles V1 :

- `internalCode`
- `serialNumber`
- `equipmentTypeCode`
- `equipmentModelCode`
- `equipmentStatusCode`
- `ownerEntityCode`
- `currentSpatialCode`
- `currentSpatialExternalRef`
- `technicalCharacteristics`
- `notes`
- `receivedAt`
- `commissionedAt`
- `immobilizationCode`

### Domaine `immobilizations`

Champs cibles V1 :

- `code`
- `label`
- `status`
- `costCenter`
- `purchaseValue`
- `purchaseDate`
- `serviceStartAt`
- `externalRef`

## Endpoints proposes

### Profils

- `POST /api/v1/imports/profiles`
- `GET /api/v1/imports/profiles`
- `GET /api/v1/imports/profiles/:profileId`
- `PATCH /api/v1/imports/profiles/:profileId`
- `POST /api/v1/imports/profiles/:profileId/archive`

### Uploads et jobs

- `POST /api/v1/imports/jobs`
- `GET /api/v1/imports/jobs`
- `GET /api/v1/imports/jobs/:jobId`
- `POST /api/v1/imports/jobs/:jobId/upload`
- `POST /api/v1/imports/jobs/:jobId/preview`
- `POST /api/v1/imports/jobs/:jobId/validate`
- `POST /api/v1/imports/jobs/:jobId/execute`
- `GET /api/v1/imports/jobs/:jobId/report`
- `POST /api/v1/imports/jobs/:jobId/cancel`

## Contrats de requete

### Creation de profil

```json
{
  "targetDomain": "equipments",
  "name": "Import equipements Marseille",
  "sourceKind": "XLSX",
  "sheetName": "Feuil1",
  "headerRowIndex": 1,
  "mappings": [
    {
      "sourceColumn": "Code inventaire",
      "targetField": "internalCode",
      "transformType": "TRIM",
      "isRequired": true
    }
  ],
  "options": {
    "dryRunDefault": true
  }
}
```

### Validation de job

```json
{
  "profileId": "uuid-profile",
  "overrideMappings": [],
  "options": {
    "stopOnFirstError": false
  }
}
```

## Contrats de reponse

### Resume de job

```json
{
  "id": "uuid-job",
  "targetDomain": "spatial-nodes",
  "status": "VALIDATED",
  "summary": {
    "rowsRead": 150,
    "rowsValid": 146,
    "rowsRejected": 4,
    "creates": 80,
    "updates": 66
  }
}
```

### Rapport d execution

```json
{
  "jobId": "uuid-job",
  "createdCount": 80,
  "updatedCount": 66,
  "rejectedCount": 4,
  "warningCount": 3,
  "rows": [
    {
      "rowIndex": 12,
      "status": "REJECTED",
      "resolvedTargetKey": null,
      "messages": [
        "internalCode manquant"
      ]
    }
  ]
}
```

## Permissions et securite

Permissions cibles proposees :

- `imports.read`
- `imports.manage`
- `imports.execute`

Regles :

- tout profil et job est strictement borne a `organizationId`
- un utilisateur sans `imports.execute` peut preparer un import sans l executer
- toute execution doit etre auditee

## Conventions de validation

- les champs obligatoires sont controles avant l execution
- les validations de references utilisent prioritairement les codes metier
- une preview ne modifie jamais les donnees metier
- l execution doit etre idempotente a l echelle du fichier et du mapping choisi, sous reserve des cles metier

### Regles ETL exactes pour `spatial-nodes`

#### 1. Normalisation de ligne

Pour chaque ligne source :

- `type` :
  - obligatoire
  - normalise en majuscule
  - doit appartenir a `SITE | BUILDING | FLOOR | ZONE | ROOM | LOCATION`
- `code` :
  - obligatoire
  - `trim`
  - conversion en majuscule recommandee par defaut
- `label` :
  - obligatoire
  - `trim`
- `description` :
  - optionnelle
  - `trim`
- `isActive` :
  - optionnel
  - valeurs acceptees : `true`, `false`, `1`, `0`, `oui`, `non`, `actif`, `inactif`
  - defaut : `true`
- `path` :
  - optionnel si `parentPath` est fourni
  - normalise en ASCII majuscule
  - separateur unique `/`
- `parentPath` :
  - obligatoire pour tout noeud non racine si `path` ne permet pas de le deduire
  - normalise comme `path`

#### 2. Resolution de la cle logique

- si `path` est fourni :
  - utiliser `path` comme cle logique cible
- sinon si `parentPath` et `code` sont fournis :
  - construire `path = parentPath + "/" + code`
- sinon si `type = SITE` et `code` est fourni :
  - construire `path = code`
- sinon :
  - rejeter la ligne

#### 3. Resolution du parent

- si `type = SITE` :
  - `parentId = null`
  - `parentPath` doit etre vide
- sinon :
  - resoudre le parent par `parentPath`
  - le parent peut provenir :
    - d une ligne valide du meme fichier
    - ou d un `SpatialNode` deja present en base pour la meme organisation
- si aucun parent n est resolu :
  - rejeter la ligne

#### 4. Validation de coherence hierarchique

- `SITE` sans parent uniquement
- `BUILDING` sous `SITE` uniquement
- `FLOOR` sous `BUILDING` uniquement
- `ZONE` sous `BUILDING` ou `FLOOR`
- `ROOM` sous `BUILDING`, `FLOOR` ou `ZONE`
- `LOCATION` :
  - reserve a la migration legacy
  - non autorise dans les imports utilisateur standards apres bascule, sauf option explicite d administration
- si la combinaison parent/enfant est invalide :
  - rejeter la ligne

#### 5. Validation d unicite

Dans le fichier :

- pas de doublon sur `path`
- pas de doublon sur `parentPath + code`

En base :

- respecter `organizationId + parentId + code`
- respecter `organizationId + path`

En cas de conflit :

- si la cle logique `path` existe deja :
  - operation `UPDATE`
- sinon si le `code` existe deja sous un autre parent :
  - rejet
- sinon :
  - operation `CREATE`

#### 6. Ordonnancement d import

- trier les lignes par profondeur croissante de `path`
- importer les racines avant les enfants
- ne jamais creer un enfant avant la resolution du parent
- si un parent est rejete, tous ses descendants du meme job deviennent rejetes avec motif derive

#### 7. Politique d ecriture

- `CREATE` :
  - creer le noeud avec `organizationId`, `type`, `code`, `label`, `description`, `path`, `depth`, `parentId`, `externalSource`, `externalRef`, `importProfileId`, `lastImportJobId`, `isActive`
- `UPDATE` :
  - mettre a jour `type`, `code`, `label`, `description`, `path`, `depth`, `parentId`, `externalRef`, `lastImportJobId`, `isActive`
- la provenance du dernier import doit etre conservee sur chaque noeud touche

#### 8. Politique d idempotence et reimport

- la cle de reconciliation principale est `organizationId + path`
- un reimport du meme fichier avec le meme mapping ne doit pas dupliquer les noeuds
- les lignes absentes d un reimport ne sont pas archivees automatiquement en V1
- l archivage ou la desactivation de masse relevera d une option ulterieure explicite
- un import spatial n impose pas que les equipements deja rattaches a un noeud `ZONE` soient modifies automatiquement si des noeuds `ROOM` apparaissent plus tard
- la relocalisation `ZONE -> ROOM` d un equipement relevera d un import equipement ulterieur ou d un mouvement metier, pas du lot `F1-L02`

#### 9. Politique de rapport

Chaque ligne du rapport doit au minimum indiquer :

- `rowIndex`
- `resolvedTargetKey` = `path`
- `status` : `CREATED | UPDATED | REJECTED | SKIPPED`
- `messages`

Motifs de rejet minimum :

- `TYPE_REQUIRED`
- `TYPE_INVALID`
- `CODE_REQUIRED`
- `LABEL_REQUIRED`
- `PATH_UNRESOLVABLE`
- `PARENT_NOT_FOUND`
- `PARENT_CHILD_TYPE_MISMATCH`
- `DUPLICATE_PATH_IN_FILE`
- `DUPLICATE_CODE_UNDER_PARENT`
- `LEGACY_LOCATION_IMPORT_FORBIDDEN`
- en `PREVIEW` et `VALIDATE`, les lignes valides ou warning doivent aussi porter `OPERATION_CREATE` ou `OPERATION_UPDATE` dans `messages`
- en `EXECUTE`, les statuts de ligne attendus sont `CREATED`, `UPDATED` ou `REJECTED`

## Notes de versioning

- V1 couvre Excel/CSV uniquement
- V2 ajoutera l ingestion IFC4 et l exploration d arborescence
