# Assistant IFC4 spatial, referentiels assets et equipements

## Objectif

Implementer un assistant IFC4 dans le workspace imports pour preparer les donnees issues d un fichier IFC4 avant passage dans le moteur ETL existant.

## Perimetre

- dans le scope :
  - upload et analyse d un fichier `.ifc`
  - preview arborescente du spatial extrait
  - creation d un job `spatial-nodes` a partir des lignes extraites
  - extraction et preview des referentiels assets candidats
  - creation controlee des referentiels assets manquants
  - preview des equipements candidats par classes IFC
  - creation d un job `equipments` a partir des lignes extraites
- hors scope :
  - rendu 3D IFC
  - rapprochement automatique avec les immobilisations comptables
  - import direct en base hors moteur `imports`
  - persistence serveur longue duree du modele IFC parse
  - edition avancee de mapping graphique

## Contexte initial

- demande :
  - implementer le plan assistant IFC4 V1 spatial, V2 referentiels assets et equipements
- etat existant :
  - les imports reels `spatial-nodes`, `immobilizations` et `equipments` sont deja branches
  - le workspace web imports supporte jobs, upload, mapping, preview, validate, execute et purge
  - `SpatialNode` porte deja `externalRef`, `sourceClass` et `sourceMetadata`
  - `Equipment` est deja aligne sur `currentSpatialNodeId`
- contraintes :
  - ne pas dupliquer la persistence metier du moteur imports
  - garder une logique tenant-aware et permissionnee
  - garder la documentation en francais ASCII

## Plan

1. Ajouter les contrats partages de l assistant IFC4.
2. Ajouter un service backend de parsing IFC4 leger base sur STEP text.
3. Exposer les endpoints d analyse, de creation de jobs et d application des referentiels.
4. Brancher une surface UI dans `apps/web/app/imports/page.tsx`.
5. Ajouter des tests backend sur l extraction IFC4.
6. Mettre a jour la documentation racine et le backlog.

## Plan de reorganisation UI IFC4

1. Recomposer l assistant dans l ordre de lecture :
   - `1. Fichier IFC4`
   - `2. Previsualisation`
   - `3. Spatial`
   - `4. Referentiels assets`
   - `5. Equipements`
   - `6. Generation des jobs`
2. Afficher le fichier selectionne juste apres le bouton de selection avec une action `X` pour le retirer.
3. Renommer `Defaults equipements` en `Valeurs par defaut equipements` et placer ces champs avant la preview equipements.
4. Ajouter pagination locale a 10 lignes pour spatial, referentiels assets et equipements.
5. Ajouter corrections de preparation :
   - type de noeud spatial corrigeable par ligne
   - type de referentiel asset corrigeable par ligne
6. Transmettre les corrections au backend via champs multipart JSON :
   - `spatialOverrides`
   - `assetReferenceOverrides`
   - `equipmentOptions`
7. Afficher les equipements avec donnees metier et ouvrir un detail read-only au clic.

## Questions ouvertes

- Le mapping fin des classes IFC vers les familles/types metier devra etre enrichi avec de vrais profils tenant.
- La normalisation des marques et modeles devra etre confirmee avec plusieurs exports Archicad.
- La future V2 devra arbitrer si l assistant IFC4 devient un vrai profil persistant distinct des profils CSV/XLSX.

## Hypotheses

- L assistant IFC4 V1 lit le fichier a chaque action ; il ne stocke pas un graphe IFC parse en base.
- Les jobs generes sont des jobs `imports` standards avec source synthesee en lignes normalisees.
- Les classes equipements V1 ciblent surtout `IfcFurniture`, puis les classes techniques seront activees progressivement.
- La creation de referentiels manquants utilise une categorie/famille/sous-famille de regroupement `IFC4` si aucune structure plus precise n est fournie.

## Zones impactees

- backend :
  - `apps/api/src/imports`
  - services Prisma assets et imports
