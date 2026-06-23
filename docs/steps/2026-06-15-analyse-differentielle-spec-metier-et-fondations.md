# Analyse differentielle spec metier et fondations

## Objectif

Comparer la specification metier source avec l implementation actuelle du repo, identifier les ecarts fonctionnels et structurels, faire remonter les questions ouvertes bloquantes, puis planifier les fondations a stabiliser avant d ouvrir les workflows de campagnes, anomalies, rapprochement et inventaire terrain complet.

## Perimetre

- dans le scope :
  - lecture de la specification source `c:\\Users\\sebas\\Downloads\\Inventaire - 1. Specification metier.docx.md`
  - audit du code actuel backend, frontend, schema Prisma et contrats partages
  - qualification des ecarts par domaine
  - formalisation des questions ouvertes
  - plan de fondations jusqu a stabilisation des referentiels equipements, localisations et integrations de base
- hors scope :
  - implementation de nouvelles fonctionnalites
  - arbitrage final des questions metier
  - detail de sprint par sprint

## Contexte initial

- demande :
  - analyser la spec fonctionnelle jointe
  - produire une analyse differentielle par rapport a l implementation actuelle
  - poser les questions ouvertes identifiees
  - planifier les fondations avant les workflows
- etat existant :
  - le repo est un monorepo `NestJS + Prisma + Next.js`
  - IAM et RBAC V1 sont en place
  - le domaine `assets` existe avec referentiels, CRUD, affectations et audit
  - les domaines `campaigns`, `anomalies`, `imports` et `audit` cote web sont encore des placeholders
  - `inventory`, `movements`, `locations` et `products` restent tres orientes stock et catalogue
- contraintes :
  - documentation en francais ASCII uniquement
  - multi-organisation hermetique
  - ne pas re-fusionner `products` et `assets`
  - stabiliser les fondations avant les workflows riches

## Plan

1. Comparer la spec source et l implementation reelle.
2. Qualifier les ecarts en `livre`, `partiel`, `absent`, ou `contre-sens de domaine`.
3. Enregistrer les questions ouvertes bloquantes.
4. Definir une sequence de fondations avec criteres de stabilisation.

## Questions ouvertes

- aucune question bloquante restante pour `F0-L01` et `F0-L02`
- aucune question bloquante restante pour `F1-L01`, `F1-L02` et `F1-L03` sur leur perimetre de fondation
- aucune question bloquante restante pour `F1-L03` cote UI imports web ; la vague cible `apps/web` uniquement avec mapping inline simple et domaine reellement executable `spatial-nodes`
- aucune question bloquante restante pour la V1 du module d aide contextuel imports ; la cible retenue est une modale texte + vignettes cliquables sans visite guidee pas a pas
- aucune question bloquante restante pour documenter la V2 du module d aide ; l implementation reste volontairement differee apres cadrage du moteur transverse de guide UI
- les sujets restants sont maintenant des ecarts d implementation `F2+` ou des bugs de stabilisation, plus des questions d architecture bloquantes

## Hypotheses

- la spec source decrit la cible produit, pas l etat courant du repo
- la separation `products` vs `assets` est maintenue
- le referentiel spatial doit devenir hierarchique et non rester un simple objet `Location`
- les workflows `campaigns`, `anomalies`, `reconciliation` ne doivent pas commencer tant que les referentiels et integrations de base ne sont pas stabilises
- l offline complet peut etre traite apres le noyau referentiel, mais avant les workflows terrain riches
- sauf decision contraire, les corrections ponctuelles restent possibles via UI admin, mais l alimentation primaire des referentiels passe par le moteur d import

## Zones impactees

- backend :
  - `apps/api/src/assets`
  - `apps/api/src/locations`
  - `apps/api/src/inventory`
  - futur domaine comptable et import
- frontend :
  - `apps/web` pour l inventaire terrain, les localisations, les mouvements et les imports
  - `apps/admin` pour les referentiels et l administration
- base de donnees :
  - `prisma/schema.prisma`
  - futures migrations sur localisations, immobilisations, equipements, imports et synchronisation
- infrastructure :
  - PWA offline, synchronisation differee, futurs batchs d integration
- documentation :
  - present fichier d etape
  - `OPEN_QUESTIONS.md`
  - `IMPLEMENTATION_BACKLOG.md`

## Tests prevus

