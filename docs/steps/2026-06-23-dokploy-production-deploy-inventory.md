# Dokploy production deploy inventory

## Objectif

Preparer `inventory-app` pour un deploiement Dokploy production sur le VPS Hostinger deja utilise par `comps`, sans reutiliser les ports de `comps` et sans embarquer les identifiants de demonstration en production.

## Perimetre

- dans le scope :
  - `docker-compose.prod.yml`
  - CORS API pilote par `CORS_ALLOWED_ORIGINS`
  - bootstrap production idempotent pilote par variables d environnement
  - suppression des identifiants demo pre-remplis dans les login deployes
  - documentation de l etat courant et verification Git
- hors scope :
  - deploiement effectif sur Dokploy
  - modification des ports de `comps`
  - creation de donnees demo stock, assets ou localisations

## Contexte initial

- demande :
  - garder `web=3010`, `api=3011`, `admin=3014`
  - exposer les domaines `inventory.gestionai.fr`, `api.inventory.gestionai.fr` et `admin.inventory.gestionai.fr`
  - autoriser les origins web et admin en CORS
  - injecter `DATABASE_URL` depuis `INVENTORY_DATABASE_URL`
  - executer un bootstrap seulement si `INVENTORY_BOOTSTRAP_ENABLED=true`
- etat existant :
  - branche locale `main`
  - aucun commit local present au debut de l etape
  - aucun remote Git configure dans cette copie (`git remote -v` vide)
  - `docker-compose.prod.yml` publiait les ports hote et utilisait des secrets de fallback faibles
  - CORS API etait fige sur `localhost:3010` et `localhost:3014`
  - le seed Prisma creait des donnees et identifiants de demonstration
- contraintes :
  - ne pas toucher aux ports de `comps`
  - ne pas publier inutilement les ports hote avec Dokploy
  - ne pas stocker les secrets de production dans le depot
  - documentation en francais ASCII uniquement

## Plan

1. Durcir le compose production avec variables requises, ports internes et URLs publiques cible.
2. Ajouter la lecture de `CORS_ALLOWED_ORIGINS` dans `apps/api/src/main.ts`.
3. Ajouter un script de bootstrap production idempotent sans donnees demo.
4. Brancher le bootstrap dans le demarrage API apres `prisma migrate deploy`.
5. Retirer les valeurs demo pre-remplies des login deployes et ajuster les tests.
6. Mettre a jour la documentation racine, executer les verifications, puis tenter commit et push.

## Questions ouvertes

- Le remote Git cible n est pas configure dans cette copie locale. Sans URL remote fournie ou retrouvable, le push ne pourra pas etre realise depuis ce repo.

## Hypotheses

- Dokploy route les domaines vers les ports internes exposes par les conteneurs.
- La base de donnees production est fournie par `INVENTORY_DATABASE_URL` et ne pointe pas vers la base `comps`.
- Le premier mot de passe admin est fourni hors depot via `INVENTORY_BOOTSTRAP_ADMIN_PASSWORD`.

## Zones impactees

- backend : CORS, bootstrap production, garde production sur `DATABASE_URL`
- frontend : valeurs par defaut du formulaire de login
- base de donnees : aucune migration prevue, creation idempotente possible de l organisation, du compte admin et du catalogue IAM
- infrastructure : compose production Dokploy
- documentation : specification fonctionnelle, architecture technique, modele de donnees, backlog et ADR

## Tests prevus

- `npm run build`
- `npm run test`
- `docker compose -f docker-compose.prod.yml config`
- `docker compose -f docker-compose.prod.yml build api web admin`

## Criteres d'acceptation

- `docker-compose.prod.yml` ne contient plus de fallback faible pour `DATABASE_URL`, `JWT_SECRET` ou `JWT_REFRESH_SECRET`.
- Les services web, api et admin gardent les ports internes 3010, 3011 et 3014 sans publication hote.
- L API accepte en production `https://inventory.gestionai.fr` et `https://admin.inventory.gestionai.fr` via CORS.
- Le bootstrap production ne cree aucune donnee demo stock/assets et refuse les identifiants demo.
- Le bootstrap ne s execute que si `INVENTORY_BOOTSTRAP_ENABLED=true`.
- L etat Git reel est documente et le commit/push est tente si un remote existe.

## Decisions prises

