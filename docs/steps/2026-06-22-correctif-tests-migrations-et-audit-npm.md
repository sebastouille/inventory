# Etape - Correctif tests migrations et audit npm

## Objectif

Corriger deux problemes de stabilisation :

- le test API complet echouait sur `test/prisma-migrations.spec.ts` car il pouvait heriter d un `DATABASE_URL` local pointant vers `127.0.0.1:5555` ;
- `npm install` signalait des vulnerabilites npm et un warning `EBADENGINE`.

## Changements

- `test/prisma-migrations.spec.ts` utilise maintenant `PRISMA_GUARD_DATABASE_URL` si defini, sinon la base projet par defaut `postgresql://inventory:inventory@127.0.0.1:5560/inventory`.
- `@nestjs/swagger` est retire du runtime API pour supprimer la dependance vulnerable `js-yaml`.
- Les decorateurs Swagger utilises par les controleurs sont remplaces par un module local no-op `swagger-compat`.
- `PartialType` est maintenant importe depuis `@nestjs/mapped-types`.
- `next` est mis a jour en `16.2.9` dans `web`, `admin` et le peer `packages/ui`.
- `shadcn` est mis a jour en `4.11.0`, ce qui retire la chaine `mute-stream` et le warning `EBADENGINE`.
- `multer` est force en `2.2.0` dans le lockfile pour couvrir la faille transitive encore presente dans `@nestjs/platform-express@11.1.27`.

## Decision

La documentation Swagger `/api/docs` est desactivee en V1.

Raison :

- `@nestjs/swagger` dependait encore de `js-yaml 4.1.1`, signale par `npm audit` ;
- la surface Swagger n est pas critique pour l exploitation courante ;
- les annotations Swagger dans les controleurs ne doivent pas bloquer les builds, elles sont donc remplacees par des no-op locaux.

## Tests executes

- `cmd /c npm audit` : OK, 0 vulnerabilite
- `cmd /c npm ls multer next postcss @nestjs/swagger mute-stream` : OK
- `cmd /c npm run test:migrations --workspace api` : OK
- `cmd /c npm run test --workspace api` : OK
- `cmd /c npm run build --workspace api` : OK
- `cmd /c npm run build --workspace @inventory/shared` : OK
- `cmd /c npm run build --workspace @inventory/ui` : OK
- `cmd /c npm run build --workspace web` : OK
- `cmd /c npm run build --workspace admin` : OK
- `cmd /c npm run test --workspace @inventory/shared` : OK
- `cmd /c npm run test --workspace @inventory/ui` : OK
- `cmd /c npm run test --workspace web` : OK
- `cmd /c npm run test --workspace admin` : OK

## Travail differe

- Reintroduire une documentation OpenAPI si necessaire avec une chaine sans dependance vulnerable.
- Supprimer le patch lockfile `multer 2.2.0` quand `@nestjs/platform-express` publiera une version dependante de `multer >= 2.2.0`.
