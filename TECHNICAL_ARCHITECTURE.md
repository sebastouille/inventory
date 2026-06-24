# Architecture technique

## Architecture actuelle

- monolithe modulaire
- `apps/api` : API NestJS
- `apps/web` : application operateur et base PWA responsive
- `apps/admin` : back-office admin
- `prisma/` : schema, migrations, seed
- `packages/shared` : contrats TypeScript partages
- `packages/ui` : design tokens, themes, shells et composants partages
- PostgreSQL comme base relationnelle
- nouveau module backend `assets` pour le patrimoine unitaire et ses referentiels
- nouveau module backend `imports` pour les profils ETL, les jobs d import et les rapports de validation
- nouveau module backend `spatial` pour le referentiel spatial hierarchique, son backfill legacy, son CRUD admin et ses endpoints de consultation
- nouveau module backend `bim-3d` pour generer, tracer et servir des scenes 3D simplifiees stockees hors base
- worker Python local `apps/api/workers/ifc_geometry` pour extraire des bounding boxes IFC4 avec IfcOpenShell sans exposer de microservice separe

## Preoccupations transverses

- API servie sous `/api/v1`
- la documentation Swagger runtime `/api/docs` est desactivee en V1 afin d eviter la dependance vulnerable `js-yaml` via `@nestjs/swagger`; les decorateurs restants sont des no-op locaux
- authentification JWT
- challenge court dedie `PASSWORD_CHANGE` pour imposer un changement de mot de passe sans ouvrir de session applicative normale
- sur reponse `401`, les clients Next vident le token local et resynchronisent la session dans le meme onglet pour revenir a l ecran de connexion
- RBAC et verification de permissions
- audit centralise
- listes metier homogenes via pagination, tri, recherche et export `.ods`
- theming dual light/dark avec tokens semantiques
- PWA `apps/web` avec `manifest.webmanifest`, icones applicatives et ergonomie mobile
- l execution terrain web utilise maintenant un controleur de scan unique : camera via `BarcodeDetector` si disponible, fallback `@zxing/browser`, douchette Bluetooth en mode clavier HID, saisie manuelle, parsing partage et file IndexedDB par campagne
- `POST /api/v1/inventory-campaigns/:id/complete-node` permet de terminer un noeud actif et de generer les anomalies `MISSING` de facon idempotente
- documentation versionnee en Markdown a la racine et sous `docs/`
- la regeneration Prisma locale passe par `scripts/prisma-generate-safe.ps1`, qui refuse `PRISMA_GENERATE_NO_ENGINE` et verifie que le client genere embarque bien l engine local Windows/Linux attendu pour `postgresql://`
- le deploiement production Dokploy utilise `docker-compose.prod.yml` avec ports internes `web=3010`, `api=3011`, `admin=3014`, exposes via `expose` et non publies sur les ports hote
- le compose production injecte `DATABASE_URL` dans l API depuis `INVENTORY_DATABASE_URL` et exige les secrets `JWT_SECRET` et `JWT_REFRESH_SECRET` sans fallback faible
- le compose production transmet `NEXT_PUBLIC_API_URL`, `API_BASE_URL` et `NEXT_PUBLIC_WEB_APP_URL` comme arguments de build aux images `web` et `admin`, car Next.js fige les variables `NEXT_PUBLIC_*` dans le bundle navigateur
- en production, `PrismaService` refuse un `DATABASE_URL` absent ou pointe vers la base `comps`
- le demarrage API production execute `prisma migrate deploy`, puis le bootstrap production seulement si `INVENTORY_BOOTSTRAP_ENABLED=true`, puis `node apps/api/dist/src/main.js`
- le CORS API est pilote par `CORS_ALLOWED_ORIGINS`, avec fallback local `http://localhost:3010,http://localhost:3014`
- les domaines publics cibles sont `https://inventory.gestionai.fr`, `https://api.inventory.gestionai.fr/api/v1` et `https://admin.inventory.gestionai.fr`
- `.dockerignore` exclut les artefacts locaux et dependances afin que Dokploy ne transfere pas `node_modules`, `.next`, `dist`, `.runtime` ou les sorties locales dans le contexte de build

## Patterns frontend actifs

