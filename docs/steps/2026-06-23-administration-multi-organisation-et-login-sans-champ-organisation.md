# administration multi-organisation et login sans champ organisation

## Objectif

Planifier l evolution du back-office et du login pour :

- administrer plusieurs organisations depuis `apps/admin`
- permettre la creation d utilisateurs dans une organisation cible choisie
- supprimer le champ organisation a la connexion en deduisant l organisation depuis le login

## Perimetre

- dans le scope :
  - page admin `organizations`
  - creation d organisation
  - edition du nom d organisation
  - creation de compte dans une organisation cible
  - refonte du contrat de login
  - adaptation du menu admin et des permissions de surface
- hors scope :
  - federation SSO
  - invitation email
  - fusion ou migration de donnees inter-organisations
  - gestion fine des delegations inter-tenant autres que les permissions existantes

## Contexte initial

- demande :
  - un utilisateur avec droits d administration des organisations doit pouvoir acceder a une vraie page `organizations`, modifier le nom d une organisation et creer une nouvelle organisation
  - un admin doit pouvoir creer un utilisateur dans une organisation autre que son organisation courante
  - a la connexion, le champ organisation ne doit plus etre visible ; l organisation doit etre deduite du login
- etat existant :
  - `apps/admin/app/organizations/page.tsx` est une page read-only du tenant courant, sans liste, sans creation, sans edition
  - `apps/api/src/organizations/organizations.controller.ts` expose seulement `GET /organizations/current` et des `PATCH` sur les settings du tenant courant
  - `apps/admin/app/users/page.tsx` cree un utilisateur uniquement dans `auth.organizationId`
  - `packages/shared/src/iam.ts` ne porte pas de `organizationId` dans `CreateUserInput`
  - `apps/api/src/iam/iam.service.ts#createUser` force `organizationId: auth.organizationId`
  - `packages/ui/src/components/auth-login-card.tsx` affiche le champ organisation
  - `apps/api/src/auth/login.dto.ts` exige `organizationSlug`
  - la contrainte de base sur `User` est `@@unique([organizationId, email])` et non une unicite globale de `email`
- contraintes :
  - ne pas casser le multi-tenant hermetique
  - garder un login simple
  - conserver une authorization explicite par permissions existantes `organizations.read` et `organizations.update`
  - supprimer le champ organisation a l ecran impose une nouvelle regle d unicite ou une nouvelle cle de login

## Plan

1. Etendre le domaine `organizations` avec une vraie administration plateforme :
   - liste paginee des organisations
   - creation
   - edition minimale du nom
   - conservation du slug comme identifiant technique stable
2. Faire evoluer la creation utilisateur pour accepter une `targetOrganizationId` sous controle des permissions.
3. Refondre le login pour ne plus demander `organizationSlug`.
4. Rebrancher les ecrans admin et le menu selon les permissions reelles.
5. Ajouter tests et documentation d architecture associes.

## Questions ouvertes

- question structurante :
  - comment deduire l organisation a partir du seul login sans ambiguite
- options possibles :
  - option A recommandee : imposer `email` unique globalement sur toute la plateforme
  - option B : introduire un `loginIdentifier` global unique distinct de `email`
  - option C : tenter une deduction heuristique par domaine email ou annuaire externe
- recommandation :
  - retenir l option A ou B
  - ne pas retenir l option C en V1 car elle est fragile et non deterministe

## Hypotheses

- le besoin "deduit du login" vise un identifiant saisi par l utilisateur final, pas une memoire locale du dernier tenant
- le `slug` d organisation doit rester stable et non editable librement dans cette vague
- la creation d organisation peut rester minimale : `name`, `slug`, `settings` par defaut

## Zones impactees

- backend :
  - `apps/api/src/organizations/*`
  - `apps/api/src/iam/*`
  - `apps/api/src/auth/*`
- frontend :
  - `apps/admin/app/organizations/page.tsx`
  - `apps/admin/app/users/page.tsx`
  - `apps/admin/components/admin-shell.tsx`
  - `packages/ui/src/components/auth-login-card.tsx`
  - `apps/admin/components/login-card.tsx`
  - `apps/web/components/login-card.tsx`
- base de donnees :
  - `Organization`
  - `User`
  - eventuelle migration d unicite globale sur `User.email` ou ajout d un champ `loginIdentifier`
- infrastructure :
  - aucune obligatoire si on reste sur login mot de passe local
- documentation :
  - spec fonctionnelle
  - architecture technique
  - modele de donnees
  - ADR dedie sur l identifiant de login

## Tests prevus

- backend :
  - lecture liste organisations avec `organizations.read`
  - creation organisation avec `organizations.update`
  - update nom organisation avec `organizations.update`
  - creation utilisateur dans une organisation cible autorisee
  - refus de creation utilisateur si organisation cible inconnue
  - login sans champ organisation
  - rejet si identifiant de login ambigu
- frontend :
  - page `organizations` visible et exploitable pour un administrateur autorise
  - formulaire user avec select organisation
  - ecran login sans champ organisation
  - messages d erreur explicites si login introuvable ou ambigu

## Criteres d'acceptation

- un administrateur plateforme peut lister les organisations, creer une organisation et renommer une organisation
- un administrateur autorise peut choisir l organisation cible lors de la creation d un utilisateur
- le login ne demande plus l organisation a l utilisateur final
- la resolution d organisation au login est deterministe
- aucun utilisateur d une organisation ne peut lire ou modifier les donnees d une autre organisation sans permission explicite

## Decisions prises

- aucune decision d architecture finale non codee a ce stade
- point a arbitrer avant implementation :
  - unicite globale de `email` ou `loginIdentifier` dedie

## Notes d'implementation

- comparaison d etat courant :
  - `organizations` est aujourd hui un ecran de contexte courant, pas un CRUD
  - `users` est aujourd hui mono-organisation
  - `login` est aujourd hui couple a `organizationSlug`
- sequence d implementation recommandee :
  1. ADR sur l identifiant de login
  2. schema et API `organizations`
  3. schema et API `users` multi-organisation
  4. UI admin `organizations`
  5. UI admin `users`
  6. refonte login admin/web
  7. migration de donnees et tests de non ambiguite

## Suivi

- si l option A est retenue :
  - prevoir un audit des doublons `email` inter-organisations avant migration
- si l option B est retenue :
  - prevoir un champ renseigne au seed et a la creation utilisateur
