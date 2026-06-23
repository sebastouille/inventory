# Bootstrap gouvernance documentaire

## Objectif

Initialiser un systeme documentaire versionne dans le repo et un workflow Codex pour capturer plans, decisions, questions ouvertes, et suites d'implementation en Markdown.

## Perimetre

- creer la structure documentaire
- creer les templates Markdown
- definir la convention ADR
- creer la skill locale Codex
- ajouter des scripts utilitaires et des formulaires de backlog

## Questions ouvertes

- les formulaires GitHub doivent-ils devenir obligatoires pour creer des tickets backlog ou rester optionnels ?
- faut-il publier la documentation automatiquement tout de suite ou attendre une stabilisation du modele documentaire ?

## Decisions prises

- utiliser des documents racine pour l'etat courant et `docs/` pour le detail
- utiliser les ADR pour les decisions transverses
- utiliser une skill locale et `AGENTS.md` pour imposer le workflow

## Livrables

- arborescence documentaire
- templates
- convention ADR
- scripts utilitaires
- skill Codex

## Suivi

- tester ce workflow sur la prochaine grande etape d'implementation
- decider ensuite si une publication documentaire automatique est necessaire