- layouts Next.js `app/` relies a `UiProviders` centralisant theme et notifications
- shell partage `AppShell` pour sidebar desktop, menu `sheet` mobile, topbar et actions communes
- `AppShell` supporte maintenant une aide contextuelle optionnelle dans le header, rendue sous forme de modale scrollable avec contenu React libre
- `AppShell` supporte maintenant aussi une recherche globale transverse via un composant partage `GlobalSearchBox`, avec dropdown groupe, navigation clavier et selection par clic ou `Enter`
- les boutons iconiques du header utilisent un composant partage `HeaderIconButton` pour garantir un diametre, un alignement et une accessibilite identiques dans `apps/web` et `apps/admin`
- une V2 ciblee devra faire evoluer cette aide vers un moteur de parcours guide pilotant overlays, surbrillances, ancrages de zones et progression utilisateur persistante
- gabarits `DashboardPage`, `ListPage`, `DetailPage`, `EditFormPage`, `ReadOnlyFormPage`
- le module `imports` web utilise maintenant un workspace unique pour jobs, profils, upload, mapping inline, preview, validate, execute et lecture de rapport, sans ecran admin parallele sur cette vague
- composants metier partages :
  - `DataGrid`
  - `FilterBar`
  - `PaginationBar`
  - `ActionBar`
  - `FormSection`
  - `ReadOnlyField`
  - `StatusBadge`
  - `PageSection`
- `DataGrid` supporte maintenant deux modes desktop pour les actions de ligne :
  - `inline` par defaut pour afficher directement les boutons quand l espace horizontal peut defiler
  - `menu` uniquement sur demande explicite de l ecran consommateur
- `DataGrid` supporte aussi un comportement optionnel `onRowClick`, utilise par l admin spatial pour piloter l expansion de l arborescence
- `SpatialNodeChip` centralise le rendu visuel des types de noeuds spatiaux avec icone et couleur derives d une configuration d organisation
- la creation de campagne reutilise l endpoint arbre `spatial/nodes/tree`, le catalogue visuel `spatial/nodes/display-settings` et la liste `spatial/nodes` enrichie d un compteur `equipmentCount` pour proposer une selection de perimetre hierarchique

## Patterns API actifs

- DTOs de liste communs pour `page`, `pageSize`, `sort`, `direction`, `q`
- reponses paginees unifiees via `PaginatedResponse<T>`
- `POST /api/v1/auth/login` retourne maintenant une union de contrats :
  - `AUTHENTICATED` avec `accessToken`
  - `PASSWORD_CHANGE_REQUIRED` avec `passwordChangeToken`
