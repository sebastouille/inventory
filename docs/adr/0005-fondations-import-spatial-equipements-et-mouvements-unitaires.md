# ADR 0005 - fondations-import-spatial-equipements-et-mouvements-unitaires

## Statut

Accepted

## Contexte

Le repo doit maintenant passer d une base patrimoniale partielle a un socle metier stable avant toute implementation des workflows de campagnes, d anomalies, de rapprochement et d inventaire terrain complet. Les arbitrages utilisateur confirment que les fondations doivent d abord traiter l import ETL Excel/CSV, le referentiel spatial, le referentiel equipements, le lien comptable SINERGI/SAP, et le journal de mouvements unitaires.

## Decision

Les fondations sont fixees comme suit :

- V1 alimente les referentiels spatial et equipements via import Excel/CSV avec moteur ETL visuel et profils reutilisables par organisation ;
- l exploration par arborescence IFC4 et le rendu graphique sont differees en V2 ;
- `internalCode` devient la cle terrain unique a encoder, imprimer et scanner ;
- les colonnes `barcode` et `qrCode` sont retirees du schema cible et ne portent plus la cle terrain ;
- `serialNumber` reste le numero constructeur eventuel, capture comme donnee de reference a la reception ;
- une entite comptable distincte doit representer les immobilisations avec relation `1 immobilisation -> n equipements` possible ;
- tout changement de localisation ou d affectation d un equipement cree automatiquement une entree dans le journal des mouvements ;
- le referentiel spatial doit devenir hierarchique et s aligner avec les scopes IAM ;
- le referentiel spatial V1 repose sur une table unique `SpatialNode` avec champ `type` et relation `parentId` ;
- l unicite spatiale V1 est portee par `organizationId + parentId + code`, avec un `path` logique unique par organisation ;
- le lien ETL parent V1 repose d abord sur `parentPath`, avec reconstruction possible via `path`, et sans dependre de `parentInternalCode` ;
- le referentiel spatial V1 ne met pas en place de versioning fort ; il historise la provenance d import et s appuie sur l audit de changement ;
- les workflows de campagnes ne demarrent qu apres stabilisation des fondations `F0/F1/F2`.

## Consequences

- positives :
  - la priorite des chantiers est nette et executable ;
  - le moteur d import devient reutilisable pour plusieurs domaines ;
  - la separation entre patrimoine unitaire et stock produits est renforcee ;
  - le futur rapprochement comptable repose sur une vraie entite metier.
- negatives :
  - la migration du modele spatial est transverse et couteuse ;
  - les modules `inventory` et `stock-movements` actuels devront etre refondus ou contournes ;
  - la suppression de `barcode` et `qrCode` impose une migration de donnees et de contrats front/back sans ambiguite.
- neutres :
  - l exposition MCP future n est pas remise en cause ;
  - les workflows riches restent differees jusqu a stabilisation du socle.

## Alternatives considerees

### Option A

- pour :
  - commencer directement par les workflows de campagnes et anomalies
- contre :
  - les workflows reposeraient sur des referentiels instables ;
  - les risques de rework schema et API seraient eleves.

### Option B

- pour :
  - utiliser Archicad ou IFC4 comme premiere source unique des fondations
- contre :
  - la mise en oeuvre serait plus lourde et moins progressive ;
  - le besoin d initialisation generique Excel/CSV resterait entier.

## Actions de suivi

- decomposer `F0/F1/F2` en lots d implementation versionnes
- traiter en premier le moteur ETL et le nouveau referentiel spatial
- introduire ensuite le noyau equipements, immobilisations et mouvements unitaires
- retirer proprement `barcode` et `qrCode` dans les contrats et migrations cibles
