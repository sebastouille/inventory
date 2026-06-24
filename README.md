# inventory-app

Application d'inventaire multientreprise basee sur un monorepo Node.js avec :

- `apps/web` : frontend operateur Next.js sur `http://localhost:3010`
- `apps/api` : API NestJS sur `http://localhost:3011/api/v1`
- `apps/admin` : back-office Next.js sur `http://localhost:3014`
- `prisma/` : schema, migrations et seed
- PostgreSQL Docker sur `127.0.0.1:5560`
- Mailpit sur `http://localhost:8035`

Les ports sont volontairement differents de `comps` pour faire tourner les deux stacks en parallele, localement comme sur un meme serveur.

## Prerequis

- Node.js
- npm
- Docker Desktop / Docker Engine
- Git

## Mise en route locale

```powershell
docker compose up -d
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

## URLs locales

- Web : `http://localhost:3010`
- API : `http://localhost:3011/api/v1`
- Swagger : `http://localhost:3011/api/docs`
- Admin : `http://localhost:3014`
- Mailpit : `http://localhost:8035`

## Seed de demonstration

- Organization slug : `demo-org`
- Email : `admin@demo.local`
- Password : `ChangeMe123!`
- Role : `Administrateur`

## IAM / RBAC V1

L'etape de cartographie metier introduit :

- des roles metiers multi-affectables ;
- des permissions explicites ;
- des perimetres hierarchiques site/batiment/etage/zone/piece/emplacement ;
- des endpoints IAM sous `/api/v1/iam/*` ;
- un enrichissement de `/api/v1/auth/me` avec roles, permissions et affectations ;
- l'audit des modifications d'habilitation.

## Scripts utiles

```powershell
npm run clean
npm run clean:all
npm run dev
npm run build
npm run lint
npm run test
npm run db:generate
npm run db:migrate
npm run db:seed
npm run db:reset-test-imports-spatial
npm run prisma:studio
npm run stack:up
npm run stack:down
```

Notes :

- `npm run clean` ferme les process en ecoute sur les ports applicatifs du projet : `3010`, `3011`, `3014`
- `npm run clean:all` inclut aussi les ports d'infrastructure locaux : `5560`, `1035`, `8035`
- reset test imports + spatial :

```powershell
$env:CONFIRM_RESET_TEST_DATA="RESET"
npm run db:reset-test-imports-spatial
```

Ce script est destructif et cible la base locale de test. Il supprime :

- les `ImportJobWrite`
- les `ImportJob`
- les `ImportProfile`
- les `SpatialNode`
- les `IamAccessScope` derives du spatial
- les `IamUserRole` scopes sur ces scopes derives
- les `AuditLog` lies aux imports
- les artefacts `.runtime/imports`

## Gouvernance documentaire

Le repo inclut maintenant un workflow de documentation versionnee :

- vision produit : [VISION_PRODUIT.md](</c:/Users/sebas/RepoSeb/inventory-app/VISION_PRODUIT.md>)
- prompts Codex : [PROMPTS_CODEX.md](</c:/Users/sebas/RepoSeb/inventory-app/PROMPTS_CODEX.md>)
- vue d'ensemble : [PROJECT_OVERVIEW.md](</c:/Users/sebas/RepoSeb/inventory-app/PROJECT_OVERVIEW.md>)
- spec fonctionnelle : [FUNCTIONAL_SPEC.md](</c:/Users/sebas/RepoSeb/inventory-app/FUNCTIONAL_SPEC.md>)
- architecture technique : [TECHNICAL_ARCHITECTURE.md](</c:/Users/sebas/RepoSeb/inventory-app/TECHNICAL_ARCHITECTURE.md>)
- modele de donnees : [DATA_MODEL.md](</c:/Users/sebas/RepoSeb/inventory-app/DATA_MODEL.md>)
- ADR : [docs/adr/README.md](</c:/Users/sebas/RepoSeb/inventory-app/docs/adr/README.md>)
- dossiers d'etape : [docs/steps/README.md](</c:/Users/sebas/RepoSeb/inventory-app/docs/steps/README.md>)
- skill Codex repo-locale : [project-doc-governor](</c:/Users/sebas/RepoSeb/inventory-app/.codex/skills/project-doc-governor/SKILL.md>)

## Deploiement Dokploy / VPS Hostinger

Le projet inclut :

- `Dockerfile.api`
- `Dockerfile.web`
- `Dockerfile.admin`
- `docker-compose.prod.yml`
- `.env.prod.example`

Domaines cibles :

- web : `https://inventory.gestionai.fr`
- api : `https://api.inventory.gestionai.fr/api/v1`
- admin : `https://admin.inventory.gestionai.fr`

Variables minimales a renseigner dans Dokploy :

- `INVENTORY_POSTGRES_USER`
- `INVENTORY_POSTGRES_PASSWORD`
- `INVENTORY_POSTGRES_DB`
- `INVENTORY_DATABASE_URL`
- `NEXT_PUBLIC_API_URL`
- `API_BASE_URL`
- `NEXT_PUBLIC_WEB_APP_URL`
- `CORS_ALLOWED_ORIGINS`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`

`NEXT_PUBLIC_API_URL`, `API_BASE_URL` et `NEXT_PUBLIC_WEB_APP_URL` sont aussi transmis comme arguments de build Docker aux images `web` et `admin`. Dokploy doit donc reconstruire ces images apres modification de ces valeurs, car Next.js fige les variables `NEXT_PUBLIC_*` dans le bundle navigateur.

Variables de bootstrap production optionnelles :

- `INVENTORY_BOOTSTRAP_ENABLED`
- `INVENTORY_BOOTSTRAP_ORGANIZATION_NAME`
- `INVENTORY_BOOTSTRAP_ORGANIZATION_SLUG`
- `INVENTORY_BOOTSTRAP_ADMIN_EMAIL`
- `INVENTORY_BOOTSTRAP_ADMIN_PASSWORD`
- `INVENTORY_BOOTSTRAP_ADMIN_NAME`
- `INVENTORY_BOOTSTRAP_ADMIN_MUST_CHANGE_PASSWORD`

Ports internes Dokploy :

- `3010` pour `web`
- `3011` pour `api`
- `3014` pour `admin`

`docker-compose.prod.yml` expose ces ports aux routeurs Dokploy avec `expose` et ne publie pas de ports hote. Les identifiants demo `admin@demo.local / ChangeMe123!` restent reserves au seed local et sont refuses par le bootstrap production.
