# Vision produit cible inventory-app

## Objectif

Definir et figer la vision produit cible de `inventory-app` comme SaaS multi-organisation, avec isolement total des donnees par organisation, RBAC par profils, deux applications metier distinctes, une API d integration, une cible MCP, une UX desktop optimisee, des parcours mobile terrain, et un moteur d import generique.

## Perimetre

- dans le scope :
  - redaction de la vision produit racine
  - creation des liens de travail vers le workspace et les prompts Codex
  - enregistrement d une ADR de cible architecture
  - cadrage des principes fonctionnels et techniques durables
- hors scope :
  - implementation des fonctionnalites metier
  - migration technique immediate
  - decomposition detaillee des epics ou sprints

## Contexte initial

- demande :
  - stocker la vision produit finale dans un fichier racine
  - garder cette vision comme finalite de travail constante
  - relier cette vision au workspace local et a un prompt Codex de reference
  - formaliser les grandes capacites metier et techniques du produit
- etat existant :
  - le repo est un monorepo `Next.js + NestJS + Prisma`
  - une base documentaire versionnee existe deja
  - une base IAM, RBAC, audit et API versionnee est deja presente
- contraintes :
  - toute documentation doit rester en francais ASCII
  - les organisations doivent rester totalement hermetiques
  - le produit doit rester coherent avec le monorepo actuel
  - la cible doit rester compatible avec une exposition MCP future

## Plan

1. Rediger la vision racine et ses liens de travail.
2. Capturer la decision de cible dans un ADR.
3. Rebrancher les points d entree documentaire du depot sur cette vision.

## Questions ouvertes

- aucune question bloquante pour ce cadrage
- les decoupages de livraison detaillees seront traites dans des steps ulterieurs

## Hypotheses

- la vision produit sert de source de verite pour les futures demandes
- la cible MCP ne remplace pas l API REST, elle la complete
- l offline mobile ne concerne que les parcours terrain utiles
- le moteur d import doit rester generique et evolutif

## Zones impactees

- backend :
  - regles d autorisation, d audit, d import et d exposition API
- frontend :
  - `apps/web` pour le metier et le terrain
  - `apps/admin` pour l administration des referentiels et des utilisateurs
- base de donnees :
  - tenance par organisation, referentiels, inventaire, campagnes, anomalies, mouvements
- infrastructure :
  - API versionnee, future exposition MCP, synchronisation offline a terme
- documentation :
  - `VISION_PRODUIT.md`
  - `PROMPTS_CODEX.md`
  - `PROJECT_OVERVIEW.md`
  - `README.md`
  - `docs/adr/0004-vision-produit-cible-saas-multi-tenant-et-mcp.md`

## Tests prevus

- verification manuelle de coherence documentaire
- verification des liens Markdown
- verification de l absence de caracteres non ASCII

## Criteres d'acceptation

- la vision produit est disponible dans un fichier racine
- le fichier racine relie le workspace et les prompts Codex
- l ADR formalise la cible SaaS multi-tenant et l orientation MCP
- les documents d entree du repo pointent vers cette vision
- la documentation expose clairement ce qui est finalite et ce qui reste a planifier

## Decisions prises

- inventaire-app vise un mode SaaS pour plusieurs organisations totalement hermetiques
- la gouvernance d acces repose sur RBAC par utilisateurs rattaches a une organisation
- le produit se structure autour de deux applications :
  - une application metier d inventaire
  - une application d administration des referentiels et des utilisateurs
- l architecture cible reste API centree avec une exposition MCP a terme
- l experience desktop reste privilegiee, avec une couche mobile responsive pour les operations terrain
- les imports doivent accepter plusieurs formats et evoluer vers une logique ETL visuelle
- la vision couvre a la fois le present du repo et sa finalite produit

## Notes d'implementation

- documentation only
- aucun code modifie dans cette vague
- la vision doit servir de reference pour les prochaines etapes produit

## Suivi

- vision racine creee
- prompts Codex de reference crees
- ADR de cible architecture creee
- points d entree du depot a relier a cette vision
