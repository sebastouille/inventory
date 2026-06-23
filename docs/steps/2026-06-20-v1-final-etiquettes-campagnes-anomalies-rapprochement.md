# 2026-06-20 - V1 finale etiquettes, campagnes, scan terrain, anomalies et rapprochement

## Objectif

Livrer la vague V1 qui transforme le socle assets en application terrain exploitable :

- generation d etiquettes a partir de `internalCode` et des noeuds spatiaux ;
- campagnes d inventaire equipements separees du stock produits ;
- scan terrain online-first avec file offline limitee ;
- anomalies et corrections superviseur ;
- rapprochement manuel equipement immobilisation.

## Perimetre

Inclus :

- permissions IAM nouvelles ;
- contrats partages ;
- schema Prisma des campagnes terrain ;
- API etiquettes, campagnes, anomalies, corrections et rapprochement ;
- UI web superviseur et terrain responsive ;
- documentation d architecture et de modele.

Exclus de cette vague :

- QR code ;
- rapprochement comptable automatique ;
- moteur de verrouillage de zone ;
- refonte du domaine `inventory` stock produits ;
- historique persistant des exports etiquettes.

## Decisions

- `inventory` et `stock-movements` restent reserves au futur stock `products`.
- Les campagnes terrain utilisent un domaine dedie.
- `MATCH` est un resultat d observation conforme, pas une anomalie.
- Les anomalies V1 sont `WRONG_LOCATION`, `UNKNOWN_CODE`, `MISSING`, `DUPLICATE`, `OUT_OF_SCOPE`.
- Les payloads scannes sont `EQ:<internalCode>` et `NODE:<spatialNodeId>`.
- Les exports etiquettes V1 sont stateless.
- Le rapprochement immobilisation equipement est manuel uniquement.

## Plan d implementation

1. Ajouter l ADR de separation entre inventaire equipements et stock produits.
2. Etendre IAM et les contrats partages.
3. Ajouter le schema campagnes et anomalies.
4. Ajouter les exports etiquettes equipements et noeuds.
5. Ajouter l API campagnes, observations et sync.
6. Ajouter l API anomalies, corrections et rapprochement.
7. Ajouter les ecrans web `/labels`, `/campaigns`, `/campaigns/:id/run`, `/anomalies`, `/reconciliation`.
8. Mettre a jour la documentation racine et les backlogs.
9. Executer les validations disponibles.

## Fichiers impactes

- `prisma/schema.prisma`
- `prisma/migrations/*`
- `packages/shared/src/*`
- `apps/api/src/*`
- `apps/web/app/*`
- `apps/web/components/app-shell.tsx`
- `FUNCTIONAL_SPEC.md`
- `TECHNICAL_ARCHITECTURE.md`
- `DATA_MODEL.md`
- `IMPLEMENTATION_BACKLOG.md`

## Tests attendus

- `prisma validate`
- `npm run build --workspace @inventory/shared`
- `npm run build --workspace api`
- `npm run build --workspace web`
- tests API sur les exports, campagnes, anomalies et rapprochement si disponibles.

## Criteres d acceptation

- Un utilisateur autorise peut generer un fichier etiquettes equipements ou noeuds.
- Une campagne peut etre creee, ouverte, executee et cloturee.
- Les scans produisent des observations et des anomalies lisibles.
- Une correction de localisation met a jour `Equipment.currentSpatialNodeId` et cree un `EquipmentMovement`.
- Le rapprochement manuel rattache ou detache une immobilisation d un equipement.
- Les routes restent tenant-aware et controlees par RBAC.

## Notes d implementation

- Le travail doit rester incremental : une V1 simple et coherente prime sur une couverture exhaustive.
- Les ecrans mobiles peuvent etre online-first avec persistance locale minimale.
- Les exports PDF Code 128 peuvent rester simples, mais doivent encoder les payloads verrouilles.

## Implementation realisee

- Ajout des permissions IAM V1 pour etiquettes, campagnes, anomalies et rapprochement.
- Ajout des contrats partages :
  - `label-exports`
  - `inventory-campaigns`
  - `inventory-anomalies`
  - `reconciliation`
- Ajout du schema Prisma et de la migration `20260620103000_v1_equipment_inventory_campaigns`.
- Ajout API :
  - `label-exports`
  - `inventory-campaigns`
  - `inventory-anomalies`
  - `reconciliation`
- Ajout UI web :
  - `/labels`
  - `/campaigns`
  - `/campaigns/[campaignId]/run`
  - `/anomalies`
  - `/reconciliation`
- Ajout helper web `apiDownloadPost`.
- Mise a jour navigation web.
- Le formulaire de creation de campagne remplace maintenant le select plat du perimetre spatial par une arborescence selectionnable avec icones de noeud, compteur d equipements par noeud et bouton `Selectionner`.
- Le champ `Inclure les enfants` reste actif par defaut a `true` pour coller au comportement attendu des campagnes terrain.
- Le resume `Noeud selectionne` affiche maintenant a droite le decompte d equipements du noeud, avec cumul des descendants quand l option d inclusion des enfants est active.
- La page `campaigns` n affiche plus le gros titre noir de section ; la liste garde le libelle de campagne sur une seule ligne pour stabiliser l alignement.
- L ecran de connexion web mobile reprend maintenant le titre du menu workspace `INVENTAIRE / Physique & rapprochement comptable`, sans texte de presentation long ni bulles d adresses locales.

## Limites V1 conservees

- Le scan camera natif n est pas livre.
- La file offline terrain est volontairement simple cote navigateur ; une version IndexedDB robuste reste au backlog.
- Les pieces jointes ont leur modele base, mais l upload photo effectif reste a livrer.
- Le rapprochement reste manuel et informatif.
- QR code et templates etiquettes parametrables restent hors V1.

## Tests executes

- `npx prisma validate --schema prisma/schema.prisma` : OK.
- `npx prisma generate --schema prisma/schema.prisma` : OK apres arret du serveur API dev qui verrouillait le client Prisma.
- `npm run build --workspace @inventory/shared` : OK.
- `npm run build --workspace api` : OK.
- `npm run build --workspace web` : OK.
- `npm run test --workspace api` : echec de la suite migration car la base de test attendue sur `127.0.0.1:5555` n etait pas accessible. Les autres suites ont execute 40 tests OK et 1 test ignore.

## Suites a planifier

- Brancher un vrai scanner camera mobile.
- Ajouter upload et affichage des photos terrain sous `.runtime/inventory-attachments`.
- Remplacer la file locale simple par IndexedDB robuste.
- Ajouter un bouton metier de fin de piece pour generer `MISSING` avant cloture.
- Ajouter QR code et templates d etiquettes parametres par organisation.