- Utiliser un script Node compile dans `apps/api/dist/src/bootstrap/production-bootstrap.js` pour rester dans le runtime API existant.
- Creer seulement le role `ADMINISTRATOR` et les permissions connues, puis assigner ce role global au premier admin.
- Ne pas ecraser le mot de passe d un admin existant a chaque demarrage.

## Notes d'implementation

- `docker-compose.prod.yml` utilise maintenant `expose` pour `3010`, `3011` et `3014`, sans publication hote.
- `DATABASE_URL` est injecte dans l API via `INVENTORY_DATABASE_URL`.
- les secrets `JWT_SECRET`, `JWT_REFRESH_SECRET` et les variables Postgres production n ont plus de fallback faible dans le compose production.
- `CORS_ALLOWED_ORIGINS` est ajoute cote API et configure par defaut pour `https://inventory.gestionai.fr` et `https://admin.inventory.gestionai.fr`.
- `NEXT_PUBLIC_API_URL` cible `https://api.inventory.gestionai.fr/api/v1` et `NEXT_PUBLIC_WEB_APP_URL` cible `https://inventory.gestionai.fr`.
- `apps/api/src/bootstrap/production-bootstrap.ts` cree l organisation initiale, le compte admin initial, les permissions IAM et le role `ADMINISTRATOR`.
- le bootstrap refuse `demo-org`, `admin@demo.local` et `ChangeMe123!`, n ecrase pas le mot de passe d un admin existant, et ne cree aucune donnee demo stock/assets/spatial.
- `PrismaService` refuse en production un `DATABASE_URL` absent ou pointant vers la base `comps`.
- les formulaires de connexion web/admin n embarquent plus les identifiants demo par defaut.
- `.dockerignore` reduit le contexte Docker Dokploy et evite d envoyer les artefacts locaux.

## Incident 2026-06-24 - URL API front production

### Symptome

- Le deploiement Dokploy demarre les conteneurs `web` et `api`.
- L API NestJS affiche `Nest application successfully started`.
- La page de connexion web affiche encore `Impossible de joindre l API (http://localhost:3011/api/v1)`.

### Diagnostic

- `NEXT_PUBLIC_API_URL` est bien renseigne dans l environnement runtime du service `web`.
- Next.js fige les variables `NEXT_PUBLIC_*` pendant le build de l image, pas au demarrage du conteneur.
- `Dockerfile.web` et `Dockerfile.admin` ne passaient pas `NEXT_PUBLIC_API_URL` et `NEXT_PUBLIC_WEB_APP_URL` au stage `builder`.

### Plan correctif

1. Ajouter les `ARG` et `ENV` de build dans `Dockerfile.web` et `Dockerfile.admin`.
2. Transmettre ces arguments depuis `docker-compose.prod.yml`.
3. Conserver les variables runtime pour la lisibilite Dokploy et les usages serveur.
4. Mettre a jour la documentation de deploiement et le backlog bug.
5. Verifier build, tests, config compose, build Docker puis pousser `main`.

### Notes de correction

- `Dockerfile.web` et `Dockerfile.admin` definissent maintenant `NEXT_PUBLIC_API_URL`, `API_BASE_URL` et `NEXT_PUBLIC_WEB_APP_URL` dans le stage `builder`.
- `docker-compose.prod.yml` transmet ces trois valeurs comme `build.args` pour les services `web` et `admin`.
- Les memes variables restent dans l environnement runtime Dokploy pour garder une configuration lisible.
- Aucun changement de schema ni aucune migration Prisma n est necessaire.

### Verifications incident 2026-06-24

- `npm run build` : OK
- `npm run test` : OK
- `docker compose -f docker-compose.prod.yml config` avec variables temporaires de validation : OK
- `docker compose -f docker-compose.prod.yml build api web admin` : OK

## Suivi

- Verifications executees :
  - `npm run build` : OK
  - `npm run test` : OK
  - `docker compose -f docker-compose.prod.yml config` avec variables temporaires de validation : OK
  - `docker compose -f docker-compose.prod.yml build api web admin` : OK apres ajout de `.dockerignore`
- Git :
  - branche locale : `main`
  - remote : `origin git@github.com:sebastouille/inventory.git`
  - branche amont : `origin/main`
  - premier push de `main` : realise avant l incident de connexion API
  - push du correctif : realise en fin de correction apres validation locale
- Travail differe :
  - `IMP-025` est clos car le remote Git cible est configure et pousse.
