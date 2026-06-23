# Etape 2 referentiel des objets metier corrigee

## Objectif

Produire une version corrigee et directement exploitable de l etape 2 pour le repo actuel, en alignant le besoin metier de referentiel patrimonial unitaire avec la stack reelle `NestJS + Prisma + Next.js`.

## Perimetre

- dans le scope :
  - diagnostic du prompt initial de l etape 2
  - reformulation complete du prompt au format du repo actuel
  - clarification des ecarts entre `products` existant et futur domaine `assets`
  - cadrage backend, base, API, frontend, RBAC, audit et tests
- hors scope :
  - implementation technique de l etape 2
  - migration de stack vers FastAPI
  - suppression ou refonte immediate du domaine `products`

## Contexte initial

- demande :
  - rediger une version corrigee et prete a implementer de l etape 2 "referentiel des objets metier"
- etat existant :
  - le repo porte deja un domaine `products`, `locations`, `suppliers`, `stock-movements`
  - ce domaine est oriente catalogue plus stock plus quantites, pas inventaire patrimonial unitaire
  - l IAM V1 est en place avec JWT, RBAC, `/api/v1` et `AuditLog`
  - le frontend `apps/web` et `apps/admin` partage des primitives via `packages/ui`
- contraintes :
  - rester coherent avec `NestJS + Prisma + TypeScript`
  - ne pas casser les modules existants
  - ne pas requalifier `Product` en actif patrimonial unitaire
  - conserver le workflow documentaire du repo

## Plan

1. Identifier les incoherences du prompt initial par rapport au code courant.
2. Geler les decisions de cadrage pour l etape 2.
3. Produire un prompt corrige et implementable dans ce repo.

## Questions ouvertes

- aucune question ouverte bloquante a ce stade

## Hypotheses

- le besoin metier cible est bien un referentiel d equipements physiques unitaires
- chaque equipement physique doit etre une ligne distincte et non une quantite agregee
- l historique V1 peut s appuyer sur `AuditLog`
- les documents lies restent hors scope de stockage pour cette etape
- la localisation V1 peut s appuyer sur `Location` existant avant enrichissement hierarchique futur

## Zones impactees

- backend :
  - nouveau domaine `assets` ou `equipment-assets` dans `apps/api`
- frontend :
  - nouveaux ecrans dans `apps/web`
  - ecrans de referentiels admin si retenus dans `apps/admin`
- base de donnees :
  - nouvelles tables Prisma pour les referentiels et les actifs unitaires
- infrastructure :
  - aucune evolution specifique attendue pour cette etape
- documentation :
  - present fichier d etape
  - eventuelle mise a jour de `FUNCTIONAL_SPEC.md`, `TECHNICAL_ARCHITECTURE.md`, `DATA_MODEL.md` au moment de l implementation

## Tests prevus

- tests backend d unicite sur code interne, numero de serie, barcode et qr code
- tests backend de soft delete et de consultation archivee
- tests backend RBAC et audit
- tests frontend des listes, fiches, formulaires et filtres

## Criteres d'acceptation

- le prompt corrige est exploitable sans reinterpretation de stack
- il n ecrase pas le domaine `products` existant
- il introduit un nouveau domaine patrimonial unitaire coherent avec le besoin
- il est compatible avec `/api/v1`, RBAC, audit et conventions du repo

## Decisions prises

- ne pas convertir `Product` en `Equipment`
- creer un nouveau domaine `assets`
- remplacer dans le prompt toute reference a `SQLAlchemy`, `Pydantic` et schemas Postgres `ref.*` / `asset.*`
- rester sur Prisma, DTO NestJS, types `@inventory/shared`, et tables du schema `public`
- conserver `products` comme domaine distinct, a reutiliser plus tard pour la gestion des accessoires et fournitures
- prevoir des la V1 une structure d affectation capable de rattacher un equipement :
  - a une personne
  - a une localisation
  - a un autre asset
- preparer la localisation cible pour des niveaux de type batiment, etage, zone et bureau
- prevoir des regles metier permettant d autoriser un rattachement entre assets selon des familles predefinies

