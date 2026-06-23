INSERT INTO "iam_permissions" ("id", "code", "label", "description", "domain", "createdAt", "updatedAt")
SELECT
  gen_random_uuid(),
  payload.code,
  payload.label,
  payload.description,
  payload.domain,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM (
  VALUES
    ('insurances.read', 'Consulter les assurances', 'Voir les contrats d assurance et leurs echeances.', 'insurances'),
    ('insurances.create', 'Creer des contrats d assurance', 'Ajouter des contrats d assurance au tenant.', 'insurances'),
    ('insurances.update', 'Modifier les assurances', 'Modifier les contrats d assurance et leurs dates cles.', 'insurances'),
    ('insurances.archive', 'Archiver les assurances', 'Archiver logiquement des contrats d assurance.', 'insurances'),
    ('insurances.history.read', 'Consulter l historique assurances', 'Voir les changements traces sur les contrats d assurance.', 'insurances')
) AS payload(code, label, description, domain)
WHERE NOT EXISTS (
  SELECT 1
  FROM "iam_permissions" existing
  WHERE existing."code" = payload.code
);

INSERT INTO "iam_role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT
  gen_random_uuid(),
  role_payload."roleId",
  role_payload."permissionId",
  CURRENT_TIMESTAMP
FROM (
  SELECT roles."id" AS "roleId", permissions."id" AS "permissionId"
  FROM "iam_roles" roles
  JOIN "iam_permissions" permissions ON permissions."code" IN (
    'insurances.read',
    'insurances.create',
    'insurances.update',
    'insurances.archive',
    'insurances.history.read'
  )
  WHERE roles."code" = 'ADMINISTRATOR'

  UNION ALL

  SELECT roles."id" AS "roleId", permissions."id" AS "permissionId"
  FROM "iam_roles" roles
  JOIN "iam_permissions" permissions ON permissions."code" IN (
    'insurances.read',
    'insurances.create',
    'insurances.update',
    'insurances.archive',
    'insurances.history.read'
  )
  WHERE roles."code" = 'ASSET_MANAGER'

  UNION ALL

  SELECT roles."id" AS "roleId", permissions."id" AS "permissionId"
  FROM "iam_roles" roles
  JOIN "iam_permissions" permissions ON permissions."code" IN (
    'insurances.read',
    'insurances.history.read'
  )
  WHERE roles."code" = 'ACCOUNTING'

  UNION ALL

  SELECT roles."id" AS "roleId", permissions."id" AS "permissionId"
  FROM "iam_roles" roles
  JOIN "iam_permissions" permissions ON permissions."code" IN (
    'insurances.read'
  )
  WHERE roles."code" IN ('INVENTORY_AGENT', 'LOGISTICS', 'CAMPAIGN_SUPERVISOR', 'EXTERNAL_PROVIDER')
) AS role_payload
WHERE NOT EXISTS (
  SELECT 1
  FROM "iam_role_permissions" existing
  WHERE existing."roleId" = role_payload."roleId"
    AND existing."permissionId" = role_payload."permissionId"
);
