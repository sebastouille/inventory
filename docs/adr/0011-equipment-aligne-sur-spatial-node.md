# ADR 0011 - equipment aligne sur spatial node

## Statut

Accepted

## Contexte

Le domaine `assets` representait deja les equipements patrimoniaux unitaires, mais leur position courante restait derivee d affectations legacy vers `Location`, tandis que `barcode` et `qrCode` restaient exposes comme champs metier.

Le referentiel spatial `SpatialNode` est maintenant la fondation cible pour la localisation, les imports spatiaux, les campagnes futures et les scopes IAM. Il faut donc refondre `Equipment` autour de ce socle avant d introduire les immobilisations et les mouvements unitaires.

## Decision

Le modele `Equipment` evolue ainsi :

- `currentSpatialNodeId` devient la source de verite de la localisation courante
- `serialNumber` devient optionnel
- `numPiece` stocke un numero de piece texte quand une source le fournit
- `externalRef` stocke une reference source externe utile a la tracabilite import
- `barcode` et `qrCode` sortent du modele metier `Equipment`
- les affectations `PERSON` et `ASSET` restent gerees via `EquipmentAssignment`
- les affectations `LOCATION` deviennent legacy et ne sont plus la source de verite du present
- le futur journal `EquipmentMovement` sera declenche plus tard sur les changements de `currentSpatialNodeId`

## Consequences

- positives :
  - `Equipment` devient coherent avec le referentiel spatial livre en `F1`
  - l import `equipments` peut viser une vraie cible spatiale
  - le modele metier terrain est simplifie autour de `internalCode`
  - les imports IFC4 peuvent conserver un numero de piece et une reference externe sans recreer des champs `barcode` ou `qrCode`
- negatives :
  - migration et backfill obligatoires sur les donnees legacy
  - la compatibilite historique avec `Location` devient explicitement transitoire
- neutres :
  - le stock `products` continue a vivre dans `inventory` et `stock-movements`

## Alternatives considerees

### Option A

- pour :
  - deduire la localisation courante uniquement depuis `EquipmentAssignment`
- contre :
  - plus complique pour les lectures, imports et campagnes
  - laisse la localisation courante dans un flux historiquement transitoire

### Option B

- pour :
  - conserver `barcode` et `qrCode` comme champs metier
- contre :
  - contraire a la decision produit `internalCode` comme seule cle terrain
  - ajoute une ambiguite inutile au schema et a l import

## Actions de suivi

- introduire `EquipmentMovement` dans `F2-L03`
- brancher l import `equipments` reel en `F2-L04`
- relier les mappings IFC4 de proprietes a `internalCode`, `numPiece` et `externalRef` dans l assistant imports