- frontend :
  - `apps/web/app/imports/page.tsx`
- base de donnees :
  - pas de migration ciblee dans cette vague
- infrastructure :
  - stockage runtime imports existant reutilise
- documentation :
  - `FUNCTIONAL_SPEC.md`
  - `TECHNICAL_ARCHITECTURE.md`
  - `DATA_MODEL.md`
  - `IMPLEMENTATION_BACKLOG.md`
  - `docs/adr/0015-ifc4-assistant-preparation-imports.md`

## Tests prevus

- test unitaire backend sur analyse IFC4 minimale
- test creation de job spatial depuis IFC4
- test preview et application de referentiels assets
- build shared
- test API cible ou suite API selon temps disponible
- build web

## Criteres d'acceptation

- un utilisateur avec `imports.manage` peut charger un IFC4 et obtenir une preview spatial/referentiels/equipements
- le bouton spatial cree un job `spatial-nodes` ouvrable dans le workspace imports
- le bouton equipements cree un job `equipments` ouvrable dans le workspace imports
- les referentiels manquants peuvent etre appliques volontairement
- les imports restent executes par preview/validate/execute standards

## Decisions prises

- IFC4 est implemente comme assistant de preparation et non comme nouveau moteur d import metier.
- Aucun nouveau schema Prisma n est requis pour cette vague.
- Le rapprochement immobilisation/equipement reste hors scope.

## Notes d'implementation

- contrats partages IFC4 ajoutes dans `packages/shared/src/imports.ts`
- service backend `Ifc4AssistantService` ajoute dans `apps/api/src/imports`
- endpoints ajoutes sous `/api/v1/imports/ifc4`
- `ImportsService.createPreparedJob` ajoute pour creer un job standard depuis des lignes deja extraites
- UI ajoutee dans `apps/web/app/imports/page.tsx`
- pas de migration Prisma ajoutee
- les jobs generes restent des jobs imports standards en `sourceKind=CSV` avec option `sourceAssistant=IFC4`
- UI reorganisee selon le workflow fichier -> previsualisation -> spatial -> referentiels assets -> equipements
- fichier selectionne affiche en ligne avec action de retrait
- `Defaults equipements` remplace par `Valeurs par defaut equipements`, positionne dans la section equipements
- previews spatial, referentiels assets et equipements paginees localement a 10 lignes
- corrections de type spatial et de type referentiel envoyees via overrides multipart
- detail equipement IFC4 ajoute en consultation read-only depuis la ligne de preview
- correctif du 2026-06-19 :
  - sections IFC4 `Previsualisation`, `Spatial`, `Referentiels assets` et `Equipements` forcees en une colonne pour que les listes et paginations restent dans l ordre vertical ;
  - preview spatial enrichie avec code, parent, nombre d enfants, classe source IFC et reference externe ;
  - preview referentiels assets enrichie avec parent, occurrences, classe source IFC et etat ;
  - pagination locale spatial, referentiels assets et equipements affichee en pied de liste avec marge dediee.
- evolution du 2026-06-19 :
  - preview spatial IFC4 remplacee par une arborescence locale construite depuis `path` et `parentPath` ;
  - fleche a gauche du noeud pour deployer ou replier les enfants ;
  - rendu du noeud aligne sur la page localisations via `SpatialNodeTitle` ;
  - clic sur le libelle pour ouvrir ou fermer le detail du noeud courant ;
  - pagination conservee en pied sur les lignes visibles de l arbre.
- evolution complementaire du 2026-06-19 :
  - les equipements IFC4 sont maintenant regroupes par `currentSpatialPath` et affiches sous le noeud spatial correspondant quand le noeud est deploye ;
  - chaque carte equipement affiche les informations metier utiles a la validation : code interne, libelle, composant asset, categorie, famille, sous-famille, type, marque, modele, statut et proprietaire ;
  - les referentiels assets detectes sont rattaches visuellement aux equipements via la classification reconstruite en memoire depuis les candidats `assetReferences` ;
  - la section equipements expose une liste metier paginee sans afficher le GUID IFC par defaut ;
  - les equipements sans noeud spatial resolu alimentent une liste separee d anomalies non rattachees a l arborescence ;
  - le detail read-only equipement affiche maintenant la classification metier reconstruite et conserve les references IFC dans la zone technique.
