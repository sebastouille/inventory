# 2026-06-22 - Tableau de bord KPI metier

## Objectif

Remplacer sur le tableau de bord web les anciens indicateurs stock par des KPI metier alignes avec la V1 terrain : campagnes ouvertes, anomalies ouvertes, immobilisations non rapprochees et biens non inventories depuis plus de 12 mois.

## Perimetre

- dans le scope :
  - nouveau endpoint de lecture dedie au tableau de bord
  - nouveaux contrats partages dashboard
  - refonte de `apps/web/app/page.tsx`
  - mise a jour des badges de navigation lies aux campagnes et anomalies
  - mise a jour de la documentation d etat courant
- hors scope :
  - refonte de la page `/inventory` orientee stock
  - nouveaux filtres metier dedies dans `assets` ou `immobilizations`
  - nouvelles permissions RBAC

## Contexte initial

- demande :
  - supprimer le sous-titre stock/fournisseurs/localisations du tableau de bord
  - supprimer les anciens indicateurs stock
  - afficher 4 KPI metier cliquables
- etat existant :
  - le tableau de bord web consomme `/api/v1/inventory/overview`
  - cet endpoint ne sert aujourd hui que des metriques `products`, `locations`, `suppliers`, `totalUnits`, `lowStockCount`, `recentMovements`
  - la page `/inventory` reutilise ce meme endpoint pour une vue stock/products
- contraintes :
  - ne pas casser la vue `/inventory`
  - rester sans migration Prisma
  - reutiliser les domaines deja livres : campagnes, anomalies, immobilisations, equipements

## Plan

1. Ajouter un contrat partage `DashboardOverviewResponse`.
2. Ajouter un module API `dashboard` avec `GET /api/v1/dashboard/overview`.
3. Calculer les 4 KPI metier a partir des tables existantes.
4. Refaire `apps/web/app/page.tsx` avec 4 cartes cliquables.
5. Rebrancher les badges de navigation `Campagnes` et `Anomalies` sur le nouveau dashboard.
6. Mettre a jour la documentation racine.

## Questions ouvertes

- aucune question bloquante

## Hypotheses

- une immobilisation non rapprochee = une immobilisation active sans aucun equipement rattache
- un bien non inventorie depuis plus de 12 mois inclut aussi les biens jamais inventories
- les cartes du tableau de bord peuvent renvoyer vers la page metier generale correspondante meme sans filtre profond dedie en V1

## Zones impactees

- backend :
  - `apps/api/src/dashboard/*`
  - `apps/api/src/app.module.ts`
- frontend :
  - `apps/web/app/page.tsx`
  - `apps/web/components/app-shell.tsx`
  - `packages/ui/src/components/metric-card.tsx`
- base de donnees :
  - aucune migration
- infrastructure :
  - aucune
- documentation :
  - `FUNCTIONAL_SPEC.md`
  - `TECHNICAL_ARCHITECTURE.md`
  - `IMPLEMENTATION_BACKLOG.md` si travail differe

## Tests prevus

- `npm run build --workspace @inventory/shared`
- `npm run build --workspace api`
- `npm run build --workspace web`

## Criteres d'acceptation

- le tableau de bord ne mentionne plus la synthese stock/fournisseurs/localisations
- les cartes `Biens`, `Localisations`, `Fournisseurs`, `Unites`, `Alertes` disparaissent
- les sections `Biens en alerte` et `Mouvements recents` disparaissent
- 4 KPI metier sont affiches et cliquables
- la page `/inventory` continue a fonctionner sur son endpoint stock existant

## Decisions prises

- le tableau de bord web ne doit plus reutiliser le endpoint stock `inventory/overview`
- un endpoint dedie `dashboard/overview` est ajoute pour eviter de melanger produits/stock et pilotage terrain equipements

## Notes d'implementation

- ajout du contrat partage `DashboardOverviewResponse`
- ajout du module API `dashboard` et de `GET /api/v1/dashboard/overview`
- conservation de `GET /api/v1/inventory/overview` pour la vue stock/products existante
- `MetricCard` supporte maintenant un clic optionnel avec clavier
- le tableau de bord web ne rend plus les anciens tableaux stock et n affiche plus le sous-titre stock/fournisseurs/localisations
- les badges de navigation `Campagnes` et `Anomalies` sont maintenant derives du dashboard metier
- cibles de clic V1 :
  - campagnes ouvertes -> `/campaigns?status=OPEN`
  - anomalies ouvertes -> `/anomalies?status=OPEN`
  - immobilisations non rapprochees -> `/immobilizations`
  - biens non inventories depuis 12 mois -> `/assets`

## Tests executes

- `npm run build --workspace @inventory/shared`
- `npm run build --workspace api`
- `npm run build --workspace web`

## Suivi

- si un filtrage profond par KPI devient necessaire, l ajouter plus tard dans `assets`, `immobilizations` et `reconciliation`