## Notes d'implementation

- implementation realisee sur le repo actuel `NestJS + Prisma + Next.js`
- migration Prisma ajoutee pour le domaine `assets` et ses referentiels
- seed complete avec permissions IAM assets, donnees de demo et regles de rattachement
- nouveau module API `assets` avec controllers, services, repositories, DTO et audit
- nouvelles routes `apps/web` :
  - `/assets`
  - `/assets/new`
  - `/assets/[id]`
- nouvelle route `apps/admin` :
  - `/assets-references`
- navigation `apps/web` et `apps/admin` mise a jour pour exposer le domaine
- ADR cree : `0003-coexistence-products-vs-assets-et-affectation-generique`
- correctif admin ajoute pour normaliser les erreurs reseau `Failed to fetch` en message metier lisible
- ajustement UI des cartes et badges pour mieux aligner les titres, compteurs et bulles
- espacement augmente entre bordure de groupe, libelles et champs sur les formulaires partages et les formulaires assets/admin encore ecrits a la main
- creation d une primitive partagee `Field` et d une `Textarea` commune dans `@inventory/ui` pour supprimer les wrappers de champ divergents page par page
- correction du controller `asset-references` pour supprimer les routes regex incompatibles avec Swagger et `path-to-regexp` en Nest 11
- augmentation du padding standard des cartes partagees et branchement de la carte de connexion sur `Field` pour eliminer les zones encore trop proches des bordures
- suppression du clipping `overflow-hidden` sur les cartes partagees et de la grille desktop pour eviter que les titres ou labels passent sous la bordure arrondie
- refonte du shell partage `web` et `admin` : suppression du bloc marque dans le header, navigation deplacee dans un menu hover desktop / sheet mobile, recherche dans le header, theme et deconnexion alignes en haut a droite
- correction du menu header `web` et `admin` pour le laisser ouvert pendant le passage de la souris du bouton vers le panneau, avec suppression de l effet de bordure active sur `Tableau de bord`
- personnalisation du menu `workspace` : nouveau titre `INVENTAIRE / Physique & rapprochement comptable`, ordre et icones de navigation ajustes, suppression des entrees `Biens` et `Fournisseurs`

## Endpoints implementes

- `GET /api/v1/assets`
- `POST /api/v1/assets`
- `GET /api/v1/assets/:assetId`
- `PATCH /api/v1/assets/:assetId`
- `POST /api/v1/assets/:assetId/archive`
- `GET /api/v1/assets/:assetId/history`
- `GET /api/v1/assets/export`
- `GET /api/v1/assets/assignment-users`
- `GET /api/v1/assets/references/{resource}`
- `POST /api/v1/assets/references/{resource}`
- `PATCH /api/v1/assets/references/{resource}/:id`
- `POST /api/v1/assets/references/{resource}/:id/archive`
- `POST /api/v1/assets/references/attachment-rules`
- `PATCH /api/v1/assets/references/attachment-rules/:id`
- `POST /api/v1/assets/references/attachment-rules/:id/archive`

## Tests executes

- `npm run build`
- `npm run test`

## Plan de recette manuelle

### Preconditions

- lancer `npm run db:migrate`
- lancer `npm run db:seed`
- lancer `npm run dev`
- verifier que les trois apps repondent :
  - API sur `http://localhost:3011/api/v1`
  - web sur `http://localhost:3010`
  - admin sur `http://localhost:3014`

### Jeux de donnees utiles

- utiliser le compte admin seed
- verifier la presence des references seed :
  - categorie `Informatique`
  - familles `Bureaux` et `Informatique nomade`
  - types de demo
  - statuts et proprietaires
- verifier la presence des assets de demo :
  - un bureau
  - un portable

### Recette 1 - Authentification et RBAC

- se connecter sur `apps/web`
- se connecter sur `apps/admin`
- verifier que `GET /api/v1/auth/me` remonte les permissions assets pour un admin
- verifier qu un utilisateur sans `assets.read` ou `asset-references.read` recoit un `403`
- verifier qu un token invalide renvoie a l ecran de connexion