- verification documentaire de coherence entre spec source, analyse et backlog
- lors des fondations :
  - migrations Prisma
  - tests unitaires backend sur invariants metier
  - tests d integration API
  - tests UI sur les referentiels stabilises
- executes pour `F1-L03` UI imports :
  - `npm run build --workspace web`
  - verification locale de la page `apps/web/app/imports`
- executes pour `F1-L01` :
  - `npm run db:generate`
  - `npm run build --workspace @inventory/shared`
  - `npm run test --workspace @inventory/shared`
  - `npm run build --workspace api`
  - `npm run test --workspace api`
  - `npx cross-env DATABASE_URL=postgresql://inventory:inventory@127.0.0.1:5560/inventory prisma migrate dev --name f1_l01_imports_foundation --schema prisma/schema.prisma`

## Criteres d'acceptation

- l analyse differentielle identifie clairement les domaines livres, partiels et absents
- les contre-sens de domaine sont explicites
- les questions ouvertes bloquantes sont capturees dans le repo
- le plan de fondations est sequentiel et arrete avant les workflows
- des criteres de stabilisation sont definis pour autoriser la suite

## Decisions prises

- prioriser la stabilisation des fondations referentielles avant les workflows de campagnes et anomalies
- conserver `inventory` et `stock-movements` pour la gestion future du domaine `products`
- separer explicitement cet inventaire de stock du futur inventaire `equipements` et des futurs mouvements `equipements`
- conserver `assets` comme noyau du patrimoine unitaire
- conserver `products` pour le stock, les accessoires et les fournitures
- faire de l import Excel/CSV avec mapping ETL visuel la source d alimentation V1 des referentiels spatiaux et equipements
- reserver l exploration IFC4 et le rendu graphique a une V2
- utiliser `internalCode` comme cle terrain unique a imprimer et scanner
- supprimer `barcode` et `qrCode` du schema cible
- traiter `serialNumber` comme numero constructeur eventuel, capture en texte et scan lors de la reception si present
- introduire une entite comptable distincte pour les immobilisations avec cardinalite `1 immobilisation -> n equipements` possible
- creer automatiquement une entree de journal de mouvement a chaque changement de localisation ou d affectation
- preparer les regles de campagnes futures avec :
  - un utilisateur actif dans une seule campagne a la fois
  - plusieurs utilisateurs possibles sur une meme campagne
  - conflit de scan sur la meme campagne => alerte bilaterale + anomalie
  - annulation possible de la saisie par l utilisateur
- figer `F1-L02` sur les arbitrages suivants :
  - une table unique `SpatialNode` avec champ `type` et relation `parentId`
  - unicite technique `organizationId + parentId + code`
  - `path` logique unique par organisation
  - lien ETL parent principal via `parentPath`, avec reconstruction possible via `path`
  - pas de versioning fort spatial V1 ; provenance d import + audit de changement uniquement
- fixer l orientation `F2` suivante :
  - garder `internalCode`
  - supprimer `barcode` et `qrCode` du modele metier cible
  - generer ensuite le rendu code barre ou QR a partir de `internalCode` au moment de l impression
  - refondre `Equipment` autour du referentiel `SpatialNode`
  - aligner l import `equipements` sur cette cible spatiale

## Notes d'implementation

- le plan initial a ete globalement respecte sur `F0` puis `F1`, avec trois derives utiles prises avant `F2` :
  - ajout d une purge metier V1 des creations issues des imports pour fiabiliser les campagnes de test
  - ajout d une politique IAM spatiale par organisation (`SCOPED` vs `ORGANIZATION_WIDE`)
  - ajout d un workspace web `imports` plus complet que le strict minimum initial, afin de rendre le pipeline ETL testable sans outil externe
- `F0-L01` et `F0-L02` ont ete formalises avant implementation
- `F1-L01` est maintenant implemente cote backend avec :
  - nouveaux contrats partages `packages/shared/src/imports.ts`
  - nouvelles permissions RBAC `imports.read`, `imports.manage`, `imports.execute`
  - nouvelles tables Prisma `ImportProfile` et `ImportJob`
  - migration `prisma/migrations/20260615131534_f1_l01_imports_foundation`
  - module Nest `apps/api/src/imports` avec profils, jobs, upload, preview, validation, rapport, annulation et catalogue des champs cibles
  - parsing `.csv` et `.xlsx` via `xlsx`
  - stockage des sources chargees et des lignes parsees sous `.runtime/imports/`
  - execution volontairement limitee a `EXECUTE_NOOP` tant que les branchements metier `spatial`, `equipments` et `immobilizations` ne sont pas livres
