# inventory-app - Ports et isolation

Source de verite commune :

- `C:\Users\sebas\RepoSeb\PROJECT_PORTS.md`

Ce document local complete la documentation du projet, mais ne remplace pas le fichier racine.

Ce projet est isole de `comps` et de `stnico-web` sur trois niveaux :

- workspace VS Code dedie : `inventory-app.code-workspace`
- variables d'environnement dediees : `.env.example` et `.env.local`
- stack Docker dediee : `docker-compose.yml` et `docker-compose.prod.yml`

## Ports reserves pour inventory-app

Ces ports sont reserves pour `inventory-app` et ne doivent pas etre reutilises par les autres projets :

| Service | Port reserve | Usage |
|---|---:|---|
| `web` | `3010` | Frontend Next.js operateur |
| `api` | `3011` | API NestJS |
| `admin` | `3014` | Frontend Next.js administration |
| `db` | `5560` | PostgreSQL local |
| `mailpit-smtp` | `1035` | SMTP local |
| `mailpit-ui` | `8035` | Interface web Mailpit |

## Variables d'environnement presentes

Variables actuellement presentes dans `.env.example` et `.env.local` :

- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_DB`
- `DATABASE_URL`
- `PORT`
- `NEXT_PUBLIC_API_URL`
- `API_BASE_URL`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `JWT_EXPIRES_IN`
- `JWT_REFRESH_EXPIRES_IN`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_TLS`

Variables production dediees a Dokploy :

- `INVENTORY_POSTGRES_USER`
- `INVENTORY_POSTGRES_PASSWORD`
- `INVENTORY_POSTGRES_DB`
- `INVENTORY_DATABASE_URL`
- `CORS_ALLOWED_ORIGINS`
- `NEXT_PUBLIC_WEB_APP_URL`
- `INVENTORY_BOOTSTRAP_ENABLED`
- `INVENTORY_BOOTSTRAP_ORGANIZATION_NAME`
- `INVENTORY_BOOTSTRAP_ORGANIZATION_SLUG`
- `INVENTORY_BOOTSTRAP_ADMIN_EMAIL`
- `INVENTORY_BOOTSTRAP_ADMIN_PASSWORD`
- `INVENTORY_BOOTSTRAP_ADMIN_NAME`
- `INVENTORY_BOOTSTRAP_ADMIN_MUST_CHANGE_PASSWORD`

## Separation Docker

La separation Docker est explicite :

- `docker-compose.yml` declare maintenant `name: inventory-app`
- `docker-compose.prod.yml` declare maintenant `name: inventory-app`
- le volume local est `inventory-db-data`
- les services exposes localement n'utilisent pas les ports de `comps`
- en production Dokploy, `web`, `api` et `admin` utilisent `expose` sur `3010`, `3011` et `3014`, sans publication hote `ports`
- l API production lit `DATABASE_URL` depuis `INVENTORY_DATABASE_URL` et refuse la base `comps`

## Regles de separation entre projets

- `comps` conserve ses propres ports et ses propres conteneurs
- `stnico-web` doit utiliser une autre plage de ports
- `inventory-app` ne doit jamais reutiliser les ports `3000`, `3001`, `3002`, `3004`, `5555`, `8025`, `11434`, `11436`, `8088` deja utilises ou reserves par `comps`

## Ou ouvrir le projet

Ouvrir directement :

- `C:\\Users\\sebas\\RepoSeb\\inventory-app\\inventory-app.code-workspace`

et non le dossier `comps`, pour eviter toute confusion de contexte.
