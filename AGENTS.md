# Workflow du depot

Utiliser la skill locale `$project-doc-governor` depuis [`.codex/skills/project-doc-governor`](</c:/Users/sebas/RepoSeb/inventory-app/.codex/skills/project-doc-governor/SKILL.md>) pour toute demande qui :

- planifie ou implemente une fonctionnalite, un refactor, une migration, ou un changement d'architecture ;
- modifie les contrats API, le schema de base, l'authentification, la securite, ou le deploiement ;
- laisse des questions ouvertes, du travail differe, des bugs, ou des pistes d'amelioration.

Regle documentaire permanente :

- toute la documentation du repo doit etre redigee en francais ;
- utiliser uniquement des caracteres ASCII ;
- ne pas utiliser d'accents ni de caracteres speciaux ;
- appliquer cette regle aux fichiers racine, a `docs/`, aux templates, aux ADR, aux dossiers d'etape, et aux documents generes par Codex.

Avant implementation :

- creer ou mettre a jour un fichier d'etape dans `docs/steps/` ;
- enregistrer l'objectif, le perimetre, le plan, les questions, les hypotheses, les fichiers impactes, les tests, et les criteres d'acceptation ;
- creer un ADR dans `docs/adr/` pour toute decision d'architecture ou toute decision transverse.

Apres implementation :

- mettre a jour `FUNCTIONAL_SPEC.md`, `TECHNICAL_ARCHITECTURE.md`, `DATA_MODEL.md`, et les fichiers impacts sous `docs/` ;
- ajouter le travail differe dans `IMPLEMENTATION_BACKLOG.md`, `BUG_BACKLOG.md`, ou `docs/backlog/` ;
- garder les changements de documentation dans la meme branche et le meme scope de commit que les changements de code.

Ne pas clore une tache d'implementation sans documenter :

- ce qui a change ;
- pourquoi cela a change ;
- ce qui reste ouvert ;
- ce qui doit etre planifie ensuite.
