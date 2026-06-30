# IFCBUILDINGSTOREY reperes etage derives

## Objectif

Permettre a l assistant IFC4 d accepter les `IFCBUILDINGSTOREY` sans geometrie propre quand leur emprise peut etre derivee depuis leur batiment parent ou depuis leurs enfants, puis les afficher en 3D comme reperes d etage lisibles.

## Perimetre

- dans le scope : diagnostics IFC4, preview spatial, raw rows d import spatial, scene 3D, viewer Three.js, documentation.
- hors scope : maillage IFC detaille, coupe BIM avancee, tuilage 3D, nouvelle table ou migration base.

## Contexte initial

- demande : les etages IFC bloquent l import car Archicad peut exporter un `IFCBUILDINGSTOREY` sans volume propre.
- etat existant : les objets sans `geometryStatus=READY` sont bloques et leurs enfants recoivent `PARENT_GEOMETRY_INVALID`.
- contraintes : ne pas ajouter de fallback silencieux ; les vrais objets sans geometrie restent bloques ; la documentation doit rester en francais ASCII.

## Plan

1. Ajouter un cas metier dedie aux etages IFC dans l assistant.
2. Deriver une bbox d etage depuis le batiment parent geometrique, puis depuis les enfants spatiaux ou equipements rattaches si le batiment n est pas exploitable.
3. Marquer la source `ifc-storey-derived-from-building` ou `ifc-storey-derived` dans les metadonnees et les raw rows.
4. Adapter les diagnostics pour afficher `Etage derive` et compter ces cas.
5. Adapter la generation de scene 3D et le viewer pour afficher des plateaux d etage et leurs labels.
6. Mettre a jour les tests et la documentation.

## Questions ouvertes

- aucune question bloquante.

## Hypotheses

- l axe vertical du viewer est `Y`.
- l epaisseur visuelle d un plateau d etage est `0.08 m`.
- la marge d emprise autour des enfants est `0.50 m`.
- si aucun enfant geometrique ne permet de calculer une emprise, l etage reste non importable.

## Zones impactees

- backend : `apps/api/src/imports/ifc4-assistant.service.ts`, `apps/api/src/bim-3d/*`.
- frontend : `apps/web/app/imports/page.tsx`, `apps/web/components/bim-3d/bim-scene-viewer.tsx`.
- base de donnees : aucun schema nouveau, reutilisation des champs de geometrie persistante.
- infrastructure : aucun changement.
- documentation : specification fonctionnelle, architecture technique, modele de donnees, ADR.

## Tests prevus

- build shared, api et web.
- tests unitaires IFC4 assistant et BIM 3D enrichis si possible.
- verification que les etages derives ne sont plus dans le filtre `A corriger`.

## Criteres d'acceptation

- un `IFCBUILDINGSTOREY` sans geometrie propre mais avec enfants geometriques devient importable.
- la source de geometrie est clairement `ifc-storey-derived-from-building` ou `ifc-storey-derived`.
- les enfants de cet etage ne sont plus bloques par le parent.
- un etage impossible a deriver reste bloque avec un message explicite.
- la vue 3D affiche le plateau d etage, son contour et une etiquette.

## Decisions prises

- `IFCBUILDINGSTOREY` est traite comme un conteneur spatial particulier.
- la geometrie derivee est une donnee explicite, pas une geometrie IFC brute.
- le comportement strict reste inchange pour les autres classes IFC.

## Notes d'implementation

- `packages/shared` expose maintenant `ifc-storey-derived`, `ifc-storey-derived-from-building`, les champs optionnels de `Bim3dFloorGuide`, le statut diagnostic `DERIVED` et le compteur `derivedStoreys`.
- `Ifc4AssistantService` derive les etages IFC sans bbox propre depuis le batiment parent geometrique en priorite, puis depuis les geometries des descendants et des equipements rattaches.
- les raw rows spatial persistent la geometrie derivee avec `geometrySource=ifc-storey-derived-from-building` ou `geometrySource=ifc-storey-derived` et une politique de derivation explicite.
- les diagnostics affichent `STOREY_GEOMETRY_DERIVED` pour les etages valides et `STOREY_DERIVATION_FAILED` si aucune emprise ne peut etre calculee.
- le viewer 3D affiche des plateaux d etage, contours et labels via `CanvasTexture`.

## Suivi

- validations executees :
  - `npm.cmd run build --workspace @inventory/shared`
  - `npm.cmd run build --workspace api`
  - `npm.cmd run build --workspace web`
  - `npm.cmd run test --workspace api -- ifc4-assistant.service.spec.ts bim-3d-ifc-scene.spec.ts`
- note : `npx.cmd tsc --noEmit --project apps/api/tsconfig.json` reste bloque par des erreurs preexistantes dans plusieurs specs non liees ; les builds runtime ciblent `tsconfig.build.json` et passent.
- note : `npm.cmd run db:generate --workspace api` n est pas requis par cette evolution sans migration et a echoue localement car `node_modules/.prisma/client/query_engine-windows.dll.node` est verrouille par un process actif.
