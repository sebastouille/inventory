# F2-L04 - imports reels immobilizations et equipments

## Objectif

Brancher les imports reels `immobilizations` et `equipments` sur le moteur ETL existant, en tenant compte des fichiers sources analyses :

- extrait SP des immobilisations corporelles ;
- fichier IFC4 contenant le spatial et des objets mobilier.

## Perimetre

- dans le scope :
  - execution reelle des jobs `immobilizations` ;
  - execution reelle des jobs `equipments` ;
  - ajout de `currentSpatialPath` au catalogue import equipements ;
  - creation de mouvements equipements lors d imports qui creent ou deplacent un equipement ;
  - provenance `ImportJobWrite` pour les creations et mises a jour ;
  - purge V1 des creations pour `spatial-nodes`, `immobilizations` et `equipments` ;
  - garde de suppression de job etendu aux creations des trois domaines.
- hors scope :
  - rapprochement automatique entre immobilisations SP et equipements IFC ;
  - rendu 3D IFC ;
  - import natif direct IFC dans l UI ;
  - creation automatique des referentiels assets manquants ;
  - rollback des `UPDATED`.

## Contexte initial

- demande :
  - implementer le plan F2-L04 revise au regard de l analyse des fichiers SP et IFC4.
- etat existant :
  - `spatial-nodes` est execute en reel ;
  - `equipments` et `immobilizations` sont visibles dans le catalogue mais passent par un rapport generique sans persistence metier ;
  - la purge V1 est specialisee `spatial-nodes`.
- contraintes :
  - `internalCode` reste la cle terrain des equipements ;
  - `Immobilization.code` reste la cle comptable ;
  - pas de lien automatique SP vers IFC sans cle commune fiable ;
  - documentation repo en francais ASCII.

## Plan

1. Ajouter les adapters metier d import pour `immobilizations` et `equipments`.
2. Brancher `ImportsService.runJobMode` vers ces adapters.
3. Enregistrer `ImportJobWrite` pour chaque create/update reelle.
4. Etendre la purge et le garde de suppression de job.
5. Activer les domaines dans l UI imports.
6. Mettre a jour les contrats partages, tests et documentation.

## Questions ouvertes

- Le rapprochement comptable automatique reste ouvert et sera traite dans un lot ulterieur.
- L import natif IFC direct reste ouvert ; F2-L04 accepte des fichiers intermediaires normalises.

## Hypotheses

- Les referentiels assets requis existent avant import equipements.
- `currentSpatialPath` est la cle prioritaire de localisation equipement.
- `currentSpatialExternalRef` est un fallback.
- `currentSpatialCode` est accepte seulement s il est unique dans l organisation.
- Les equipements IFC sans code metier utilisent provisoirement `ID unique` comme `internalCode` dans le fichier intermediaire.

## Zones impactees

- backend :
  - `apps/api/src/imports`
  - `apps/api/src/assets`
  - `apps/api/src/equipment-movements`
- frontend :
  - `apps/web/app/imports/page.tsx`
- base de donnees :
  - pas de nouvelle migration prevue ;
  - utilisation de `ImportJobWrite`, `Equipment.initializedByImportJobId`, `Immobilization.initializedByImportJobId`.
- documentation :
  - specifications racine et ADR.

## Tests prevus

- import immobilisations create/update/rejet ;
- import equipements create/update/rejet ;
- resolution spatiale par path, externalRef et code unique ;
- mouvements initiaux et mouvements de localisation ;
- purge des creations par domaine ;
- suppression de job bloquee avant purge et autorisee apres purge ;
- build shared/api/web.

## Criteres d'acceptation

- `execute` persiste reellement `immobilizations` et `equipments`.
- `preview` et `validate` ne persistent rien.
- Les rapports indiquent `CREATED`, `UPDATED` ou `REJECTED`.
- Les creations importees sont purgeables.
- La suppression de job ne peut plus casser la provenance.
- L UI permet d executer les trois domaines supportes.

## Decisions prises

- Pas de rapprochement automatique SP/IFC dans F2-L04.
- Pas de creation automatique des referentiels manquants.
- Pas de rollback des mises a jour.
- Le moteur ETL reste l entree unique ; les fichiers IFC peuvent etre transformes en fichiers intermediaires normalises.

## Notes d'implementation

- adapters ajoutes dans `apps/api/src/imports` pour `immobilizations` et `equipments` ;
- `ImportsService` delegue maintenant preview, validate et execute aux adapters metier ;
- `currentSpatialPath` est ajoute au catalogue import equipements ;
- la purge V1 est etendue aux equipements et immobilisations crees par un job ;
- le garde de suppression de job couvre maintenant les trois domaines.

## Suivi

- tests unitaires ajoutes pour les adapters et le garde de suppression ;
- builds `shared`, `api` et `web` verifies pendant implementation.
