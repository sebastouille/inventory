# 0008 - provenance des ecritures import et purge v1

## Statut

Accepted

## Contexte

Le workspace `imports` permet deja de creer des jobs, charger un fichier, faire `preview`, `validate`, puis `execute` sur `spatial-nodes`.

La suppression d un job nettoie bien les artefacts techniques du job, mais ne supprime pas les donnees metier creees par ce job.

Pour les campagnes de test ETL, il faut pouvoir rejouer plusieurs fois les memes fichiers sans polluer durablement la base.

Le champ `SpatialNode.lastImportJobId` ne suffit pas :

- il ne distingue pas creation et mise a jour ;
- il peut etre ecrase par un import suivant ;
- il ne permet pas de savoir si un noeud a ete cree par un job puis reutilise par une autre structure.

Il faut donc introduire une provenance d ecriture explicite et une premiere politique de purge sure.

## Decision

Nous ajoutons une table de provenance `ImportJobWrite` alimentee uniquement pendant `imports.execute`.

Principes retenus :

- chaque ecriture reelle `spatial-nodes` cree une trace `ImportJobWrite` ;
- la trace distingue `CREATED` et `UPDATED` ;
- la purge V1 est reservee a `spatial-nodes` ;
- la purge V1 ne supprime que les traces `CREATED` ;
- les traces `UPDATED` sont conservees pour audit mais jamais annulees en V1 ;
- la purge est `all-or-nothing` :
  - si un seul noeud cree par le job est bloque, rien n est supprime.

Blocages V1 :

- `HAS_FOREIGN_DESCENDANTS` :
  - le noeud cree par le job a au moins un descendant encore present qui ne fait pas partie des creations de ce meme job ;
- `HAS_SCOPE_ASSIGNMENTS` :
  - le scope IAM lie au noeud a encore au moins une affectation utilisateur.

La purge supprime explicitement :

1. les scopes IAM derives des noeuds cibles ;
2. les `SpatialNode` crees par le job.

La purge ne supprime pas :

- `ImportJob`
- `ImportProfile`
- `ImportJobWrite`
- `AuditLog`

Le bouton UI de purge est distinct du bouton de suppression de job :

- `Purger les creations` = suppression metier sure ;
- `Supprimer le job` = suppression de l historique et des artefacts du job.

## Consequences

Effets positifs :

- les tests d import peuvent etre rejoues avec un mecanisme explicite et auditables ;
- la decision de purge ne depend plus d un champ metier instable ;
- la future V2 peut reutiliser `ImportJobWrite` pour des annulations plus riches.

Couts et limites :

- une table supplementaire est alimentee a chaque `execute` ;
- V1 ne restaure pas les valeurs avant mise a jour ;
- V1 bloque integralement des qu un noeud cree a ete reutilise ou affecte.

## Alternatives considerees

### Utiliser uniquement `SpatialNode.lastImportJobId`

Rejetee :

- ne distingue pas `CREATE` et `UPDATE` ;
- information ecrasable ;
- ne permet pas une purge sure.

### Supprimer tout le sous arbre du job sans provenance d ecriture

Rejetee :

- trop risquee ;
- pourrait supprimer des noeuds reutilises par d autres imports ou par l administration manuelle.

### Stocker un snapshot complet avant et apres chaque mise a jour

Differee :

- plus puissante pour une future V2 ;
- trop lourde pour la premiere iteration.

## Actions de suivi

- faire evoluer `IMP-013` vers une V2 de rollback partiel ou complet des mises a jour ;
- ajouter plus tard une vue d audit des traces `ImportJobWrite` ;
- etendre le pattern aux futurs domaines `equipments` et `immobilizations` quand `F2` sera branche.
