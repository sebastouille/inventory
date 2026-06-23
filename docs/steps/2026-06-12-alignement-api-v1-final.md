# Alignement final API v1

## Objectif

Supprimer les dernieres references documentaires et de configuration vers l'ancien prefixe API `/api` pour ne garder que `/api/v1`.

## Perimetre

- dans le scope :
  - `docker-compose.prod.yml`
  - textes affiches dans le frontend web
  - ajout d'un test de garde
- hors scope :
  - changement du point d'entree Swagger `api/docs`
  - renommage des imports de fichiers `lib/api`

## Contexte initial

- demande : corriger les dernieres occurrences `/api` restantes et verifier par rebuild et execution
- etat existant : clients runtime deja alignes en `/api/v1`, mais valeurs prod et certains textes UI restaient en `/api`
- contraintes : ne pas casser Swagger ni produire de faux positifs sur `apps/api` ou `lib/api`

## Plan

1. filtrer les vraies occurrences legacy
2. corriger les fichiers de configuration et les textes UI
3. ajouter un test de garde
4. rebuild et verifier le comportement reseau

## Questions ouvertes

- aucune

## Hypotheses

- `api/docs` reste valide pour Swagger et ne doit pas etre remplace

## Zones impactees

- backend : aucune logique metier
- frontend : textes affiches et resolution d'URL
- base de donnees : aucune
- infrastructure : valeurs par defaut du compose prod
- documentation : backlog bug et dossier d'etape

## Tests prevus

- `npm test`
- `npm run build`
- verification reseau en navigateur local

## Criteres d'acceptation

- aucune reference legacy active vers `http://localhost:3011/api` ou `http://api:3011/api`
- toutes les references runtime utilisent `/api/v1`
- un test automatise protege contre la reintroduction du mauvais prefixe

## Decisions prises

- conserver `api/docs` comme endpoint Swagger
- ajouter un test de scan de fichiers plutot qu'un simple test de constante runtime

## Notes d'implementation

- references corrigees dans `docker-compose.prod.yml`
- references corrigees dans `apps/web/app/page.tsx` et `apps/web/app/settings/page.tsx`
- test ajoute dans `packages/shared/src/api-url-guard.spec.ts`
- correction du wiring Nest pour permettre le demarrage effectif de l'API avec les guards JWT et permissions
- correction du chemin de demarrage compile de l'API vers `dist/src/main.js`

## Suivi

- verifier en navigateur local que les requetes partent bien vers `/api/v1`
