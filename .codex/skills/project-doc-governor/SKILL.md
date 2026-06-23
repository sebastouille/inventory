---
name: project-doc-governor
description: Imposer un workflow docs-as-code local au repository pour la planification, l'architecture, l'implementation de fonctionnalites, les migrations, la correction de bugs, et la gestion du backlog. Utiliser quand Codex doit creer ou mettre a jour une documentation Markdown versionnee avant et apres implementation, capturer les plans et les reponses utilisateur dans `docs/steps/`, enregistrer les decisions d'architecture dans `docs/adr/`, mettre a jour les specifications racine, ou creer des artefacts backlog et bug.
---

# Gouvernance documentaire projet

## Vue d'ensemble

Utiliser cette skill pour faire de la documentation une sortie obligatoire du travail d'implementation dans ce repository. Traiter les plans, les reponses utilisateur, les decisions, les changements d'architecture, et le travail differe comme des artefacts versionnes de premier niveau.

## Workflow

### 1. Partir de l'etat documentaire courant

Lire d'abord les documents racine :

- `PROJECT_OVERVIEW.md`
- `FUNCTIONAL_SPEC.md`
- `TECHNICAL_ARCHITECTURE.md`
- `DATA_MODEL.md`
- `OPEN_QUESTIONS.md`
- `IMPLEMENTATION_BACKLOG.md`
- `BUG_BACKLOG.md`

Puis inspecter :

- `docs/steps/README.md`
- `docs/adr/README.md`
- les fichiers utiles dans `docs/features/`, `docs/api/`, `docs/database/`, ou `docs/backlog/`

### 2. Avant implementation, creer ou mettre a jour un dossier d'etape

Pour toute demande non triviale :

- creer un nouveau fichier dans `docs/steps/` avec `scripts/docs/new-step.ps1`, ou mettre a jour le fichier actif ;
- capturer l'objectif, le perimetre, le plan, les hypotheses, les questions ouvertes, les zones impactees, les tests, et les criteres d'acceptation ;
- si l'utilisateur repond a des questions, enregistrer les reponses dans le meme fichier.

Ne pas laisser les details de plan uniquement dans l'historique de chat.

### 3. Enregistrer les decisions importantes sous forme d'ADR

Creer un ADR si la demande modifie :

- l'architecture ou les frontieres runtime ;
- l'orientation de stack backend ou frontend ;
- le versioning API ou les regles de contrat ;
- l'authentification, l'autorisation, ou l'audit ;
- la strategie base de donnees, la logique de migration, ou le pattern d'integration ;
- la gouvernance documentaire elle-meme.

Utiliser `scripts/docs/new-adr.ps1` et la convention de `docs/adr/README.md`.

### 4. Mettre a jour la documentation d'etat courant apres implementation

Si du code ou de la configuration changent, mettre a jour dans le meme tour :

- `FUNCTIONAL_SPEC.md` pour le comportement et les capacites visibles
- `TECHNICAL_ARCHITECTURE.md` pour l'architecture et les patterns transverses
- `DATA_MODEL.md` pour les changements du modele de donnees oriente metier
- `OPEN_QUESTIONS.md` pour les sujets non tranches
- `IMPLEMENTATION_BACKLOG.md` et `BUG_BACKLOG.md` pour le travail differe

Ajouter des fichiers de backlog detailles dans `docs/backlog/` quand une simple ligne de tableau ne suffit pas.

### 5. Boucler le travail

En fin de tache, verifier que le dossier d'etape contient :

- les decisions prises ;
- les notes d'implementation ;
- les tests executes ;
- les suites a traiter.

Si un changement est important mais volontairement differe, l'enregistrer dans le backlog et ne pas le laisser implicite.

## Regles de creation de fichiers

- utiliser `docs/templates/step-template.md` pour les dossiers d'etape
- utiliser `docs/templates/adr-template.md` pour les ADR
- utiliser `docs/templates/feature-spec-template.md` pour les specifications fonctionnelles detaillees
- utiliser `docs/templates/technical-spec-template.md` pour les specifications techniques
- utiliser `docs/templates/backlog-item-template.md` et `docs/templates/bug-ticket-template.md` pour les tickets detailles

Preferer les scripts de `scripts/docs/` quand il faut creer un nouveau fichier.

## Regles de decision

- preferer un dossier d'etape actif par grande demande ou grand flux d'implementation ;
- preferer un ADR par decision distincte ;
- garder les fichiers racine concis et orientes etat courant ;
- garder `docs/steps/` historique et chronologique ;
- garder les ADR centres sur le rationnel, les arbitrages, et les consequences.

## Checklist de validation

Avant de terminer une tache eligibile, verifier :

1. un fichier d'etape existe ou a ete mis a jour ;
2. les documents racine impactes ont ete mis a jour ;
3. un ADR existe si une decision transverse a ete prise ;
4. le travail differe est ecrit dans le backlog ;
5. la documentation est coherente avec le code et la configuration.

## Note de validation locale

Si `quick_validate.py` est lance localement, verifier que `PyYAML` est installe dans l'environnement Python actif :

```powershell
python -m pip install PyYAML
```

## Ressources

- scripts : voir `scripts/docs/`
- templates : voir `docs/templates/`
- convention ADR : voir `docs/adr/README.md`
- exemple d'etape bootstrap : voir `docs/steps/2026-06-12-documentation-governance-bootstrap.md`
