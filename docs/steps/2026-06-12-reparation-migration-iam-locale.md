# reparation-migration-iam-locale

## Objectif

Remettre la base locale en phase avec le code IAM/RBAC afin de supprimer l'erreur Prisma sur `User.isActive` au login.

## Perimetre

- dans le scope :
  - correction de la migration Prisma `20260611150000_iam_rbac_v1`
  - correction du seed Prisma pour un lancement local fiable
  - reinitialisation de la base locale de developpement
  - verification du login API apres migration
- hors scope :
  - evolution fonctionnelle IAM supplementaire
  - changement de contrats API
  - migration de stack backend

## Contexte initial

- demande : corriger l'erreur `The column User.isActive does not exist in the current database`
- etat existant : le code NestJS/Prisma attend le schema IAM/RBAC V1, mais la migration locale n'a pas abouti et le seed echoue aussi
- contraintes : ne pas casser les migrations versionnees, rester compatible avec le workflow documentaire du repo

## Plan

1. corriger le SQL de migration qui bloque `prisma migrate deploy`
2. corriger le seed local pour retirer la dependance fragile au build de `packages/shared`
3. reinitialiser la base locale et rejouer migration + seed
4. verifier le login API et documenter le resultat

## Questions ouvertes

- aucune

## Hypotheses

- la base locale peut etre reinitialisee car elle ne contient pas encore de donnees metier a conserver

## Zones impactees

- backend : auth au login via Prisma
- frontend : aucune
- base de donnees : migration IAM/RBAC V1 et seed de demo
- infrastructure : PostgreSQL local sur `127.0.0.1:5560`
- documentation : present dossier d'etape

## Tests prevus

- `npx prisma migrate reset --force --schema prisma/schema.prisma`
- `npm run db:seed`
- verification du login API
- `npm run test:migrations --workspace api`

## Criteres d'acceptation

- la migration IAM s'applique sans erreur SQL
- le seed local s'execute sans erreur de resolution de module
- l'API ne remonte plus l'erreur Prisma sur `User.isActive` au login

## Decisions prises

- en environnement local de developpement, la remise en phase passe par un reset de base plutot que par une reparation incrementale de l'etat partiellement migre
- le seed Prisma embarque localement le catalogue IAM minimal pour ne pas dependre du build de `packages/shared` au moment du seed
- le test de migration est branche dans une passe CI GitHub Actions dediee plutot que dans `npm test` racine pour eviter de penaliser les developpeurs sans base locale lancee

## Notes d'implementation

- correction du SQL de migration : les requetes `INSERT ... SELECT` de backfill utilisent maintenant les alias de sous-requete `mappings` et `backfill` au lieu de references invalides a `r`, `p` et `u`
- correction de `prisma/seed.ts` : remplacement de l'import `@inventory/shared` par des constantes locales `IAM_ROLE_CODES` et `IAM_PERMISSION_CODES`
- ajout d'un test `apps/api/test/prisma-migrations.spec.ts` qui cree un schema PostgreSQL temporaire et valide `prisma migrate deploy` sur une base vide
- ajout de `.github/workflows/ci.yml` avec PostgreSQL de service et execution de `npm run test:migrations --workspace api`
- execution validee de `npx prisma migrate reset --force --schema prisma/schema.prisma`
- execution validee de `npm run db:seed`
- verification validee du login `POST /api/v1/auth/login` avec `admin@demo.local`
- execution validee de `npm run test:migrations --workspace api`

## Suivi

- si d'autres bases locales existent chez d'autres developpeurs, leur demander de relancer la migration proprement apres pull
- si une base distante partagee a deja ete marquee en echec sur cette migration, traiter son etat Prisma avant de deployer le correctif
