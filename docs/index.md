# Documentation Inventory App

Ce repertoire contient le systeme documentaire versionne du projet.

## Sections principales

- documents racine pour l'etat courant du projet
- `adr/` pour les decisions d'architecture et de conception
- `steps/` pour les dossiers par etape de conception ou d'implementation
- `backlog/` pour les tickets detailles
- `templates/` pour les modeles Markdown

## Principe de fonctionnement

Toute demande d'implementation significative doit :

1. creer ou mettre a jour un dossier d'etape ;
2. mettre a jour les documents de reference impactes ;
3. creer un ADR si une decision transverse est prise ;
4. enregistrer le travail differe dans le backlog.

## Note de validation locale

Pour valider une skill Codex localement avec `quick_validate.py`, Python doit avoir le package `PyYAML` installe car le validateur importe le module `yaml`.

Commande :

```powershell
python -m pip install PyYAML
```
