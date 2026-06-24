# Backlog bugs

Suivre ici les bugs confirmes et les corrections a planifier.

| ID | Gravite | Titre | Statut | Source | Notes |
|---|---|---|---|---|---|
| BUG-001 | Low | Aligner toutes les URL API restantes et les valeurs de deploiement sur `/api/v1` | Resolved | audit inventory-app | References restantes corrigees dans le compose prod et le frontend web ; test de garde ajoute |
| BUG-002 | Medium | Un token invalide affichait le payload JSON `401` brut dans l admin au lieu de revenir a la connexion | Resolved | retour utilisateur | Correctif frontend applique dans `apps/admin` et `apps/web` avec purge automatique du token et resynchronisation de session |
| BUG-003 | High | Interdire la suppression d un job d import tant que ses creations metier n ont pas ete purgees | Resolved | retour utilisateur | Garde backend ajoute sur `DELETE /api/v1/imports/jobs/:jobId` avec `409 IMPORT_JOB_DELETE_BLOCKED` tant que des creations `spatial-nodes`, `equipments` ou `immobilizations` existent encore |
| BUG-004 | Medium | Les listes d arborescence spatiale affichent encore le `path` alors que la cible UI demande de le masquer | Proposed | diagnostic 2026-06-17 | `apps/admin/app/spatial/page.tsx` et `apps/web/app/locations/page.tsx` rendent encore `label - path` dans certaines lignes et etiquettes de selection |
| BUG-005 | High | Le frontend Dokploy appelait encore `http://localhost:3011/api/v1` en production | Resolved | retour utilisateur 2026-06-24 | `NEXT_PUBLIC_API_URL` et `NEXT_PUBLIC_WEB_APP_URL` sont maintenant passes en build args aux images `web` et `admin` |

## Notes recentes

- 2026-06-23 : aucun nouveau bug applicatif ouvert pour la preparation Dokploy production ; le point restant est operationnel et suivi dans `IMP-025`.
- 2026-06-24 : l incident de connexion Dokploy venait des variables publiques Next.js absentes au build Docker ; correctif applique dans les Dockerfiles front et le compose production.
