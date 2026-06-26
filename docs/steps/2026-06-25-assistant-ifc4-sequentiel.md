# Assistant IFC4 sequentiel

## Objectif

Transformer l assistant IFC4 en parcours metier vertical complet pour importer, dans l ordre, le referentiel spatial, les referentiels assets et les equipements issus d un fichier IFC4.

## Perimetre

- dans le scope :
  - parcours assistant vertical dans `apps/web`
  - pilotage des jobs enfants `spatial-nodes` et `equipments` depuis l assistant
  - etape explicite de creation des referentiels assets manquants
  - rapports lisibles avec `CREATE`, `UPDATE`, `NO_OP` et `REJECTED`
  - logs et annulation sur les traitements longs
- hors scope :
  - nouvelle queue externe Redis ou BullMQ
  - import objet par objet avec selection ligne par ligne
  - profils IFC4 persistants par organisation
  - changement du modele de donnees Prisma

## Contexte initial

- demande : rendre l assistant IFC4 conforme au besoin metier d import sequentiel de noeuds, references assets puis equipements.
- etat existant : le repo possede deja `quick-parse`, analyse IFC4 asynchrone, logs, annulation Python, previews IFC4 et creation de jobs d imports generiques.
- contraintes : documentation en francais ASCII, API versionnee `/api/v1`, conservation des `ImportJob` pour audit et purge.

## Plan

1. Ajouter les contrats partages de workflow IFC4.
2. Ajouter les endpoints d orchestration assistant pour workflow, preview, validation, execution et annulation des jobs enfants.
3. Ajouter la detection `NO_OP` aux rapports spatial et equipements.
4. Reorganiser `apps/web/app/imports/page.tsx` en assistant IFC4 vertical sans panneau lateral obligatoire.
5. Afficher les operations et resultats par etape.
6. Mettre a jour la documentation d etat courant.

## Questions ouvertes

- aucune question bloquante apres arbitrage utilisateur.

## Hypotheses

- les jobs enfants restent des `ImportJob` classiques pour garder provenance, rapports, purge et audit.
- l assistant devient la surface principale pour les imports IFC4.
- le mapping spatial reste guide : `path` et `parentPath` sont derives du fichier IFC4.
- les classes techniques IFC restent disponibles seulement via un mode avance ulterieur si necessaire.

## Zones impactees

- backend : `imports`, `spatial`, `equipments-import`, contrats DTO.
- frontend : page `apps/web/app/imports/page.tsx`.
- base de donnees : aucune migration prevue.
- infrastructure : aucune modification prevue.
- documentation : specs racine, ADR, backlog si dette differee.

## Tests prevus

- tests unitaires backend sur workflow IFC4 et `NO_OP`.
- tests service sur preview, validation et execution de jobs enfants.
- build API et web.
- tests de non regression sur assistant IFC4 existant.

## Criteres d'acceptation

- un utilisateur deroule l import IFC4 dans une seule page verticale.
- les noeuds spatiaux sont crees ou mis a jour avant les equipements.
- les references assets manquantes sont proposees puis creees explicitement.
- les equipements sont importes avec mapping inline et rattachement spatial.
- les objets deja identiques sont affiches en `NO_OP` et ne sont pas reecrits.
- les traitements longs affichent logs et peuvent etre annules.

## Decisions prises

- conserver `ImportJob` comme unite de trace des jobs enfants.
- ajouter un endpoint de workflow agrege pour eviter de dupliquer la logique d etat cote frontend.
- piloter les jobs enfants depuis l assistant au lieu d obliger l utilisateur a utiliser le panneau generique.

## Notes d'implementation

- contrats partages ajoutes pour `Ifc4WorkflowResponse`, `Ifc4WorkflowActionResponse` et le statut ligne `NO_OP`.
- endpoint workflow ajoute sous `/api/v1/imports/ifc4/analyze-jobs/:jobId/workflow`.
- actions enfants ajoutees pour `spatial` et `equipments` : `preview`, `validate`, `execute`, `cancel`.
- la page imports passe en parcours vertical et pilote les jobs enfants depuis l assistant IFC4.
- les rapports spatial et equipements marquent les lignes identiques comme `NO_OP` et les excluent des ecritures.

## Suivi

- `npm run build --workspace @inventory/shared`
- `npm run build --workspace api`
- `npm run build --workspace web`
- `npm run test --workspace api -- spatial.service.spec.ts import-domain-services.spec.ts ifc4-assistant.service.spec.ts`
