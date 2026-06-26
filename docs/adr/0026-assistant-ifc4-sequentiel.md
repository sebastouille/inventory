# ADR 0026 - Assistant IFC4 sequentiel

## Statut

Accepted

## Contexte

L assistant IFC4 sait deja parser un fichier, lancer une analyse asynchrone, afficher des logs, annuler le worker Python, proposer des noeuds spatiaux, des references assets et des equipements.

Le parcours restait toutefois decoupe entre l assistant IFC4 et le moteur d import generique. L utilisateur devait comprendre que l analyse IFC4 ne fait que preparer des jobs `spatial-nodes` et `equipments`, puis executer ces jobs ailleurs dans la page. Ce modele est robuste techniquement, mais trop confus pour l usage metier cible.

## Decision

L assistant IFC4 devient le parcours principal et sequentiel pour importer un fichier IFC4.

Les jobs enfants `spatial-nodes` et `equipments` restent des `ImportJob` classiques pour conserver les rapports, la provenance, la purge et l audit. En revanche, leur preview, validation, execution, annulation et lecture de resultat sont pilotes directement par l assistant.

Les references assets manquantes sont gerees dans une etape assistant explicite avec proposition, confirmation utilisateur, creation et resultat.

Le mapping spatial reste guide : le parentage et le chemin sont derives de la structure IFC4. L utilisateur peut ajuster les champs metier visibles, mais ne mappe pas librement `path` ou `parentPath`.

## Consequences

- positives :
  - parcours utilisateur plus clair
  - conservation des garanties d audit et de purge des imports
  - reduction des erreurs d ordre entre spatial, references et equipements
- negatives :
  - la page imports contient plus de logique d orchestration
  - certains endpoints generiques restent necessaires en arriere-plan
- neutres :
  - pas de migration de schema
  - pas de changement du worker IfcOpenShell

## Alternatives considerees

### Option A

Garder le modele actuel avec jobs separes visibles dans le panneau generique.

- pour :
  - peu de code a changer
  - reuse maximum du moteur existant
- contre :
  - parcours difficile a comprendre
  - risque d executer les equipements avant les noeuds

### Option B

Creer un import IFC4 monolithique qui ecrit directement les trois domaines.

- pour :
  - flux technique plus direct
- contre :
  - perte des rapports, de la purge et de la provenance `ImportJob`
  - rollback plus difficile

## Actions de suivi

- ajouter des profils IFC4 persistants par organisation.
- etudier une queue externe si plusieurs analyses IFC4 lourdes doivent tourner en parallele.