### Recette 2 - Liste des equipements

- ouvrir `/assets`
- verifier le chargement de la liste
- verifier la recherche par code interne
- verifier la recherche par numero de serie
- verifier les filtres famille, statut et archive
- verifier la pagination
- verifier le tri visuel
- verifier le bouton `Exporter ODS`

### Recette 3 - Creation d un equipement

- ouvrir `/assets/new`
- creer un equipement avec :
  - code interne unique
  - numero de serie unique
  - type valide
  - statut valide
  - proprietaire valide
- verifier la redirection vers la fiche detail
- verifier la presence de l equipement dans la liste
- verifier l entree d audit de creation dans l historique

### Recette 4 - Controles d unicite

- tenter de creer un equipement avec un `internalCode` deja utilise
- tenter de creer un equipement avec un `serialNumber` deja utilise
- si renseigne, tenter de dupliquer `barcode`
- si renseigne, tenter de dupliquer `qrCode`
- verifier un refus metier ou technique de type conflit

### Recette 5 - Edition d un equipement

- ouvrir un equipement existant
- modifier notes, caracteristiques, statut ou proprietaire
- enregistrer
- verifier la mise a jour en detail
- verifier l entree d audit `assets.updated`

### Recette 6 - Affectation PERSON

- ajouter une affectation `PERSON`
- tester un utilisateur interne
- tester un nom libre
- verifier l affichage de l affectation active
- verifier qu une seconde affectation active `PERSON` dans la meme sauvegarde est refusee

### Recette 7 - Affectation LOCATION

- ajouter une affectation `LOCATION`
- choisir une localisation existante
- verifier l affichage de la localisation sur la fiche et dans la liste si filtre utilise
- verifier qu une seconde affectation active `LOCATION` dans la meme sauvegarde est refusee

### Recette 8 - Affectation ASSET

- partir d un asset de famille source compatible
- rattacher cet asset a un asset cible autorise par la regle de famille
- verifier que l affectation est acceptee
- tenter un rattachement vers un asset incompatible
- verifier le refus metier
- verifier qu un asset ne peut pas etre rattache a lui-meme

### Recette 9 - Archivage d un equipement

- archiver un equipement depuis sa fiche
- verifier qu il disparait de la vue active
- verifier qu il reapparait avec le filtre `Archives`
- verifier que les affectations actives sont cloturees
- verifier les entrees d audit `assets.archived` et `assets.assignments.closed`

### Recette 10 - Historique

- ouvrir `GET /api/v1/assets/:id/history` ou la section historique de la fiche
- verifier la presence des evenements :
  - creation
  - modification
  - remplacement des affectations
  - archivage

### Recette 11 - Administration des references assets

- ouvrir `apps/admin` puis `/assets-references`
- tester chaque sous-vue :
  - categories
  - familles
  - sous-familles
  - types
  - marques
  - modeles
  - statuts
  - proprietaires
  - regles de rattachement
- verifier creation
- verifier modification
- verifier archivage logique
- verifier coherence des parents :
  - famille -> categorie
  - sous-famille -> famille
  - type -> sous-famille
  - modele -> marque

### Recette 12 - Regles de rattachement

- creer une regle source -> cible
- modifier une regle existante
- archiver une regle
- verifier l impact sur les choix possibles en affectation `ASSET`

### Recette 13 - Swagger et contrats API

- ouvrir Swagger sur l API
- verifier la presence des routes :
  - `/api/v1/assets`
  - `/api/v1/assets/references/*`
- verifier les payloads attendus
- verifier les codes de retour principaux

### Resultats attendus

- `products` reste intact et distinct
- les equipements unitaires vivent dans `assets`
- les controles RBAC protegent les routes sensibles
- l audit couvre creation, update, affectations, archivage et references
- l administration des references permet de preparer les futures etapes metier

## Resultat de l implementation

- `products` n a pas ete ecrase et reste disponible
- le nouveau domaine `assets` couvre les equipements unitaires, les referentiels et les regles de rattachement
- les permissions RBAC et l audit sont branches sur les nouvelles routes sensibles
- le front web livre la liste, la creation, l edition, l archivage et l historique des equipements
- le front admin livre la gestion centralisee des references assets

