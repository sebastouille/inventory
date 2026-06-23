"use client";

import type { AssetAssignableUser, AssetAssignmentInput, AssetListItem } from "@inventory/shared";
import { Button, Field, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@inventory/ui";
import { PlusIcon, Trash2Icon } from "lucide-react";

interface AssetAssignmentEditorProps {
  assignments: AssetAssignmentInput[];
  users: AssetAssignableUser[];
  assets: AssetListItem[];
  onChange: (assignments: AssetAssignmentInput[]) => void;
}

const assignmentTypes = [
  { value: "PERSON", label: "Personne" },
  { value: "ASSET", label: "Asset parent" }
] as const;

function createEmptyAssignment(): AssetAssignmentInput {
  return {
    assignmentType: "PERSON",
    targetUserId: null,
    targetPersonName: null,
    targetLocationId: null,
    targetEquipmentId: null,
    startsAt: null,
    endsAt: null,
    notes: null
  };
}

function buildUserLabel(user: AssetAssignableUser | null) {
  if (!user) {
    return "Aucun utilisateur";
  }
  return user.name ? `${user.name} - ${user.email}` : user.email;
}

function buildParentAssetLabel(asset: AssetListItem | null) {
  if (!asset) {
    return "Aucun asset parent";
  }
  return `${asset.equipmentModel?.label ?? asset.equipmentType.label} - ${asset.internalCode}`;
}

export function AssetAssignmentEditor({
  assignments,
  users,
  assets,
  onChange
}: AssetAssignmentEditorProps) {
  const updateAt = (index: number, next: Partial<AssetAssignmentInput>) => {
    onChange(assignments.map((assignment, currentIndex) => (currentIndex === index ? { ...assignment, ...next } : assignment)));
  };

  const removeAt = (index: number) => {
    onChange(assignments.filter((_, currentIndex) => currentIndex !== index));
  };

  return (
    <div className="space-y-4">
      {assignments.map((assignment, index) => (
        (() => {
          const selectedUser = users.find((user) => user.id === assignment.targetUserId) ?? null;
          const selectedAsset = assets.find((asset) => asset.id === assignment.targetEquipmentId) ?? null;
          const selectedAssignmentType =
            assignmentTypes.find((item) => item.value === assignment.assignmentType)?.label ?? "Personne";
          return (
        <div key={`${assignment.assignmentType}-${index}`} className="space-y-4 rounded-2xl border border-border/60 bg-background/70 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="w-full max-w-56">
              <p className="mb-2 text-sm font-medium text-foreground">Type d affectation</p>
              <Select
                value={assignment.assignmentType}
                onValueChange={(value) =>
                  updateAt(index, {
                    assignmentType: value as AssetAssignmentInput["assignmentType"],
                    targetUserId: null,
                    targetPersonName: null,
                    targetEquipmentId: null
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue>{selectedAssignmentType}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {assignmentTypes.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="ghost" size="sm" onClick={() => removeAt(index)}>
              <Trash2Icon className="size-4" />
              Retirer
            </Button>
          </div>

          {assignment.assignmentType === "PERSON" ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Utilisateur interne">
                <Select
                  value={assignment.targetUserId ?? "none"}
                  onValueChange={(value) => updateAt(index, { targetUserId: value === "none" ? null : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Aucun utilisateur">
                      {buildUserLabel(selectedUser)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun utilisateur</SelectItem>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name ? `${user.name} - ${user.email}` : user.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Nom libre">
                <Input
                  value={assignment.targetPersonName ?? ""}
                  placeholder="Nom de la personne"
                  onChange={(event) => updateAt(index, { targetPersonName: event.target.value || null })}
                />
              </Field>
            </div>
          ) : null}

          {assignment.assignmentType === "ASSET" ? (
            <Field label="Asset parent">
              <Select
                value={assignment.targetEquipmentId ?? "none"}
                onValueChange={(value) => updateAt(index, { targetEquipmentId: value === "none" ? null : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un asset parent">
                    {buildParentAssetLabel(selectedAsset)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun asset parent</SelectItem>
                  {assets.map((asset) => (
                    <SelectItem key={asset.id} value={asset.id}>
                      {(asset.equipmentModel?.label ?? asset.equipmentType.label) + " - " + asset.internalCode}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : null}

          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Debut">
              <Input
                className="max-w-44"
                type="date"
                value={assignment.startsAt ?? ""}
                onChange={(event) => updateAt(index, { startsAt: event.target.value || null })}
              />
            </Field>
            <Field label="Fin">
              <Input
                className="max-w-44"
                type="date"
                value={assignment.endsAt ?? ""}
                onChange={(event) => updateAt(index, { endsAt: event.target.value || null })}
              />
            </Field>
            <Field label="Notes">
              <Input
                value={assignment.notes ?? ""}
                placeholder="Commentaire"
                onChange={(event) => updateAt(index, { notes: event.target.value || null })}
              />
            </Field>
          </div>
        </div>
          );
        })()
      ))}

      <Button variant="outline" onClick={() => onChange([...assignments, createEmptyAssignment()])}>
        <PlusIcon className="size-4" />
        Ajouter une affectation
      </Button>
    </div>
  );
}
