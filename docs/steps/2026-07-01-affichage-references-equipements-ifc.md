# 2026-07-01 - Affichage references equipements IFC

## Objectif

Clarifier le resultat d import des equipements IFC4 quand le champ metier `internalCode` est alimente par la propriete IFC `Reference produit`, et rendre l affichage de la liste equipements coherent avec le mapping inline.

## Perimetre

- Import IFC4 equipements.
- Preview et creation des references asset marque/modele.
- Liste `/assets` dans l application web.

## Decisions

- `Reference produit` alimente bien le champ `Equipment.internalCode` si le mapping inline `Code equipement` pointe vers cette propriete.
- La liste equipements affiche en premier `Reference produit / code interne`, puis `N de piece`, puis le type et le path spatial.
- Un modele IFC mappe reste exploitable meme si la marque est absente. Dans ce cas, le modele est rattache a une marque technique `NON_DEFINI` pour eviter de perdre l information `Modele/Gamme`.

## Fichiers impactes

- `apps/api/src/imports/ifc4-assistant.service.ts`
- `apps/api/src/imports/ifc4-assistant.service.spec.ts`
- `apps/web/app/assets/page.tsx`
- `FUNCTIONAL_SPEC.md`
- `TECHNICAL_ARCHITECTURE.md`
- `DATA_MODEL.md`

## Tests prevus

- Test backend: un modele IFC sans fabricant cree une reference modele sous la marque `NON_DEFINI`.
- Build API.
- Build web.

## Criteres d acceptation

- Un equipement importe depuis IFC4 affiche la valeur mappee depuis `Reference produit` dans la liste equipements.
- La liste equipements expose le numero de piece, le type et le path spatial.
- Le modele mappe depuis IFC reste visible meme si la marque IFC est vide.
