# Specification fonctionnelle

## Perimetre

Ce fichier decrit le perimetre fonctionnel courant de l'application. Le mettre a jour apres chaque fonctionnalite implementee ou chaque decision qui modifie le comportement visible.

## Domaines centraux

- biens physiques et elements inventoriables
- localisation multi-niveaux : site, batiment, etage, zone, piece, emplacement
- inventaire terrain mobile
- campagnes d'inventaire
- photos et pieces jointes
- mouvements et changements de stock
- anomalies et ecarts d'inventaire
- import Archicad
- import SINERGI/SAP
- rapprochement physique/comptable
- export de corrections
- audit trail
- securite JWT + RBAC

## Decisions fonctionnelles actives

- le versioning API utilise `/api/v1`
- IAM/RBAC V1 est implemente avec roles metier, permissions, perimetres, et audit
- la gestion des comptes supporte maintenant la reinitialisation admin du mot de passe avec mot de passe temporaire et changement force au prochain login
- chaque organisation peut maintenant choisir une politique IAM spatiale :
  - `SCOPED` : les perimetres scopes restreignent l acces spatial
  - `ORGANIZATION_WIDE` : les scopes restent stockes mais sont ignores pour l acces effectif
- le domaine `assets` est livre en parallele de `products` pour representer les equipements patrimoniaux unitaires
- `products` reste reserve au stock, aux accessoires et aux fournitures
- les pages stock `/inventory` et `/movements` sont conservees techniquement, mais masquees de la navigation generale V1 jusqu a reprise de la chaine stock/products/fournisseurs
- le module `inventory` actuel et le journal `stock-movements` sont conserves pour le futur inventaire de stock `products` ; ils ne doivent pas porter l inventaire physique ni les mouvements du domaine `equipements`
- un equipement peut maintenant etre positionne directement sur un noeud spatial courant, tout en restant affectable a une personne ou a un autre asset compatible
- `internalCode` est la cle terrain cible a imprimer et scanner ; `serialNumber` reste un champ constructeur optionnel ; `numPiece` permet de stocker le numero de piece issu des sources metier ; `externalRef` conserve une reference source externe ; `barcode` et `qrCode` sont retires du modele metier `Equipment` et devront etre regeneres plus tard a l impression a partir de `internalCode`
- l interface `apps/admin` et `apps/web` partage un systeme UI commun via `packages/ui`
- un token JWT invalide ou obsolete est traite comme une session terminee : le token local est supprime et l utilisateur revient a l ecran de connexion
- les formulaires de connexion web et admin ne pre-remplissent plus les identifiants de demonstration ; les identifiants `admin@demo.local / ChangeMe123!` restent reserves au seed local et ne sont pas deployes comme valeurs par defaut
- le bootstrap production Dokploy est separe du seed de demonstration : il cree uniquement l organisation initiale, le compte admin initial, le catalogue minimal de permissions et le role `ADMINISTRATOR`
- en production Dokploy, les clients web et admin appellent l API publique `https://api.inventory.gestionai.fr/api/v1` via `NEXT_PUBLIC_API_URL` fige au build Docker, afin que le navigateur ne tente pas de joindre `localhost`
- les listes prioritaires `users`, `roles`, `products`, `locations`, `suppliers`, `stock-movements` supportent recherche, tri, pagination 10/50/100/200 et export `.ods`
- le module `assets` supporte recherche, filtres, archivage logique, historique et export `.ods`
- `apps/web` sert de base PWA responsive pour poste de travail et smartphone
- le backend `imports` livre un socle transverse `.csv/.xlsx` par organisation avec profils, jobs, upload, preview, validation et rapport ; l execution reelle est branchee pour `spatial-nodes`, `equipments` et `immobilizations`
- les jobs d import peuvent maintenant etre supprimes definitivement via l UI seulement s ils ne referencent plus de creations metier encore presentes ; le backend bloque la suppression tant qu une purge metier prealable reste necessaire
- les jobs `spatial-nodes` executes exposent maintenant une action `Purger les creations` qui supprime uniquement les noeuds crees par ce job ; les mises a jour ne sont jamais annulees en V1
- la purge V1 d import est bloquee integralement si un noeud cree par le job possede des descendants externes ou un scope IAM encore affecte
- en mode `ORGANIZATION_WIDE`, la purge V1 d import n est plus bloquee par les affectations scopees historiques ; les descendants externes restent bloquants
- le referentiel spatial V1 est maintenant porte par `SpatialNode`, avec hierarchy `SITE | BUILDING | FLOOR | ZONE | ROOM | LOCATION`, import Excel/CSV, backfill legacy depuis `Location`, et reserve technique IFC4 via `externalRef`, `sourceClass` et `sourceMetadata`
- l import `spatial-nodes` est maintenant branche de bout en bout sur le moteur ETL avec preview, validate, execute reel, reconciliation par `path`, et rejet en cascade si un parent du fichier est invalide
- le referentiel spatial V1 supporte maintenant le CRUD admin, l archivage logique, la consultation operateur, et la synchronisation automatique des scopes IAM via `IamAccessScope.spatialNodeId`
- `F2-L01` est maintenant livre : `Equipment.currentSpatialNodeId` est la source de verite de la localisation courante, les affectations `LOCATION` deviennent legacy, et les champs dates `receivedAt`, `commissionedAt` et `lastInventoryAt` sont exposes
- `F2-L02` est maintenant livre : une immobilisation comptable est une entite distincte de l equipement, peut couvrir plusieurs equipements, et peut etre recherchee ou rattachee depuis la fiche equipement
- `F2-L03` est maintenant livre : les mouvements equipements sont separes des mouvements stock, derives automatiquement des creations, changements de localisation et changements d affectation
- `F2-L04` est maintenant livre : les imports reels `immobilizations` et `equipments` creent ou mettent a jour les donnees metier, tracent les ecritures, generent les mouvements equipements et restent purgeables en base de test
- la V1 etiquettes terrain est maintenant livree cote API et web : les equipements encodent `EQ:<internalCode>`, les noeuds spatiaux encodent `NODE:<spatialNodeId>`, les exports sont stateless et peuvent etre telecharges en `xlsx`, `ods` ou `pdf-a4`
- la V1 campagnes terrain equipements est maintenant separee du domaine stock `inventory` : une campagne definit un perimetre spatial, fige les equipements attendus a l ouverture, collecte des observations, puis genere des anomalies
- `MATCH` reste un resultat d observation conforme ; les anomalies V1 sont `WRONG_LOCATION`, `UNKNOWN_CODE`, `MISSING`, `DUPLICATE` et `OUT_OF_SCOPE`
- la V1 execution terrain est mobile-first avec scan camera prioritaire via `BarcodeDetector` ou `@zxing/browser`, douchette Bluetooth HID en acceleration, saisie manuelle en secours, file IndexedDB par campagne et synchronisation idempotente
- la saisie manuelle terrain accepte maintenant les references metier : un noeud peut etre resolu par UUID, code, chemin ou reference externe, et un equipement par code interne, reference externe ou numero de piece
- la fin de noeud actif terrain genere maintenant les anomalies `MISSING` du noeud actif et de ses descendants sans attendre la cloture complete de la campagne
- les campagnes peuvent etre creees et executees sur un noeud `FLOOR`, `ZONE` ou `ROOM`; le matching accepte un equipement attendu dans un descendant du noeud actif
- un resultat `WRONG_LOCATION` cree automatiquement une anomalie et une correction superviseur `LOCATION_CHANGE` proposee vers le noeud observe, sans deplacer directement l equipement
- la cloture de campagne met a jour `Equipment.lastInventoryAt` pour les equipements observes et ecrit un audit `inventory.equipment.observed`
- la V1 corrections superviseur permet `LOCATION_CHANGE`, `STATUS_CHANGE`, `RELABEL_REQUEST` et `MANUAL_IMMOBILIZATION_LINK` ; le changement de localisation cree aussi un `EquipmentMovement`
- la V1 rapprochement comptable est manuelle : l ecran propose des candidats informatifs mais ne rattache jamais automatiquement une immobilisation a un equipement
- toute ecriture spatiale backend recalcule maintenant le `path`, le `depth` et la coherence parent/enfant avant persistence, y compris pour l import et le backfill legacy
- les listes admin et web basees sur `DataGrid` affichent maintenant les actions desktop en clair par defaut ; le menu `...` reste un mode optionnel pour les ecrans denses
- chaque type de noeud spatial dispose maintenant d une couleur et d une icone configurables par organisation depuis les parametres admin
- les listes d arborescence spatiale admin et web recherchent maintenant sur code, libelle et references utiles, sans exposer le `path` dans la ligne de liste
- l execution d import est reelle pour `spatial-nodes`, `equipments` et `immobilizations` ; le rapprochement automatique entre immobilisations SP et equipements IFC reste differe faute de cle commune fiable dans les fichiers analyses
- le workspace imports dispose maintenant d un assistant IFC4 V1 qui analyse un fichier `.ifc`, suit une lecture chronologique fichier -> previsualisation -> spatial -> referentiels assets -> equipements, et genere des jobs imports standards pour `spatial-nodes` et `equipments`
- l analyse IFC4 est maintenant lancee comme un job batch persistant `ifc4-analysis` : le fichier est stocke hors base, le worker Python ecrit des logs consultables, et le resultat sert ensuite a creer les jobs `spatial-nodes` et `equipments`
- l assistant IFC4 commence maintenant par un parse rapide : le fichier est stocke une seule fois, les classes IFC presentes sont listees avec compteurs, puis l utilisateur coche les classes a previsualiser et importer
- la selection des classes IFC est affichee sous forme d arborescence deployable par familles IFC, avec selection possible au niveau groupe ou classe
- l assistant IFC4 propose maintenant un profil avant lancement : nombre maximum de produits a analyser, defaut `5000`, niveau de geometrie `Aucun`, `Minimum` ou `Intermediaire`, et limite de details simplifiee pour le niveau intermediaire
- l assistant IFC4 applique le filtrage des classes IFC avant l extraction geometrique ; les proprietes selectionnees pour le mapping equipement sont transmises dans le profil d analyse
- le mode geometrie `Aucun` permet une preview de preparation sans donnees geometriques ; les jobs metier restent possibles mais aucune geometrie IFC n est importee dans ce mode
- le traitement IFC4 peut etre annule depuis le badge de statut `RUNNING` du panneau de logs ; l annulation stoppe le process Python actif quand il existe et passe le job en `CANCELLED`
- l assistant IFC4 pilote maintenant directement les etapes `preview`, `validate` et `execute` des jobs enfants `spatial-nodes` et `equipments`, sans obliger l utilisateur a passer par le panneau generique des imports
- l assistant IFC4 permet de corriger les types proposes en preview pour les noeuds spatiaux et les referentiels assets avant generation des jobs ou application des referentiels ; la preview spatial affiche aussi une arborescence deployable pour valider la chaine parent/enfant avant creation du job
- l assistant IFC4 affiche maintenant une vue de controle complete avant import : noeuds spatiaux, equipements rattaches sous leur noeud spatial, classification asset associee a chaque equipement, et liste separee des equipements non rattachables a l arborescence
- l assistant IFC4 permet maintenant de mapper explicitement les proprietes `IfcPropertySingleValue` vers les champs equipement `code equipement`, `num piece`, `reference externe`, `categorie`, `famille`, `sous-famille`, `type`, `marque`, `modele`, `statut` et `proprietaire`, avec recalcul volontaire de la preview equipements sans relancer IfcOpenShell
- l assistant IFC4 rattache maintenant un equipement a la `ROOM` du meme batiment dont la propriete `N de piece` correspond a la propriete `N de piece` de l equipement ; les doublons de numero de piece dans un meme batiment sont signales comme anomalie
- l assistant IFC4 dispose maintenant de profils dedies sauvegardables par organisation, separes des profils CSV/XLSX, pour reutiliser classes, proprietes, mappings, overrides, niveau de geometrie et politique d import
- l assistant IFC4 affiche maintenant un panneau `Diagnostics geometrie IFC` avec compteurs, filtres `Tous`, `OK`, `A corriger`, detail GlobalId/classe/path/bbox/dimensions/message et export CSV des anomalies
- l assistant IFC4 propose maintenant une politique explicite `Importer uniquement les lignes OK`; dans ce mode les objets non importables sont exclus du job, inscrits dans le rapport et jamais positionnes par approximation
- les `IFCBUILDINGSTOREY` sans geometrie propre peuvent maintenant etre acceptes comme etages derives : l assistant utilise d abord l emprise X/Z du batiment parent geometrique, sinon l emprise des enfants geometriques ; ils restent signales comme `Etage derive` et ne masquent pas les autres erreurs IFC
- les `IFC_PROPERTY_ZONE` crees depuis la propriete IFC `Zone` peuvent maintenant etre acceptes comme zones derivees : l assistant calcule leur emprise depuis les `IFCSPACE` enfants geometriques et les signale comme geometrie derivee
- en mode strict, les zones issues de `IFCSPACE` sont rattachees a un etage uniquement via la relation IFC vers `IFCBUILDINGSTOREY`; si cette relation manque, l assistant affiche une erreur au lieu de rattacher au batiment
- les rapports d import spatial et equipements distinguent maintenant les lignes `NO_OP`, c est a dire les objets deja presents et strictement identiques, afin d eviter des mises a jour inutiles
- l assistant IFC4 peut appliquer volontairement des referentiels assets manquants detectes dans le fichier, en s appuyant sur une structure technique IFC4 pour les types inconnus, et affiche les equipements candidats en detail read-only
- le shell web supporte maintenant une aide contextuelle V1 en pop-up, avec vignettes cliquables, texte a plat et visuels d explication ; la page `imports` en est le premier ecran equipe
- le champ header `Navigation et espace de travail` est maintenant une recherche globale transverse V1 sur `equipements`, `campagnes`, `localisations`, `immobilisations`, `jobs imports` et `profils imports`, avec suggestions a partir de 3 caracteres
- la recherche globale V1 n expose que des codes et libelles metier, jamais les UUID ou identifiants techniques internes
- les suggestions de recherche globale sont filtrees par permissions existantes, et depuis `apps/admin` elles ouvrent la page cible correspondante dans `apps/web`
- la V1 carte 3D IFC4 simplifiee est disponible dans `apps/web` : elle genere une scene legere depuis les noeuds spatiaux et equipements, rend des volumes simplifiees, permet la selection et affiche une heatmap d anciennete d inventaire
- la carte 3D peut maintenant generer une scene depuis un fichier IFC via IfcOpenShell/Python cote backend ; quand l extraction reussit, les boites 3D utilisent les coordonnees monde IFC et des reperes d etage sont affiches
- les imports IFC4 exigent maintenant une geometrie exploitable : IfcOpenShell indisponible, extraction impossible ou objet sans geometrie produisent un message explicite au lieu d un placement approximatif
- la carte 3D affiche les etages derives sous forme de plateaux bleus semi-transparents avec bordure et etiquettes lisibles, controles par le bouton `Reperes d etage`
- les noeuds spatiaux et les equipements importes depuis IFC4 conservent une geometrie persistante : centre monde, dimensions maximales, source et metadonnees de bbox
- la carte 3D standard utilise en priorite la geometrie IFC persistante et refuse les generations partielles
- la carte 3D V1 utilise `lastInventoryAt` pour classer les equipements de vert a rouge ; les dates inconnues sont affichees en gris neutre
- une V2 de l aide contextuelle est ciblee pour plus tard, avec parcours guide pas a pas, surbrillance des zones de page, positionnement contextuel et memorisation de progression par utilisateur
- le module `audit` reste une surface reservee dans la navigation web ; `campaigns`, `anomalies`, `imports`, `labels` et `reconciliation` disposent maintenant d ecrans operationnels V1

