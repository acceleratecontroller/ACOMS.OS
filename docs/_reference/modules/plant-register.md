# Plant Register (legacy reference)

> Moved here as part of the docs reorganisation. Original: `docs/modules/plant-register.md`. Some fields have been added since (e.g. `ampolCardNumber`, `linktTagNumber`, `fleetDynamicsSerialNumber`, `coiExpirationDate`).

---

## Purpose

The Plant Register tracks larger operational equipment and machinery. These are significant company assets that typically have registration numbers, service schedules, and compliance requirements.

**Examples:** cars, trucks, excavators, generators, forklifts, cranes, compressors, welding rigs, trailers, concrete mixers.

**Not plant (use Asset Register instead):** drills, hand tools, phones, laptops, PPE — these are smaller portable items tracked in the Asset Register.

## Key fields (2026)

| Field | Description |
|---|---|
| Plant Number | Unique company ID, auto-generated |
| Category | Type of plant (free text) |
| State Registered | Australian state/territory of registration |
| Registration Number | Vehicle registration |
| VIN Number | Chassis VIN |
| Year, Make, Model | — |
| Licence Type | Required licence to operate |
| Location | Shared `Location` enum |
| Assigned To | Optional FK to Employee |
| Ampol Card Number, Ampol Card Expiry | Fuel-card details |
| Linkt Tag Number | Toll-tag |
| Fleet Dynamics Serial Number | Telematics |
| COI Expiration Date | Certificate of Inspection expiry |
| Purchase Date / Purchase Price | — |
| Sold Date / Sold Price | — |
| Last Service Date / Next Service Due | — |
| Status | OPERATIONAL, MAINTENANCE, DECOMMISSIONED, STANDBY |
| Condition | NEW, GOOD, FAIR, POOR |
| Comments | Free-text notes |

## Statuses

| Status | Meaning |
|--------|---------|
| **OPERATIONAL** | In active use |
| **MAINTENANCE** | Being repaired or serviced |
| **DECOMMISSIONED** | Permanently out of service |
| **STANDBY** | Available but not currently deployed |

## Permissions

| Action | ADMIN | STAFF (future) |
|--------|-------|---------------|
| View list | Yes | View only (admin-selected items) |
| Create | Yes | No |
| Edit | Yes | No |
| Archive | Yes | No |

## Relationships

- A plant item can be **assigned to one Employee**
- A plant item can have **linked Assets** (e.g. first-aid kit, fire extinguisher) via `PlantAssetLink`. When an asset is linked, its `location` and `assignedTo` mirror the plant; when unlinked, both clear.

## Future: file/document relationship

In Stage 3, documents will be attachable to plant records.
