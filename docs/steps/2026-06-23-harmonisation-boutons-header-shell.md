# 2026-06-23 - Harmonisation boutons header shell

## Objectif

Harmoniser les boutons du header partage pour que menu, mode jour/nuit et deconnexion utilisent exactement le meme composant, le meme diametre, et le meme alignement visuel dans `apps/web` et `apps/admin`.

## Perimetre

- dans le scope :
  - header partage `packages/ui/src/components/app-shell.tsx`
  - bouton theme partage `packages/ui/src/components/theme-toggle.tsx`
- hors scope :
  - refonte de la recherche globale
  - changement des actions fonctionnelles du header

## Contexte initial

- demande :
  - supprimer le libelle visible `Deconnexion`
  - garder uniquement une icone
  - donner aux boutons menu, mode jour/nuit et deconnexion une taille identique
  - garantir un rond visuel stable sur web et admin
- etat existant :
  - les boutons header utilisaient des classes locales differentes selon le composant
  - `AppShell` et `ThemeToggle` appliquaient une largeur/hauteur fixes a la main
  - cette duplication creait un risque de divergence visuelle entre les usages
- contraintes :
  - rester coherent avec le systeme de boutons partage
  - conserver l accessibilite via `aria-label`

## Plan

1. Introduire un composant partage `HeaderIconButton`.
2. Remplacer les boutons menu, theme et deconnexion dans `AppShell` et `ThemeToggle`.
3. Valider les builds UI et web.

## Questions ouvertes

- aucune

## Hypotheses

- la taille cible est celle du variant `icon` du design-system, afin d obtenir une geometrie identique partout
- le rendu rond doit etre porte par le composant partage et non par des classes locales

## Zones impactees

- backend :
- aucun
- frontend :
- `packages/ui/src/components/app-shell.tsx`
- `packages/ui/src/components/theme-toggle.tsx`
- base de donnees :
- aucune
- infrastructure :
- aucune
- documentation :
- ce fichier d etape

## Tests prevus

- `npm run build --workspace @inventory/ui`
- `npm run build --workspace web`

## Criteres d'acceptation

- les boutons menu, theme et deconnexion utilisent le meme composant partage
- les boutons ont exactement la meme largeur, la meme hauteur et le meme rendu visuel
- le libelle visible `Deconnexion` ne s affiche plus
- le rendu est identique dans `apps/web` et `apps/admin`

## Decisions prises

- creation d un composant partage `HeaderIconButton`
- utilisation du variant `icon` du design-system pour garantir un diametre stable
- exposition du composant dans `packages/ui` pour un usage partage par `AppShell` et `ThemeToggle`

## Notes d'implementation

- creation de `packages/ui/src/components/header-icon-button.tsx`
- remplacement des usages locaux par `HeaderIconButton` dans `packages/ui/src/components/app-shell.tsx`
- remplacement du bouton theme par `HeaderIconButton` dans `packages/ui/src/components/theme-toggle.tsx`
- export du composant dans `packages/ui/src/index.ts`
- augmentation de l espace interne via `p-2.5` pour donner plus d air entre l icone et la bordure
- passage des icones header en `size-5` pour renforcer leur lisibilite sans changer le diametre externe

## Tests executes

- a executer apres la modification

## Suivi

- si d autres boutons header doivent etre alignes plus tard, reutiliser `HeaderIconButton`
