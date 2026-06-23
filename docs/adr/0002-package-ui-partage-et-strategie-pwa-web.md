# ADR 0002 - package-ui-partage-et-strategie-pwa-web

## Statut

Accepted

## Contexte

Les deux clients Next du repo dupliquent aujourd hui leurs composants UI, leurs styles globaux et leurs shells. En parallele, `apps/web` doit devenir la base d usage mobile terrain sans qu une troisieme application soit creee dans cette vague.

## Decision

- creer un workspace `packages/ui` qui porte les tokens de theme, les primitives `shadcn` mutualisees et les gabarits de page ;
- faire consommer `@inventory/ui` par `apps/admin` et `apps/web` ;
- traiter le besoin mobile comme une PWA responsive dans `apps/web`, avec manifest et ergonomie mobile, sans service worker offline dans cette vague ;
- etendre les endpoints existants de listes plutot que d ajouter des endpoints de compteur ou une API parallele.

## Consequences

- positives :
  - fin de la duplication des composants principaux ;
  - design system coherent entre admin et web ;
  - base technique prete pour les ecrans mobiles terrain ;
  - navigation et theming plus simples a faire evoluer.
- negatives :
  - refactor transverse touchant simultanement backend, `admin` et `web` ;
  - cout initial de migration des imports et des tests ;
  - `packages/ui` devient un point central a maintenir.
- neutres :
  - la stack backend et les routes REST versionnees restent inchangees ;
  - le service worker offline reste hors scope immediat.

## Alternatives considerees

### Option A

- pour :
  - garder les composants dans chaque app limite les changements de structure
- contre :
  - la duplication persiste ;
  - la coherence visuelle et comportementale devient difficile a tenir.

### Option B

- pour :
  - creer une app mobile separee donnerait plus d isolation produit
- contre :
  - le repo ne la prevoit pas aujourd hui ;
  - la charge explose pour une premiere vague de refonte UI ;
  - le besoin terrain peut etre couvert plus vite par une PWA responsive.

## Actions de suivi

- migrer les ecrans existants sur `@inventory/ui`
- ajouter la base PWA `apps/web`
- reevaluer un vrai offline plus tard si le terrain le justifie
