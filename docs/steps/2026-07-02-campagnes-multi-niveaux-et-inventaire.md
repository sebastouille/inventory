# Campagnes multi-niveaux et inventaire terrain

## Objectif

Permettre de creer et executer une campagne d inventaire sur un noeud spatial de type etage, zone ou bureau.

Le workflow doit couvrir les equipements attendus du noeud selectionne et de ses descendants quand l option `Inclure les enfants` est activee. Pendant l execution terrain, le noeud actif peut lui aussi etre un conteneur. Les observations doivent produire des resultats lisibles, des anomalies si ecart, des corrections proposees pour les mauvaises localisations, et mettre a jour la date de dernier inventaire seulement a la cloture de campagne.

## Perimetre

- Backend `inventory-campaigns`.
- Backend `inventory-anomalies` via creation automatique de corrections proposees.
- Contrats partages `packages/shared`.
- Pages web `campaigns` et `campaigns/[campaignId]/run`.
- Tests backend du service campagnes.
- Documentation racine fonctionnelle, technique et modele de donnees.

## Etat de depart

- Une campagne peut deja figer des attendus depuis un perimetre spatial.
- La saisie terrain peut resoudre un noeud actif par id, code, chemin, reference externe ou numero de piece quand ce numero est unique dans la campagne.
- La synchronisation compare encore principalement la localisation attendue au noeud actif exact.
- La fin de piece cree des anomalies `MISSING` seulement sur le noeud exact.
- Les corrections superviseur existent deja et peuvent appliquer un `LOCATION_CHANGE`, mais elles ne sont pas encore proposees automatiquement au scan `WRONG_LOCATION`.
- `Equipment.lastInventoryAt` existe deja, mais n est pas encore mis a jour par la cloture de campagne.

## Plan d implementation

1. Etendre les contrats de campagne pour exposer le type et le libelle du noeud attendu, les chemins attendus/observes d observation, et l indication de correction proposee.
2. Adapter le matching serveur pour considerer un equipement comme `MATCH` si sa localisation attendue est le noeud actif ou un descendant du noeud actif.
3. Adapter `complete-node` pour creer les `MISSING` du noeud actif et de ses descendants.
4. Creer automatiquement une correction `LOCATION_CHANGE` proposee lors d un `WRONG_LOCATION`, sans deplacer l equipement.
5. A la cloture de campagne, mettre a jour `Equipment.lastInventoryAt` pour les equipements observes et auditer `inventory.equipment.observed`.
6. Ameliorer l UI de detail campagne et d execution terrain pour afficher le perimetre, les attendus, le noeud actif, les scans locaux et les resultats.
7. Ajouter les tests backend sur etage, zone, bureau, mauvaise localisation, manquants descendants et cloture.
8. Mettre a jour la documentation d etat courant.

## Regles metier

- `Inclure les enfants = true` reste le defaut pour les campagnes sur etage ou zone.
- Un scan sur un etage ou une zone valide la presence dans ce conteneur, mais ne prouve pas le bureau exact.
- Un scan sur un bureau reste le mode recommande pour verifier les erreurs de bureau.
- Un changement de localisation detecte cree une anomalie `WRONG_LOCATION` et une correction proposee `LOCATION_CHANGE`.
- Aucune localisation d equipement n est modifiee automatiquement pendant le scan.
- `Equipment.lastInventoryAt` est mis a jour uniquement a la cloture de campagne.
- Les scans `UNKNOWN_CODE` ne mettent a jour aucun equipement.

## Fichiers impactes

- `packages/shared/src/inventory-campaigns.ts`
- `apps/api/src/inventory-campaigns/inventory-campaigns.service.ts`
- `apps/api/src/inventory-campaigns/inventory-campaigns.service.spec.ts`
- `apps/web/app/campaigns/page.tsx`
- `apps/web/app/campaigns/[campaignId]/run/page.tsx`
- `FUNCTIONAL_SPEC.md`
- `TECHNICAL_ARCHITECTURE.md`
- `DATA_MODEL.md`

## Tests prevus

- Campagne sur un etage : les attendus descendants sont presents.
- Campagne sur une zone : les attendus descendants sont presents.
- Campagne sur un bureau : seuls les equipements du bureau sont presents.
- Scan attendu dans un bureau actif : `MATCH`.
- Scan attendu dans B521 mais observe dans B522 : `WRONG_LOCATION` et correction proposee.
- Fin de zone ou etage : creation des `MISSING` sur les descendants non vus.
- Cloture : mise a jour de `lastInventoryAt` et audit par equipement observe.

## Criteres d acceptation

- L utilisateur peut creer une campagne sur `FLOOR`, `ZONE` ou `ROOM`.
- Les attendus affichent reference produit, numero de piece, type, path, marque et modele.
- L execution terrain affiche les scans locaux avant synchronisation.
- Les resultats de synchronisation distinguent `MATCH`, `WRONG_LOCATION`, `OUT_OF_SCOPE`, `DUPLICATE`, `UNKNOWN_CODE` et `MISSING`.
- Une mauvaise localisation propose une correction superviseur sans deplacer l equipement.
- La cloture met a jour la date de dernier inventaire des equipements observes.

## Questions ouvertes

- Aucune question bloquante pour cette implementation.

## Implementation livree

- Les contrats `InventoryExpectedItemSummary`, `InventoryObservationSummary` et `InventoryCampaignDetail.scopes` exposent le type, le libelle et le path des noeuds attendus.
- Le service `inventory-campaigns` considere un equipement comme conforme si son noeud attendu est le noeud actif ou un descendant du noeud actif.
- `complete-node` cree les anomalies `MISSING` sur le noeud actif et tous ses descendants.
- `sync` cree une anomalie `WRONG_LOCATION` et une correction `LOCATION_CHANGE` proposee quand un equipement attendu est observe ailleurs.
- La cloture met a jour `Equipment.lastInventoryAt` pour les equipements observes et audite `inventory.equipment.observed`.
- La page detail campagne affiche le perimetre selectionne avec type, path, inclusion enfants et total attendu.
- La page execution affiche le noeud actif, les scans locaux, un bouton de fin dynamique et les chemins attendu/observe dans les derniers resultats.

## Tests executes

- `npm.cmd run build --workspace @inventory/shared`
- `npm.cmd run test --workspace api -- inventory-campaigns.service.spec.ts`
- `npm.cmd run build --workspace api`
- `npm.cmd run build --workspace web`
- `npm.cmd test`
- `npm.cmd run build`

## Ecarts restants

- Aucun ecart bloquant identifie dans cette passe.
