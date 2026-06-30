# ADR 0028 - IFCBUILDINGSTOREY comme repere spatial derive

## Statut

Accepted

## Contexte

Certains exports Archicad IFC4 fournissent des `IFCBUILDINGSTOREY` comme conteneurs de niveau sans geometrie propre exploitable. Le flux IFC4 strict actuel bloque alors l etage et tous ses enfants, meme si les pieces ou equipements portent des bounding boxes correctes.

Le besoin metier est de conserver la structure d etage pour l import spatial et pour la lecture 3D, sans inventer un placement approximatif ni masquer les erreurs sur les autres objets.

## Decision

Traiter `IFCBUILDINGSTOREY` comme un cas particulier : sa geometrie propre n est pas obligatoire si une emprise peut etre derivee depuis son batiment parent ou depuis ses enfants spatiaux ou equipements rattaches.

La geometrie derivee utilise :

- `geometrySource = ifc-storey-derived-from-building` quand l emprise X/Z vient du batiment parent
- `geometrySource = ifc-storey-derived` quand la bbox vient des enfants
- une epaisseur visuelle fixe
- une marge visuelle
- des metadonnees indiquant que la geometrie est derivee et non extraite brute

L ordre retenu est : geometrie propre de l etage, emprise du batiment parent, emprise des enfants. Si aucune emprise n est derivable, l etage reste non importable avec un diagnostic explicite.

## Consequences

- positives : les imports IFC4 Archicad sont moins bloques par une absence normale de volume d etage.
- positives : la vue 3D dispose de reperes d etage lisibles et coherents avec les enfants.
- negatives : les dimensions d un etage derive ne sont pas une mesure IFC certifiee, mais une emprise calculee.
- neutres : aucune migration base n est requise.

## Alternatives considerees

### Exiger une geometrie brute pour les etages

- pour : regle stricte simple et uniforme.
- contre : bloque des fichiers IFC4 valides fonctionnellement quand les enfants portent deja les informations utiles.

### Utiliser un fallback spatial approximatif

- pour : permet toujours d afficher quelque chose.
- contre : masque les erreurs et contredit le choix de geometrie IFC stricte.

### Deriver explicitement l emprise d etage

- pour : preserve l arborescence, reste explicite, et rend la 3D lisible.
- contre : demande une logique de diagnostic et de rendu specifique.

## Actions de suivi

- documenter dans l assistant que les etages derives sont des reperes visuels.
- ajouter plus tard une option d affichage par coupe d etage si la scene devient dense.