- correctif de packaging applique sur `packages/shared` :
  - sortie `dist/` emise en CommonJS
  - `package.json` aligne sur `dist/index.js` et `dist/index.d.ts`
  - suppression du blocage `api@dev` sur `Cannot find module ...\\packages\\shared\\dist\\iam`
- amelioration UX appliquee sur les clients `admin` et `web` :
  - traduction en francais des erreurs `class-validator`
  - rendu explicite des chemins de champs complexes comme `roleAssignments.0.roleId`
- correctif UI admin applique sur les referentiels assets :
  - le champ `Parent` du formulaire d edition affiche maintenant le libelle de la reference parente au lieu de son identifiant technique
  - les champs `Famille source` et `Famille cible` du formulaire de regles de rattachement affichent maintenant les libelles des familles au lieu de leurs identifiants techniques
- correctif IAM applique sur les DTO utilisateur :
  - abandon de `IsUUID()` pour les `roleId` et `scopeId` IAM
  - remplacement par un controle de format UUID permissif compatible avec les IDs seedes
  - creation utilisateur reverifiee avec succes via `POST /api/v1/iam/users`
- `F1-L02` est maintenant implemente cote schema, backend et verification admin avec :
  - nouvelle table Prisma `spatial_nodes`
  - enums `SpatialNodeType` et `SpatialSourceKind`
  - migration `prisma/migrations/20260616060157_f1_l02_spatial_foundation`
  - script de backfill `prisma/backfill-spatial.ts`
  - nouveau module API `apps/api/src/spatial`
  - branchement reel de `imports.execute` pour `spatial-nodes`
  - page admin `apps/admin/app/spatial/page.tsx`
  - compatibilite IFC4 reservee via `externalRef`, `sourceClass` et `sourceMetadata`
- `F1-L03` demarre sur les hypotheses d implementation suivantes :
  - nouveaux droits `spatial.read` et `spatial.manage`
  - CRUD spatial complet cote API admin
  - synchronisation `IamAccessScope <- SpatialNode` via une liaison explicite `spatialNodeId`
  - convergence de la page operateur `locations` vers le referentiel spatial et la selection de perimetre
- les tests partages et API sont passes apres correction des ponts de typage Prisma et des enums exposes par l API
- `F1-L03` est maintenant implemente cote schema, IAM et UI avec :
  - migration `prisma/migrations/20260616120000_f1_l03_spatial_crud_iam_sync`
  - nouveaux droits partages `spatial.read` et `spatial.manage`
  - ajout de `IamAccessScope.spatialNodeId` et synchronisation des scopes depuis `SpatialNode`
  - enrichissement des contrats IAM exposes par `auth/me` et `/iam/scopes` avec `scopePath` et `scopeSpatialNodeId`
  - page admin `apps/admin/app/spatial/page.tsx` en CRUD metier complet
  - page operateur `apps/web/app/locations/page.tsx` branchee sur le referentiel spatial et les scopes IAM
  - seed aligne sur un arbre spatial reel + scopes IAM relies
- tests executes pour `F1-L03` :
  - `npm run db:generate`
  - `npm run test --workspace api`
  - `npm run build --workspace @inventory/shared`
  - `npm run build --workspace api`
  - `npm run build --workspace admin`
  - `npm run build --workspace web`
  - `npx cross-env DATABASE_URL=postgresql://inventory:inventory@127.0.0.1:5560/inventory prisma migrate deploy --schema prisma/schema.prisma`
  - `npm run db:seed`
- correctif de stabilisation applique apres retour utilisateur :
  - la limite backend `pageSize <= 200` du spatial est maintenant factorisee dans `@inventory/shared`
  - les pages `apps/admin/app/spatial` et `apps/web/app/locations` n envoient plus `pageSize=500`
