# ADR 0012 - Immobilization comptable distincte

## Statut

Accepted

## Contexte

Le produit doit gerer des equipements physiques unitaires et des donnees comptables issues de systemes comme SINERGI ou SAP. Une meme immobilisation comptable peut temporairement couvrir plusieurs equipements physiques. La cible long terme est de nettoyer progressivement les donnees pour aller vers une correspondance plus fine, mais cette contrainte ne peut pas etre imposee au demarrage.

## Decision

Creer une entite `Immobilization` distincte de `Equipment`.

La relation V1 est :

- une organisation possede plusieurs immobilisations ;
- une immobilisation peut etre rattachee a plusieurs equipements ;
- un equipement peut ne pas avoir d immobilisation ;
- un equipement reference au plus une immobilisation courante via `Equipment.immobilizationId`.

`Immobilization.code` est unique par organisation et devient la cle de recherche comptable V1. Les imports `immobilizations` et `equipments` restent prepares mais non executes reellement dans ce lot.

## Consequences

- positives :
  - separation nette entre patrimoine physique et referentiel comptable ;
  - recherche des equipements par code immobilisation ;
  - preparation simple de l import `immobilizationCode` pour F2-L04 ;
  - support explicite du cas 1 immobilisation vers n equipements.
- negatives :
  - pas de rapprochement automatique en V1 ;
  - une immobilisation archivee peut rester rattachee a des equipements ;
  - il faudra ajouter plus tard des controles de convergence.
- neutres :
  - les permissions existantes `assets.read` et `assets.update` couvrent la V1.

## Alternatives considerees

### Option A - Stocker le code immobilisation directement sur Equipment

- pour :
  - implementation plus rapide.
- contre :
  - duplication des informations comptables ;
  - pas de referentiel administrable ;
  - pas de compteur fiable d equipements par immobilisation ;
  - rapprochement futur plus difficile.

### Option B - Forcer 1 immobilisation = 1 equipement des maintenant

- pour :
  - modele strict et cible.
- contre :
  - incompatible avec les donnees existantes ;
  - bloque l initialisation depuis SINERGI/SAP ;
  - impose un nettoyage metier avant que l outil puisse servir.

## Actions de suivi

- Brancher l import reel `immobilizations` dans F2-L04.
- Brancher la resolution `immobilizationCode` dans l import `equipments`.
- Ajouter plus tard un tableau de rapprochement et un indicateur de convergence `1 immobilisation = 1 equipement`.
