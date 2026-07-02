# 2026-07-01 - Campagne noeud actif par numero de piece

## Objectif

Corriger l execution terrain d une campagne quand l agent saisit le numero de piece metier, par exemple `B520`, au lieu du path ou de l identifiant technique du noeud spatial.

## Probleme constate

La saisie `B520` etait acceptee comme noeud actif dans l ecran, mais la liste `Attendus du noeud actif` restait vide. Le filtrage local comparait uniquement l id du noeud, le path ou le dernier segment du path. Or `B520` est porte par les equipements comme `numPiece`.

## Changement implemente

- Cote web, les attendus du noeud actif matchent maintenant aussi `InventoryExpectedItemSummary.numPiece`.
- Cote API, `ensureNodeInCampaign` peut resoudre une reference de noeud depuis le numero de piece des equipements attendus de la campagne.
- Si le meme numero de piece pointe vers plusieurs noeuds attendus differents dans la campagne, l API renvoie une erreur d ambiguite.

## Fichiers impactes

- `apps/web/app/campaigns/[campaignId]/run/page.tsx`
- `apps/api/src/inventory-campaigns/inventory-campaigns.service.ts`
- `apps/api/src/inventory-campaigns/inventory-campaigns.service.spec.ts`

## Tests executes

- `npm.cmd run test --workspace api -- inventory-campaigns.service.spec.ts`
- `npm.cmd run build --workspace api`
- `npm.cmd run build --workspace web`

## Criteres d acceptation

- Saisir `B520` comme noeud actif affiche les equipements attendus dont `numPiece=B520`.
- La synchronisation d un equipement attendu scanne dans ce contexte produit `MATCH`.
- La fin de piece peut utiliser la meme reference de piece metier.
