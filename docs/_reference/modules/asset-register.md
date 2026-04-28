# Asset Register (legacy reference)

> Moved here as part of the docs reorganisation. Original: `docs/modules/asset-register.md`. Some details have changed: `Asset.category` is now an FK to `AssetCategory` (tag table), and external ownership has been added (`externallyOwned` + `externalOwnerId` linking to `AssetOwner`).

---

## Purpose

The Asset Register tracks smaller, portable, or general company items. These are items that can be assigned to individual employees and are typically moveable.

**Examples:** drills, power tools, hand tools, phones, laptops, tablets, PPE, safety equipment, testing instruments.

**Not assets (use Plant Register instead):** cars, trucks, excavators, generators, forklifts — these are larger operational equipment tracked in the Plant Register.

## Key fields

| Field | Required? | Description |
|-------|-----------|------------|
| Asset Number | Yes | Unique company ID. *(2026: auto-generated)* |
| Name | Yes | Name/description of the item |
| Category | Yes | Type of asset *(2026: now an FK to `AssetCategory` tag table)* |
| Make | No | Manufacturer |
| Model | No | Model name or number |
| Serial Number | No | Serial number |
| Purchase Date | No | When the item was purchased |
| Purchase Cost | No | Cost at purchase |
| Location | No | Where the item is currently located *(2026: shared `Location` enum)* |
| Assigned To | No | Which Employee currently has this item |
| Status | Yes | AVAILABLE, IN_USE, MAINTENANCE, RETIRED, EXPIRED |
| Condition | No | NEW, GOOD, FAIR, or POOR |
| Notes | No | Free-text notes |
| Externally owned | No | *(2026 addition)* Marks the asset as third-party property |
| External Owner | No | *(2026 addition)* FK to `AssetOwner` tag table |
| Expires | No | *(2026 addition)* Marks an asset as having an expiration date |
| Expiration Date | No | *(2026 addition)* When the asset expires |

## Statuses

| Status | Meaning |
|--------|---------|
| **AVAILABLE** | Not assigned, ready for use |
| **IN_USE** | Currently assigned to or in use by someone |
| **MAINTENANCE** | Being repaired or serviced |
| **RETIRED** | No longer in service |
| **EXPIRED** | *(2026 addition)* Past expiration date |

## Condition ratings

| Condition | Meaning |
|-----------|---------|
| **NEW** | Brand new or near-new |
| **GOOD** | Working well, normal wear |
| **FAIR** | Usable but showing significant wear |
| **POOR** | Needs repair or replacement soon |

## Permissions

| Action | ADMIN | STAFF (future) |
|--------|-------|---------------|
| View list | Yes | View only (admin-selected items) |
| Create | Yes | No |
| Edit | Yes | No |
| Archive | Yes | No |

## Relationships

- An asset can optionally be **assigned to one Employee**
- An asset can optionally be **linked to a Plant item** *(2026: via `PlantAssetLink`; location and `assignedTo` mirror the plant when linked, then clear when unlinked)*
- An asset can be **externally owned** by an `AssetOwner` *(2026 addition)*

## Future: file/document relationship

In Stage 3, documents will be attachable to asset records.
