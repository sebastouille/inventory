# ADR 0017 - Scan terrain camera, douchette HID et IndexedDB

## Statut

Accepte

## Contexte

L execution terrain des campagnes equipements utilisait une saisie de payload et une file simple cote navigateur. La cible V1 demande un scan utilisable sur smartphone, avec camera prioritaire, douchette Bluetooth possible, et reprise offline plus robuste.

## Decision

Le scan terrain V1 reste dans `apps/web` en mode responsive.

Les choix techniques sont :

- camera smartphone prioritaire via `BarcodeDetector` quand il est disponible, avec fallback `@zxing/browser` ;
- douchette Bluetooth supportee en mode clavier HID, sans driver specifique ;
- saisie manuelle toujours disponible ;
- parsing unique des payloads dans `packages/shared` ;
- stockage local IndexedDB par campagne ;
- synchronisation idempotente par `clientObservationId` et `clientBatchId` ;
- endpoint dedie `complete-node` pour generer les anomalies `MISSING` d un noeud actif.

## Consequences

- Le serveur reste maitre du resultat d observation.
- Le web reste compatible desktop, smartphone et douchette clavier.
- Les navigateurs sans decodeur camera utilisent le mode douchette ou manuel.
- Les SDK BLE proprietaires, terminaux natifs et RFID restent differes.
