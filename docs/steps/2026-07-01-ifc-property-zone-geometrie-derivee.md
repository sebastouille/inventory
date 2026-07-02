# IFC_PROPERTY_ZONE - geometrie derivee depuis les espaces

## Objectif

Accepter les noeuds `IFC_PROPERTY_ZONE` crees depuis la propriete IFC `Zone` comme zones derivees, meme s ils n ont pas de geometrie IFC propre.

## Diagnostic

Le fichier `Inventaire_Bureaux.ifc` contient des `IFCSPACE` avec geometrie exploitable. Les erreurs de preview viennent des zones applicatives `IFC_PROPERTY_ZONE`, qui sont creees depuis une propriete et ne portent pas de GlobalId ni de bbox.

Les `IFCSPACE` enfants sont ensuite bloques par `PARENT_GEOMETRY_INVALID` car leur parent zone n est pas importable.

## Plan

- Deriver la geometrie des zones `IFC_PROPERTY_ZONE` depuis les bbox des `IFCSPACE` enfants.
- Marquer la source technique `ifc-zone-derived-from-spaces`.
- Conserver un message explicite indiquant que la zone est derivee.
- Garder une erreur si aucune geometrie enfant n est disponible.
- Mettre a jour les diagnostics pour classer ces zones comme `DERIVED`.
- Ajouter un test backend couvrant une zone derivee et un espace enfant importable.

## Fichiers impactes

- `apps/api/src/imports/ifc4-assistant.service.ts`
- `apps/api/src/imports/ifc4-assistant.service.spec.ts`
- `FUNCTIONAL_SPEC.md`
- `TECHNICAL_ARCHITECTURE.md`
- `DATA_MODEL.md`
- `docs/adr/0029-ifc-property-zone-comme-zone-spatiale-derivee.md`

## Criteres d acceptation

- Une zone derivee depuis la propriete `Zone` devient importable si elle a au moins un `IFCSPACE` enfant avec geometrie.
- Les `IFCSPACE` enfants ne sont plus bloques par `PARENT_GEOMETRY_INVALID`.
- La preview garde une trace claire de la source derivee.

## Implementation livree

- Ajout de `geometrySource=ifc-zone-derived-from-spaces`.
- Derivation de la bbox zone depuis les `IFCSPACE` enfants ou depuis les `IFCSPACE` porteurs de la meme propriete `Zone` sous le meme parent spatial.
- En mode strict, rattachement des zones issues de `IFCSPACE` uniquement via la relation IFC vers `IFCBUILDINGSTOREY`.
- En mode strict, absence de relation `IFCBUILDINGSTOREY` marquee en erreur `IFC_STOREY_RELATION_MISSING` au lieu de rattacher la zone au batiment.
- Diagnostic `ZONE_GEOMETRY_DERIVED` pour les zones importables.
- Diagnostic `ZONE_DERIVATION_FAILED` quand aucune emprise enfant n est exploitable.
- Ajout du compteur `Zones derivees` dans le panneau diagnostics IFC.
- Ajout d un test backend couvrant une zone derivee depuis un espace.
- Ajout d un test backend couvrant un `IFCSPACE` avec zone mais sans relation `IFCBUILDINGSTOREY`.

## Tests executes

- `npm.cmd run build --workspace @inventory/shared`
- `npm.cmd run test --workspace api -- ifc4-assistant.service.spec.ts`
- `npm.cmd run build --workspace api`
- `npm.cmd run build --workspace web`
- `npm.cmd run test --workspace api -- ifc4-assistant.dto.spec.ts`

## Points ouverts

- Verifier sur le fichier IFC4 complet que les zones du RDC sont maintenant rattachees a `RDC` via la relation `IFCBUILDINGSTOREY`.
