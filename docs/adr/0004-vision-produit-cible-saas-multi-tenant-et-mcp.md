# ADR 0004 - vision-produit-cible-saas-multi-tenant-et-mcp

## Statut

Accepted

## Contexte

inventory-app doit disposer d une cible produit durable et partageable pour guider les futures implementations. Le depot vise un SaaS multi-organisation avec un isolement total des donnees, une gouvernance RBAC, deux applications distinctes, une API versionnee, et une exposition MCP a terme pour les usages IA.

## Decision

La cible produit est actee comme suit :

- SaaS multi-organisation avec hermeticite totale entre tenants ;
- application metier distincte de l application d administration ;
- API centrale versionnee comme socle d integration ;
- RBAC par organisation et par profil comme mecanisme d acces ;
- exposition MCP en finalite, alignee sur l API existante, sans contourner les regles de securite ;
- parcours mobile terrain et mode offline limites aux usages utiles ;
- imports heterogenes guides par une logique ETL visuelle plutot que par des schemas figes.

## Consequences

- positives :
  - la direction produit devient explicite et partageable ;
  - les futures demandes peuvent etre validees contre une cible stable ;
  - les equipes peuvent separer clairement les sujets metier, administration, integration et IA ;
  - la future exposition MCP reste alignee avec le modele d autorisation et d audit ;
- negatives :
  - chaque nouvelle fonctionnalite devra verifier sa compatibilite avec cette cible ;
  - l isolement multi-tenant impose une discipline stricte sur les filtres et les permissions ;
- neutres :
  - cette ADR ne tranche pas le decoupage detaille des epics ;
  - elle n impose pas encore une implementation technique specifique du serveur MCP ;

## Alternatives considerees

### Option A

- pour :
  - garder une vision produit plus floue pour decider plus tard
- contre :
  - les arbitrages se feraient au fil de l eau sans cap commun
  - le risque de divergence d architecture serait plus grand

### Option B

- pour :
  - separer la cible en plusieurs documents sans decision centrale
- contre :
  - la coherence produit serait plus difficile a maintenir
  - les liens entre vision, architecture et travail Codex seraient moins visibles

## Actions de suivi

- maintenir `VISION_PRODUIT.md` comme source de verite produit
- relier les futures steps a cette ADR quand elles touchent la cible SaaS, RBAC, API ou MCP
- decrire les chantiers detailles dans des steps dediees avant implementation