- correctif UI transversal applique apres retour utilisateur :
  - `packages/ui/src/components/data-grid.tsx` affiche maintenant les actions desktop en boutons inline par defaut, avec retour au menu `...` seulement si le consommateur le demande explicitement
  - `apps/admin/app/spatial/page.tsx` pilote une arborescence expandable/collapsible par clic sur la ligne, avec conservation des actions d edition
  - `apps/web/app/locations/page.tsx` reprend la meme logique de deploiement et repli de l arborescence
  - les types de noeuds spatiaux disposent maintenant d une apparence configurable par organisation : icone + couleur
  - un ecran d administration de ces styles est disponible dans `apps/admin/app/settings/page.tsx`
  - la configuration est persistee dans `Organization.settings` et exposee en lecture via `GET /api/v1/spatial/nodes/display-settings`
  - derive constatee :
    - la documentation cible demande maintenant de ne plus exposer le `path` dans les lignes d arborescence spatiale
    - le code affiche encore `label - path` dans certaines vues `admin/spatial` et `web/locations`
    - ce point doit etre traite comme un bug de stabilisation UI
- `F1-L02-S04` est maintenant referme qualitativement par des tests dedies et un durcissement de `executeImportReport` contre les ecritures hors invariants
- `F1-L02-S05` est maintenant referme avec :
  - orchestration unique `ImportsService.runJobMode -> SpatialService.buildImportReport/executeImportReport`
  - reconciliation `CREATE/UPDATE` par `path`
  - rejet en cascade des descendants quand un parent du fichier est rejete
  - tests d orchestration `preview`, `validate`, `execute`
- `F1-L03` cote UI imports demarre sur les hypotheses suivantes :
  - remplacement du placeholder `apps/web/app/imports/page.tsx`
  - page unique `apps/web` pour jobs, profils, upload, mapping, preview, validate, execute et report
  - helper client multipart dedie dans `apps/web/lib/api.ts`
  - domaines `equipments` et `immobilizations` visibles mais non executables tant que `F2` n est pas branche
- `F1-L03` cote UI imports est maintenant livre avec :
  - workspace web `apps/web/app/imports/page.tsx`
  - selection de domaine, creation et reprise de job
  - upload `.csv/.xlsx`
  - mapping inline simple avec sauvegarde et mise a jour de profils
  - preview, validate, execute et lecture du rapport
  - historique pagine minimal des jobs
  - helper multipart `apps/web/lib/api.ts`
  - aide contextuelle V1 dans le header avec bouton `?`, contenu detaille et vignettes SVG cliquables
  - correctif de stabilisation de la modale d aide :
    - hauteur fixe et zone centrale scrollable
    - bouton `Fermer` persistant en pied de modale
    - apercu image principal limite pour eviter les debordements d alignement
  - correctif complementaire de flottement :
    - ouverture pilotee explicitement
    - panneau flottant redimensionnable
    - scroll interne horizontal et vertical
    - bouton de redimensionnement en bas a droite
  - durcissement de la couche API web :
    - traduction des erreurs reseau en message explicite
    - remplacement de `Failed to fetch` par une erreur indiquant que l API locale est injoignable
  - correctif d etat UI imports :
    - une erreur reseau initiale ne reste plus affichee apres une action API reussie
    - le bouton `Rafraichir` met maintenant a jour proprement l etat d erreur de la page
    - clarification de diagnostic : `GET /api/v1/auth/login` renvoie normalement `404` car la route de connexion est un endpoint `POST`
- derive de gouvernance encore ouverte :
  - le endpoint backend `DELETE /api/v1/imports/jobs/:jobId` existe toujours
  - le bouton UI de suppression de job a ete retire
  - le garde metier interdisant la suppression d un job tant que ses creations n ont pas ete purgees n est pas encore applique
  - ce sujet reste ouvert dans `BUG_BACKLOG.md`
- evolution differee documentee :
  - V2 du module d aide avec sequence guidee pas a pas
  - surbrillance contextuelle des zones de page
  - navigation precedent / suivant / quitter
  - memorisation de progression par utilisateur et par page
- tests executes pour `F1-L03` UI imports :
  - `npm run build --workspace @inventory/shared`
  - `npm run build --workspace api`
  - `npm run build --workspace web`
  - `npm run build --workspace web` apres ajout de l aide contextuelle

### Analyse differentielle

