"use client";

import type {
  CurrentUserResponse,
  IamRoleDetail,
  IamScopeSummary,
  IamUserDetail,
  ReplaceUserRolesInput,
  ResetUserPasswordInput
} from "@inventory/shared";
import { formatDateTime, isPasswordPolicySatisfied } from "@inventory/shared";
import {
  ActionBar,
  Button,
  DetailPage,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FormSection,
  Input,
  PasswordPolicyChecklist,
  PageSection,
  ReadOnlyField,
  StatusBadge
} from "@inventory/ui";
import { ArrowLeftIcon, SaveIcon } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AdminAuthScreen } from "@/components/admin-auth-screen";
import { AdminShell } from "@/components/admin-shell";
import { RoleAssignmentEditor, type EditableRoleAssignment } from "@/components/iam/role-assignment-editor";
import { RoleBadges } from "@/components/iam/role-badges";
import { apiFetch, isUnauthorizedApiError } from "@/lib/api";
import { useStoredToken } from "@/lib/session";

export default function UserDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const token = useStoredToken();
  const [user, setUser] = useState<IamUserDetail | null>(null);
  const [me, setMe] = useState<CurrentUserResponse | null>(null);
  const [roles, setRoles] = useState<IamRoleDetail[]>([]);
  const [scopes, setScopes] = useState<IamScopeSummary[]>([]);
  const [assignments, setAssignments] = useState<EditableRoleAssignment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [temporaryPasswordConfirmation, setTemporaryPasswordConfirmation] = useState("");
  const resetPasswordValid = isPasswordPolicySatisfied(temporaryPassword);
  const resetPasswordsMatch =
    temporaryPasswordConfirmation.length > 0 && temporaryPasswordConfirmation === temporaryPassword;

  const loadData = useCallback(async () => {
    if (!token || !params.id) {
      throw new Error("Utilisateur introuvable");
    }

    return Promise.all([
      apiFetch<CurrentUserResponse>("/auth/me"),
      apiFetch<IamUserDetail>(`/iam/users/${params.id}`),
      apiFetch<{ items: IamRoleDetail[] }>("/iam/roles?page=1&pageSize=200&sort=label&direction=asc"),
      apiFetch<IamScopeSummary[]>("/iam/scopes")
    ]);
  }, [params.id, token]);

  useEffect(() => {
    if (!token || !params.id) {
      return;
    }

    let cancelled = false;

    const run = async () => {
      try {
        const [meResponse, userResponse, rolesResponse, scopesResponse] = await loadData();
        if (cancelled) {
          return;
        }
        setMe(meResponse);
        setUser(userResponse);
        setRoles(rolesResponse.items);
        setScopes(scopesResponse);
        setAssignments(
          userResponse.scopeAssignments.map((assignment) => ({
            roleId: assignment.roleId,
            scopeId: assignment.scopeId
          }))
        );
        setError(null);
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        if (isUnauthorizedApiError(loadError)) {
          setError(null);
          setUser(null);
          return;
        }
        setError(loadError instanceof Error ? loadError.message : "Impossible de charger la fiche utilisateur");
        setUser(null);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [loadData, params.id, token]);

  if (!token) {
    return <AdminAuthScreen />;
  }

  return (
    <AdminShell>
      <DetailPage
        eyebrow="Administration IAM"
        title={user?.name ?? "Fiche utilisateur"}
        description="Consultation et mise a jour des roles et des perimetres du compte selectionne."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setResetOpen(true);
                setResetError(null);
                setTemporaryPassword("");
                setTemporaryPasswordConfirmation("");
              }}
            >
              Reinitialiser le mot de passe
            </Button>
            <Button variant="outline" onClick={() => router.push("/users")}>
              <ArrowLeftIcon className="size-4" />
              Retour a la liste
            </Button>
          </div>
        }
        aside={
          <PageSection title="Identite" description="Resume du compte et de son rattachement IAM.">
            <div className="grid gap-4">
              <ReadOnlyField label="Nom" value={user?.name ?? "Chargement"} />
              <ReadOnlyField label="Email" value={user?.email ?? "Chargement"} />
              <ReadOnlyField label="Creation" value={user ? formatDateTime(user.createdAt) : "Chargement"} />
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Statut</p>
                <div className="flex min-h-10 flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-background/70 px-3 py-2">
                  <StatusBadge
                    status={user?.isActive ? "active" : "inactive"}
                    label={user?.isActive ? "Actif" : "Inactif"}
                  />
                  {user?.mustChangePassword ? (
                    <StatusBadge status="warning" label="Mot de passe a redefinir" />
                  ) : null}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Roles actifs</p>
              <RoleBadges roles={user?.roles ?? []} />
            </div>
          </PageSection>
        }
      >
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <FormSection
          title="Roles et perimetres"
          description="Remplacement atomique des affectations de roles pour cet utilisateur."
          columns={1}
        >
          <RoleAssignmentEditor
            roles={roles}
            scopes={scopes}
            spatialScopePolicy={me?.spatialScopePolicy}
            value={assignments}
            onChange={setAssignments}
          />
        </FormSection>

        <PageSection title="Affectations resolues" description="Vue simple des roles et perimetres actuellement attaches.">
          <div className="grid gap-3">
            {user?.scopeAssignments.length ? (
              user.scopeAssignments.map((assignment) => (
                <div key={assignment.id} className="rounded-xl border border-border/60 bg-background/70 p-4">
                  <p className="font-medium text-foreground">{assignment.roleLabel}</p>
                  <p className="text-sm text-muted-foreground">
                    {assignment.scopeLabel
                      ? `${assignment.scopeType} - ${assignment.scopeLabel}`
                      : "Toute l organisation"}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Aucune affectation resolue pour cet utilisateur.</p>
            )}
          </div>
        </PageSection>

        <ActionBar
          sticky
          secondary={
            <Button variant="ghost" onClick={() => router.push("/users")}>
              Annuler
            </Button>
          }
          primary={
            <Button
              disabled={saving || !user}
              onClick={async () => {
                if (!user) {
                  return;
                }

                setSaving(true);
                setError(null);

                try {
                  const payload: ReplaceUserRolesInput = {
                    roleAssignments: assignments
                  };

                  const updated = await apiFetch<IamUserDetail>(`/iam/users/${user.id}/roles`, {
                    method: "PUT",
                    body: JSON.stringify(payload)
                  });

                  setUser(updated);
                } catch (saveError) {
                  if (isUnauthorizedApiError(saveError)) {
                    setError(null);
                    return;
                  }
                  setError(saveError instanceof Error ? saveError.message : "Impossible d enregistrer les habilitations");
                } finally {
                  setSaving(false);
                }
              }}
            >
              <SaveIcon className="size-4" />
              {saving ? "Enregistrement..." : "Enregistrer les habilitations"}
            </Button>
          }
        />
      </DetailPage>
      <Dialog
        open={resetOpen}
        onOpenChange={(open) => {
          setResetOpen(open);
          if (!open) {
            setResetError(null);
            setTemporaryPassword("");
            setTemporaryPasswordConfirmation("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reinitialiser le mot de passe</DialogTitle>
            <DialogDescription>
              {user
                ? `Definir un mot de passe temporaire pour ${user.name ?? user.email}. Le changement sera impose a la prochaine connexion.`
                : "Definir un mot de passe temporaire."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Field label="Mot de passe temporaire">
              <Input type="password" value={temporaryPassword} onChange={(event) => setTemporaryPassword(event.target.value)} />
            </Field>
            <Field label="Confirmation du mot de passe temporaire">
              <Input
                type="password"
                value={temporaryPasswordConfirmation}
                onChange={(event) => setTemporaryPasswordConfirmation(event.target.value)}
              />
            </Field>
            <PasswordPolicyChecklist password={temporaryPassword} confirmation={temporaryPasswordConfirmation} />
            {resetError ? <p className="text-sm text-destructive">{resetError}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)}>
              Annuler
            </Button>
            <Button
              disabled={resetSubmitting || !user || !resetPasswordValid || !resetPasswordsMatch}
              onClick={async () => {
                if (!user) {
                  return;
                }

                setResetSubmitting(true);
                setResetError(null);
                try {
                  const updated = await apiFetch<IamUserDetail>(`/iam/users/${user.id}/reset-password`, {
                    method: "POST",
                    body: JSON.stringify({
                      temporaryPassword
                    } satisfies ResetUserPasswordInput)
                  });

                  setUser(updated);
                  setResetOpen(false);
                } catch (saveError) {
                  if (isUnauthorizedApiError(saveError)) {
                    setResetError(null);
                    return;
                  }
                  setResetError(
                    saveError instanceof Error ? saveError.message : "Impossible de reinitialiser le mot de passe"
                  );
                } finally {
                  setResetSubmitting(false);
                }
              }}
            >
              {resetSubmitting ? "Reinitialisation..." : "Reinitialiser le mot de passe"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
