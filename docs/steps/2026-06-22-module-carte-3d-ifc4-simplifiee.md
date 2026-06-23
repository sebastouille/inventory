# Etape - Module carte 3D IFC4 simplifiee

## Objectif

Livrer une premiere carte 3D legere dans `apps/web` pour visualiser les noeuds spatiaux et les equipements, avec selection, surbrillance, zoom, rotation, deplacement lateral et heatmap d anciennete d inventaire.

## Perimetre livre

- backend `bim-3d` sous `/api/v1/bim-3d/maps`
- tables Prisma `Bim3dMap` et `Bim3dMapBuild`
- stockage hors base des scenes sous `.runtime/bim-3d`
- generation de scene JSON V1 depuis `SpatialNode` et `Equipment`
- fallback spatial deterministe si aucune geometrie IFC exploitable n est disponible
- permissions `bim3d.read`, `bim3d.build`, `bim3d.manage`
- audit des generations, echecs et archivages de carte
- page web `/spatial-3d`
- viewer Three.js avec boites et cubes simplifiees
- heatmap selon `Equipment.lastInventoryAt`
- entree de navigation `Carte 3D`

## Choix techniques

- ne pas charger le fichier IFC directement dans le navigateur en V1
- ne pas ajouter de chaine BIM avancee ni de fragments IFC en V1
- utiliser `three` uniquement cote `apps/web`
- stocker la scene comme fichier JSON versionne hors base
- garder en base seulement les metadonnees de carte, les builds et les chemins de fichiers
- afficher des volumes simplifiees plutot qu un maillage BIM detaille

## API

- `GET /api/v1/bim-3d/maps`
- `POST /api/v1/bim-3d/maps/build`
- `GET /api/v1/bim-3d/maps/:mapId`
- `GET /api/v1/bim-3d/maps/:mapId/scene`
- `GET /api/v1/bim-3d/maps/:mapId/history`
- `POST /api/v1/bim-3d/maps/:mapId/archive`

## Modele de scene V1

- `metadata` : carte, organisation, import source, date generation
- `nodes` : noeuds spatiaux avec `bbox`
- `equipments` : equipements avec position, taille, statut, famille, type et bucket heatmap
- `materials` : couleurs noeuds, equipements et heatmap
- `limits` : plafonds desktop/mobile et mode de generation

## Tests executes

- `npm run build --workspace @inventory/shared`
- `npm run test --workspace api`
- `npm run build --workspace api`
- `npm run test:migrations --workspace api`
- `npm run build --workspace web`

## Criteres d acceptation

- un utilisateur avec `bim3d.read` consulte les cartes 3D
- un utilisateur avec `bim3d.build` genere une carte
- une scene est stockee hors base et relue par l API
- la page `/spatial-3d` affiche les noeuds et equipements
- la heatmap distingue les inventaires recents, anciens et inconnus
- une action de generation ou d archivage est auditee
- la migration passe sur un schema vide

## Travail differe

- extraction de bounding boxes IFC plus fidele : reprise par `docs/steps/2026-06-22-ifcopenshell-python-carte-3d.md`
- rendu par tuiles ou fragments BIM
- mode coupe par etage
- export image ou rapport PDF
- lien direct fiche equipement vers carte 3D
- service worker offline pour scenes 3D recentes