| Domaine | Attendu par la spec source | Etat actuel du repo | Qualification |
|---|---|---|---|
| Multi-organisation et securite | authentification nominative, droits par role, securisation mobile | `Organization`, JWT, RBAC, permissions et scopes IAM presents | Livre en fondation |
| Referentiel equipements | objet `Bien` inventoriable, etiquetable, historise | domaine `assets` livre avec references, CRUD, archivage, audit, localisation courante sur `SpatialNode` et dates metier ; restent l immobilisation, le journal de mouvements et l import reel `equipments` | Partiel avance |
| Referentiel localisations | hierarchie site -> batiment -> etage -> zone -> piece | referentiel `SpatialNode` livre avec hierarchy, CRUD admin, consultation web, import ETL et synchronisation IAM | Livre en fondation |
| Immobilisations comptables | objet distinct venant de SINERGI, relation possible `1 -> n` | aucune entite metier comptable dediee dans le schema courant | Absent |
| Inventaire physique terrain | scan zone, scan bien, validation presence, creation terrain, photo, sync | le futur inventaire terrain `equipements` n existe pas encore ; le module `inventory` actuel reste reserve au futur domaine stock `products` | Absent sur le domaine equipements |
| Campagnes | creation, affectation, suivi, cloture | page web placeholder, pas de backend dedie | Absent |
| Anomalies | qualification, correction, cloture | page web placeholder, pas de backend dedie | Absent |
| Mouvements | deplacements d equipements entre localisations | `stock-movements` reste pertinent pour `products`, mais aucun journal de mouvements `equipements` n existe encore | Partiel par separation de domaine non realisee |
| Rapprochement comptable | import SINERGI, calcul ecarts, validation | permissions de lecture preparees, aucune logique metier | Absent |
| Import Archicad / SAP | imports batch, spatial et comptable | moteur ETL V1 livre, import spatial `.csv/.xlsx` reel livre, mais aucun adapter Archicad IFC4 ni SAP metier | Partiel |
| Photos | photo possible sur creation et inventaire | aucune gestion photo sur `assets` | Absent |
| Etiquetage | identifiant visible et imprimable | `internalCode` est maintenant la seule cle terrain du domaine `assets` ; `barcode` et `qrCode` sont retires du modele metier, mais le workflow d impression reste a livrer | Partiel stable |
| Offline et synchronisation | reprise apres coupure reseau, sync differee | base PWA responsive, pas de service worker ni moteur de sync | Partiel faible |
| Controle concurrence zone | verrou ou alerte | aucune logique de verrouillage de perimetre | Absent |

### Fondations deja exploitables

- IAM et RBAC tenant-aware
- domaine `assets` pour le patrimoine unitaire
- referentiels `assets` administres dans `apps/admin`
- audit des actions sensibles
- structure web/admin partagee et base PWA responsive
- moteur ETL transverse `.csv/.xlsx` avec profils, jobs, preview, validate, execute et rapports
- referentiel spatial `SpatialNode` avec CRUD, import reel, synchronisation IAM et consultation operateur
- noyau `Equipment` aligne sur `SpatialNode` pour la localisation courante et les dates metier
- purge metier V1 des creations issues d imports `spatial-nodes`
- politique IAM spatiale par organisation pour basculer entre perimetres scopes et acces tenant-wide

### Fondations manquantes ou instables

- modele comptable distinct pour les immobilisations et leur lien vers les equipements
- separation explicite entre :
  - inventaire / mouvements de stock pour `products`
  - inventaire / mouvements patrimoniaux pour `equipements`
- journal des mouvements unitaires lie aux equipements et non au stock
- branchement ETL metier pour `equipments` et `immobilizations`
- politique offline et synchronisation
- support media et etiquetage terrain
- moteur transverse d aide guidee avec overlays et surbrillance contextuelle des ecrans
- nettoyage UI restant pour ne plus afficher le `path` dans les lignes d arborescence spatiale

### Aide contextuelle V2 differee

- cible fonctionnelle :
  - completer l aide V1 statique par un accompagnement operatoire directement dans la page
- capacites attendues :
  - sequence de pas ordonnes
  - focalisation visuelle sur la zone concernee
  - voile partiel du reste de l interface
  - panneaux d explication ancres a la zone cible
  - memorisation de progression par utilisateur
  - relecture volontaire de sequences ciblees
- premier perimetre vise :
  - `imports` dans `apps/web`
  - extension ensuite a `locations`, `spatial`, `assets`, puis aux workflows `campaigns` et `anomalies`
- implications techniques deja identifiees :
  - registre partage des zones cibles par page
  - composant transverse de type tour guide dans `packages/ui`
  - contrat de persistence de progression par utilisateur
  - verification responsive desktop et mobile

