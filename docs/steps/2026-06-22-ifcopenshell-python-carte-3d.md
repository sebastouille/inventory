# Etape - IfcOpenShell Python pour carte 3D IFC4

## Objectif

Ameliorer la carte 3D IFC4 pour utiliser les coordonnees monde et les volumes issus du fichier IFC quand ils sont disponibles, sans charger le fichier IFC dans le navigateur et sans introduire un moteur BIM complet en V1.

## Perimetre livre

- worker Python local sous `apps/api/workers/ifc_geometry`
- extraction IfcOpenShell en JSON technique interne
- endpoint multipart `POST /api/v1/bim-3d/maps/build-ifc`
- stockage du fichier IFC source sous `.runtime/bim-3d`
- transformation backend vers `scene.v1.json`
- scene enrichie avec moteur d extraction, source de geometrie, bbox monde, origine scene et reperes d etage
- geometrie IFC persistante sur `SpatialNode` et `Equipment`
- import IFC4 strict : les jobs spatial et equipements sont bloques si une ligne n a pas de geometrie exploitable
- generation standard de carte 3D depuis la geometrie IFC persistante, sans placement fallback silencieux
- affichage web d un bouton `Generer depuis IFC`
- affichage des reperes d etage dans le viewer Three.js
- messages explicites si IfcOpenShell est indisponible, si l extraction echoue, ou si des objets n ont pas de geometrie

## Decisions

- NestJS reste l API principale.
- Python ne fournit pas de serveur reseau.
- IfcOpenShell est appele comme batch local.
- Le frontend continue a lire uniquement le JSON de scene simplifie.
- Le maillage IFC detaille n est pas expose en V1.
- L image Docker API passe de Alpine a Debian slim pour permettre l installation de wheels Python IfcOpenShell compatibles glibc.
- Le flux IFC4 ne masque plus les erreurs par un fallback spatial.
- Le fallback spatial reste reserve a une scene de demonstration ou a des donnees non IFC, pas a l import IFC strict.

## API

- `POST /api/v1/bim-3d/maps/build-ifc`
  - multipart form-data
  - `file` obligatoire
  - `name` optionnel
  - `includeEquipments` optionnel
  - `includeFloorGuides` optionnel
  - permission `bim3d.build`

## Contrats scene

- `metadata.geometrySource`
- `metadata.extractionEngine`
- `metadata.globalBbox`
- `metadata.sceneOrigin`
- `metadata.unitScale`
- `metadata.geometryStats`
- `metadata.fallbackCount`
- `floorGuides`
- `geometrySource` sur noeuds et equipements
- `worldBbox` et `fallbackReason` quand utile
- mode `ifc-persisted-geometry` pour les scenes issues des champs persistants

## Champs persistants ajoutes

- `geometrySource`
- `geometryMetadata`
- `worldCenterX`, `worldCenterY`, `worldCenterZ`
- `worldSizeX`, `worldSizeY`, `worldSizeZ`
- `geometryUpdatedAt`

Ces champs existent sur `SpatialNode` et `Equipment`. Les dimensions sont des bounding boxes en metres.

## Tests executes

- `npm run build --workspace @inventory/shared`
- `npm run build --workspace api`
- `npm run build --workspace web`
- `npm run test --workspace api -- --run src/bim-3d/bim-3d-ifc-scene.spec.ts src/bim-3d/bim-3d-scene.spec.ts`
- `npm run test --workspace api`
- `npm run test:migrations --workspace api`
- `npm run test --workspace web`
- `python -m py_compile apps/api/workers/ifc_geometry/extract_scene.py`

## Limites connues

- l extraction reelle requiert `ifcopenshell` installe dans l environnement Python actif
- le rendu reste compose de boites proportionnelles, pas de maillage BIM detaille
- les objets sans geometrie IFC bloquent le job IFC strict
- le tuilage spatial, les coupes par etage et le rendu fragments BIM restent differes

## Criteres d acceptation

- un utilisateur autorise peut charger un fichier `.ifc` et generer une carte 3D
- la scene indique si elle utilise des coordonnees IFC directes ou une geometrie IFC importee
- les etages sont visibles comme reperes
- les objets conservent leur `GlobalId` IFC dans la scene
- un echec Python ou une geometrie manquante produit une erreur explicite dans le flux IFC strict
- le navigateur ne parse jamais le fichier IFC source
