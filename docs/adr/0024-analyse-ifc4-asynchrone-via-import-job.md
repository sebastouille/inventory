# ADR 0024 - Analyse IFC4 asynchrone via ImportJob

## Statut

Accepted

## Contexte

L analyse IFC4 avec IfcOpenShell peut durer plusieurs minutes sur des fichiers volumineux. Le flux synchrone expose l application aux timeouts HTTP, aux erreurs peu lisibles et a une absence de suivi d avancement.

## Decision

L analyse IFC4 devient un job `ImportJob` de type `ifc4-analysis`. Le fichier source est stocke hors base, le worker Python tourne en arriere-plan, les logs sont ecrits dans `ImportJobLog`, et le resultat complet est stocke en fichier runtime.

Les jobs `spatial-nodes` et `equipments` restent des jobs d import classiques crees depuis le resultat de l analyse. Le job d analyse prepare et controle, les jobs metier ecrivent dans la base.

## Consequences

- positives : suivi d avancement, meilleure robustesse pour gros fichiers, historique unifie, erreurs plus lisibles.
- negatives : ajout d une table de logs et d un cycle de vie supplementaire.
- neutres : pas de queue externe en V1.

## Alternatives considerees

### Option A

- pour : garder le flux synchrone avec un timeout plus long.
- contre : reste fragile avec proxy, navigateur et gros fichiers.

### Option B

- pour : utiliser Redis ou BullMQ.
- contre : ajoute une dependance d infrastructure trop lourde pour la V1.

## Actions de suivi

- envisager une vraie queue externe si plusieurs analyses IFC doivent tourner en parallele.
