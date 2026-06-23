# ADR 0013 - equipment movements separes stock movements

## Statut

Accepted

## Contexte

Le depot contient deja `StockMovement`, mais ce modele porte les mouvements de quantites du domaine `products`. Les equipements patrimoniaux unitaires sont maintenant portes par `Equipment`, avec une localisation courante et des affectations. Les deplacements et changements d affectation doivent etre lisibles comme une timeline metier, sans melanger stock et patrimoine.

## Decision

Ajouter un journal dedie `EquipmentMovement`.

Ce journal est alimente automatiquement depuis les mutations `assets` :

- creation initiale d equipement ;
- changement de localisation courante ;
- ajout, retrait ou changement d affectation `PERSON` ou `ASSET`.

`StockMovement` reste reserve aux produits et aux quantites.

## Consequences

- positives :
  - separation claire des flux stock et patrimoine ;
  - timeline metier exploitable par fiche equipement ;
  - base reutilisable pour les imports et campagnes futures.
- negatives :
  - une mutation asset peut maintenant creer plusieurs lignes de mouvement ;
  - les changements historiques avant F2-L03 ne sont pas reconstruits.
- neutres :
  - `AuditLog` reste le journal technique.

## Alternatives considerees

### Option A

- pour :
  - reutiliser `StockMovement`.
- contre :
  - confusion entre quantites de stock et equipements unitaires ;
  - schema inadapte aux affectations et snapshots.

### Option B

- pour :
  - utiliser uniquement `AuditLog`.
- contre :
  - donnees trop techniques ;
  - pas de contrats metier stables pour les UI et imports.

## Actions de suivi

- Brancher les imports F2-L04 sur le service de mouvements.
- Ajouter plus tard des mouvements issus des campagnes d inventaire.