- evolution mapping proprietes du 2026-06-19 :
  - l analyse IFC4 expose maintenant les proprietes `IfcPropertySingleValue` detectees sur les classes equipements selectionnees, avec exemple et nombre d occurrences ;
  - la section equipements propose un formulaire de mapping ephemere vers `categorie`, `famille`, `sous-famille`, `type`, `marque`, `modele`, `statut` et `proprietaire` ;
  - le recalcul de la preview est volontaire via le bouton `Actualiser le mapping`, afin d eviter un recalcul a chaque changement de select ;
  - les mappings sont transmis dans `equipmentOptions.propertyMappings` aux endpoints `analyze`, `asset-references/apply` et `equipments/create-job` ;
  - le backend utilise les mappings avant ses heuristiques historiques, puis conserve les anciennes regles en repli ;
  - l application des referentiels assets rattache maintenant les familles, sous-familles et types au parent declare par les candidats issus du mapping.
- evolution champs equipement du 2026-06-19 :
  - le schema `Equipment` ajoute `numPiece` pour stocker un numero de piece texte et `externalRef` pour conserver une reference source externe ;
  - les contrats `assets`, les DTO API, les repositories, les exports ODS et les ecrans de saisie/visualisation affichent maintenant `numPiece` et `externalRef` ;
  - le catalogue import `equipments` expose `numPiece` et `externalRef` ;
  - l assistant IFC4 permet de mapper des proprietes `IfcPropertySingleValue` vers `internalCode`, `numPiece` et `externalRef`, en plus des mappings de classification ;
  - le bouton `Actualiser le mapping` reste le point de controle volontaire du recalcul de preview.

## Suivi

- Diagnostic du 2026-06-19 :
  - le workflow IFC4 et les overrides sont deja en place ;
  - les previews spatial et referentiels assets manquent encore de details visibles par ligne ;
  - les sections IFC4 heritent de la grille deux colonnes de `FormSection`, ce qui peut afficher la pagination a cote de la liste sur grand ecran ;
  - la correction cible est purement UI : colonnes de detail enrichies et sections forcees en une colonne.
- Ajouter plus tard un mapping persistant IFC class/proprietes vers referentiels metier.
- Ajouter plus tard une selection plus fine par objets et classes IFC.
- Tests executes :
  - `npm run build --workspace @inventory/shared`
  - `npm run build --workspace api`
  - `npx vitest run src/imports/ifc4-assistant.service.spec.ts --config vitest.config.ts`
  - `npm run test --workspace api`
  - `npm run build --workspace web`
- Tests executes apres reorganisation :
  - `npm run build --workspace @inventory/shared`
  - `npm run build --workspace api`
  - `npm run test --workspace api`
  - `npm run build --workspace web`
- Tests executes apres correctif du 2026-06-19 :
  - `npm run build --workspace web`
- Tests executes apres evolution arborescente du 2026-06-19 :
  - `npm run build --workspace web`
- Tests executes apres rattachement equipements du 2026-06-19 :
  - `npm run build --workspace web`
- Tests executes apres mapping proprietes IFC du 2026-06-19 :
  - `npm run build --workspace @inventory/shared`
  - `npm run build --workspace api`
  - `npm run build --workspace web`
- Tests executes apres ajout `numPiece` et `externalRef` :
  - `cmd /c npx prisma validate --schema prisma/schema.prisma`
  - `npm run test --workspace api -- src/imports/ifc4-assistant.service.spec.ts`
  - `npm run build --workspace @inventory/shared`
  - `npm run build --workspace api`
  - `npm run build --workspace web`
