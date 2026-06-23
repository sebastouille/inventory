# ADR 0016 - Inventaire equipements separe du stock produits

## Statut

Accepte

## Contexte

Le projet contient deja un domaine `inventory` et un domaine `stock-movements`. Ces domaines sont orientes produits et stock quantitatif.

La cible metier d inventaire terrain concerne des equipements unitaires rattaches a `Equipment`, localises par `SpatialNode`, et suivis par `EquipmentMovement`.

Melanger ces deux besoins creerait une ambiguite :

- un produit est une reference stockable avec quantite ;
- un equipement est un objet physique unitaire avec code interne ;
- un mouvement stock n est pas un mouvement patrimonial d equipement ;
- une campagne terrain produit des observations et anomalies, pas des entrees ou sorties de stock.

## Decision

Creer un domaine dedie aux campagnes d inventaire equipements.

Le domaine utilise :

- `Equipment` comme objet observe ;
- `SpatialNode` comme perimetre et localisation ;
- `InventoryCampaign` pour piloter une campagne ;
- `InventoryObservation` pour tracer les scans ;
- `InventoryAnomaly` pour isoler les ecarts ;
- `InventoryCorrection` pour appliquer les decisions superviseur ;
- `EquipmentMovement` pour tracer les changements patrimoniaux.

Les domaines `inventory` et `stock-movements` restent reserves au stock produits.

## Consequences

Avantages :

- separation claire entre stock et patrimoine ;
- meilleure lisibilite des permissions IAM ;
- journal metier equipement reutilisable ;
- evolutions terrain et offline plus simples.

Contraintes :

- nouvelles tables Prisma ;
- nouvelles routes API ;
- menus web a clarifier ;
- documentation necessaire pour eviter toute confusion avec `/inventory`.

## Regles retenues

- `MATCH` est un resultat d observation conforme.
- Les anomalies V1 sont `WRONG_LOCATION`, `UNKNOWN_CODE`, `MISSING`, `DUPLICATE`, `OUT_OF_SCOPE`.
- Les scans equipements encodent `EQ:<internalCode>`.
- Les scans noeuds encodent `NODE:<spatialNodeId>`.
- Les corrections superviseur appliquent les changements metier, avec audit.
