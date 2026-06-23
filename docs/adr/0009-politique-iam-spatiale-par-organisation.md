# 0009 - politique iam spatiale par organisation

## Statut

Accepted

## Contexte

Le modele IAM actuel combine :

- des roles portant les permissions ;
- des affectations utilisateur `IamUserRole` ;
- des scopes spatiaux `IamAccessScope` synchronises depuis `SpatialNode`.

Le systeme supporte deja `scopeId = null`, donc une affectation globale organisation existe deja techniquement.

Le besoin produit est de permettre a certaines organisations de fonctionner sans perimetres spatiaux obligatoires, tout en gardant le support des organisations qui veulent un cloisonnement fin.

## Decision

Nous ajoutons une politique d organisation :

- `SCOPED`
- `ORGANIZATION_WIDE`

Cette politique est stockee dans `Organization.settings.iam.spatialScopePolicy`.

Regles retenues :

- `SCOPED` :
  - comportement actuel
  - les scopes explicites participent au perimetre effectif
- `ORGANIZATION_WIDE` :
  - les scopes explicites existants sont conserves en base
  - mais ils sont ignores pour l acces effectif
  - seul `organizationId` borne alors le perimetre spatial

Le modele `IamAccessScope` n est pas supprime.

Les affectations existantes ne sont ni migrees ni nettoyees automatiquement dans cette vague.

## Consequences

Effets positifs :

- on simplifie l usage pour les organisations qui ne veulent pas gerer de perimetres fins ;
- on conserve la compatibilite avec le modele IAM existant ;
- on garde la possibilite de revenir plus tard a `SCOPED` sans perte des scopes historiques.

Couts et limites :

- certains scopes deviennent purement informatifs en mode `ORGANIZATION_WIDE` ;
- il faut exposer clairement le mode effectif dans `/auth/me` et dans l admin ;
- les futurs workflows metier devront reutiliser ce meme arbitre de perimetre et ne pas reinventer leur propre interpretation.

## Alternatives considerees

### Supprimer `IamAccessScope`

Rejetee :

- casserait le support du perimetre fin ;
- rendrait plus difficile un retour a un mode scope.

### Migrer toutes les affectations scopees vers des affectations globales

Rejetee en V1 :

- trop intrusive ;
- pas necessaire pour obtenir le comportement voulu.

### Ignorer le besoin et garder seulement `scopeId = null`

Rejetee :

- le comportement resterait implicite ;
- pas de signal clair au niveau organisation pour les ecrans et la purge.

## Actions de suivi

- factoriser a terme un helper transverse backend pour tous les futurs filtres spatiaux metier ;
- documenter dans le backlog la conversion optionnelle des scopes devenus inutiles en mode global ;
- reutiliser cette politique dans les futurs domaines `equipments`, `campaigns` et `anomalies`.