## Prompt corrige pret a implementer

### ETAPE 2 - Referentiel des objets metier

Ta mission est de produire le plan d implementation puis les briques du referentiel des objets metier patrimoniaux.

### Objectif fonctionnel

Implementer le socle de gestion des equipements physiques inventoriables, en modelant des actifs unitaires et non un simple catalogue de produits plus stock.

Le domaine `products` existant ne doit pas etre ecrase dans cette etape. L implementation doit creer un nouveau domaine `assets` coherent avec le besoin patrimonial.

### Objets metier a couvrir

- categorie equipement
- famille equipement
- sous-famille equipement
- type equipement
- marque
- modele
- statut equipement
- proprietaire
- equipement physique
- affectation facultative
- documents lies si un module document existe deja ; sinon preparer uniquement l interface metier sans implementer le stockage complet

### Modele cible attendu dans ce repo

Creer de nouvelles entites Prisma dans le schema `public`, avec un nommage explicite compatible avec le monolithe existant :

- `EquipmentCategory`
- `EquipmentFamily`
- `EquipmentSubfamily`
- `EquipmentType`
- `EquipmentBrand`
- `EquipmentModel`
- `EquipmentStatus`
- `OwnerEntity`
- `Equipment`
- `EquipmentAssignment`

Le nommage SQL physique peut suivre une convention `snake_case` de type :

- `equipment_categories`
- `equipment_families`
- `equipment_subfamilies`
- `equipment_types`
- `equipment_brands`
- `equipment_models`
- `equipment_statuses`
- `owner_entities`
- `equipment_assets`
- `equipment_assignments`

### Contraintes metier

- un equipement doit avoir un `internalCode` unique par organisation
- un equipement doit avoir un `serialNumber` obligatoire et unique par organisation en V1
- `barcode` et `qrCode` sont facultatifs mais uniques s ils sont renseignes
- un equipement doit avoir un statut valide
- un equipement doit avoir un proprietaire
- la suppression physique est interdite : utiliser `isDeleted`
- conserver `deletedAt` pour tracer l archivage
- le modele generique doit etre possible quand le modele exact est inconnu
- les caracteristiques techniques peuvent rester en texte libre en V1
- un equipement peut etre rattache a une localisation existante via `locationId`
- une affectation est facultative
- la structure d affectation V1 doit deja permettre :
  - un rattachement a une personne
  - un rattachement a une localisation
  - un rattachement a un autre asset
- le rattachement a un autre asset doit etre controle par des regles de compatibilite de famille definies par le metier

### Contraintes techniques du repo

- backend en `NestJS`
- acces donnees via `Prisma`
- DTO via classes NestJS dans `apps/api`
- types partages frontend/backend dans `packages/shared`
- API versionnee sous `/api/v1`
- JWT plus RBAC obligatoire sur les endpoints sensibles
- audit des actions sensibles via `AuditLog`
- ne pas casser `products`, `locations`, `suppliers` et `inventory`

### A produire dans le plan

1. Analyse des modeles existants dans `prisma/schema.prisma` et des modules API/front deja en place.
2. Proposition de coexistence entre le domaine existant `products` et le nouveau domaine `assets`.
3. Plan de migration Prisma.
4. Definition des nouvelles entites Prisma et de leurs relations.
5. Definition des DTO API NestJS.
6. Definition des types partages `@inventory/shared`.
7. Services metier :
   - creation equipement
   - modification equipement
   - consultation detail
   - recherche filtree
   - archivage logique
   - restauration seulement si retenue explicitement
8. Repository pattern ou couche d acces explicite cote backend, coherente avec l architecture actuelle.
9. API REST :
   - `GET /api/v1/assets`
   - `POST /api/v1/assets`
   - `GET /api/v1/assets/:assetId`
   - `PATCH /api/v1/assets/:assetId`
   - `POST /api/v1/assets/:assetId/archive`
   - `GET /api/v1/assets/:assetId/history`
