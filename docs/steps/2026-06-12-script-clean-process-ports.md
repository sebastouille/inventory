# Script clean process ports

## Objectif

Ajouter un script simple pour nettoyer les process qui occupent les ports du projet et eviter les erreurs `EADDRINUSE` pendant le developpement local.

## Perimetre

- dans le scope :
  - ajout d'un script PowerShell de nettoyage
  - exposition via `package.json`
  - documentation d'usage
- hors scope :
  - arret selectif par nom de process
  - gestion automatique dans `npm run dev`

## Contexte initial

- demande : eviter les erreurs de type `listen EADDRINUSE` sur les ports du projet
- etat existant : aucun script centralise pour fermer les process Node ou autres process en ecoute
- contraintes : ne pas tuer les services d'autres projets sans action explicite

## Plan

1. ajouter un script cible sur les ports applicatifs
2. ajouter une option pour inclure les ports d'infrastructure
3. exposer le tout via npm
4. documenter l'usage

## Questions ouvertes

- aucune

## Hypotheses

- un nettoyage par ports du projet est plus fiable qu'un filtrage par nom de process

## Zones impactees

- backend : aucune logique metier
- frontend : aucune
- base de donnees : aucune
- infrastructure : scripts locaux et usage developpeur
- documentation : README et dossier d'etape

## Tests prevus

- execution du script sans process cibles
- verification des scripts npm exposes

## Criteres d'acceptation

- `npm run clean` arrete les process en ecoute sur `3010`, `3011`, `3014`
- `npm run clean:all` peut aussi inclure `5560`, `1035`, `8035`
- la commande ne casse pas les autres projets par defaut

## Decisions prises

- limiter le script par defaut aux ports applicatifs
- rendre l'arret des ports d'infrastructure explicite via option

## Notes d'implementation

- script ajoute dans `scripts/clean-dev.ps1`
- scripts npm ajoutes dans `package.json`

## Suivi

- si besoin, ajouter plus tard une commande `dev:clean` ou une tache VS Code dediee
