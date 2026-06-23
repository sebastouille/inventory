# Etape - V1 scan terrain camera et douchette HID

## Objectif

Livrer un poste de scan terrain mobile pour les campagnes d inventaire equipements.

La cible V1 est :

- scan camera smartphone prioritaire ;
- douchette Bluetooth en mode clavier HID si elle est connectee au telephone ;
- saisie manuelle en secours ;
- file offline locale robuste via IndexedDB ;
- synchronisation idempotente cote API ;
- fin de piece permettant de generer les anomalies `MISSING`.

## Perimetre

Inclus :

- contrats partages de parsing scan et metadonnees de scan ;
- endpoint `complete-node` pour terminer un noeud scanne ;
- metadonnees de scan persistantes sur `InventoryObservation` ;
- refonte de l ecran web `/campaigns/:id/run` ;
- documentation d architecture et modele.

Hors perimetre :

- application native ;
- SDK BLE proprietaire ;
- RFID ;
- QR code ;
- upload photo effectif ;
- cache PWA complet par service worker.

## Plan

1. Ajouter `InventoryScanSource` et les champs `scanSource`, `deviceHint`, `clientObservedAt`.
2. Ajouter les contrats partages `ScanPayloadKind`, `ScanSource`, `parseScanPayload`, `CompleteInventoryNodeInput` et `CompleteInventoryNodeResult`.
3. Etendre la synchronisation campagne pour accepter les metadonnees de scan et l active node par observation.
4. Ajouter `POST /api/v1/inventory-campaigns/:id/complete-node`.
5. Refaire l ecran terrain avec modes `Camera`, `Douchette`, `Manuel`, IndexedDB, feedback et synchronisation.
6. Mettre a jour les specifications racine et le backlog.

## Hypotheses

- Les etiquettes terrain encodent deja `EQ:<internalCode>` et `NODE:<spatialNodeId>`.
- Le serveur reste la source de verite du verdict d observation.
- Le scan camera V1 utilise `BarcodeDetector` si disponible, puis `@zxing/browser` en fallback ; si aucun decodeur ne fonctionne, l UI bascule proprement vers douchette ou manuel.
- La douchette Bluetooth est configuree comme clavier HID.

## Tests

- build shared ;
- build API ;
- build web ;
- tests API existants ;
- verification fonctionnelle du parsing scan ;
- verification de l endpoint `complete-node` ;
- verification de l ecran terrain sur navigateur desktop avec saisie simulee.

## Notes d implementation

- Le stockage local passe de `localStorage` a IndexedDB.
- Le champ capture HID est maintenu dans l ecran pour accepter les suffixes `Enter` et `Tab`.
- `complete-node` est idempotent : une anomalie `MISSING` existante n est pas dupliquee.
- `InventoryObservation` conserve `scanSource`, `deviceHint` et `clientObservedAt`.
- `BarcodeDetector` est utilise comme decodeur camera V1 quand le navigateur le supporte ; `@zxing/browser` prend le relais si le decodeur natif est absent.
- La generation Prisma a necessite l arret du serveur API dev qui verrouillait `query_engine-windows.dll.node`.

## Tests executes

- `cmd /c npx prisma validate --schema prisma\schema.prisma` : OK
- `cmd /c npx prisma generate --schema prisma\schema.prisma` : OK apres arret de l API dev
- `cmd /c "set DATABASE_URL=postgresql://inventory:inventory@127.0.0.1:5560/inventory&& npx prisma migrate deploy --schema prisma\schema.prisma"` : OK
- `cmd /c npm run build --workspace @inventory/shared` : OK
- `cmd /c npm run test --workspace @inventory/shared` : OK
- `cmd /c npm run build --workspace api` : OK
- `cmd /c npm run build --workspace web` : OK
- `cmd /c npm run test --workspace web` : OK
- `cmd /c npm run test --workspace api -- --exclude test/prisma-migrations.spec.ts` : OK

## Limite de test connue

- `cmd /c npm run test --workspace api` echoue uniquement sur `test/prisma-migrations.spec.ts`, car ce test pointe vers `127.0.0.1:5555` alors que la base locale active du projet est `127.0.0.1:5560`.

## Correctif campagne

- la page `apps/web/app/campaigns/page.tsx` contenait un retour conditionnel avant la fin des hooks React, ce qui pouvait provoquer `Rendered fewer hooks than expected`
- le retour vers `WebAuthScreen` est maintenant place apres tous les hooks pour conserver la sequence stable
