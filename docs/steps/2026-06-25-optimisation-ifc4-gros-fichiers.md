# Optimisation IFC4 gros fichiers et profil d import

## Objectif

Optimiser l analyse IFC4 pour les fichiers volumineux en limitant le volume traite, en filtrant les classes avant extraction geometrique, en proposant un profil d import, et en ecrivant des artefacts progressifs hors base.

## Perimetre

- dans le scope :
  - parse rapide du fichier IFC4 avant extraction geometrique
  - selection des classes IFC par cases a cocher apres detection
  - `maxProducts` saisi avant lancement, defaut `5000`
  - niveau de geometrie `NONE`, `MINIMUM`, `INTERMEDIATE`
  - filtrage des classes IFC avant extraction geometrie
  - artefacts NDJSON progressifs sous `.runtime/imports`
  - file locale de traitement IFC4
  - logs worker conserves et affiches
  - timeout worker a 1h par defaut
  - annulation utilisateur avec arret du process Python actif
- hors scope :
  - Redis ou queue externe
  - vrai maillage BIM
  - mode hors heures ouvrables

## Contexte initial

- un fichier IFC de 130 Mo a depasse le timeout de 30 minutes pendant `extract_product_geometry`.
- le worker traitait `IfcElement` de facon trop large et la limite `maxProducts=20000` ne reduisait pas le fichier teste.
- les logs sont persistants et affiches, mais le worker n emet que des jalons.

## Plan

1. Ajouter un profil IFC4 cote contrats et UI.
2. Ajouter une etape `quick-parse` qui stocke le fichier, lit les classes IFC et retourne les compteurs sans geometrie.
3. Faire passer `maxProducts`, `selectedClasses`, `geometryLevel` et `maxShapeParts` au worker.
4. Filtrer les produits IFC par classe avant `create_shape`.
5. Ajouter des fichiers NDJSON progressifs metadata/geometrie.
6. Ajouter une file locale a concurrence configurable.
7. Ajouter l annulation du process IFC4 depuis le badge `RUNNING`.
8. Mettre a jour documentation et tests.

## Hypotheses

- le niveau `INTERMEDIATE` reste une geometrie simplifiee issue de sous-boites, pas un mesh.
- les artefacts volumineux restent hors base.
- le job `ifc4-analysis` reste la preparation des jobs `spatial-nodes` et `equipments`.

## Criteres d'acceptation

- la valeur par defaut `maxProducts` est `5000`.
- le parse rapide affiche les classes IFC detectees avant la previsualisation complete.
- la selection des classes se fait par cases a cocher.
- les classes selectionnees sont filtrees avant extraction geometrique.
- le mode `NONE` ne calcule pas de geometrie et permet une preview rapide.
- le mode `MINIMUM` conserve les bounding boxes.
- le mode `INTERMEDIATE` ajoute des sous-boites limitees par `maxShapeParts`.
- les logs restent visibles dans la fenetre worker.
- le timeout worker vaut `3600000` ms par defaut.
- un clic sur le badge `RUNNING` annule le job IFC4 et tente de tuer le process Python actif.

## Notes d'implementation

- contrats partages enrichis avec `Ifc4AnalysisProfile` et `Ifc4GeometryLevel`.
- l UI imports affiche un profil avant lancement avec `maxProducts`, `geometryLevel` et `maxShapeParts`.
- l UI imports lance maintenant un parse rapide avant la previsualisation complete.
- le parse rapide cree un job `ifc4-analysis`, stocke le fichier IFC et met le job en `READY`.
- la previsualisation complete est lancee ensuite depuis le meme job avec `POST /imports/ifc4/analyze-jobs/:jobId/start`.
- les classes IFC detectees sont affichees en cases a cocher avec leurs compteurs.
- le bouton `Parser les classes IFC` est place dans le groupe `Profil d import IFC4`, avant l arbre des classes.
- les classes IFC sont regroupees dans une arborescence deployable par familles IFC, avec cases a cocher au niveau groupe et au niveau classe.
- le bouton `Lancer la previsualisation IFC4` peut s activer depuis le resultat `quick-parse` meme si `currentJob` local conserve un ancien statut.
- une previsualisation IFC4 peut etre relancee depuis un job `CANCELLED`, car le fichier source est deja stocke et le job repasse alors en `RUNNING`.
- `maxProducts` vaut `5000` par defaut cote UI, cote API et cote worker Python.
- le timeout IfcOpenShell vaut `3600000` ms par defaut.
- le worker Python recoit les classes selectionnees et les filtre avant `create_shape`.
- le niveau `NONE` ouvre une preview sans extraction geometrique et ne signale pas de faux manque de geometrie.
- le niveau `MINIMUM` calcule les bounding boxes monde.
- le niveau `INTERMEDIATE` ajoute des sous-boites simplifiees limitees par `maxShapeParts`.
- le worker ecrit deux flux NDJSON progressifs : metadata et geometrie.
- l API stocke les references d artefacts dans le resultat d analyse et garde le JSON final pour compatibilite avec la preview actuelle.
- les analyses IFC4 sont passees dans une file locale in-process, avec concurrence configurable par `IFC_JOB_CONCURRENCY`.
- `POST /imports/ifc4/analyze-jobs/:jobId/cancel` marque le job `CANCELLED`, retire le job de la file si possible et tue le process Python actif si present.
- le badge `RUNNING` du panneau de logs declenche cette annulation apres confirmation.
- les logs ne sont pas reduits : toutes les lignes JSON emises par le worker sont persistantes en `ImportJobLog` et affichees dans la fenetre de logs du job. Si l affichage semble pauvre, c est que le worker emet seulement des jalons.

## Tests executes

- `python -m py_compile apps/api/workers/ifc_geometry/extract_scene.py`
- `npm run build --workspace @inventory/shared`
- `npm run build --workspace api`
- `npm run build --workspace web`
- `npm run build --workspace admin`
- `npm run test --workspace api`
- `npm run test:migrations --workspace api`
- `git diff --check`

## Limites restantes

- les flux NDJSON progressifs sont disponibles, mais la preview consomme encore un JSON final complet pour rester compatible avec les ecrans existants.
- les profils IFC4 ne sont pas encore persistants par organisation.
- la file locale ne coordonne pas plusieurs instances API.
