# Asset Register

## Purpose

The Asset Register tracks smaller, portable, or general company items. These are items that can be assigned to individual employees and are typically moveable.

**Examples:** drills, power tools, hand tools, phones, laptops, tablets, PPE, safety equipment, testing instruments.

**Not assets (use Plant Register instead):** cars, trucks, excavators, generators, forklifts — these are larger operational equipment tracked in the Plant Register.

## Key fields

| Field | Required? | Description |
|-------|-----------|------------|
| Asset Number | Yes | Unique company ID (e.g. "AST-001"). Manually entered. |
| Name | Yes | Name/description of the item |
| Category | Yes | Type of asset (e.g. "Power Tool", "IT Equipment", "PPE") |
| Make | No | Manufacturer |
| Model | No | Model name or number |
| Serial Number | No | Serial number |
| Purchase Date | No | When the item was purchased |
| Purchase Cost | No | Cost at purchase |
| Location | No | Where the item is currently located |
| Assigned To | No | Which Employee currently has this item |
| Status | Yes | AVAILABLE, IN_USE, MAINTENANCE, or RETIRED |
| Condition | No | NEW, GOOD, FAIR, or POOR |
| Notes | No | Free-text notes |

## Statuses

| Status | Meaning |
|--------|---------|
| **AVAILABLE** | Not assigned, ready for use |
| **IN_USE** | Currently assigned to or in use by someone |
| **MAINTENANCE** | Being repaired or serviced |
| **RETIRED** | No longer in service |

## Condition ratings

| Condition | Meaning |
|-----------|---------|
| **NEW** | Brand new or near-new |
| **GOOD** | Working well, normal wear |
| **FAIR** | Usable but showing significant wear |
| **POOR** | Needs repair or replacement soon |

## Expected workflows

### Adding a new asset
1. Admin clicks "Add Asset"
2. Fills in asset number, name, category (required)
3. Optionally fills in make, model, serial number, etc.
4. Optionally assigns to an employee
5. Saves

### Assigning an asset to an employee
1. Admin opens the asset record
2. Clicks "Edit"
3. Selects an employee from the "Assigned To" dropdown
4. Changes status to "In Use"
5. Saves

### Archiving an asset
1. Admin opens the asset record
2. Clicks "Archive"
3. Confirms — asset is hidden from default list but not deleted

## Permissions

| Action | ADMIN | STAFF (future) |
|--------|-------|---------------|
| View list | Yes | View only (admin-selected items) |
| Create | Yes | No |
| Edit | Yes | No |
| Archive | Yes | No |

## Relationships

- An asset can optionally be **assigned to one Employee**
- An employee can have **many assets** assigned to them
- Each record tracks which **User** (login account) created it

## Future: file/document relationship

In Stage 3, documents will be attachable to asset records. Examples:
- Purchase receipts
- Warranty documents
- Calibration certificates
- Photos

## Future: reporting needs

- All assets by category
- All assets assigned to a specific employee
- Assets by status (how many available, in use, in maintenance)
- Assets by condition
- Total asset value
- Assets due for replacement (poor condition + old)
