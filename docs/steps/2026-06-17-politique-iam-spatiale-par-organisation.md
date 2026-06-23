# Politique IAM spatiale par organisation

## Objectif

Permettre a une organisation de choisir si les perimetres spatiaux IAM sont requis ou si, par defaut, les roles utilisateur valent sur tout le tenant.

## Perimetre

- dans le scope :
  - extension de `Organization.settings` avec une politique IAM spatiale
  - exposition du mode dans `/auth/me`
  - ecran admin settings pour modifier la politique
  - ajustement des ecrans admin users et web locations
  - ajustement de la purge des imports spatiaux
  - tests backend et UI cibles
- hors scope :
  - suppression des `IamAccessScope`
  - migration ou nettoyage automatique des affectations scopees existantes
  - refonte transverse de tous les futurs workflows metier non encore livres

## Contexte initial

- le modele supporte deja `IamUserRole.scopeId = null`
- l UI affiche aujourd hui `Global organisation`
- les scopes spatiaux restent synchronises depuis `SpatialNode`
- le filtrage effectif par perimetre est surtout visible dans `apps/web/app/locations/page.tsx`
- la purge V1 d import bloque actuellement sur des affectations scopees actives

## Plan

1. Etendre `Organization.settings` avec `iam.spatialScopePolicy`.
2. Introduire une normalisation backend unique des settings organisation.
3. Exposer le mode dans `/auth/me` et un indicateur derive `isOrganizationWideSpatialAccess`.
4. Ajouter l edition du mode dans `apps/admin/app/settings/page.tsx`.
5. Adapter l UX admin users pour afficher `Toute l organisation` et un bandeau informatif en mode global.
6. Adapter `apps/web/app/locations/page.tsx` pour ignorer les scopes en mode `ORGANIZATION_WIDE`.
7. Adapter la purge V1 pour ne plus bloquer sur les affectations scopees en mode global.

## Questions ouvertes

- aucune

## Hypotheses

- valeur par defaut : `SCOPED`
- les scopes explicites existants restent stockes
- en mode `ORGANIZATION_WIDE`, les scopes explicites sont ignores pour l acces effectif
- cette vague ne met pas en place une migration des affectations vers `scopeId = null`

## Zones impactees

- shared :
  - `packages/shared/src/organizations.ts`
  - `packages/shared/src/iam.ts`
- backend :
  - `apps/api/src/organizations/*`
  - `apps/api/src/auth/auth-context.service.ts`
  - `apps/api/src/auth/auth.types.ts`
  - `apps/api/src/spatial/spatial.service.ts`
- frontend admin :
  - `apps/admin/app/settings/page.tsx`
  - `apps/admin/app/users/page.tsx`
  - `apps/admin/app/users/[id]/page.tsx`
  - `apps/admin/components/iam/role-assignment-editor.tsx`
  - `apps/admin/app/organizations/page.tsx`
- frontend web :
  - `apps/web/app/locations/page.tsx`
- docs :
  - present fichier d etape
  - `FUNCTIONAL_SPEC.md`
  - `TECHNICAL_ARCHITECTURE.md`
  - `DATA_MODEL.md`
  - `IMPLEMENTATION_BACKLOG.md`
  - ADR associe

## Tests prevus

- `npm run build --workspace @inventory/shared`
- `npm run build --workspace api`
- `npm run build --workspace admin`
- `npm run build --workspace web`
- `npm run test --workspace api`
- tests unitaires UI admin cibles

## Criteres d'acceptation

- une organisation peut choisir `SCOPED` ou `ORGANIZATION_WIDE`
- `/auth/me` expose le mode effectif
- l admin peut modifier le mode depuis settings
- les ecrans users admin affichent `Toute l organisation`
- `locations` ne limite plus les perimetres aux scopes en mode global
- la purge V1 ne bloque plus sur des affectations scopees si l organisation est en mode global

## Decisions prises

- la valeur par defaut reste `SCOPED`
- le mode global n efface pas les scopes existants
- en mode `ORGANIZATION_WIDE`, les scopes sont conserves mais ignores pour l acces effectif
- la purge V1 ignore aussi les affectations scopees pour le blocage `HAS_SCOPE_ASSIGNMENTS` quand l organisation est en mode global

## Notes d'implementation

- ajout de `Organization.settings.iam.spatialScopePolicy` dans les contrats partages
- ajout d un helper backend de normalisation et validation des settings organisation
- ajout de `PATCH /api/v1/organizations/current/settings`
- `/auth/me` expose maintenant :
  - `organizationSettings`
  - `spatialScopePolicy`
  - `isOrganizationWideSpatialAccess`
- `apps/admin/app/settings/page.tsx` pilote maintenant a la fois :
  - les styles spatiaux
  - la politique IAM spatiale
- `RoleAssignmentEditor` affiche `Toute l organisation` et un bandeau explicatif en mode global
- `apps/web/app/locations/page.tsx` ignore les scopes pour le choix des perimetres quand le mode effectif est `ORGANIZATION_WIDE`
- `SpatialService.purgeCreatedDataForImportJob()` lit maintenant la politique de l organisation avant de bloquer sur les affectations scopees

## Suivi

- documents mis a jour :
  - `FUNCTIONAL_SPEC.md`
  - `TECHNICAL_ARCHITECTURE.md`
  - `DATA_MODEL.md`
  - `IMPLEMENTATION_BACKLOG.md`
  - `docs/adr/0009-politique-iam-spatiale-par-organisation.md`
- tests executes :
  - `npm run build --workspace @inventory/shared`
  - `npm run build --workspace api`
  - `npm run build --workspace admin`
  - `npm run build --workspace web`
  - `npm run test --workspace api`