## Parcours UI actifs

- `apps/web`
  - page de connexion terrain
  - page de connexion terrain avec changement force du mot de passe quand le backend renvoie `PASSWORD_CHANGE_REQUIRED`
  - page de connexion terrain sans valeurs demo pre-remplies en production
  - tableau de bord metier avec KPI campagnes ouvertes, anomalies ouvertes, immobilisations non rapprochees et biens non inventories depuis plus de 12 mois
  - module `assets` avec liste, creation, detail, edition, affectations et historique
  - module `assets` avec edition de la localisation courante via `SpatialNode`, suppression des champs `barcode` et `qrCode`, saisie et visualisation de `numPiece` et `externalRef`, et libelles metier explicites pour type, modele, statut, proprietaire et affectations
  - module `assets` avec groupe `Comptabilite` permettant de rattacher ou detacher une immobilisation comptable
  - module `immobilizations` avec liste, recherche, consultation read-only, creation, edition, archivage logique, compteur et liste des equipements rattaches
  - module `equipment-movements` avec journal pagine, recherche, filtres par type/source, et ouverture de la fiche equipement
  - fiche equipement avec panneau `Mouvements equipement` separe de l historique technique d audit
  - module `locations` aligne sur le referentiel spatial, avec consultation d arborescence deployable, selection de perimetre issue des scopes IAM, et marqueurs visuels par type de noeud
  - module `locations` qui bascule automatiquement en visibilite tenant-wide quand l organisation est en mode `ORGANIZATION_WIDE`
  - module `spatial-3d` avec generation et consultation d une carte 3D simplifiee des noeuds spatiaux et equipements, filtres, selection et heatmap d anciennete d inventaire
  - module `spatial-3d` avec upload `.ifc` pour generer une carte positionnee depuis IfcOpenShell quand les coordonnees IFC sont exploitables
  - module `imports` avec workspace ETL V1 pour jobs, upload `.csv/.xlsx`, mapping inline simple, preview, validate, execute, profils reutilisables et lecture des rapports
  - module `imports` avec assistant IFC4 permettant de charger un fichier `.ifc`, retirer le fichier selectionne, previsualiser les donnees, verifier l arborescence spatiale parent/enfant, mapper les proprietes IFC vers les champs equipement, voir les equipements sous leur noeud spatial avec leur referentiel asset, paginer les previews, corriger les types proposes et consulter le detail des equipements candidats
  - module `imports` avec analyse IFC4 asynchrone, historique de job, logs worker detailles, polling du statut et reutilisation du resultat pour creer les jobs spatial et equipements
  - module `imports` avec assistant IFC4 sequentiel fichier -> profil -> previsualisation -> import spatial -> referentiels assets -> import equipements, les actions enfants etant pilotees dans la meme page verticale
  - module `imports` avec parse rapide IFC4, selection des classes par cases a cocher, profil IFC4 avant analyse, limite `maxProducts`, niveau de geometrie et selection de proprietes pour reduire le volume traite sur les gros fichiers
  - module `imports` avec annulation d un traitement IFC4 `RUNNING` depuis le badge de statut du worker
  - module `imports` avec diagnostic de geometrie IFC obligatoire, badges `Geometrie OK`, `Geometrie manquante` et `Erreur geometrie`, import strict par defaut, import partiel explicite des lignes OK, export CSV des anomalies et profils IFC4 dedies
  - module `imports` avec badge `Etage derive` pour les `IFCBUILDINGSTOREY` dont l emprise est calculee depuis le batiment parent ou les enfants geometriques
  - module `imports` avec zones derivees pour les `IFC_PROPERTY_ZONE` sans bbox propre mais avec des `IFCSPACE` enfants geometriques
  - module `imports` qui conserve le modele IFC mappe meme si la marque est vide, en le rattachant a une marque technique `NON_DEFINI`
  - module `imports` avec aide contextuelle detaillee accessible depuis le header via un bouton `?`
  - module `labels` avec assistant de previsualisation et telechargement des etiquettes equipements et noeuds spatiaux
  - module `assets` dont la liste affiche la reference produit importee comme code interne, le numero de piece, le type et le path spatial
  - module `campaigns` avec liste, creation, preview des attendus, ouverture, execution terrain, cloture et archivage
  - les pages `campaigns`, `locations`, `immobilizations` et `imports` savent maintenant s ouvrir directement depuis des query params de deep-link (`campaignId`, `perimeterId`, `immobilizationId`, `jobId`, `profileId`)
  - le formulaire de creation d une campagne propose une selection de perimetre spatial en arborescence, avec icones par type de noeud, compteur d equipements rattaches au noeud et `Inclure les enfants` actif par defaut
  - module `campaigns/:id/run` avec scan camera prioritaire, mode douchette Bluetooth HID, saisie manuelle, scan de noeud obligatoire, file IndexedDB, synchronisation idempotente et action dynamique `Terminer ce bureau`, `Terminer cette zone` ou `Terminer cet etage`
  - module `campaigns/:id/run` qui accepte aussi le numero de piece metier comme reference de noeud actif quand il correspond aux attendus de la campagne
  - module `anomalies` avec liste des ecarts, detail, proposition de correction et application superviseur
  - module `reconciliation` avec selection d equipement, candidats informatifs, rattachement manuel et detachement d immobilisation
  - module `imports` qui efface une ancienne alerte reseau des qu une requete API reussit, pour eviter un faux negatif persistant dans l ecran
  - module `imports` qui permet aussi de purger les creations metier d un job spatial execute, avec confirmation et detail des blocages eventuels
  - voyant de sante API dans le header admin uniquement, base sur `GET /api/v1/health`
  - listes metier pour biens, localisations, fournisseurs et mouvements equipements
  - la vue `inventory` stock et la page `movements` stock restent hors navigation V1, en attente de reintegration future
  - page `settings`
