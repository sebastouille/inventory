# Specification fonctionnalite - F0 L02 import referentiels excel csv v1

## Objectif

Definir le comportement fonctionnel du moteur d import V1 permettant d initialiser et de mettre a jour les referentiels spatiaux, equipements et immobilisations a partir de fichiers Excel et CSV, sans format impose a l avance.

## Valeur metier

- permettre d initialiser rapidement le referentiel depuis des donnees heterogenes
- eviter le developpement d un import specifique par source
- rendre l outil exploitable avant l arrivee des imports IFC4
- conserver un mapping reutilisable par organisation et par source

## Acteurs

- administrateur
- gestionnaire patrimoine
- referent utilisateur integration

## Workflow principal

1. l utilisateur choisit un domaine cible :
   - spatial
   - equipements
   - immobilisations
2. l utilisateur charge un fichier `.xlsx` ou `.csv`
3. le systeme detecte les feuilles ou colonnes disponibles
4. l utilisateur choisit une feuille si necessaire
5. le systeme affiche un apercu des lignes source
6. l utilisateur cree ou recharge un profil de mapping
7. l utilisateur relie visuellement les colonnes source aux champs cibles
8. l utilisateur configure les transformations simples necessaires
9. le systeme valide le mapping et signale les erreurs bloquantes
10. l utilisateur lance une previsualisation de resultat
11. le systeme calcule les creations, mises a jour, rejets et conflits
12. l utilisateur execute l import
13. le systeme produit un rapport d execution et conserve l historique

## Cas limites

- colonnes source manquantes pour des champs obligatoires
- doublons dans le fichier source
- reference parent inexistante dans le spatial
- `internalCode` deja present sur un autre equipement
- code immobilisation inconnu ou duplique
- types de donnees incoherents
- import annule avant execution
- nouvelle execution sur un fichier deja importe

## Regles fonctionnelles

- aucun format de fichier impose en V1
- le mapping est sauvegardable comme profil reutilisable
- un profil est rattache a une organisation et a un domaine cible
- l import doit separer :
  - validation du mapping
  - previsualisation
  - execution
- les erreurs de ligne ne doivent pas rendre le rapport illisible
- les creations et mises a jour doivent etre distinguees
- les champs obligatoires different selon le domaine cible
- `internalCode` est la cle terrain unique pour les equipements
- `barcode` et `qrCode` ne font pas partie du schema cible V1
- la recherche future par code immobilisation doit etre preservee des l import initial

## Impact API

- API dediee aux profils, jobs, previews, validations, executions et rapports
- permissions metier dediees aux imports
- journalisation des actions sensibles d import

## Impact donnees

- nouvelles entites de profil, job, mapping et rapport d import
- alimentation des futurs domaines `spatial`, `equipments` et `immobilizations`

### Detail fonctionnel `spatial-nodes` pour F1-L02

- l utilisateur doit pouvoir mapper un fichier libre vers les champs :
  - `type`
  - `code`
  - `label`
  - `description`
  - `path`
  - `parentPath`
  - `externalRef`
  - `isActive`
- le systeme doit accepter des fichiers qui donnent soit :
  - le `path` complet
  - soit le couple `parentPath + code`
- le systeme doit refuser les fichiers qui ne permettent pas de reconstruire sans ambiguite l arborescence
- le systeme doit traiter les lignes par profondeur croissante pour garantir la creation des parents avant les enfants
- si une ligne parent du meme fichier est rejetee, les descendants dependants doivent etre rejetes a leur tour via l echec de resolution parent
- un import spatial V1 ne fait pas de versioning complet du referentiel
- un import spatial V1 doit conserver la provenance :
  - job d import
  - profil de mapping
  - source du fichier
- les lignes absentes d un reimport ne doivent pas etre archivees automatiquement en V1
- la reconciliation create/update se fait uniquement par `organizationId + path`

## Impact UI

- page `imports` remplace le placeholder actuel
- ecran de mapping visuel colonne -> champ
- ecran de preview avant execution
- ecran d historique et de rapports d import

## Questions ouvertes

- aucune question bloquante pour `F0-L02`