- export OpenDocument tableur via `xlsx` et endpoints `GET /export`
- le domaine `assets` expose un controller metier et un controller de referentiels sous `/api/v1/assets`
- le domaine `immobilizations` expose un controller dedie sous `/api/v1/immobilizations`, couvert par les permissions existantes `assets.read` et `assets.update`; le detail retourne aussi une liste synthetique des equipements rattaches
- le domaine `equipment-movements` expose un controller dedie sous `/api/v1/equipment-movements` et une route de fiche `/api/v1/assets/:assetId/movements`, avec lecture protegee par `assets.read`
- le domaine `imports` expose un controller transverse sous `/api/v1/imports`
- le domaine `imports` expose aussi un assistant IFC4 sous `/api/v1/imports/ifc4/*` pour analyser un fichier IFC4, appliquer les referentiels assets candidats, et creer des jobs imports standards a partir de lignes extraites avec overrides optionnels de preparation
- le domaine `imports` expose aussi `DELETE /api/v1/imports/jobs/:jobId` pour supprimer un job et nettoyer ses artefacts de stockage local, mais retourne `409 IMPORT_JOB_DELETE_BLOCKED` tant que des creations metier du job existent encore
- le domaine `imports` expose aussi `POST /api/v1/imports/jobs/:jobId/purge-created-data` pour purger en V1 uniquement les creations `spatial-nodes` d un job execute
- le domaine `spatial` expose des endpoints sous `/api/v1/spatial/nodes` pour liste, arbre, detail, resume, creation, mise a jour et archivage
- le domaine `label-exports` expose `POST /api/v1/label-exports/equipments/*` et `POST /api/v1/label-exports/spatial-nodes/*` pour preview et export stateless des etiquettes
- le domaine `inventory-campaigns` expose les campagnes terrain equipements sous `/api/v1/inventory-campaigns`, avec creation, preview attendus, ouverture, cloture, archivage et synchronisation terrain
- le domaine `inventory-anomalies` expose les anomalies et corrections superviseur sous `/api/v1/inventory-anomalies`
- le domaine `reconciliation` expose le rapprochement manuel sous `/api/v1/reconciliation/equipment/:equipmentId`
- le domaine `global-search` expose `GET /api/v1/search/global?q=...` pour agreger les suggestions metier cross-domaines selon les permissions de lecture deja presentes
- le domaine `bim-3d` expose `/api/v1/bim-3d/maps` pour lister, generer, consulter, historiser et archiver les cartes 3D simplifiees
- le domaine `bim-3d` expose aussi `POST /api/v1/bim-3d/maps/build-ifc` pour recevoir un fichier IFC et lancer l extraction IfcOpenShell/Python
- `bim-3d` stocke les fichiers scene sous `.runtime/bim-3d/` et conserve seulement les metadonnees dans PostgreSQL
- `bim-3d` stocke aussi le fichier IFC source et le JSON technique d extraction sous `.runtime/bim-3d/`, puis transforme ces donnees en `scene.v1.json`
- les imports IFC4 appellent aussi le worker IfcOpenShell pendant l analyse, rapprochent la geometrie par `GlobalId`, et persistent les champs de geometrie sur `SpatialNode` et `Equipment`
- la generation standard `bim-3d` refuse les donnees sans geometrie persistante avec `BIM3D_GEOMETRY_MISSING` ou `BIM3D_PARTIAL_GEOMETRY`
- le viewer `apps/web/app/spatial-3d/page.tsx` utilise `three` et `OrbitControls`, avec une scene client-only composee de boites et cubes
- le viewer 3D affiche les reperes d etage issus de la scene, et distingue `Coordonnees IFC`, `Mode mixte` et `Fallback spatial`
- le domaine `spatial` expose aussi `GET /api/v1/spatial/nodes/display-settings` pour fournir la configuration visuelle aux ecrans operateur et admin sans dependre d un droit organisationnel
- le domaine `organizations` expose maintenant `PATCH /api/v1/organizations/current/settings` pour mettre a jour en une seule operation les styles spatiaux et la politique IAM spatiale
- `IamAccessScope` reste l objet IAM assigne aux utilisateurs, mais il est maintenant synchronise depuis `SpatialNode` via `spatialNodeId`
- les acces Prisma du domaine `assets` passent par des repositories dedies pour isoler la logique de persistence
- les acces Prisma du domaine `immobilizations` passent par un repository dedie et exposent un helper de resolution par code pour les futurs imports F2-L04
- le domaine `assets` s aligne maintenant sur `Equipment.currentSpatialNodeId` comme source de verite de la position courante ; les affectations `LOCATION` restent lisibles pour l historique legacy mais ne sont plus le flux normal d edition
- le domaine `assets` inclut maintenant `Equipment.immobilizationId` dans ses lectures, validations, exports et audits de changement
- le domaine `assets` emet maintenant des `EquipmentMovement` dans la meme transaction que les creations et mises a jour d equipements
- les changements d equipements, d affectations et de referentiels assets sont audites via `AuditService`
- `inventory` et `stock-movements` restent des briques separees pour le futur domaine `products` ; ils ne doivent pas etre reutilises comme support des futurs mouvements et campagnes `equipements`
- le domaine `imports` persiste ses metadonnees en base via `ImportProfile` et `ImportJob`, mais stocke les sources chargees et le cache de lignes sous `.runtime/imports/`
- le domaine `imports` persiste aussi la provenance des ecritures reelles via `ImportJobWrite`, alimente uniquement pendant `execute`
- `imports` utilise des contrats partages `@inventory/shared` pour les enums, mappings, rapports et listes paginees
- `imports` supporte trois etapes de traitement en V1 : `preview`, `validate` et `execute`
- `imports.execute` est maintenant branche en reel pour `spatial-nodes`, `immobilizations` et `equipments`, avec adapters metier dedies et provenance `ImportJobWrite`
- la suppression d un `ImportJob` efface le dossier `.runtime/imports/<organizationId>/<jobId>`, mais reste distincte de la purge metier
- la purge V1 des imports repose sur `ImportJobWrite`, ne supprime que les `CREATED`, et bloque integralement si un descendant externe ou une affectation IAM rend le sous arbre non purgeable
- `SpatialService` recentralise maintenant tous les invariants d ecriture spatiale : normalisation du `code` et du `path`, recalcul de `depth`, resolution du parent, et validation hierarchique avant persistence
- `AuthContextService` expose maintenant dans `/auth/me` les `organizationSettings`, `spatialScopePolicy` et `isOrganizationWideSpatialAccess` pour permettre aux clients de rendre et appliquer le mode effectif
- `AuthService.completePasswordChange` verifie un JWT dedie de finalite `PASSWORD_CHANGE`, controle la politique mot de passe, refuse la reutilisation du mot de passe temporaire, remet `User.mustChangePassword=false`, audite l operation puis emet le vrai JWT applicatif
- `IamService.resetUserPassword` remplace `passwordHash`, positionne `mustChangePassword=true` et audite l action `iam.user.password.reset`
- `JwtGuard` refuse les tokens dont `purpose` n est pas `ACCESS`, ce qui empeche la reutilisation d un challenge de changement force comme bearer applicatif
- les mutations `spatial` synchronisent les scopes IAM associes dans la meme transaction logique de persistence
- `Organization.settings` persiste maintenant a la fois :
  - `spatialDisplay`
  - `iam.spatialScopePolicy`
