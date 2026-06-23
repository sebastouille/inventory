# ADR 0018 - Retrait Swagger runtime pour audit npm

## Statut

Accepte

## Contexte

`npm audit` signalait une vulnerabilite `js-yaml` via `@nestjs/swagger`. La version amont disponible de `@nestjs/swagger` depend encore de `js-yaml 4.1.1`, et `npm audit fix --force` proposait un downgrade majeur incoherent avec Nest 11.

## Decision

Retirer `@nestjs/swagger` du runtime API V1.

Les imports de decorateurs Swagger sont remplaces par `apps/api/src/swagger-compat.ts`, qui expose des decorateurs no-op suffisants pour conserver le code existant.

`PartialType` est remplace par `@nestjs/mapped-types`.

## Consequences

- `/api/docs` n est plus expose.
- Le build API ne depend plus de `@nestjs/swagger`.
- `npm audit` passe a 0 vulnerabilite avec les autres corrections de dependances.
- Une future documentation OpenAPI devra etre reintroduite avec une chaine de dependances auditable.
