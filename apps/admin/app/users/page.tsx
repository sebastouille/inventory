"use client";

import type {
  CreateUserInput,
  CurrentUserResponse,
  IamRoleDetail,
  IamScopeSummary,
  IamUserListItem,
  PaginatedResponse,
  ResetUserPasswordInput
} from "@inventory/shared";
import { formatDateTime, isPasswordPolicySatisfied } from "@inventory/shared";
import {
  Button,
  DataGrid,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FilterBar,
  FormSection,
  Input,
  ListPage,
  PasswordPolicyChecklist,
  PageSection,
  PaginationBar,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StatusBadge
} from "@inventory/ui";
import { DownloadIcon, RefreshCwIcon, UserPlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { startTransition, useCallback, useDeferredValue, useEffect, useState } from "react";
import { AdminAuthScreen } from "@/components/admin-auth-screen";
import { AdminShell } from "@/components/admin-shell";
import { RoleAssignmentEditor, type EditableRoleAssignment } from "@/components/iam/role-assignment-editor";
import { RoleBadges } from "@/components/iam/role-badges";
import { apiDownload, apiFetch, isUnauthorizedApiError } from "@/lib/api";
import { buildQueryString } from "@/lib/query-string";
import { useStoredToken } from "@/lib/session";

const defaultCreateForm = {
  email: "",
  password: "",
  passwordConfirmation: "",
  name: "",
  roleAssignments: [] as EditableRoleAssignment[]
};

const defaultResetForm = {
  temporaryPassword: "",
  temporaryPasswordConfirmation: ""
};

export default function UsersPage() {
  const router = useRouter();
  const token = useStoredToken();
  const [response, setResponse] = useState<PaginatedResponse<IamUserListItem> | null>(null);
  const [me, setMe] = useState<CurrentUserResponse | null>(null);
  const [roles, setRoles] = useState<IamRoleDetail[]>([]);
  const [scopes, setScopes] = useState<IamScopeSummary[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [form, setForm] = useState(defaultCreateForm);
  const [pendingResetUser, setPendingResetUser] = useState<IamUserListItem | null>(null);
  const [resetForm, setResetForm] = useState(defaultResetForm);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [query, setQuery] = useState({
    page: 1,
    pageSize: 10,
    sort: "createdAt" as "createdAt" | "name" | "email",
    direction: "desc" as "asc" | "desc",
    q: "",
    roleId: "all",
    isActive: "all"
  });
  const deferredSearch = useDeferredValue(query.q);
  const createPasswordValid = isPasswordPolicySatisfied(form.password);
  const createPasswordsMatch =
    form.passwordConfirmation.length > 0 && form.passwordConfirmation === form.password;
  const canSubmitCreateUser =
    form.email.trim().length > 0 &&
    form.password.length > 0 &&
    createPasswordValid &&
    createPasswordsMatch &&
    form.roleAssignments.length > 0;
  const resetPasswordValid = isPasswordPolicySatisfied(resetForm.temporaryPassword);
  const resetPasswordsMatch =
    resetForm.temporaryPasswordConfirmation.length > 0 &&
    resetForm.temporaryPasswordConfirmation === resetForm.temporaryPassword;
  const canSubmitResetPassword = resetPasswordValid && resetPasswordsMatch;

  const loadData = useCallback(async () => {
    if (!token) {
      throw new Error("Session absente");
    }

    return Promise.all([
      apiFetch<CurrentUserResponse>("/auth/me"),
      apiFetch<PaginatedResponse<IamUserListItem>>(
        `/iam/users${buildQueryString({
          page: query.page,
          pageSize: query.pageSize,
          sort: query.sort,
          direction: query.direction,
          q: deferredSearch,
          roleId: query.roleId === "all" ? undefined : query.roleId,
          isActive: query.isActive === "all" ? undefined : query.isActive
        })}`
      ),
      apiFetch<PaginatedResponse<IamRoleDetail>>("/iam/roles?page=1&pageSize=200&sort=label&direction=asc"),
      apiFetch<IamScopeSummary[]>("/iam/scopes")
    ]);
  }, [deferredSearch, query.direction, query.isActive, query.page, query.pageSize, query.roleId, query.sort, token]);

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;

    const run = async () => {
      try {
        const [meResponse, usersResponse, rolesResponse, scopesResponse] = await loadData();
        if (cancelled) {
          return;
        }
        startTransition(() => {
          setMe(meResponse);
          setResponse(usersResponse);
          setRoles(rolesResponse.items);
          setScopes(scopesResponse);
          setLoadError(null);
          setSelectedIds([]);
        });
      } catch (error) {
        if (cancelled) {
          return;
        }
        if (isUnauthorizedApiError(error)) {
          startTransition(() => {
            setLoadError(null);
            setResponse(null);
          });
          return;
        }
        startTransition(() => {
          setLoadError(error instanceof Error ? error.message : "Impossible de charger les utilisateurs");
          setResponse(null);
        });
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [loadData, token]);

  const refreshData = async () => {
    try {
      const [meResponse, usersResponse, rolesResponse, scopesResponse] = await loadData();
      startTransition(() => {
        setMe(meResponse);
        setResponse(usersResponse);
        setRoles(rolesResponse.items);
        setScopes(scopesResponse);
        setLoadError(null);
        setSelectedIds([]);
      });
    } catch (error) {
      if (isUnauthorizedApiError(error)) {
        setLoadError(null);
        return;
      }
      setLoadError(error instanceof Error ? error.message : "Impossible de charger les utilisateurs");
    }
  };

  if (!token) {
    return <AdminAuthScreen />;
  }

  return (
    <AdminShell>
      <ListPage
        eyebrow="Administration IAM"
        title="Utilisateurs"
        description="Gestion des comptes, des roles et des perimetres d intervention."
        filters={
          <FilterBar
            searchValue={query.q}
            onSearchChange={(value) => {
              setQuery((current) => ({ ...current, q: value, page: 1 }));
            }}
            searchPlaceholder="Rechercher par nom ou email"
            filters={
              <>
                <Select
                  value={query.roleId}
                  onValueChange={(value) =>
                    setQuery((current) => ({ ...current, roleId: value ?? "all", page: 1 }))
                  }
                >
                  <SelectTrigger className="min-w-52">
                    <SelectValue placeholder="Tous les roles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les roles</SelectItem>
                    {roles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={query.isActive}
                  onValueChange={(value) =>
                    setQuery((current) => ({ ...current, isActive: value ?? "all", page: 1 }))
                  }
                >
                  <SelectTrigger className="min-w-40">
                    <SelectValue placeholder="Tous les statuts" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les statuts</SelectItem>
                    <SelectItem value="true">Actifs</SelectItem>
                    <SelectItem value="false">Inactifs</SelectItem>
                  </SelectContent>
                </Select>
              </>
            }
            actions={
              <>
                <Button variant="outline" onClick={() => void refreshData()}>
                  <RefreshCwIcon className="size-4" />
                  Rafraichir
                </Button>
                <Button
                  variant="outline"
                  onClick={async () =>
                    apiDownload(
                      `/iam/users/export${buildQueryString({
                        sort: query.sort,
                        direction: query.direction,
                        q: deferredSearch,
                        roleId: query.roleId === "all" ? undefined : query.roleId,
                        isActive: query.isActive === "all" ? undefined : query.isActive
                      })}`
                    )
                  }
                >
                  <DownloadIcon className="size-4" />
                  Exporter ODS
                </Button>
              </>
            }
          />
        }
        grid={
          <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_390px]">
            <PageSection
              title="Comptes du tenant"
              description={
                selectedIds.length > 0
                  ? `${selectedIds.length} ligne(s) selectionnee(s)`
                  : "Tri, recherche, pagination et selection multiple."
              }
            >
              {loadError ? <p className="text-sm text-destructive">{loadError}</p> : null}
              <DataGrid
                rows={response?.items ?? []}
                columns={[
                  {
                    key: "name",
                    label: "Utilisateur",
                    sortable: true,
                    render: (user) => (
                      <div className="space-y-1">
                        <p className="font-medium text-foreground">{user.name ?? "Utilisateur sans nom"}</p>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>{user.email}</span>
                          {user.mustChangePassword ? (
                            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                              Mot de passe a redefinir
                            </span>
                          ) : null}
                        </div>
                      </div>
                    )
                  },
                  {
                    key: "email",
                    label: "Email",
                    sortable: true,
                    render: (user) => <span className="text-sm text-muted-foreground">{user.email}</span>
                  },
                  {
                    key: "roles",
                    label: "Roles",
                    render: (user) => <RoleBadges roles={user.roles} />
                  },
                  {
                    key: "status",
                    label: "Statut",
                    render: (user) => (
                      <StatusBadge
                        status={user.isActive ? "active" : "inactive"}
                        label={user.isActive ? "Actif" : "Inactif"}
                      />
                    )
                  },
                  {
                    key: "createdAt",
                    label: "Creation",
                    sortable: true,
                    render: (user) => (
                      <span className="text-sm text-muted-foreground">{formatDateTime(user.createdAt)}</span>
                    )
                  }
                ]}
                sort={query.sort}
                direction={query.direction}
                onSortChange={(sort, direction) =>
                  setQuery((current) => ({
                    ...current,
                    sort: sort as typeof current.sort,
                    direction,
                    page: 1
                  }))
                }
                getRowId={(user) => user.id}
                getMobileTitle={(user) => user.name ?? user.email}
                getMobileDescription={(user) => user.email}
                getMobileMeta={(user) => (
                  <div className="space-y-2.5">
                    <RoleBadges roles={user.roles} />
                    <StatusBadge
                      status={user.isActive ? "active" : "inactive"}
                      label={user.isActive ? "Actif" : "Inactif"}
                    />
                  </div>
                )}
                rowActions={[
                  {
                    label: "Afficher",
                    onClick: (user) => router.push(`/users/${user.id}`)
                  },
                  {
                    label: "Reinitialiser le mot de passe",
                    onClick: (user) => {
                      setPendingResetUser(user);
                      setResetForm(defaultResetForm);
                      setResetError(null);
                    }
                  }
                ]}
                selectedIds={selectedIds}
                onSelectedIdsChange={setSelectedIds}
                emptyTitle="Aucun utilisateur"
                emptyDescription="Aucun compte ne correspond aux filtres courants."
              />
            </PageSection>

            <PageSection title="Creer un utilisateur" description="Initialiser le compte et ses habilitations.">
              <div className="space-y-4">
                {submitError ? <p className="text-sm text-destructive">{submitError}</p> : null}
                <FormSection title="Identite" description="Informations minimales du compte." columns={1}>
                  <Field label="Nom complet" htmlFor="user-name">
                    <Input
                      id="user-name"
                      placeholder="Exemple: Marie Dupont"
                      value={form.name}
                      onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                    />
                  </Field>
                  <Field label="Email" htmlFor="user-email">
                    <Input
                      id="user-email"
                      placeholder="prenom.nom@example.test"
                      type="email"
                      value={form.email}
                      onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                    />
                  </Field>
                  <Field label="Mot de passe initial" htmlFor="user-password">
                    <Input
                      id="user-password"
                      placeholder="Choisir un mot de passe"
                      type="password"
                      value={form.password}
                      onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                    />
                  </Field>
                  <Field label="Confirmation du mot de passe" htmlFor="user-password-confirmation">
                    <Input
                      id="user-password-confirmation"
                      placeholder="Ressaisir le mot de passe"
                      type="password"
                      value={form.passwordConfirmation}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, passwordConfirmation: event.target.value }))
                      }
                    />
                  </Field>
                  <PasswordPolicyChecklist password={form.password} confirmation={form.passwordConfirmation} />
                </FormSection>

                <FormSection
                  title="Habilitations"
                  description="Chaque utilisateur doit recevoir au moins un role."
                  columns={1}
                >
                  <RoleAssignmentEditor
                    roles={roles}
                    scopes={scopes}
                    spatialScopePolicy={me?.spatialScopePolicy}
                    value={form.roleAssignments}
                    onChange={(roleAssignments) => setForm((current) => ({ ...current, roleAssignments }))}
                  />
                </FormSection>

                <Button
                  className="w-full"
                  disabled={submitting || !canSubmitCreateUser}
                  onClick={async () => {
                    setSubmitting(true);
                    setSubmitError(null);

                    try {
                      const payload: CreateUserInput = {
                        email: form.email,
                        password: form.password,
                        name: form.name || null,
                        roleAssignments: form.roleAssignments
                      };

                      await apiFetch("/iam/users", {
                        method: "POST",
                        body: JSON.stringify(payload)
                      });

                      setForm(defaultCreateForm);
                      await refreshData();
                    } catch (error) {
                      if (isUnauthorizedApiError(error)) {
                        setSubmitError(null);
                        return;
                      }
                      setSubmitError(error instanceof Error ? error.message : "Impossible de creer l utilisateur");
                    } finally {
                      setSubmitting(false);
                    }
                  }}
                >
                  <UserPlusIcon className="size-4" />
                  {submitting ? "Creation..." : "Creer l utilisateur"}
                </Button>
              </div>
            </PageSection>
          </div>
        }
        pagination={
          <PaginationBar
            page={response?.page ?? query.page}
            pageSize={response?.pageSize ?? query.pageSize}
            total={response?.total ?? 0}
            onPageChange={(page) => setQuery((current) => ({ ...current, page }))}
            onPageSizeChange={(pageSize) => setQuery((current) => ({ ...current, pageSize, page: 1 }))}
          />
        }
      />
      <Dialog
        open={pendingResetUser !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingResetUser(null);
            setResetForm(defaultResetForm);
            setResetError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reinitialiser le mot de passe</DialogTitle>
            <DialogDescription>
              {pendingResetUser
                ? `Definir un mot de passe temporaire pour ${pendingResetUser.name ?? pendingResetUser.email}. L utilisateur devra le redefinir a sa prochaine connexion.`
                : "Definir un mot de passe temporaire."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Field label="Mot de passe temporaire" htmlFor="reset-user-password">
              <Input
                id="reset-user-password"
                type="password"
                value={resetForm.temporaryPassword}
                onChange={(event) =>
                  setResetForm((current) => ({ ...current, temporaryPassword: event.target.value }))
                }
              />
            </Field>
            <Field label="Confirmation du mot de passe temporaire" htmlFor="reset-user-password-confirmation">
              <Input
                id="reset-user-password-confirmation"
                type="password"
                value={resetForm.temporaryPasswordConfirmation}
                onChange={(event) =>
                  setResetForm((current) => ({
                    ...current,
                    temporaryPasswordConfirmation: event.target.value
                  }))
                }
              />
            </Field>
            <PasswordPolicyChecklist
              password={resetForm.temporaryPassword}
              confirmation={resetForm.temporaryPasswordConfirmation}
            />
            {resetError ? <p className="text-sm text-destructive">{resetError}</p> : null}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPendingResetUser(null);
                setResetForm(defaultResetForm);
                setResetError(null);
              }}
            >
              Annuler
            </Button>
            <Button
              disabled={resetSubmitting || !pendingResetUser || !canSubmitResetPassword}
              onClick={async () => {
                if (!pendingResetUser) {
                  return;
                }

                setResetSubmitting(true);
                setResetError(null);
                try {
                  const payload: ResetUserPasswordInput = {
                    temporaryPassword: resetForm.temporaryPassword
                  };

                  await apiFetch(`/iam/users/${pendingResetUser.id}/reset-password`, {
                    method: "POST",
                    body: JSON.stringify(payload)
                  });

                  setPendingResetUser(null);
                  setResetForm(defaultResetForm);
                  await refreshData();
                } catch (error) {
                  if (isUnauthorizedApiError(error)) {
                    setResetError(null);
                    return;
                  }
                  setResetError(
                    error instanceof Error ? error.message : "Impossible de reinitialiser le mot de passe"
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
