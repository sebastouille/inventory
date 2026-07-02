# ADR 0029 - IFC_PROPERTY_ZONE comme zone spatiale derivee

## Statut

Accepted

## Contexte

Les exports Archicad peuvent porter une propriete `Zone` sur des `IFCSPACE`.
L assistant IFC4 cree alors des noeuds applicatifs `IFC_PROPERTY_ZONE` pour organiser les pieces par zone metier.

Ces noeuds ne correspondent pas toujours a un objet IFC geometrique autonome. Ils n ont donc pas de `GlobalId` ni de bbox propre, alors que les `IFCSPACE` enfants ont une geometrie exploitable.

Avant cette decision, une zone sans geometrie bloquait aussi ses espaces enfants avec `PARENT_GEOMETRY_INVALID`.

## Decision

Un noeud `IFC_PROPERTY_ZONE` peut etre accepte comme zone derivee si son emprise peut etre calculee depuis les bbox de ses `IFCSPACE` enfants.

La geometrie produite est marquee explicitement :

- `geometrySource = ifc-zone-derived-from-spaces`
- `geometryMessage = Geometrie de zone derivee depuis les espaces enfants`
- `geometryMetadata.derivation = ZONE_EXTENT_FROM_CHILD_SPACES`

Si aucun espace enfant geometrique n est disponible, la zone reste non importable avec `ZONE_DERIVATION_FAILED`.

En mode strict, le rattachement d une zone issue d un `IFCSPACE` a un etage utilise uniquement la relation IFC vers `IFCBUILDINGSTOREY`. Si cette relation manque, l assistant ne rattache pas la zone au batiment par fallback et marque le noeud source avec `IFC_STOREY_RELATION_MISSING`.

## Consequences

- positives : les zones applicatives issues de la propriete `Zone` ne bloquent plus les pieces geometriques valides.
- positives : l import reste strict car la geometrie derivee est explicite et auditable dans les diagnostics.
- positives : les zones ne sont plus silencieusement rattachees au batiment quand l etage IFC manque.
- negatives : une zone derivee represente une emprise calculee, pas un volume IFC natif certifie.
- negatives : un IFC incomplet sur les relations d etage bloque davantage le flux strict.
- neutres : aucun fallback approximatif n est ajoute pour les autres classes IFC.

## Alternatives considerees

### Option A - Exiger une geometrie propre pour IFC_PROPERTY_ZONE

- pour : regle stricte simple.
- contre : bloque des exports Archicad valides ou la zone est une propriete metier.

### Option B - Importer la zone sans geometrie

- pour : evite de bloquer l arborescence.
- contre : casse la carte 3D et masque une information geometrique manquante.

## Actions de suivi

- Verifier sur de gros fichiers IFC4 que les zones derivees restent groupees sous le bon etage quand les relations spatiales sont completes.
- Ajouter si besoin un affichage dedie `Zone derivee` dans la vue 3D.