### Reponses utilisateur enregistrees

- referentiels spatial et equipements :
  - alimentation V1 par import Excel/CSV
  - mapping ETL graphique entre colonnes source et champs cibles
  - V2 dediee a IFC4 avec exploration par arborescence et rendu graphique
- identite terrain :
  - `internalCode` devient la cle terrain a encoder et scanner
  - `serialNumber` reste le numero constructeur quand il existe
  - `barcode` et `qrCode` doivent disparaitre du modele metier cible
  - le rendu code barre ou QR sera genere a partir de `internalCode` lors de l impression
- comptabilite :
  - une immobilisation distincte peut porter plusieurs equipements physiques
  - la recherche par code immobilisation doit etre possible
  - la cible de long terme reste `1 equipement = 1 code immobilisation`
- mouvement et historique :
  - tout changement d affectation ou de localisation cree une entree de mouvement
- refonte `Equipment` :
  - la localisation courante d un equipement doit pointer sur `SpatialNode`
  - les deplacements entre noeuds spatiaux doivent devenir une logique metier explicite
  - l historique doit etre derive automatiquement de ces changements
  - l import `equipements` doit etre coherent avec cette cible spatiale
- concurrence de campagne :
  - un utilisateur ne participe qu a une campagne active a la fois
  - plusieurs utilisateurs peuvent participer a une meme campagne
  - un conflit de scan dans une meme campagne cree une alerte et une anomalie
  - l utilisateur peut annuler sa saisie

### Plan de fondations concret par lot

#### F0 - cadrage et contrats cibles

##### Lot F0-L01 - ADR, modele cible et trajectoire de migration

- objectif :
  - figer les decisions de fondation sur import, spatial, equipements, immobilisations et mouvements
- livrables :
  - ADR de fondation
  - schema cible de haut niveau
  - plan de migration `Location -> hierarchie spatiale`
  - plan de coexistence `products` vs `assets`
- dependances :
  - aucune
- sortie attendue :
  - toutes les decisions structurantes sont documentees et relues
- statut :
  - complete

##### Lot F0-L02 - contrats d import et conventions metier

- objectif :
  - definir les contrats techniques du moteur ETL avant tout dev de schema
- livrables :
  - format de job d import
  - format de mapping source -> cible
  - regles de validation, preview, rejet, correction et rejouabilite
  - conventions sur `internalCode`, `serialNumber`, code immobilisation et references spatiales
- dependances :
  - F0-L01
- sortie attendue :
  - les imports Excel/CSV peuvent etre implementes sans reinterpretation fonctionnelle
- statut :
  - complete

#### F1 - socle import et referentiel spatial

##### Lot F1-L01 - moteur ETL Excel/CSV transverse

- objectif :
  - livrer le noyau reutilisable d import avant tout import metier
- livrables :
  - upload de fichiers `.xlsx` et `.csv`
  - parsing, preview, normalisation de types
  - mapping visuel colonne source -> champ cible
  - sauvegarde de profils d import par organisation
  - journal des executions, erreurs et rejets
- dependances :
  - F0-L02
- sortie attendue :
  - un meme moteur peut alimenter spatial, equipements et immobilisations
- statut :
  - complete

##### Lot F1-L02 - nouveau modele spatial et ingestion

- objectif :
  - remplacer le `Location` plat par une hierarchie spatiale metier
- livrables :
  - nouvelles entites spatiales `site`, `building`, `floor`, `zone`, `room`, `location` ou equivalent normalise
  - migration Prisma et seed de base
  - import spatial via le moteur ETL
  - regles de coherence parent/enfant et unicites par organisation
- dependances :
  - F1-L01
- sortie attendue :
  - le referentiel spatial est importable, versionne et exploitable par l API
- statut :
  - complete sur le perimetre V1 retenu
  - derive assumee : pas de versioning fort, seulement provenance d import et audit

##### Lot F1-L03 - API, IAM et UI du spatial

- objectif :
  - exposer le spatial stabilise aux utilisateurs et aux regles de perimetre
- livrables :
  - API CRUD/consultation/import des noeuds spatiaux
  - alignement entre hierarchie spatiale et scopes IAM
  - UI admin de navigation et correction du referentiel spatial
  - UI web de consultation et selection de perimetre
- dependances :
  - F1-L02
