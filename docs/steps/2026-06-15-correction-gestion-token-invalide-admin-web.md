# Correction gestion token invalide admin web

## Objectif

Corriger la gestion des tokens JWT invalides dans les clients `apps/admin` et `apps/web` pour eviter l affichage d erreurs JSON brutes et revenir proprement a l ecran de connexion.

## Perimetre

- dans le scope :
  - normalisation des erreurs API frontend
  - suppression automatique du token local sur `401`
  - synchronisation du state de session dans le meme onglet
  - test unitaire de non regression
  - mise a jour de la documentation d etat courant
- hors scope :
  - changement du backend JWT
  - refresh token
  - SSO ou federation d identite

## Contexte initial

- demande : l application d admin affiche `{"message":"Invalid token","error":"Unauthorized","statusCode":401}` a la place de revenir a la connexion
- etat existant :
  - `apiFetch` et `apiDownload` remontent le payload brut des erreurs HTTP
  - aucun nettoyage automatique du token local sur `401`
  - `useStoredToken` ecoute seulement l evenement navigateur `storage`, pas les changements dans le meme onglet
- contraintes :
  - ne pas casser le workflow JWT actuel
  - garder une implementation simple et locale aux clients Next
  - documenter le correctif dans le repo

## Plan

1. Mettre a jour les librairies API/session de `apps/admin` et `apps/web`.
2. Corriger les points de deconnexion directe pour reutiliser le meme mecanisme de session.
3. Ajouter un test unitaire qui echoue si un `401` ne vide pas le token et si le hook de session ne se resynchronise pas.

## Questions ouvertes

- aucune question bloquante pour ce correctif

## Hypotheses

- un token invalide ou obsolete doit etre traite comme une session terminee
- il est acceptable de renvoyer l utilisateur vers la connexion sans tentative de refresh token en V1

## Zones impactees

- backend : aucune
- frontend :
  - `apps/admin`
  - `apps/web`
- base de donnees : aucune
- infrastructure : aucune
- documentation :
  - fichier d etape courant
  - specification fonctionnelle
  - architecture technique

## Tests prevus

- test unitaire admin : `401` vide le token et remonte un message exploitable
- test unitaire admin : `useStoredToken` se met a jour dans le meme onglet
- verification des tests workspace admin et web

## Criteres d'acceptation

- un token invalide ne reste pas stocke apres un `401`
- l application d admin revient a l ecran de connexion au lieu d afficher le JSON brut
- les erreurs API affichent un message simple quand un payload JSON `message` est fourni
- le comportement est aligne entre `apps/admin` et `apps/web`

## Decisions prises

- correctif applique cote frontend sans changement de contrat backend
- alignement de `apps/web` sur le meme mecanisme car le bug de session est structurellement identique
- le navigateur embarque `iab` n etait pas disponible dans cet environnement Codex ; la verification finale a ete faite par tests unitaires, build et smoke HTTP local

## Notes d'implementation

- ajout d une classe `ApiError` et d un parsing de payload JSON pour remonter des messages simples
- purge automatique du token stocke sur tout `401` dans `apiFetch` et `apiDownload`
- emission d un evenement local de changement de token pour synchroniser `useStoredToken` dans le meme onglet
- alignement du logout admin avec `clearStoredToken`
- protection des pages admin pour ne pas afficher d erreur visible pendant l invalidation de session
- ajout d un test unitaire admin et web couvrant la purge du token et la resynchronisation du hook

## Suivi

- tests executes :
  - `npm run test --workspace admin`
  - `npm run test --workspace web`
  - `npm run build`
- verification locale :
  - `POST /api/v1/auth/login` valide avec le seed `demo-org` / `admin@demo.local`
  - `GET /api/v1/auth/me` avec bearer invalide renvoie bien `401`
  - `GET http://localhost:3014` repond `200`
- aucun travail differe identifie dans cette etape
