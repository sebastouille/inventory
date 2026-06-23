# 0020 - IfcOpenShell Python pour extraction geometrique IFC4

## Statut

Accepte

## Contexte

La carte 3D IFC4 simplifiee utilisait deja un fichier JSON pregenere et un rendu Three.js leger. Le placement des objets restait toutefois artificiel quand aucune geometrie IFC exploitable n etait lue par le backend.

Le besoin V1 est d obtenir des positions coherentes avec Archicad/IFC4, des volumes proportionnels et des reperes d etage, sans livrer un viewer BIM complet ni parser le fichier IFC dans le navigateur.

## Decision

Ajouter un worker Python local base sur IfcOpenShell pour extraire les bounding boxes monde depuis un fichier IFC.

Le worker est appele par `apps/api` comme un batch local. Il ne fournit pas d API reseau.

NestJS conserve :

- l authentification
- les permissions
- l audit
- le stockage hors base
- la transformation vers le contrat public `scene.v1.json`
- le fallback spatial

Le frontend `apps/web` continue a afficher une scene simplifiee avec Three.js.

La geometrie IFC devient aussi une donnee metier persistante sur `SpatialNode` et `Equipment`. Le flux IFC4 strict refuse la creation de jobs si IfcOpenShell est indisponible ou si une ligne selectionnee ne possede pas de geometrie exploitable.

Aucun fallback spatial ne doit masquer une erreur du flux IFC4. Le fallback spatial reste limite aux scenes de demonstration ou aux donnees non IFC.

## Consequences

- la fidelite de positionnement est meilleure que l extracteur maison TypeScript
- le navigateur reste leger car il ne charge pas le fichier IFC
- le backend depend maintenant de Python et de IfcOpenShell pour le build IFC
- l image API doit utiliser une base compatible avec les wheels Python IfcOpenShell
- les objets IFC sans geometrie exploitable bloquent le job concerne avec un diagnostic explicite
- la carte 3D standard peut etre regeneree depuis les donnees persistantes sans recharger le fichier IFC source

## Alternatives considerees

- extracteur TypeScript maison : rejete comme solution principale car le standard IFC rend vite les placements et representations complexes
- `web-ifc` cote Node : interessant, mais l integration WASM et la couverture geometrique seraient a evaluer dans une vague separee
- viewer BIM complet avec fragments : differe, car trop couteux pour la V1 et moins prioritaire que l ergonomie metier
- parsing IFC dans le navigateur : rejete pour preserver les performances desktop et smartphone

## Actions de suivi

- tester l extraction sur plusieurs exports Archicad reels
- ajouter une vue de diagnostic des objets IFC sans geometrie exploitable
- evaluer une coupe par etage
- etudier le tuilage spatial pour les gros batiments
- envisager un rendu fragments BIM en V2 si le besoin de detail graphique augmente
