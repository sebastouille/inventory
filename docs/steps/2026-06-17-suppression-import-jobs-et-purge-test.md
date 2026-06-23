# Suppression des jobs d import et purge de test

## Objectif

Ajouter une suppression definitive des jobs d import dans le workspace web, puis cadrer la strategie de purge des donnees de test importees afin de pouvoir rejouer les memes fichiers sans polluer la base.

## Perimetre

- dans le scope :
  - endpoint backend de suppression definitive d un job
  - nettoyage des artefacts `.runtime/imports` du job
  - bouton UI de suppression dans `apps/web/app/imports`
  - documentation des limites actuelles
- hors scope :
  - purge automatique des noeuds spatiaux crees par un job
  - purge globale d une campagne de tests d import
  - historique avance de provenance ligne par ligne

## Contexte initial

- demande :
  - ajouter un bouton pour supprimer les jobs
  - definir comment supprimer definitivement les donnees importees de test pour rejouer les memes imports
- etat existant :
  - les jobs peuvent etre crees, uploades, executes et annules
  - aucune suppression definitive des jobs n existe
  - les artefacts de fichiers restent stockes sous `.runtime/imports`
  - la provenance spatiale conserve `lastImportJobId`, mais pas encore un journal d ecritures permettant de supprimer exactement les objets crees par un job
- contraintes :
  - ne pas faire de suppression metier approximative sur les noeuds spatiaux sans trace d origine fiable

## Plan

1. Ajouter la table de provenance `ImportJobWrite` et les contrats partages associes.
2. Tracer les creations et mises a jour reelles pendant `imports.execute` pour `spatial-nodes`.
3. Ajouter un endpoint de purge V1 qui supprime uniquement les `CREATED` du job et bloque en cas de conflit structurel.
4. Exposer le bouton `Purger les creations` dans le job courant et l historique, avec confirmation et retour explicite.
5. Conserver la suppression de job existante comme flux distinct de purge metier.

## Questions ouvertes

- aucune

## Hypotheses

- un job `RUNNING` ne doit pas etre supprimable
- la suppression de job ne doit pas tenter de supprimer des noeuds spatiaux sans traque explicite des ecritures
- la purge V1 ne cible que `spatial-nodes`
- la purge V1 supprime uniquement les `CREATED`
- la purge V1 bloque integralement si un seul noeud cree par le job n est pas purgeable

## Zones impactees

- backend :
  - `apps/api/src/imports/imports.controller.ts`
  - `apps/api/src/imports/imports.service.ts`
  - `apps/api/src/imports/imports-storage.ts`
  - `apps/api/src/spatial/spatial.service.ts`
- frontend :
  - `apps/web/app/imports/page.tsx`
- base de donnees :
  - `prisma/schema.prisma`
  - nouvelle migration Prisma
- documentation :
  - present fichier d etape
  - `FUNCTIONAL_SPEC.md`
  - `TECHNICAL_ARCHITECTURE.md`
  - `IMPLEMENTATION_BACKLOG.md`

## Tests prevus

- `npm run db:generate`
- `npm run build --workspace api`
- `npm run build --workspace web`
- `npm run test --workspace api`

## Criteres d'acceptation

- un utilisateur autorise peut supprimer definitivement un job
- les fichiers stockes du job sont supprimes de `.runtime/imports`
- l historique n affiche plus le job supprime
- l ecran courant se reinitialise si le job ouvert vient d etre supprime
- la documentation explique explicitement que cela ne supprime pas encore les donnees metier importees
- un utilisateur autorise peut purger uniquement les noeuds `CREATED` par un job `spatial-nodes`
- les `UPDATED` ne sont jamais annules
- la purge retourne `BLOCKED` si un descendant externe ou une affectation IAM empeche la suppression
- la purge ne supprime jamais `ImportJob`, `ImportProfile`, `AuditLog` ni `ImportJobWrite`

## Decisions prises

- la suppression de job est definitive
- un job `RUNNING` n est pas supprimable
- la suppression de job nettoie aussi les artefacts `.runtime/imports`
- la suppression de job ne supprime pas encore les objets metier importes
- la purge V1 s appuie sur une nouvelle table `ImportJobWrite`
- la purge V1 ne supprime que les `CREATED`
- la purge V1 bloque integralement si un noeud cree a des descendants externes ou des affectations IAM

## Notes d'implementation

- ajout de `DELETE /api/v1/imports/jobs/:jobId`
- ajout du helper `removeImportJobArtifacts()` dans `imports-storage`
- ajout de l action `Supprimer` dans le panneau de job courant et dans l historique des jobs
- la suppression du job ouvert reinitialise l ecran courant
- ajout du modele Prisma `ImportJobWrite` et de l enum `ImportJobWriteOperation`
- ajout de `POST /api/v1/imports/jobs/:jobId/purge-created-data`
- `SpatialService.executeImportReport()` trace maintenant toutes les ecritures reelles `CREATED` et `UPDATED`
- la purge backend :
  - charge les traces du job
  - recharge les `SpatialNode` traces en `CREATED`
  - bloque si un descendant externe ou un scope IAM affecte est detecte
  - supprime les scopes IAM derives puis les noeuds spatiaux
- le workspace web `imports` expose maintenant `Purger les creations` sur le job courant et dans l historique
- la purge et la suppression de job restent deux flux distincts
- ajout du script de maintenance `prisma/reset-test-imports-spatial.ts` pour remettre a zero les donnees de test imports + spatial quand le lien job -> creations a ete perdu
- correctif UI :
  - le bouton de suppression du job a d abord ete retire du workspace web pour eviter la suppression de l historique avant purge metier
  - il a ensuite ete rebranche une fois le garde backend en place
  - le dialogue de confirmation rappelle maintenant explicitement que la suppression sera refusee si des creations metier du job existent encore
- correctif backend complementaire :
  - `DELETE /api/v1/imports/jobs/:jobId` bloque maintenant avec `409 IMPORT_JOB_DELETE_BLOCKED` tant que des `SpatialNode` traces en `CREATED` existent encore en base
  - un job reste supprimable apres purge metier si ses traces `CREATED` ne pointent plus vers aucun noeud existant
- note locale :
  - la migration Prisma V1 a ete appliquee apres un `migrate resolve` sur un etat local deja derive pour `20260616162000_organization_settings_spatial_display`

## Suivi

- documents mis a jour :
  - `README.md`
  - `BUG_BACKLOG.md`
  - `FUNCTIONAL_SPEC.md`
  - `TECHNICAL_ARCHITECTURE.md`
  - `DATA_MODEL.md`
  - `IMPLEMENTATION_BACKLOG.md`
  - `docs/adr/0008-provenance-des-ecritures-import-et-purge-v1.md`
- tests executes :
  - `npm run build --workspace api`
  - `npm run build --workspace web`
  - `npm run test --workspace api`
