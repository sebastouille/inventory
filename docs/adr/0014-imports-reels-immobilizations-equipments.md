# ADR 0014 - Imports reels immobilizations et equipments

## Statut

Accepted

## Contexte

Le moteur d import possede deja les profils, jobs, upload, mapping, preview, validate, execute et report. Avant F2-L04, seule l execution `spatial-nodes` persistait des donnees metier. Les domaines `immobilizations` et `equipments` etaient visibles mais non branches en reel.

Les fichiers sources analyses confirment deux flux distincts :

- l extrait SP initialise les immobilisations comptables ;
- le fichier IFC4 permet de preparer du spatial et des equipements mobilier ;
- aucune cle commune fiable ne permet un rapprochement automatique entre ces deux sources.

## Decision

Brancher `immobilizations` et `equipments` comme adapters metier reels du moteur d import existant.

- `Immobilization` est reconciliee par `organizationId + code`.
- `Equipment` est reconcilie par `organizationId + internalCode`.
- `Equipment.currentSpatialNodeId` est resolu en priorite par `currentSpatialPath`.
- `currentSpatialExternalRef` est un fallback.
- `currentSpatialCode` est accepte seulement s il est unique.
- Les mouvements equipements sont generes via le service `EquipmentMovementsService`.
- Les ecritures reelles sont tracees dans `ImportJobWrite`.
- La purge V1 des creations est etendue aux trois domaines supportes.
- Aucun rapprochement automatique immobilisation/equipement n est realise dans F2-L04.

## Consequences

- positives :
  - les imports comptables et equipements deviennent testables de bout en bout ;
  - les donnees de test peuvent etre purgees sans casser l audit de job ;
  - les mouvements equipements restent coherents avec les imports ;
  - le risque de mauvais rapprochement comptable est evite.
- negatives :
  - les referentiels assets doivent etre prepares avant import equipements ;
  - les fichiers IFC doivent encore etre transformes en fichiers intermediaires normalises ;
  - les mises a jour importees ne sont pas rollbackees en V1.
- neutres :
  - le rendu 3D IFC reste differe ;
  - le rapprochement comptable devient un lot dedie.

## Alternatives considerees

### Rapprochement automatique SP/IFC des F2-L04

- pour :
  - experience utilisateur plus directe.
- contre :
  - aucune cle commune fiable dans les fichiers analyses ;
  - risque de creer des liens comptables faux.

### Creation automatique des referentiels manquants

- pour :
  - moins de rejets a l import.
- contre :
  - risque de polluer les referentiels avec des libelles non normalises ;
  - contredit la logique actuelle de referentiels admin maitrises.

## Actions de suivi

- Planifier le rapprochement immobilisations/equipements apres stabilisation des imports.
- Planifier l adapter IFC natif et la preparation du rendu 3D dans la V2 IFC4.
- Planifier le rollback enrichi des `UPDATED` si le besoin operationnel est confirme.
