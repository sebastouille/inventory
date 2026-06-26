# Analyse IFC4 en job batch asynchrone persistant

## Objectif

Remplacer l analyse IFC4 synchrone par un job batch persistant, visible dans l historique des imports, avec des logs detailles du worker Python.

## Perimetre

- dans le scope : creation d un job d analyse IFC4, stockage disque du fichier, execution Python en arriere-plan, logs persistants, polling UI, reutilisation du resultat pour creer les jobs spatial et equipements.
- hors scope : queue externe Redis, execution distribuee, WebSocket, optimisation fine du parsing IFC.

## Contexte initial

- demande : les gros fichiers IFC peuvent prendre longtemps et ne doivent plus dependre d une requete HTTP longue.
- etat existant : `POST /api/v1/imports/ifc4/analyze` lance IfcOpenShell de facon synchrone.
- contraintes : erreurs explicites, pas de fallback silencieux, documentation en francais ASCII.

## Plan

1. Ajouter un domaine de job `ifc4-analysis` et un journal persistant `ImportJobLog`.
2. Ajouter les endpoints batch `analyze-jobs`, `logs` et `result`.
3. Faire streamer les logs du worker Python vers la base.
4. Adapter l assistant IFC4 pour lancer, suivre et exploiter un job d analyse.
5. Mettre a jour la documentation projet.

## Questions ouvertes

- aucune question bloquante.

## Hypotheses

- pas de queue externe en V1.
- reprise automatique des jobs IFC4 `RUNNING` si le fichier source existe encore.
- les jobs d ecriture `spatial-nodes` et `equipments` restent separes du job d analyse.

## Zones impactees

- backend : imports, assistant IFC4, worker IfcOpenShell, contrats API.
- frontend : page imports et assistant IFC4.
- base de donnees : enum cible import, table `import_job_logs`.
- infrastructure : variables d environnement du worker Python.
- documentation : specifications, architecture, modele de donnees, ADR.

## Tests prevus

- build shared, API et web.
- test migrations Prisma.
- tests unitaires API existants.
- verification du worker Python.

## Criteres d'acceptation

- un gros fichier IFC lance un job sans attendre la fin de l analyse.
- les logs du worker sont visibles pendant le traitement.
- le resultat d analyse est lisible apres completion.
- les erreurs passent le job en `FAILED` avec diagnostic.
- les jobs spatial et equipements sont crees depuis le resultat d analyse.

## Decisions prises

- utiliser `ImportJob` pour l analyse IFC4.
- ajouter `ifc4-analysis` comme cible non executable.
- stocker les logs en base et le resultat complet en fichier runtime.
- utiliser le polling HTTP plutot que WebSocket/SSE.

## Notes d'implementation

- migration Prisma `20260625100000_ifc4_analysis_jobs` ajoute `IFC4_ANALYSIS` et `import_job_logs`.
- le nouveau endpoint `POST /api/v1/imports/ifc4/analyze-jobs` stocke le fichier en disque et retourne un job immediatement.
- le worker Python emet des logs JSON par etape, captures par le backend et affiches dans la page imports.
- les actions de creation spatial/equipements utilisent le resultat du job d analyse au lieu de re-uploader le fichier.
- les endpoints synchrones historiques restent presents pour compatibilite mais ne sont plus utilises par l UI principale.
- le script `db:migrate` applique maintenant les migrations versionnees avec `prisma migrate deploy` pour eviter un reset local quand une ancienne migration appliquee a un checksum different.

## Suivi

- valider sur un fichier IFC volumineux en environnement cible.
- tests executes : build shared, build api, build web, tests api, test migrations, compilation Python.