- `apps/admin`
  - page de connexion admin
  - page de connexion admin avec changement force du mot de passe quand le compte est marque `mustChangePassword`
  - page de connexion admin sans valeurs demo pre-remplies en production
  - tableau de bord IAM
  - page `assets-references` pour administrer categories, familles, sous-familles, types, marques, modeles, statuts, proprietaires et regles de rattachement
  - page `spatial` complete pour creer, corriger, archiver et consulter les noeuds spatiaux synchronises avec IAM, avec arborescence deployable et repliable par clic sur la ligne
  - page `settings` permettant de modifier les icones et couleurs associees aux types de noeuds spatiaux
  - page `settings` permettant aussi de choisir la politique IAM spatiale de l organisation
  - liste utilisateurs avec filtres, tri, pagination, export, creation de compte, double saisie du mot de passe, checklist de complexite temps reel, action `Reinitialiser le mot de passe` et badge `Mot de passe a redefinir`
  - fiche utilisateur avec edition des roles et perimetres, reinitialisation du mot de passe, badge `Mot de passe a redefinir`, les perimetres affichant le chemin spatial synchronise et un message explicite quand les scopes sont ignores par la politique de l organisation
  - catalogue roles et matrice des permissions
  - pages organisation et parametres
  - pas encore d interface graphique imports dans `apps/admin`

