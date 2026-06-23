# ADR 0001 - Workflow de gouvernance documentaire

## Statut

Accepted

## Contexte

Le projet a besoin d'un moyen repetable et versionne pour capturer les plans, les questions de conception, les decisions d'architecture, les resultats d'implementation, et le travail differe directement dans le repo. Les interactions Codex doivent aussi produire des artefacts persistants pour eviter de perdre l'information dans l'historique de chat.

## Decision

Adopter un workflow docs-as-code dans le repo base sur :

- des documents racine pour l'etat courant du projet ;
- `docs/steps/` pour les dossiers de chaque etape de conception ou d'implementation ;
- `docs/adr/` pour les decisions transverses ;
- `docs/backlog/` et les fichiers racine de backlog pour le travail differe et les bugs ;
- la skill locale Codex `$project-doc-governor` pour imposer ce workflow ;
- des scripts sous `scripts/docs/` pour normaliser la creation des fichiers.

## Consequences

- chaque demande d'implementation doit produire des artefacts documentaires durables ;
- la maintenance de la documentation devient une partie de la definition of done ;
- les futurs contributeurs peuvent retrouver non seulement ce qui a change, mais aussi pourquoi.

## Alternatives considerees

### Approche README unique

Rejetee car elle concentre trop d'information dans un seul fichier et perd l'historique d'implementation.

### Outil documentaire externe uniquement

Rejetee pour la V1 car cela affaiblit le versioning, la tracabilite en review, et la visibilite locale dans le repo.

## Actions de suivi

- ajouter plus tard une pipeline MkDocs si besoin
- ajouter plus tard des issue forms GitHub plus completes si besoin
