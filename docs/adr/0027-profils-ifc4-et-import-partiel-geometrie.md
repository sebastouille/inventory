# ADR 0027 - Profils IFC4 et import partiel geometrie

## Statut

Accepted

## Contexte

L assistant IFC4 peut analyser la geometrie ligne par ligne, mais le flux actuel bloque tout l import si une seule geometrie est absente ou en erreur. Les profils existants `ImportProfile` sont concus pour des sources CSV/XLSX avec mappings tabulaires.

## Decision

Creer un modele dedie `Ifc4AssistantProfile` pour stocker les choix de l assistant IFC4. Ajouter une politique explicite `IMPORT_READY_ONLY` permettant d importer uniquement les lignes dont la geometrie est valide, tout en listant les lignes exclues dans les diagnostics et rapports.

## Consequences

- positives : workflow IFC4 plus lisible, profils adaptes au metier BIM, import partiel controle sans fallback.
- negatives : migration supplementaire et endpoints dedies.
- neutres : les profils CSV/XLSX restent inchanges.

## Alternatives considerees

### Option A

- pour : reutiliser `ImportProfile` evite une table.
- contre : melange les mappings CSV avec les options IFC4 et rend l UI confuse.

### Option B

- pour : modele dedie plus clair et extensible.
- contre : demande un CRUD specifique.

## Actions de suivi

- documenter les limites du mode partiel.
- envisager un export ODS des anomalies apres la V1 CSV.
