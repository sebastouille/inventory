# Vision produit inventory-app

## Finalite

`inventory-app` est un SaaS multi-organisation pour la gestion de l inventaire patrimonial, des referentiels metier, des campagnes terrain, des anomalies, des mouvements, et de la tracabilite complete.

La cible finale conserve un isolement total entre organisations, une gouvernance RBAC stricte, une API stable pour les integrations, et une exposition MCP a terme pour les usages IA.

## Principes invariants

- chaque organisation doit rester totalement hermetique aux autres
- chaque utilisateur est rattache a une organisation et a des profils de droits
- les actions sensibles doivent etre auditees
- la plateforme doit rester API centree et versionnee
- MCP est une cible de diffusion future, pas un remplacement de l API
- les parcours metier doivent separer clairement l application operateur et l application d administration
- les usages terrain doivent rester utilisables sur smartphone avec lecture QR et code barre
- les imports doivent pouvoir absorber des sources heterogenes via une logique ETL visuelle
- les modules lourds doivent limiter la memoire et ne charger que les donnees utiles

## Cible produit

### Application metier

- gestion de l inventaire physique
- campagnes d inventaire
- scan de localisation puis scan d equipements
- correction des anomalies
- rapprochement entre campagnes
- historique des mouvements
- consultation des equipements et de leurs affectations

### Application d administration

- gestion des utilisateurs
- gestion des roles et des permissions
- gestion des organisations et de leurs referentiels
- administration des listes de reference metier
- parametres de securite et de gouvernance

### Experience utilisateur

- interface principale optimisee pour ecran de travail
- header, page centrale, panneau lateral droit et footer flottant
- parcours mobile responsive pour les operations terrain
- mode hors ligne pour les usages de terrain avec synchronisation a la reconnexion

## Capacites metier cibles

- initialisation des referentiels metier par import Excel, CSV, puis IFC4
- creation de regles de transcription entre donnees source et donnees cibles
- import V2 IFC4 avec arborescence des classes, navigation, visualisation 3D simplifiee et edition d objets
- inventaire physique prioritaire par scan de localisation puis scan d equipements
- gestion de campagnes avec perimetre, etat, anomalies, corrections, et cloture
- correction d anomalies par rapprochement automatique lorsque deux ecarts se compensent
- affectation d un equipement a un bureau puis propagation de la localisation a un ecran ou autre materiel
- historisation des mouvements et des corrections

## Capacites techniques cibles

- monorepo avec une API centrale
- un domaine metier pour l inventaire et un domaine d administration pour les referentiels
- RBAC par organisation et par profil
- audit centralise des actions sensibles
- compatibilite avec une future exposition MCP
- optimisation pour les volumes terrain et la visualisation web
- chargement progressif des donnees et reduction des couts memoire

## Liens de travail

- workspace : [inventory-app.code-workspace](</c:/Users/sebas/RepoSeb/inventory-app/inventory-app.code-workspace>)
- prompts Codex : [PROMPTS_CODEX.md](</c:/Users/sebas/RepoSeb/inventory-app/PROMPTS_CODEX.md>)
- etape de cadrage : [docs/steps/2026-06-15-vision-produit-cible-inventory-app.md](</c:/Users/sebas/RepoSeb/inventory-app/docs/steps/2026-06-15-vision-produit-cible-inventory-app.md>)
- ADR de cible : [docs/adr/0004-vision-produit-cible-saas-multi-tenant-et-mcp.md](</c:/Users/sebas/RepoSeb/inventory-app/docs/adr/0004-vision-produit-cible-saas-multi-tenant-et-mcp.md>)

## Evolution continue

Cette vision est la reference principale pour arbitrer les demandes futures.

En cas de conflit entre une demande ponctuelle et cette vision, la demande doit etre reformulee ou planifiee dans une step dediee avant implementation.