- la mise a jour legacy `PATCH /api/v1/organizations/current/spatial-display` reste disponible, mais le flux admin principal passe desormais par `PATCH /api/v1/organizations/current/settings`
- en mode `ORGANIZATION_WIDE`, les scopes IAM restent stockes pour audit et compatibilite, mais ils sont ignores pour l acces spatial effectif et pour le blocage `HAS_SCOPE_ASSIGNMENTS` de la purge V1
- `imports.execute` pour `immobilizations` reconcilie par `organizationId + code`, convertit les dates Excel numeriques et trace les creations/mises a jour
- `imports.execute` pour `equipments` reconcilie par `organizationId + internalCode`, resout la localisation par `currentSpatialPath`, puis `currentSpatialExternalRef`, puis `currentSpatialCode` uniquement si unique
- `imports.execute` pour `equipments` reutilise `EquipmentMovementsService` avec `source=IMPORT` pour creer les mouvements initiaux et les changements de localisation
- l assistant IFC4 est une couche de preparation : il parse le STEP IFC4, extrait les proprietes utiles, construit des raw rows, puis appelle le moteur imports existant via un job prepare ; il ne persiste pas directement `SpatialNode` ou `Equipment`
- les jobs crees par l assistant IFC4 utilisent les domaines existants `spatial-nodes` et `equipments`, ce qui preserve mapping, rapports, provenance `ImportJobWrite`, audit et purge
- les endpoints IFC4 acceptent `spatialOverrides`, `assetReferenceOverrides` et `equipmentOptions` en multipart pour appliquer les corrections de preparation avant creation du job ou application des referentiels
- `equipmentOptions.propertyMappings` permet de choisir les proprietes `IfcPropertySingleValue` source des champs equipement (`internalCode`, `numPiece`, `externalRef`) et des referentiels assets ; ces mappings restent ephemeres en V1 et sont appliques lors de `analyze`, `asset-references/apply` et `equipments/create-job`
- cote web, la preview IFC4 construit une vue derivee en memoire a partir de `spatialNodes`, `equipmentRows` et `assetReferences` : les equipements sont regroupes par `currentSpatialPath`, affiches sous le noeud spatial correspondant, et les lignes sans noeud resolu alimentent une liste d anomalies sans changer les contrats backend
- `F2-L01` a introduit le rattachement direct `Equipment -> SpatialNode`, les dates metier `receivedAt`, `commissionedAt`, `lastInventoryAt`, les champs texte `numPiece` et `externalRef`, et le retrait de `barcode` / `qrCode` des contrats `assets`
- `F2-L02` a introduit `Immobilization`, les endpoints CRUD V1, le rattachement optionnel `Equipment -> Immobilization`, et les catalogues d import prepares
- `F2-L03` a introduit le journal `EquipmentMovement` derive des changements de localisation et d affectation, sans casser le domaine stock `products`
- `F2-L04` a branche les imports reels `immobilizations` et `equipments`, sans rapprochement automatique SP/IFC
- `apps/web/lib/api.ts` expose maintenant un helper multipart dedie pour les uploads de fichiers d import, en complement de `apiFetch`
- `apps/web/lib/api.ts` expose aussi `apiDownloadPost` pour les exports stateless declenches par payload JSON
- `apps/web` et `apps/admin` adaptent leur ecran de login a la reponse union du backend et utilisent un composant partage `ForcedPasswordChangeCard` pour la saisie du nouveau mot de passe
- `AuthLoginCard` ne fournit plus de valeurs demo par defaut ; les champs organisation, email et mot de passe demarrent vides sauf props explicites
- `packages/ui` expose aussi `PasswordPolicyChecklist` pour afficher en rouge/vert les regles de complexite et la correspondance de confirmation
- `apps/web/app/imports/page.tsx` recale maintenant explicitement `pageError` apres une requete API reussie et gere le bouton `Rafraichir` via le meme flux de chargement securise, afin d eviter les faux messages reseau persistants
- `apps/web/app/imports/page.tsx` reexpose l action `Supprimer le job`, mais la connecte au garde backend `IMPORT_JOB_DELETE_BLOCKED` et a un dialogue de confirmation explicite
- le domaine `health` expose `GET /api/v1/health` sans JWT, avec `SELECT 1` via Prisma et une reponse `200` ou `503` selon l etat SQL
- le domaine `dashboard` expose `GET /api/v1/dashboard/overview` pour le tableau de bord metier web, separe du domaine `inventory` conserve pour la vue stock/products
- la navigation web principale masque temporairement `/inventory` et `/movements`, mais conserve les pages et endpoints stock pour une reintegration future
- `apps/admin/lib/api.ts` expose `fetchApiHealth()` sans token ; il interprete explicitement l etat `degraded` pour nourrir le voyant admin
- `packages/ui/src/components/app-shell.tsx` accepte un bloc `headerStatus` optionnel pour injecter un voyant ou un statut de header sans coupler `web` et `admin`
- `apps/web` et `apps/admin` branchent chacun un hook `useGlobalSearch`; l admin recompose des URLs absolues vers `apps/web` via `NEXT_PUBLIC_WEB_APP_URL`
- les pages `campaigns`, `locations`, `immobilizations` et `imports` utilisent des query params comme deep-links V1 afin d ouvrir un detail sans creer de nouvelle route detail cote Next
- les permissions `imports.read`, `imports.manage` et `imports.execute` sont rattachees au RBAC courant et auditees
- agragation et tri applicatifs en V1 sur les ressources prioritaires, avec optimisation SQL differee au backlog
- la page `apps/web/app/imports/page.tsx` embarque un premier module d aide V1 avec vignettes SVG statiques cliquables sous `apps/web/public/help/imports/`
- la V2 devra probablement introduire un composant transverse de type `GuidedHelpTour` dans `packages/ui`, avec registre de zones cibles par page, et une persistence de progression cote API ou `Organization/User settings` selon l arbitrage futur