## Aide contextuelle V2 cible

- objectif :
  - faire evoluer l aide V1 statique vers un vrai guidage operatoire dans la page
- comportement attendu :
  - un utilisateur peut lancer un tutoriel depuis le bouton `?`
  - le tutoriel ouvre une sequence de pas numerotes
  - chaque pas met en surbrillance une zone fonctionnelle de la page
  - le contenu d aide se positionne au plus pres de la zone cible sans masquer l action a faire
  - l utilisateur peut passer au pas suivant, revenir au precedent, quitter, ou relancer le guide
- exigences fonctionnelles :
  - la page `imports` doit proposer au minimum les sequences :
    - decouverte generale du workspace
    - creation d un job
    - upload et lecture des colonnes source
    - construction du mapping
    - lecture du rapport
  - le guide doit pouvoir masquer le reste de l interface par un voile partiel, tout en gardant la zone utile visible et interactive
  - chaque sequence doit pouvoir etre rejouee independamment
  - la progression doit etre memorisee par utilisateur et par page pour permettre :
    - un premier affichage assiste optionnel
    - une reprise ulterieure
    - une remise a zero volontaire
  - le guide doit rester compatible desktop et mobile
  - le guide doit pouvoir etre alimente plus tard par des contenus admin et web differents
- perimetre initial vise pour l implementation future :
  - `apps/web/app/imports/page.tsx`
  - puis extension a `locations`, `spatial`, `assets` et aux futurs workflows `campaigns` et `anomalies`
- hors scope de la V2 :
  - personnalisation libre des guides par tenant
  - analytics avances de completion
  - generation automatique du guide depuis le DOM

## Clarifications fonctionnelles en attente

Voir [OPEN_QUESTIONS.md](</c:/Users/sebas/RepoSeb/inventory-app/OPEN_QUESTIONS.md>) et `docs/steps/`.