- sortie attendue :
  - les localisations ne sont plus un simple catalogue plat et peuvent servir de base aux campagnes futures
- statut :
  - complete sur le perimetre spatial cible
  - etendue utile hors plan initial :
    - workspace web `imports` V1 reel
    - aide contextuelle V1 sur `imports`
    - politique IAM spatiale par organisation
    - purge metier V1 des creations issues d imports spatiaux

#### F2 - noyau equipements, immobilisations et mouvements unitaires

##### Lot F2-L01 - stabilisation schema equipements

- objectif :
  - faire d `Equipment` le vrai noyau terrain et referentiel
- livrables :
  - localisation courante normalisee sur le nouveau spatial
  - dates de creation, dernier inventaire et provenance d initialisation
  - support de l identite terrain par `internalCode`
  - retrait cible de `barcode` et `qrCode` du modele metier
  - capacite future de generer un code barre ou un QR a partir de `internalCode` pour l impression
  - placeholders de media si la photo n est pas encore branchee completement
- dependances :
  - F1-L03
- sortie attendue :
  - chaque equipement est localisable, identifiable et pret pour l import initial
- statut :
  - livre

##### Lot F2-L02 - entite immobilisation et recherche comptable

- objectif :
  - introduire le noyau comptable necessaire avant le rapprochement
- livrables :
  - entite `Immobilization` ou nom equivalent
  - relation `1 immobilisation -> n equipements`
  - recherche equipement par code immobilisation
  - etat de purge/metrique de convergence vers `1 -> 1`
- dependances :
  - F2-L01
- sortie attendue :
  - le referentiel peut etre initialise depuis des codes immobilisation non encore purges
- statut :
  - non demarre

##### Lot F2-L03 - journal des mouvements et historique derive

- objectif :
  - separer clairement les mouvements `equipements` des mouvements de stock `products`
- livrables :
  - entite de mouvement unitaire d equipement
  - emission automatique a chaque changement de localisation ou d affectation
  - timeline exploitable par fiche equipement et audit
  - maintien de `stock-movements` pour `products`
  - absence d ambiguite entre flux de stock et flux patrimoniaux
- dependances :
  - F2-L01
- sortie attendue :
  - le suivi des deplacements est coherent avec l historique reel des equipements
- statut :
  - non demarre

##### Lot F2-L04 - imports equipements et immobilisations

- objectif :
  - brancher les objets metier cibles sur le moteur ETL
- livrables :
  - import des equipements
  - import des immobilisations
  - gestion des liens entre equipements et immobilisations
  - controles d unicite, rejet, mise a jour et rapport de chargement
- dependances :
  - F2-L02
  - F2-L03
- sortie attendue :
  - le referentiel equipements/localisations/immobilisations est initialisable et rejouable par import
- statut :
  - non demarre

### Criteres de passage F2 -> workflows

- le moteur ETL fonctionne sur spatial, equipements et immobilisations
- la hierarchie spatiale est stable, exploitable et alignee avec IAM
- `Equipment` porte bien l identite terrain `internalCode`
- la recherche par code immobilisation est disponible
- tout changement de localisation ou d affectation alimente un journal de mouvement unitaire
- les imports initiaux peuvent etre refaits sans corruption des donnees

## Suivi

- questions ouvertes resolues ou mises a jour dans `OPEN_QUESTIONS.md`
- plan de fondations raffine en lots concrets
- `F0-L01` formalise dans :
  - `docs/adr/0005-fondations-import-spatial-equipements-et-mouvements-unitaires.md`
  - `docs/database/f0-l01-modele-cible-spatial-equipements-immobilisations.md`
- `F0-L02` formalise dans :
  - `docs/features/f0-l02-import-referentiels-excel-csv-v1.md`
  - `docs/api/f0-l02-contrat-import-etl-excel-csv-v1.md`
- `F1-L01` implemente dans :
  - `packages/shared/src/imports.ts`
  - `apps/api/src/imports/`
  - `prisma/migrations/20260615131534_f1_l01_imports_foundation/`
- schema cible et regles ETL `F1-L02` formalises dans :
  - `docs/database/f0-l01-modele-cible-spatial-equipements-immobilisations.md`
  - `docs/api/f0-l02-contrat-import-etl-excel-csv-v1.md`
  - `docs/features/f0-l02-import-referentiels-excel-csv-v1.md`