## Bootstrap production Dokploy

- le script compile `apps/api/dist/src/bootstrap/production-bootstrap.js` est le seul bootstrap production
- il lit `INVENTORY_BOOTSTRAP_ORGANIZATION_NAME`, `INVENTORY_BOOTSTRAP_ORGANIZATION_SLUG`, `INVENTORY_BOOTSTRAP_ADMIN_EMAIL`, `INVENTORY_BOOTSTRAP_ADMIN_PASSWORD`, `INVENTORY_BOOTSTRAP_ADMIN_NAME` et `INVENTORY_BOOTSTRAP_ADMIN_MUST_CHANGE_PASSWORD`
- il refuse `demo-org`, `admin@demo.local` et `ChangeMe123!`
- il n ecrase pas le mot de passe d un admin deja existant lors des redemarrages
- il ne cree aucune donnee stock, asset, spatial node, immobilisation ou campagne

## Worker IfcOpenShell

- le worker Python est appele par `apps/api` via un process local
- le chemin Python peut etre force par `IFC_GEOMETRY_PYTHON`
- en Docker, l image API utilise Debian slim et un venv Python dedie pour installer `ifcopenshell`
- si le worker echoue dans un flux IFC strict, l API retourne une erreur explicite et ne produit pas de placement approximatif
- le navigateur ne parse jamais le fichier IFC source

## Regles de mise a jour

- mettre a jour ce fichier quand l'architecture, les frontieres runtime, l'infrastructure, les integrations, ou les patterns transverses changent ;
- enregistrer les decisions importantes dans `docs/adr/` ;
- conserver l'historique detaille d'implementation dans `docs/steps/`.
