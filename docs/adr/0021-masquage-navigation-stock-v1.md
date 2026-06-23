# ADR 0021 - masquage navigation stock v1

## Statut

Accepted

## Contexte

La navigation web principale expose encore des entrees du domaine stock/products :

- `Inventaire` -> [apps/web/app/inventory/page.tsx](</c:/Users/sebas/RepoSeb/inventory-app/apps/web/app/inventory/page.tsx>)
- `Mouvements stock` -> [apps/web/app/movements/page.tsx](</c:/Users/sebas/RepoSeb/inventory-app/apps/web/app/movements/page.tsx>)

La V1 produit active est maintenant centree sur :

- campagnes terrain equipements
- anomalies
- referentiel spatial
- equipements
- immobilisations
- imports
- rapprochement

Le maintien de ces entrees stock dans le menu general cree une confusion produit, alors que la chaine stock complete biens/fournisseurs/inventaire n est plus prioritaire dans cette phase.

## Decision

Masquer temporairement de la navigation generale web :

- `/inventory`
- `/movements`

Conserver en revanche :

- les pages Next existantes
- les endpoints backend existants
- les fichiers et services associes pour une reintegration future

Liens de reintegration future :

- page inventaire stock : [apps/web/app/inventory/page.tsx](</c:/Users/sebas/RepoSeb/inventory-app/apps/web/app/inventory/page.tsx>)
- page mouvements stock : [apps/web/app/movements/page.tsx](</c:/Users/sebas/RepoSeb/inventory-app/apps/web/app/movements/page.tsx>)
- shell navigation web : [apps/web/components/app-shell.tsx](</c:/Users/sebas/RepoSeb/inventory-app/apps/web/components/app-shell.tsx>)
- service overview stock : [apps/api/src/inventory/inventory.service.ts](</c:/Users/sebas/RepoSeb/inventory-app/apps/api/src/inventory/inventory.service.ts>)

## Consequences

- positives :
  - la navigation V1 devient coherente avec la priorite metier terrain equipements
  - le shell web ne charge plus le compteur `stock-movements` pour afficher un badge devenu invisible
- negatives :
  - les pages stock deviennent moins decouvrables tant que la reintegration n est pas faite
- neutres :
  - les pages et endpoints stock restent presents dans le code

## Alternatives considerees

### Option A

- pour :
  - supprimer completement les pages et endpoints stock
- contre :
  - trop risquee et hors demande

### Option B

- pour :
  - conserver les pages visibles mais les deplacer en second niveau
- contre :
  - ne resout pas la confusion de perimetre V1

## Actions de suivi

- enregistrer un item backlog de reintegration stock/products
- lors de la reintegration, verifier aussi les pages `products` et `suppliers`
