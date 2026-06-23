# ADR 0010 - retrait du module assurances SCI du workspace

## Statut

Accepted

## Contexte

Un module assurances SCI complet a ete ajoute dans `inventory-app` le 2026-06-16, avec page web, API NestJS, contrats partages, schema Prisma, seed IAM, documentation et migrations SQL.

Le besoin ne concerne finalement pas ce workspace. Le conserver ici pollue la navigation, le modele de donnees, les permissions IAM et la maintenance technique. Il faut donc retirer proprement ce domaine sans destabiliser les autres modules ni reecrire l historique Prisma deja versionne.

## Decision

Le domaine assurances est retire du scope courant de `inventory-app`.

Le retrait se fait selon les regles suivantes :

- suppression des points d entree runtime :
  - menu web
  - page `apps/web/assurances`
  - module API `apps/api/src/insurances`
  - export `packages/shared/src/insurances.ts`
- suppression du modele courant :
  - retrait de `InsuranceContract` du schema Prisma actif
  - retrait des permissions IAM assurances du seed
- conservation de l historique de migration :
  - les migrations anciennes restent versionnees
  - une nouvelle migration SQL supprime les objets assurances de la base
- suppression de la documentation fonctionnelle et technique qui presentait les assurances comme un domaine actif du produit

## Consequences

- positives :
  - le produit redevient aligne sur son perimetre reel
  - le schema, le seed et le RBAC sont simplifies
  - la navigation web ne propose plus une fonctionnalite hors sujet
- negatives :
  - les environnements ayant applique les migrations assurances devront aussi appliquer la migration de retrait
  - l historique documentaire du 2026-06-16 est volontairement nettoye dans ce repo
- neutres :
  - les anciennes migrations Prisma restent dans l historique mais ne definissent plus l etat courant

## Alternatives considerees

### Option A

- pour :
  - conserver le module assurances mais le masquer dans la navigation
- contre :
  - laisse des endpoints, permissions et tables inutiles
  - entretient une dette structurelle sans utilite

### Option B

- pour :
  - reecrire l historique Prisma et supprimer les anciennes migrations assurances
- contre :
  - risquee pour les environnements ayant deja applique les migrations
  - complique inutilement la remise en coherence

## Actions de suivi

- verifier qu aucune reference assurances ne reste dans les documents racine, les ADR, les steps et les README documentaires
- verifier les builds `shared`, `api`, `web` et `admin` apres retrait
