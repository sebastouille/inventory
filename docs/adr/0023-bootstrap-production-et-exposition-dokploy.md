# ADR 0023 - Bootstrap production et exposition Dokploy

## Statut

Accepted

## Contexte

`inventory-app` doit etre deploye en production via Dokploy sur un VPS Hostinger qui heberge deja `comps`. Les ports reserves pour `inventory-app` restent `3010` pour web, `3011` pour api et `3014` pour admin, mais Dokploy doit router les domaines publics vers les ports internes des conteneurs sans publication hote inutile.

Le seed Prisma courant cree des donnees de demonstration et les identifiants `admin@demo.local / ChangeMe123!`. Ce flux reste utile en local, mais il ne doit pas etre utilise comme initialisation production.

## Decision

Le compose production expose seulement les ports internes des services applicatifs et exige les secrets critiques via variables d environnement. L API recoit `DATABASE_URL` depuis `INVENTORY_DATABASE_URL`, afin de separer explicitement la base `inventory-app` de toute configuration `comps`.

Un bootstrap production idempotent separe du seed demo est ajoute au runtime API. Il s execute uniquement si `INVENTORY_BOOTSTRAP_ENABLED=true`, apres `prisma migrate deploy` et avant le demarrage NestJS. Il cree ou met a jour l organisation initiale, le catalogue de permissions, le role systeme `ADMINISTRATOR` et le compte admin initial, sans creer de stocks, assets, localisations ou autres donnees de demonstration.

## Consequences

- positives :
  - les secrets faibles ne sont plus masques par des fallbacks production
  - le bootstrap initial est reproductible et sans donnees demo
  - Dokploy peut router les domaines publics sans collision de ports hote
  - la base `comps` est protegee par une variable dediee et un garde applicatif production
- negatives :
  - le premier deploiement exige davantage de variables d environnement
  - le push Git depend d un remote correctement configure
- neutres :
  - le seed Prisma de demonstration reste disponible pour le developpement local
  - aucune migration de schema n est necessaire

## Alternatives considerees

### Option A

Lancer `prisma db seed` en production.

- pour :
  - reutilise un flux deja existant
- contre :
  - cree des donnees demo et les identifiants interdits
  - melange initialisation locale et production

### Option B

Creer un bootstrap production dedie, pilote par variables.

- pour :
  - isole les donnees minimales production
  - permet l idempotence sans rotation involontaire du mot de passe admin
  - evite les donnees demo stock/assets
- contre :
  - ajoute un script supplementaire a maintenir avec le catalogue IAM

## Actions de suivi

- Documenter les variables Dokploy attendues dans les documents racine et exemples d environnement.
- Verifier que le remote Git de production est ajoute avant le push final.
