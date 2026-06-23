# 0019 - Scene 3D IFC4 simplifiee et Three.js

## Statut

Accepte

## Contexte

Le projet doit proposer une visualisation 3D des noeuds spatiaux et des equipements a partir des donnees IFC4 importees. La priorite V1 est l ergonomie, la selection, le zoom, la surbrillance et la heatmap d anciennete d inventaire, pas la fidelite graphique BIM.

Le repo possede deja `SpatialNode`, `Equipment`, `ImportJob`, l assistant IFC4 et le stockage hors base pour les imports. Il ne possedait pas encore de moteur 3D ni de modele de scene persistant.

## Decision

La V1 utilise une scene JSON simplifiee pregeneree cote backend et stockee hors base sous `.runtime/bim-3d`.

Le frontend `apps/web` rend cette scene avec `three`, sans `@react-three/fiber` et sans chargement IFC direct dans le navigateur.

La base de donnees stocke seulement :

- `Bim3dMap`
- `Bim3dMapBuild`
- le statut
- le chemin de scene
- le resume de generation
- l historique de build

La geometrie V1 est composee de boites pour les noeuds et de cubes pour les equipements. Si la geometrie IFC exploitable n est pas disponible, le backend genere un fallback spatial deterministe depuis la hierarchie `SpatialNode`.

## Consequences

- le navigateur charge une scene legere et stable
- la fonctionnalite fonctionne aussi avec les donnees de demo
- la base ne stocke pas de maillage lourd
- les futurs traitements BIM peuvent enrichir le format de scene sans casser l UI
- la fidelite aux vrais volumes IFC reste limitee en V1

## Alternatives considerees

- charger et parser le fichier IFC dans le navigateur : rejete en V1 car plus lourd, plus fragile sur smartphone, et plus difficile a securiser
- utiliser une chaine fragments BIM avancee : differe en V2 car plus puissante mais plus couteuse
- stocker chaque element 3D en base : rejete car non necessaire en V1 et contraire a la contrainte de stockage fichier hors base

## Actions de suivi

- etudier extraction de bounding boxes IFC plus fidele
- ajouter un mode coupe par etage
- ajouter un lien depuis la fiche equipement vers la carte
- evaluer une strategie de tuilage pour les gros batiments
- envisager un cache PWA des scenes recentes
