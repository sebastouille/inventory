# Correction scan campagne - references metier

## Objectif

Corriger l erreur serveur observee pendant l execution terrain d une campagne quand l utilisateur saisit un code de noeud spatial ou une reference externe equipement dans le champ manuel.

## Diagnostic

Le service `inventory-campaigns` recevait parfois un identifiant de noeud sous forme de code metier, par exemple `LRANETAEA00227`, puis l utilisait directement dans une requete Prisma sur `SpatialNode.id`.

Comme `SpatialNode.id` est un UUID, Prisma levait une erreur `P2023` au lieu de retourner une erreur metier lisible.

Le scan equipement etait aussi trop strict : il ne recherchait que `Equipment.internalCode`, alors que les imports IFC4 peuvent renseigner une reference externe ou un numero de piece utile sur le terrain.

## Perimetre

- Backend `inventory-campaigns`.
- Page terrain `campaigns/[campaignId]/run`.
- Tests unitaires du service campagne.
- Documentation fonctionnelle et technique.

## Plan applique

1. Normaliser les references de noeud scannees en retirant le prefixe optionnel `NODE:`.
2. Resoudre un noeud spatial par UUID, code, chemin ou reference externe.
3. Refuser explicitement une reference de noeud ambigue ou hors perimetre.
4. Convertir toute reference de noeud vers l UUID reel avant creation de batch et observation.
5. Resoudre un equipement par `internalCode`, `externalRef` ou `numPiece`.
6. Mettre a jour les messages de saisie manuelle pour expliciter les formats acceptes.
7. Ajouter un test de non regression sur scan manuel avec noeud par code et equipement par reference externe.

## Fichiers impactes

- `apps/api/src/inventory-campaigns/inventory-campaigns.service.ts`
- `apps/api/src/inventory-campaigns/inventory-campaigns.service.spec.ts`
- `apps/web/app/campaigns/[campaignId]/run/page.tsx`
- `FUNCTIONAL_SPEC.md`
- `TECHNICAL_ARCHITECTURE.md`

## Tests

- Test unitaire ajoute : synchronisation d une observation `EQ:EXT-001` avec noeud actif `B101`.
- Validation attendue : le batch et l observation utilisent l UUID du noeud resolu, et l equipement est trouve par reference externe.

## Criteres d acceptation

- La saisie manuelle d un noeud par code metier ne produit plus d erreur Prisma.
- La saisie manuelle d un equipement par reference externe est acceptee si elle identifie un equipement unique.
- Une reference de noeud ambigue ou inconnue retourne une erreur metier explicite.
- Les donnees persistees restent des UUID pour les relations base de donnees.

## Points ouverts

- Definir plus tard si les etiquettes de noeuds doivent imprimer uniquement un UUID, un code metier, ou les deux.
- Ajouter une validation visuelle du noeud actif resolu quand le scan est fait par code metier.
