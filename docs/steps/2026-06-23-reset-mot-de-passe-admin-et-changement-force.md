# reset mot de passe admin et changement force

## Objectif

Ajouter un flux V1 de reinitialisation admin du mot de passe avec mot de passe temporaire et changement force au prochain login sur `apps/admin` et `apps/web`.

## Perimetre

- dans le scope :
  - ajout du flag `User.mustChangePassword`
  - reset admin du mot de passe via IAM
  - challenge de login `PASSWORD_CHANGE_REQUIRED`
  - endpoint de completion du changement force
  - checklist de complexite et double saisie dans les formulaires admin et login
  - audit des resets admin et des changements effectifs
- hors scope :
  - email de reinitialisation
  - lien externe de recovery
  - invalidation immediate des JWT deja emis
  - historique des anciens mots de passe
  - expiration periodique obligatoire des mots de passe

## Contexte initial

- demande :
  - permettre a un admin de redefinir un mot de passe temporaire puis d obliger l utilisateur a changer ce mot de passe a la prochaine connexion
- etat existant :
  - le login renvoyait directement un `accessToken`
  - la creation utilisateur n imposait pas encore une checklist partagee en UI
  - aucun flag ne marquait un compte comme devant redefinir son mot de passe
- contraintes :
  - conserver un flux simple sans email
  - reutiliser la meme politique de complexite partout
  - ne pas casser les parcours de login normaux

## Plan

1. Ajouter le flag `mustChangePassword` et les contrats auth associes.
2. Faire evoluer le backend auth et IAM pour le reset admin et le challenge de changement force.
3. Brancher les UI `admin` et `web` avec checklist temps reel, confirmation et badge de suivi.
4. Documenter la decision et valider les builds/tests cibles.

## Questions ouvertes

- aucune pour la V1 implementee
- travail differe explicite :
  - faut il invalider a terme les sessions deja ouvertes au reset admin
  - faut il proposer ensuite un flux email ou un lien de recovery

## Hypotheses

- le mot de passe temporaire est transmis hors application par l administrateur
- le challenge de changement force peut reposer sur un JWT court dedie sans table supplementaire
- la politique de mot de passe est identique sur creation, reset et changement force

## Zones impactees

- backend :
  - `apps/api/src/auth/*`
  - `apps/api/src/iam/*`
- frontend :
  - `apps/admin/app/users/page.tsx`
  - `apps/admin/app/users/[id]/page.tsx`
  - `apps/admin/components/login-card.tsx`
  - `apps/web/components/login-card.tsx`
  - `packages/ui/src/components/*password*`
- base de donnees :
  - `prisma/schema.prisma`
  - migration `20260623110000_user_must_change_password`
- infrastructure :
  - aucune
- documentation :
  - ADR auth
  - spec fonctionnelle
  - architecture technique
  - modele de donnees
  - backlog implementation

## Tests prevus

- `prisma validate`
- build `@inventory/shared`
- test `@inventory/shared`
- build `@inventory/ui`
- build `api`
- tests API cibles auth/IAM
- build `web`
- build `admin`

## Criteres d'acceptation

- un admin peut reinitialiser un mot de passe depuis la liste et la fiche utilisateur
- le mot de passe temporaire respecte la politique de complexite et la double saisie
- le login d un compte marque `mustChangePassword` ne renvoie pas de session applicative directe
- l utilisateur doit definir un nouveau mot de passe valide et different du temporaire avant ouverture de session
- le badge `mot de passe a redefinir` est visible cote admin
- les erreurs sont explicites en francais ASCII

## Decisions prises

- ajout de `User.mustChangePassword` comme source de verite du changement force
- reset admin V1 base sur un mot de passe temporaire choisi par l admin
- challenge de changement force sous forme de JWT dedie avec `purpose=PASSWORD_CHANGE`
- pas d invalidation immediate des sessions deja ouvertes en V1
- reutilisation stricte de la meme politique de complexite sur tous les flux mot de passe

## Notes d'implementation

- nouveaux contrats partages :
  - `packages/shared/src/auth.ts`
  - `packages/shared/src/password-policy.ts`
- nouveau helper backend :
  - `apps/api/src/auth/password-policy.ts`
- nouveau endpoint :
  - `POST /api/v1/auth/complete-password-change`
- nouveau endpoint IAM :
  - `POST /api/v1/iam/users/:id/reset-password`
- les deux frontends interpretent maintenant la reponse union du login :
  - `AUTHENTICATED`
  - `PASSWORD_CHANGE_REQUIRED`
- le composant partage `ForcedPasswordChangeCard` centralise la UI du changement force
- le composant partage `PasswordPolicyChecklist` centralise la checklist rouge/vert

## Suivi

- lot livre en V1
- suite potentielle :
  - invalidation selective des sessions actives
  - recovery email
  - historique et non reutilisation des anciens mots de passe
- maintenance associee :
  - le script `scripts/prisma-generate-safe.ps1` bloque maintenant les regenerations Prisma en mode `no-engine` et verifie que `copyEngine=true` apres generation
