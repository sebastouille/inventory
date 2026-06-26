# ADR 0025 - Profil IFC4 et geometrie progressive

## Statut

Accepted

## Contexte

Les fichiers IFC volumineux peuvent contenir plusieurs milliers d objets. Extraire la geometrie de tous les `IfcElement` avant filtrage consomme trop de temps et de memoire.

## Decision

Introduire un profil d import IFC4 avec classes selectionnees, limite `maxProducts`, niveau de geometrie et limite de details. Le flux UI commence par un parse rapide qui stocke le fichier IFC, liste les classes presentes et met le job en `READY`; la previsualisation complete reutilise ensuite le meme fichier avec le profil choisi.

Le worker filtre les classes avant extraction, ecrit des artefacts NDJSON progressifs hors base et la file locale limite les jobs lourds simultanes.

Les niveaux de geometrie sont :

- `NONE` : aucune geometrie importee.
- `MINIMUM` : bounding box monde et dimensions exterieures.
- `INTERMEDIATE` : bounding box plus sous-boites simplifiees limitees par parametre.

Les logs du worker ne sont pas echantillonnes cote API : toutes les lignes JSON emises par le worker sont persistees et visibles dans l UI du job.

Le timeout IfcOpenShell par defaut est porte a `3600000` ms. L annulation utilisateur utilise le statut existant `CANCELLED`; si un process Python est actif pour le job, il est termine via le worker.

## Consequences

- positives :
  - reduction du volume traite
  - meilleure maitrise des ressources
  - pas de double upload du fichier IFC volumineux
  - logs conserves
  - selection des classes avant extraction geometrique
  - preview possible sans geometrie
- negatives :
  - l extraction intermediaire reste approximative
  - la file locale ne couvre pas plusieurs instances API
  - le JSON final de preview reste conserve en V1 en plus des flux NDJSON pour compatibilite UI
- neutres :
  - `READY` represente un job IFC4 parse rapidement et pret a lancer la previsualisation complete
  - `CANCELLED` represente une annulation utilisateur et bloque la creation de jobs metier depuis ce job IFC4
  - les jobs metier restent separes du job d analyse IFC4

## Alternatives considerees

### Queue externe

- pour : meilleure robustesse multi-instance.
- contre : dependance infrastructure trop lourde pour cette vague.

### Timeout plus long uniquement

- pour : tres simple.
- contre : ne corrige pas la cause du ralentissement.

## Actions de suivi

- envisager Redis/BullMQ si plusieurs gros IFC doivent etre traites en parallele.
- enrichir plus tard `INTERMEDIATE` avec une vraie simplification de maillage.
