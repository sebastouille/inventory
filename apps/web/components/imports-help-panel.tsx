"use client";

import { Badge } from "@inventory/ui";
import { useRef, useState } from "react";

type HelpSection = {
  id: string;
  title: string;
  image: string;
  imageAlt: string;
  summary: string;
};

const HELP_SECTIONS: HelpSection[] = [
  {
    id: "workflow",
    title: "Workflow global",
    image: "/help/imports/imports-workflow-overview.svg",
    imageAlt: "Schema du workflow global de la page imports et exports",
    summary: "Choisir un domaine, creer un job, charger un fichier, mapper, puis lancer preview, validate et execute."
  },
  {
    id: "mapping",
    title: "Mapping et profils",
    image: "/help/imports/imports-mapping.svg",
    imageAlt: "Schema du mapping entre colonnes source et champs cibles",
    summary: "Relier chaque colonne source au bon champ cible, regler les transformations et memoriser le mapping dans un profil."
  },
  {
    id: "report",
    title: "Rapport et reprise",
    image: "/help/imports/imports-report.svg",
    imageAlt: "Schema du rapport de validation et d execution",
    summary: "Relire les decisions CREATE ou UPDATE, les rejets et reprendre un job plus tard depuis l historique."
  }
];

export function ImportsHelpPanel() {
  const [activeSectionId, setActiveSectionId] = useState<string>(HELP_SECTIONS[0]?.id ?? "workflow");
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const activeSection = HELP_SECTIONS.find((section) => section.id === activeSectionId) ?? HELP_SECTIONS[0];

  const focusSection = (sectionId: string) => {
    setActiveSectionId(sectionId);
    sectionRefs.current[sectionId]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border/60 bg-card/40 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">V1 aide contextuelle</Badge>
          <Badge variant="outline">Imports web</Badge>
          <Badge variant="outline">Domaine actif: spatial-nodes</Badge>
        </div>
        <div className="mt-3 space-y-2 text-sm text-muted-foreground">
          <p>
            Cette aide suit un workflow simple: lire le resume, cliquer une vignette pour viser une etape, puis revenir au
            workspace pour executer la meme sequence.
          </p>
          <p>
            Dans cette V1, la page est d abord un poste de pilotage d import. Les exports metier centralises ne sont pas encore
            livres ici: les exports disponibles restent portes par les listes metier via les boutons export ODS.
          </p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-3">
          {HELP_SECTIONS.map((section) => {
            const isActive = section.id === activeSectionId;

            return (
              <button
                key={section.id}
                type="button"
                onClick={() => focusSection(section.id)}
                className={
                  isActive
                    ? "w-full rounded-2xl border border-sky-500/40 bg-sky-500/10 p-3 text-left shadow-sm transition"
                    : "w-full rounded-2xl border border-border/60 bg-card/40 p-3 text-left transition hover:border-sky-500/30 hover:bg-card/80"
                }
              >
                <img
                  src={section.image}
                  alt={section.imageAlt}
                  className="h-32 w-full rounded-xl border border-border/60 bg-background object-cover"
                />
                <div className="mt-3 space-y-1">
                  <p className="text-sm font-semibold text-foreground">{section.title}</p>
                  <p className="text-sm text-muted-foreground">{section.summary}</p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="rounded-2xl border border-border/60 bg-card/30 p-4">
          <a
            href={activeSection.image}
            target="_blank"
            rel="noreferrer"
            className="block overflow-hidden rounded-2xl border border-border/60 bg-background"
          >
            <img
              src={activeSection.image}
              alt={activeSection.imageAlt}
              className="max-h-[360px] w-full object-contain bg-slate-50"
            />
          </a>
          <div className="mt-3 space-y-1">
            <p className="text-base font-semibold text-foreground">{activeSection.title}</p>
            <p className="text-sm text-muted-foreground">
              Image cliquable. Elle s ouvre seule si tu veux la relire a part, et la vignette de gauche recentre aussi la
              section de texte correspondante.
            </p>
          </div>
        </div>
      </div>

      <section
        ref={(node) => {
          sectionRefs.current.workflow = node;
        }}
        className="space-y-3 rounded-2xl border border-border/60 bg-card/30 p-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-foreground">1. Workflow global de la page</h3>
          <button
            type="button"
            onClick={() => focusSection("workflow")}
            className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700"
          >
            Afficher le schema
          </button>
        </div>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>
            La page se lit de gauche a droite. La colonne principale sert a controler la source, le mapping et le rapport. La
            colonne droite sert a piloter le job: domaine, creation, upload, relance des etapes et reprise de l historique.
          </p>
          <p>Le chemin nominal est le suivant :</p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Choisir le domaine cible. En V1, seul `spatial-nodes` est executable de bout en bout.</li>
            <li>Creer un job. Sans job, aucun fichier ne peut etre charge.</li>
            <li>Uploader un fichier `.csv`, `.xlsx` ou `.xls`.</li>
            <li>Verifier les colonnes source et ajuster le mapping.</li>
            <li>Lancer `Preview` pour voir ce que le moteur comprend sans ecriture metier.</li>
            <li>Lancer `Validate` pour verifier les regles de structure et de coherence.</li>
            <li>Lancer `Execute` seulement quand le rapport est propre.</li>
            <li>Relire le rapport final puis rouvrir le job plus tard si besoin.</li>
          </ol>
          <p>
            `Preview` et `Validate` ne modifient pas la base metier. `Execute` est la seule etape qui applique des creations ou
            des mises a jour.
          </p>
        </div>
      </section>

      <section
        ref={(node) => {
          sectionRefs.current.mapping = node;
        }}
        className="space-y-3 rounded-2xl border border-border/60 bg-card/30 p-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-foreground">2. Mapping, transformations et profils</h3>
          <button
            type="button"
            onClick={() => focusSection("mapping")}
            className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700"
          >
            Afficher le schema
          </button>
        </div>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>
            Le tableau de mapping relie les colonnes du fichier aux champs cibles attendus par le backend. Chaque ligne du
            mapping correspond a un champ cible tel que `type`, `code`, `label`, `path` ou `parentPath`.
          </p>
          <p>Pour chaque ligne, la page permet de regler :</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>la colonne source a lire ;</li>
            <li>le type de transformation a appliquer ;</li>
            <li>un `transformConfig` JSON ou une valeur constante si necessaire ;</li>
            <li>le caractere obligatoire ou non de la donnee.</li>
          </ul>
          <p>
            Si tu rejoues souvent le meme format de fichier, enregistre le mapping comme profil. Le profil memorise les colonnes,
            les transformations et quelques options de source, puis peut etre recharge pour un nouveau job.
          </p>
          <p>
            Regle pratique: le domaine spatial marche mieux quand les colonnes `type`, `code`, `label` et `parentPath` sont
            explicitement mappees. Si `path` n est pas fourni, le backend tente de le reconstruire depuis `parentPath + code`.
          </p>
        </div>
      </section>

      <section
        ref={(node) => {
          sectionRefs.current.report = node;
        }}
        className="space-y-3 rounded-2xl border border-border/60 bg-card/30 p-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-foreground">3. Rapport, reprise et limites exports V1</h3>
          <button
            type="button"
            onClick={() => focusSection("report")}
            className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700"
          >
            Afficher le schema
          </button>
        </div>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>
            Le rapport de job est la preuve de ce que le moteur a decide ligne par ligne. Il affiche le statut, la cle resolue,
            les messages techniques et le resume global du traitement.
          </p>
          <p>Les messages importants a surveiller sont :</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>`OPERATION_CREATE` : la ligne va creer un nouvel objet ;</li>
            <li>`OPERATION_UPDATE` : la ligne va mettre a jour un objet deja reconnu ;</li>
            <li>les rejets sur parent absent, type invalide, doublon de path ou doublon de code sous le meme parent.</li>
          </ul>
          <p>
            L historique en bas a droite sert a reprendre un job existant. C est utile pour relire une source, reappliquer un
            profil, rejouer une validation ou auditer une execution deja faite.
          </p>
          <p>
            Cote permissions, `imports.read` autorise la lecture, `imports.manage` autorise la creation de job, l upload et la
            sauvegarde de profils, et `imports.execute` autorise `Preview`, `Validate` et `Execute`.
          </p>
          <p>
            Le titre de la page reste `Imports et exports`, mais la partie exports centralisee n est pas encore livree dans ce
            workspace. En V1, les exports disponibles restent ceux des listes metier, typiquement les exports ODS sur les
            ecrans de referentiel.
          </p>
        </div>
      </section>
    </div>
  );
}
