# ADR 0003 - coexistence-products-vs-assets-et-affectation-generique

## Statut

Accepted

## Contexte

Le repo portait deja un domaine `products` oriente catalogue, stock et mouvements. Le besoin de l etape 2 introduit en parallele un domaine patrimonial unitaire pour les equipements physiques, avec statut, proprietaire, historique et affectations. Une fusion rapide entre les deux modeles aurait casse les usages existants de stock et brouille la semantique metier.

En plus, le besoin d affectation devait couvrir des cas heterogenes des la V1 :

- rattachement a une personne ;
- rattachement a une localisation ;
- rattachement a un autre asset compatible.

## Decision

- conserver `products` comme domaine distinct pour les accessoires et fournitures ;
- creer un nouveau domaine `assets` pour les equipements patrimoniaux unitaires ;
- modeler les affectations dans une table generique `EquipmentAssignment` avec enum `PERSON | LOCATION | ASSET` ;
- controler les rattachements `ASSET -> ASSET` par une table de regles `EquipmentFamilyAttachmentRule` plutot que par du code dur ;
- exposer les referentiels assets et les ecrans associes sans renommer ni deplacer `products`.

## Consequences

- positives :
  - separation claire entre stock consommable et patrimoine unitaire ;
  - evolution plus sure des regles metier patrimoniales sans regression sur le domaine existant ;
  - affectation deja extensible pour les futures etapes de localisation fine et de rattachement compose.
- negatives :
  - duplication partielle apparente entre deux domaines de biens ;
  - navigation et documentation plus riches a maintenir ;
  - besoin futur de clarifier les frontieres fonctionnelles entre fournitures, accessoires et equipements.
- neutres :
  - la stack reste `NestJS + Prisma + Next.js` ;
  - `Location` existant reste la cible de rattachement V1 sans remodelisation immediate.

## Alternatives considerees

### Option A

- pour :
  - reutiliser `products` aurait minimise le nombre de nouvelles tables
- contre :
  - le modele existant est agrege et non unitaire ;
  - les contraintes d unicite, d archive et d affectation y sont mal representees ;
  - le risque de casser stock, mouvements et inventaire etait trop eleve.

### Option B

- pour :
  - creer trois tables d affectation specialisees aurait simplifie certaines validations locales
- contre :
  - la lecture fonctionnelle devient plus dispersee ;
  - les ecrans et services doivent gerer trois contrats differents ;
  - les evolutions futures sur l historique et l audit deviennent plus lourdes.

## Actions de suivi

- preciser plus tard les passerelles fonctionnelles entre `products` et `assets`
- enrichir l enforcement des perimetres de localisation sur les futures routes inventaire
- evaluer en etape ulterieure si certaines fournitures doivent etre promues en assets selon des regles metier formelles