- `F1-L02` implemente dans :
  - `prisma/schema.prisma`
  - `prisma/migrations/20260616060157_f1_l02_spatial_foundation/`
  - `prisma/backfill-spatial.ts`
  - `packages/shared/src/spatial.ts`
  - `apps/api/src/spatial/`
  - `apps/admin/app/spatial/page.tsx`
- `F1-L03` formalise par l ADR :
  - `docs/adr/0007-alignement-iam-scopes-sur-spatial-node.md`
- precision metier complementaire :
  - un equipement peut etre importe d abord sous un noeud `ZONE`, puis etre deplace ulterieurement vers un noeud `ROOM`
  - `ROOM` est autorise directement sous `BUILDING`, `FLOOR` ou `ZONE`
- prochain lot executable :
  - `F2-L01 - stabilisation schema equipements`
- diagnostic de priorisation mis a jour :
  - avant ou en parallele de `F2-L01`, il reste deux sujets de stabilisation a faible cout mais fort impact de coherence :
    - `BUG-003` sur la suppression de job d import sans purge metier prealable
    - `BUG-004` sur l affichage residuel du `path` dans les listes d arborescence spatiale

### Decoupage executable propose pour F1-L02

#### F1-L02-S01 - schema Prisma et migration de base

- modifier `prisma/schema.prisma`
- ajouter `SpatialNodeType`
- ajouter `SpatialNode`
- ajouter les relations `Organization -> SpatialNode`
- ajouter les relations optionnelles `ImportProfile -> SpatialNode[]` et `ImportJob -> SpatialNode[]`
- generer la migration Prisma
- verifier les contraintes :
  - `organizationId + parentId + code`
  - `organizationId + path`
  - `legacyLocationId` unique si renseigne
- sortie :
  - schema compilable
  - migration SQL generee

#### F1-L02-S02 - script de backfill `Location -> SpatialNode`

- creer un script applicatif ou seed technique de migration
- convertir les `Location` existantes en `SpatialNode(type=LOCATION)`
- journaliser les conflits
- produire un resume de migration
- sortie :
  - toutes les `Location` legacy ont un `SpatialNode` associe

#### F1-L02-S03 - contrats partages et catalogue import `spatial-nodes`

- completer `packages/shared`
- exposer le type `SpatialNodeType`
- exposer le contrat de ligne preview/import pour `spatial-nodes`
- aligner le catalogue des champs cibles avec :
  - `type`
  - `code`
  - `label`
  - `description`
  - `path`
  - `parentPath`
  - `externalRef`
  - `isActive`
- sortie :
  - backend et UI consomment le meme contrat

#### F1-L02-S04 - service backend `spatial`

- creer `apps/api/src/spatial`
- ajouter service de resolution :
  - normalisation de `path`
  - calcul de `depth`
  - resolution `parentPath`
  - validation parent/enfant
- ajouter repository Prisma ou logique service equivalente
- sortie :
  - coeur metier spatial testable hors HTTP

#### F1-L02-S05 - branchement ETL backend `spatial-nodes`

- brancher `ImportTargetDomain.SPATIAL_NODES` sur le moteur `imports`
- implementer :
  - preview
  - validate
  - execute
- ajouter la logique :
  - tri par profondeur
  - create/update par `path`
  - rejet en cascade si parent invalide
- sortie :
  - import spatial executable en vrai, sans `noop`

#### F1-L02-S06 - tests backend et migration

- tests unitaires sur :
  - normalisation `path`
  - resolution parent
  - regles de type
- tests integration sur :
  - import complet arbre simple
  - import avec parent deja en base
  - conflit de doublon
  - backfill legacy
- sortie :
  - securisation du lot avant exposition UI

#### F1-L02-S07 - endpoints API minimaux de consultation technique

- ajouter endpoints backend minimaux :
  - lecture liste
  - lecture arbre
  - recherche par `path`, `code`, `label`
- garder le CRUD complet pour `F1-L03`
- sortie :
  - l import et les verifications peuvent etre pilotes par API

#### F1-L02-S08 - outillage admin minimal de verification

- ajouter une vue temporaire ou une page simple de verification admin
- afficher :
  - nombre de noeuds
  - racines
  - erreurs import recentes
  - resultat du backfill
- sortie :
  - verification fonctionnelle possible avant la vraie UI `F1-L03`
