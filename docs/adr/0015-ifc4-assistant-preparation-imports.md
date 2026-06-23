# ADR 0015 - Assistant IFC4 comme preparation d imports

## Statut

Accepted

## Contexte

L application dispose deja d un moteur imports transverse avec jobs, profils, upload, mapping, preview, validate, execute, rapports, provenance `ImportJobWrite` et purge des creations. Les fichiers IFC4 apportent une structure source riche : spatial, classes d objets, proprietes, references techniques et donnees candidates d equipements.

Creer un import IFC4 direct en base ajouterait un deuxieme chemin de persistence, donc un risque de divergence avec les rapports, la purge, l audit et les controles existants.

## Decision

Implementer IFC4 comme assistant de preparation dans le domaine `imports`.

L assistant :

- lit un fichier IFC4 texte STEP ;
- extrait une preview spatial, referentiels assets et equipements candidats ;
- cree des jobs `imports` standards pour `spatial-nodes` et `equipments` ;
- cree volontairement les referentiels assets manquants quand l utilisateur le demande ;
- conserve les references source dans `externalRef`, `sourceClass` et `sourceMetadata`.

L assistant ne persiste pas directement des `SpatialNode` ou des `Equipment`. La persistence metier reste portee par le moteur `imports.execute`.

## Consequences

- positives :
  - reutilisation des rapports, de la provenance, des permissions et de la purge existants
  - reduction du risque de divergence entre CSV/XLSX et IFC4
  - trajectoire compatible avec l import IFC4 V2 et le futur rendu 3D
- negatives :
  - l utilisateur doit encore passer par preview/validate/execute apres creation du job
  - le fichier IFC4 est reparses lors des actions assistant V1
  - la normalisation des referentiels reste volontairement simple en V1
- neutres :
  - aucun changement de schema base n est introduit dans cette vague

## Alternatives considerees

### Option A - Import IFC4 direct en base

- pour :
  - parcours utilisateur plus court
  - moins d etapes visibles
- contre :
  - contournement des rapports et de la purge
  - logique metier dupliquee
  - audit moins coherent

### Option B - Conversion IFC4 externe en fichier CSV manuel

- pour :
  - tres simple cote application
  - aucun endpoint supplementaire
- contre :
  - pas de preview integree
  - experience utilisateur fragile
  - pas de reutilisation directe dans le workspace imports

## Actions de suivi

- Ajouter un profil de mapping IFC4 persistant par organisation.
- Ajouter une selection objet par objet et classe par classe.
- Ajouter un rapprochement manuel ou semi-automatique entre equipements IFC et immobilisations comptables.
- Ajouter plus tard le rendu 3D simplifie hors scope de cette decision.