10. Referentiels REST a exposer au minimum :
   - `GET /api/v1/assets/references/categories`
   - `GET /api/v1/assets/references/families`
   - `GET /api/v1/assets/references/subfamilies`
   - `GET /api/v1/assets/references/types`
   - `GET /api/v1/assets/references/brands`
   - `GET /api/v1/assets/references/models`
   - `GET /api/v1/assets/references/statuses`
   - `GET /api/v1/assets/references/owners`
11. Frontend `apps/web` :
   - liste des equipements
   - fiche equipement
   - formulaire creation plus modification
   - filtres par famille, statut, localisation, code interne, numero de serie
12. Frontend `apps/admin` si retenu dans le repo pour cette etape :
   - administration des referentiels categories, types, statuts, marques, modeles, proprietaires
13. Audit minimal :
   - creation d equipement
   - modification d equipement
   - archivage
14. Tests :
   - unicite code interne
   - unicite numero de serie
   - unicite barcode et qr code si renseignes
   - soft delete
   - modification statut
   - acces RBAC
   - audit d archivage et de modification

### Permissions RBAC a prevoir

Ajouter des permissions explicites, au minimum :

- `assets.read`
- `assets.create`
- `assets.update`
- `assets.archive`
- `assets.history.read`
- `asset-references.read`
- `asset-references.manage`

Le role `ASSET_MANAGER` doit pouvoir creer, modifier, consulter et archiver un equipement.

### Resultat attendu cote donnees

`Equipment` doit porter au minimum :

- `id`
- `organizationId`
- `internalCode`
- `serialNumber`
- `barcode`
- `qrCode`
- `equipmentTypeId`
- `equipmentModelId`
- `equipmentStatusId`
- `ownerEntityId`
- `locationId`
- `technicalCharacteristics`
- `notes`
- `isDeleted`
- `deletedAt`
- `createdAt`
- `updatedAt`

`EquipmentAssignment` doit rester simple en V1, par exemple :

- `id`
- `equipmentId`
- `assignmentType`
- `personName`
- `locationId`
- `parentEquipmentId`
- `startsAt`
- `endsAt`
- `notes`

Si l implementation reste maitrisee, preferer des maintenant une affectation generique compatible avec :

- `PERSON`
- `LOCATION`
- `ASSET`

### Historique

L endpoint `GET /api/v1/assets/:assetId/history` peut s appuyer en V1 sur `AuditLog`, sans creer un sous-systeme d historique specifique si ce n est pas necessaire.

### Frontend et navigation

- `apps/web` doit exposer un vrai module "Equipements" distinct de `Products`
- la navigation ne doit pas renommer `Products` en `Assets` tant que la migration fonctionnelle complete n est pas decidee
- `Products` reste un domaine utile a moyen terme pour les accessoires et fournitures

### Criteres d acceptation

- un gestionnaire patrimoine peut creer un equipement
- le systeme empeche les doublons critiques
- un equipement archive reste consultable via filtre
- les referentiels sont administrables
- les endpoints sont documentes OpenAPI
- l implementation ne casse pas les routes existantes `products`, `locations`, `suppliers`, `inventory`
- le domaine `assets` represente bien des actifs physiques unitaires

### Points de vigilance

- ne pas reutiliser `Product` comme support direct de l equipement patrimonial
- ne pas introduire de multi-schema Postgres si Prisma n en a pas besoin ici
- ne pas promettre un module document complet dans cette etape
- conserver la compatibilite avec l audit et le RBAC deja en place

## Suivi

- artefact cree pour servir de base a la future implementation de l etape 2
- la question sur le devenir de `products` est tranchee : le domaine est conserve pour les accessoires et fournitures
- la navigation workspace place maintenant `Etiquettes` en fin du groupe `Referentiel`, pour aligner le menu sur l organisation fonctionnelle retenue
- le groupe `Pilotage` du workspace suit desormais l ordre `Tableau de bord`, `Campagnes`, `Inventaire`, `Anomalies`
- aucune dette explicite nouvelle n a ete ajoutee au backlog dans cette vague
