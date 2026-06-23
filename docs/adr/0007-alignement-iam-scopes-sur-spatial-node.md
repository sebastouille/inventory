# ADR 0007 - alignement-iam-scopes-sur-spatial-node

## Statut

Accepted

## Contexte

Le lot `F1-L03` doit exposer le referentiel spatial stabilise aux utilisateurs et l aligner avec les regles de perimetre IAM. Le repo contient deja une table `IamAccessScope` semee de maniere autonome, alors que `F1-L02` a introduit `SpatialNode` comme source de verite du referentiel spatial.

Conserver deux hierarchies sans lien direct ferait persister :

- une duplication structurelle des noeuds ;
- des risques de divergence entre spatial et scopes IAM ;
- des affectations utilisateur basees sur des scopes non synchronises ;
- une complexite inutile pour les futures campagnes et selections de perimetre.

## Decision

L alignement `F1-L03` est fixe comme suit :

- `SpatialNode` devient la source de verite de la hierarchie spatiale ;
- `IamAccessScope` reste l objet porte par les affectations IAM, mais il est desormais synchronise depuis `SpatialNode` ;
- une liaison explicite `IamAccessScope.spatialNodeId` est ajoutee et rendue unique quand elle est renseignee ;
- les creations, mises a jour et archivages de `SpatialNode` doivent synchroniser le scope IAM correspondant ;
- la synchronisation IAM conserve les identifiants de scopes existants quand un scope peut etre rapproche par `organizationId + type + code`, afin de ne pas casser les affectations utilisateurs deja semees ;
- les ecrans et API IAM continuent de manipuler `IamAccessScope`, mais les donnees de ces scopes deviennent issues du spatial synchronise.

## Consequences

- positives :
  - un seul referentiel spatial pilote les perimetres IAM ;
  - les roles scopes restent compatibles avec l existant ;
  - les futures selections de perimetre terrain pourront reposer sur le meme arbre que le referentiel spatial ;
  - la synchronisation reste compatible avec les imports V1 et les futures extensions IFC4.
- negatives :
  - le CRUD spatial doit maintenant maintenir la coherence avec IAM ;
  - une migration additionnelle est necessaire sur `IamAccessScope` ;
  - les tests doivent couvrir la synchronisation et les cas de rapprochement legacy.
- neutres :
  - `IamAccessScope` n est pas supprime dans `F1-L03` ;
  - l edition des roles utilisateurs continue de cibler `IamAccessScope`.

## Alternatives considerees

### Option A

- pour :
  - remplacer integralement `IamAccessScope` par `SpatialNode`
- contre :
  - l impact sur les affectations IAM existantes serait plus risquee ;
  - cela imposerait une refonte plus large que `F1-L03`.

### Option B

- pour :
  - laisser `IamAccessScope` vivre sans lien avec `SpatialNode`
- contre :
  - la divergence de donnees resterait structurelle ;
  - le besoin de synchronisation reapparaitrait plus tard sous une forme plus couteuse.

## Actions de suivi

- ajouter `spatialNodeId` dans `IamAccessScope`
- synchroniser les scopes lors des mutations spatiales
- enrichir les API et UI IAM avec les metadonnees spatiales utiles
- basculer progressivement les pages operateur vers la selection de perimetre issue du spatial
