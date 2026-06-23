# ADR 0022 - reset admin mot de passe avec changement force

## Statut

Accepted

## Contexte

L application devait permettre a un administrateur de reinitialiser le mot de passe d un utilisateur sans passer par email ni lien externe. Le besoin metier impose aussi que ce mot de passe temporaire ne devienne pas le mot de passe definitif de l utilisateur.

Le systeme existant retournait directement un JWT applicatif au login, sans etape intermediaire. Aucun flag ne permettait de marquer un compte comme devant redefinir son mot de passe. La creation utilisateur et les ecrans admin n etaient pas encore alignes sur une politique de complexite unique visible en temps reel.

## Decision

Nous introduisons une V1 simple basee sur :

- un flag persiste `User.mustChangePassword`
- un reset admin qui remplace directement `passwordHash` par un mot de passe temporaire choisi par l admin
- une reponse union de `POST /api/v1/auth/login`
  - `AUTHENTICATED`
  - `PASSWORD_CHANGE_REQUIRED`
- un JWT dedie de courte duree pour le challenge de changement force, avec `purpose=PASSWORD_CHANGE`
- un endpoint `POST /api/v1/auth/complete-password-change`
- une politique de mot de passe partagee entre creation utilisateur, reset admin et changement force

Le challenge dedie ne donne acces a aucun endpoint applicatif standard. Il sert uniquement a autoriser la completion du changement de mot de passe.

La V1 ne coupe pas immediatement les JWT deja ouverts. L obligation s applique a la prochaine authentification.

## Consequences

- positives :
  - flux simple a comprendre et a exploiter par les administrateurs
  - pas de dependance email ou fournisseur externe
  - comportement identique sur `apps/admin` et `apps/web`
  - politique de mot de passe unifiee et visible en temps reel
  - audit explicite des resets admin et des changements de mot de passe
- negatives :
  - un utilisateur deja connecte reste connecte jusqu a expiration ou deconnexion
  - le mot de passe temporaire doit etre transmis hors application
  - absence de mecanisme de recovery autonome pour l utilisateur final
- neutres :
  - pas de table supplementaire de token persiste en V1
  - le `passwordHash` reste la seule source de verite du secret courant

## Alternatives considerees

### Option A

- pour :
  - reset admin par mot de passe temporaire et changement force
  - faible cout d implementation
  - pas d integration externe
- contre :
  - transfert manuel du mot de passe temporaire
  - sessions existantes non coupees en V1

### Option B

- pour :
  - lien email one-shot avec token persiste
  - meilleure autonomie utilisateur
- contre :
  - plus couteux
  - depend d une brique email absente du scope actuel
  - augmente la surface de securite et l exploitation

## Actions de suivi

- evaluer une V2 d invalidation des sessions actives apres reset admin
- evaluer une V2 de recovery email ou lien externe
- evaluer une V2 de non reutilisation des anciens mots de passe
