# 2026-06-23 - Masquage navigation stock V1

## Objectif

Retirer du menu general web les entrees `Inventaire` et `Mouvements stock` afin de ne plus exposer dans la navigation principale la chaine stock/products, tout en conservant les pages et endpoints pour une reintegration future.

## Perimetre

- dans le scope :
  - retrait des entrees `/inventory` et `/movements` dans `apps/web`
  - nettoyage des badges et chargements shell devenus inutiles
  - documentation de la decision et des liens de reintegration
- hors scope :
  - suppression des pages `apps/web/app/inventory/page.tsx` et `apps/web/app/movements/page.tsx`
  - suppression des endpoints API `inventory` et `stock-movements`
  - refonte future du domaine stock/products

## Contexte initial

- demande :
  - supprimer l entree de menu `Inventaire`
  - supprimer l entree de menu `Mouvements stock`
  - enregistrer la decision avec les liens vers les pages pour reintegration future
- etat existant :
  - le shell web affiche encore `Inventaire` dans `Pilotage`
  - le shell web affiche encore `Mouvements stock` dans `Flux`
  - les pages existent encore :
    - `/inventory`
    - `/movements`
- contraintes :
  - conserver le code de la chaine stock pour reintegration ulterieure
  - ne pas casser les autres entrees de navigation

## Plan

1. Documenter la decision de masquage temporaire.
2. Retirer les entrees de navigation et les chargements shell inutiles.
3. Mettre a jour la documentation produit, architecture et backlog avec les liens de reintegration.

## Questions ouvertes

- aucune

## Hypotheses

- le retrait demande concerne le menu general web principal
- les pages stock restent accessibles uniquement par URL directe ou future reintegration
- la reintegration future devra rebrancher au minimum :
  - [inventory page](</c:/Users/sebas/RepoSeb/inventory-app/apps/web/app/inventory/page.tsx>)
  - [movements page](</c:/Users/sebas/RepoSeb/inventory-app/apps/web/app/movements/page.tsx>)
  - [inventory service](</c:/Users/sebas/RepoSeb/inventory-app/apps/api/src/inventory/inventory.service.ts>)

## Zones impactees

- backend :
  - aucune logique metier
- frontend :
  - `apps/web/components/app-shell.tsx`
  - `apps/web/components/sidebar-nav.tsx`
- base de donnees :
  - aucune
- infrastructure :
  - aucune
- documentation :
  - `FUNCTIONAL_SPEC.md`
  - `TECHNICAL_ARCHITECTURE.md`
  - `IMPLEMENTATION_BACKLOG.md`
  - `docs/adr/0021-masquage-navigation-stock-v1.md`

## Tests prevus

- `npm run build --workspace web`

## Criteres d'acceptation

- le menu general ne contient plus `Inventaire`
- le menu general ne contient plus `Mouvements stock`
- les pages stock restent presentes dans le repo
- la documentation reference clairement les pages et services a rebrancher plus tard

## Decisions prises

- V1 recentre la navigation principale sur les campagnes, anomalies, referentiels, imports et rapprochement
- la chaine stock/products est masquee de la navigation, mais pas supprimee du code

## Notes d'implementation

- `apps/web/components/app-shell.tsx`
  - retrait de l entree `Inventaire`
  - retrait de l entree `Mouvements stock`
  - suppression de l appel shell a `/stock-movements` devenu inutile
- `apps/web/components/sidebar-nav.tsx`
  - retrait des liens legacy `Inventory` et `Movements`
- documentation mise a jour pour expliciter le masquage temporaire et la reintegration future

## Tests executes

- `npm run build --workspace web`

## Suivi

- prevoir un lot de reintegration stock/products quand la chaine metier stock sera reprise
