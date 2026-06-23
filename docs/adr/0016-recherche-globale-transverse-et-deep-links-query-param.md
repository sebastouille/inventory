# ADR 0016 - recherche globale transverse et deep-links query param

## Statut

Accepted

## Contexte

Le shell partage `packages/ui` affiche deja un champ de recherche dans le header, mais il est inactif. Les objets metier a naviguer existent surtout dans `apps/web`, tandis que `apps/admin` sert surtout a l administration. Plusieurs ecrans metier `web` n ont pas encore de route detail dediee et s appuient sur un etat interne de page.

## Decision

La V1 introduit :

- un endpoint backend transverse unique `GET /api/v1/search/global`
- un composant `GlobalSearchBox` central dans le shell partage
- des resultats filtres par permissions existantes, sans nouvelle permission dediee
- des URLs cibles metier pre-resolues par l API
- des deep-links par query params pour `campaigns`, `locations`, `immobilizations` et `imports`
- une ouverture cross-app depuis `apps/admin` vers `apps/web` pour les objets metier

## Consequences

- positives :
  - le champ du header devient utile et coherent dans les deux applications
  - la navigation metier est centralisee et reutilisable
  - les pages sans route detail deviennent partageables via URL
- negatives :
  - `apps/admin` depend d une base URL `web` publique pour l ouverture cross-app
  - certaines pages `web` gagnent une logique supplementaire de synchronisation query param <-> etat interne
- neutres :
  - aucune migration ni nouvelle table n est introduite

## Alternatives considerees

### Option A

- pour :
  - garder le champ inactif jusqu a une refonte complete de navigation
- contre :
  - laisse un element UI visible mais inutile
  - n apporte aucun gain metier a court terme

### Option B

- pour :
  - creer une route detail dediee pour chaque domaine avant d activer la recherche
- contre :
  - scope beaucoup plus large
  - retarde inutilement la mise en service de la recherche globale V1

## Actions de suivi

- evaluer une V2 avec recherche admin dediee sur `users`, `roles`, `spatial` et `assets-references`
- evaluer plus tard une indexation ou un moteur full-text si le volume de donnees augmente
