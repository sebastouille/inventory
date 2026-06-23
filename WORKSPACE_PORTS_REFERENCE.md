# Workspace ports reference

Ce workspace n'est pas la source de verite pour les ports.

La reference commune se trouve ici :

- `C:\Users\sebas\RepoSeb\PROJECT_PORTS.md`

Projet courant : `inventory-app`

Ports associes :

- `3010` web
- `3011` api
- `3014` admin
- `5560` postgres
- `1035` mailpit smtp
- `8035` mailpit ui

Ce projet est deja aligne sur ces ports dans :

- `.env.example`
- `.env.local`
- `apps/web/package.json`
- `apps/admin/package.json`
- `apps/api/package.json`
- `docker-compose.yml`
- `docker-compose.prod.yml`

Si tu modifies les ports de `inventory-app`, mets d'abord a jour :

1. `C:\Users\sebas\RepoSeb\PROJECT_PORTS.md`
2. puis les fichiers du projet
