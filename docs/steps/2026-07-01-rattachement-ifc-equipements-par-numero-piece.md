# Rattachement IFC equipements par numero de piece

## Objectif

Corriger l import IFC4 pour rattacher un equipement au noeud `ROOM` dont la propriete `N de piece` correspond a la propriete `N de piece` de l equipement.

## Perimetre

- Assistant IFC4.
- Preview equipements.
- Creation des jobs `equipments`.
- Controle de coherence des noeuds spatiaux importes.

## Decision

- Si un equipement IFC porte une propriete `N de piece`, l assistant cherche un noeud `ROOM` du meme batiment avec la meme propriete.
- Si une seule room correspond, l equipement est rattache a cette room.
- Si plusieurs rooms du meme batiment portent le meme numero de piece, l import spatial signale une anomalie d unicite.
- Le controle ne verifie pas `Numero de zone liee` ni `Zone`, par decision utilisateur.
- En absence de correspondance unique, le flux garde le rattachement IFC courant et signale le cas dans les warnings.

## Fichiers impactes

- `apps/api/src/imports/ifc4-assistant.service.ts`
- `apps/api/src/imports/ifc4-assistant.service.spec.ts`
- `FUNCTIONAL_SPEC.md`
- `TECHNICAL_ARCHITECTURE.md`
- `DATA_MODEL.md`

## Tests prevus

- Un equipement avec `N de piece=B520` est rattache a la room dont `N de piece=B520`.
- Deux rooms du meme batiment avec le meme `N de piece` creent une anomalie d unicite.
- Le build API passe.

## Criteres d acceptation

- Une campagne creee sur une room peut retrouver les equipements importes par numero de piece.
- Les doublons de numero de piece dans un batiment ne sont pas acceptes silencieusement.
