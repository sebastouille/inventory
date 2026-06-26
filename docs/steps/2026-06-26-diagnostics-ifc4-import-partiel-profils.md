# Diagnostics IFC4, import partiel et profils assistant

## Objectif

Rendre l assistant IFC4 exploitable quand une partie seulement des objets a une geometrie valide, sans masquer les erreurs.

## Perimetre

- dans le scope : diagnostics geometrie detailles, import explicite des lignes OK, blocage des enfants dont le parent spatial est invalide, export CSV des anomalies, profils IFC4 dedies.
- hors scope : fallback geometrique, correction automatique du fichier IFC, modification du moteur IfcOpenShell.

## Contexte initial

- demande : importer les spatials OK avec des logs et diagnostics pour corriger les objets bloquants.
- etat existant : l analyse IFC4 expose deja `geometryStatus`, `geometryMessage`, bbox et dimensions, mais une seule geometrie invalide bloque toute la suite.
- contraintes : documentation en francais ASCII, pas de fallback masquant les erreurs, profils IFC4 separes des profils CSV/XLSX.

## Plan

1. Ajouter les contrats partages IFC4 pour politiques d import, diagnostics et profils assistant.
2. Ajouter le modele Prisma `Ifc4AssistantProfile` et sa migration.
3. Ajouter les endpoints de profils IFC4, diagnostics et export CSV.
4. Adapter l orchestration IFC4 pour `STRICT_ALL_READY` et `IMPORT_READY_ONLY`.
5. Afficher diagnostics, filtres, import partiel et profils dans l assistant web.
6. Ajouter les tests backend et frontend pertinents.

## Questions ouvertes

- aucune question bloquante.

## Hypotheses

- `STRICT_ALL_READY` reste le defaut.
- `IMPORT_READY_ONLY` doit etre choisi explicitement dans l UI.
- l export anomalies V1 est CSV.
- les anomalies sont recalculees depuis l artefact d analyse stocke.

## Zones impactees

- backend : module imports, service assistant IFC4, audit.
- frontend : page imports, assistant IFC4.
- base de donnees : nouveau modele `Ifc4AssistantProfile`.
- infrastructure : aucune.
- documentation : ADR, specs racine et backlog.

## Tests prevus

- migration Prisma sur base vide.
- CRUD profil IFC4.
- diagnostics geometrie et export CSV.
- import strict refuse les geometries invalides.
- import partiel cree un job avec uniquement les lignes importables.
- UI affiche diagnostics, filtres et profils.

## Criteres d'acceptation

- l utilisateur voit les objets IFC a corriger avec les informations utiles.
- l utilisateur peut importer uniquement les lignes OK.
- un enfant spatial est bloque si son parent est invalide.
- les anomalies sont exportables.
- un profil IFC4 peut etre sauvegarde, recharge et applique.

## Decisions prises

- creer `Ifc4AssistantProfile` au lieu de reutiliser `ImportProfile`.
- conserver le strict par defaut.
- ne pas ajouter de fallback geometrique.

## Notes d'implementation

- ajout du modele Prisma `Ifc4AssistantProfile` et de la migration `20260626100000_ifc4_assistant_profiles`.
- ajout des contrats partages `Ifc4ImportPolicy`, diagnostics geometrie et profils IFC4.
- ajout des endpoints profils IFC4, diagnostics et export CSV.
- ajout du mode `IMPORT_READY_ONLY` dans l assistant IFC4.
- les jobs enfants IFC4 stockent les diagnostics exclus dans `options.ifcGeometryExcludedDiagnostics` et le rapport est enrichi avec des lignes `REJECTED` synthetiques.
- l UI imports affiche le panneau diagnostics, les filtres `Tous / OK / A corriger`, l export anomalies et les profils IFC4.

## Suivi

- validations executees : `npm.cmd run build --workspace @inventory/shared`, `npm.cmd run db:generate --workspace api`, `npm.cmd run build --workspace api`, `npm.cmd run build --workspace web`, `npm.cmd run test:migrations --workspace api`, `npm.cmd run test --workspace api -- ifc4-assistant.service.spec.ts import-domain-services.spec.ts spatial.service.spec.ts`.
