DELETE FROM "iam_role_permissions"
WHERE "permissionId" IN (
  SELECT "id"
  FROM "iam_permissions"
  WHERE "code" IN (
    'insurances.read',
    'insurances.create',
    'insurances.update',
    'insurances.archive',
    'insurances.history.read'
  )
);

DELETE FROM "iam_permissions"
WHERE "code" IN (
  'insurances.read',
  'insurances.create',
  'insurances.update',
  'insurances.archive',
  'insurances.history.read'
);

DELETE FROM "AuditLog"
WHERE "action" IN (
  'insurances.created',
  'insurances.updated',
  'insurances.archived'
)
OR "entityType" = 'insurance_contract';

DROP TABLE IF EXISTS "insurance_contracts";

DROP TYPE IF EXISTS "InsuranceContractType";
