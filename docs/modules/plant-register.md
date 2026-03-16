# Plant Register

## Purpose

The Plant Register tracks larger operational equipment and machinery. These are significant company assets that typically have registration numbers, service schedules, and compliance requirements.

**Examples:** cars, trucks, excavators, generators, forklifts, cranes, compressors, welding rigs, trailers, concrete mixers.

**Not plant (use Asset Register instead):** drills, hand tools, phones, laptops, PPE — these are smaller portable items tracked in the Asset Register.

## Key fields

| Field | Required? | Description |
|-------|-----------|------------|
| Plant Number | Yes | Unique company ID (e.g. "PLT-001"). Manually entered. |
| Name | Yes | Name/description of the equipment |
| Category | Yes | Type of plant (e.g. "Excavator", "Truck", "Generator") |
| Make | No | Manufacturer (e.g. "Caterpillar", "Toyota") |
| Model | No | Model name or number |
| Serial Number | No | Serial number |
| Year of Manufacture | No | Year the equipment was made |
| Registration Number | No | Vehicle registration or compliance number |
| Purchase Date | No | When purchased |
| Purchase Cost | No | Cost at purchase |
| Location | No | Where the equipment is currently stationed |
| Assigned To | No | Which Employee is responsible for this item (optional) |
| Status | Yes | OPERATIONAL, MAINTENANCE, DECOMMISSIONED, or STANDBY |
| Condition | No | NEW, GOOD, FAIR, or POOR |
| Last Service Date | No | When the equipment was last serviced |
| Next Service Due | No | When the next service is due |
| Notes | No | Free-text notes |

## Statuses

| Status | Meaning |
|--------|---------|
| **OPERATIONAL** | In active use |
| **MAINTENANCE** | Being repaired or serviced |
| **DECOMMISSIONED** | Permanently out of service |
| **STANDBY** | Available but not currently deployed |

## Condition ratings

| Condition | Meaning |
|-----------|---------|
| **NEW** | Brand new or near-new |
| **GOOD** | Working well, normal wear |
| **FAIR** | Usable but showing significant wear |
| **POOR** | Needs repair or replacement soon |

## Expected workflows

### Adding new plant
1. Admin clicks "Add Plant"
2. Fills in plant number, name, category (required)
3. Optionally fills in make, model, registration, service dates, etc.
4. Optionally assigns to an employee
5. Saves

### Recording a service
1. Admin opens the plant record
2. Clicks "Edit"
3. Updates "Last Service Date" to today
4. Updates "Next Service Due" to the next scheduled date
5. Saves

### Assigning plant to an employee
1. Admin opens the plant record
2. Clicks "Edit"
3. Selects an employee from the "Assigned To" dropdown
4. Saves

### Archiving plant
1. Admin opens the plant record
2. Clicks "Archive"
3. Confirms — item is hidden from default list but not deleted

## Permissions

| Action | ADMIN | STAFF (future) |
|--------|-------|---------------|
| View list | Yes | View only (admin-selected items) |
| Create | Yes | No |
| Edit | Yes | No |
| Archive | Yes | No |

## Relationships

- A plant item can optionally be **assigned to one Employee**
- An employee can have **many plant items** assigned to them
- Each record tracks which **User** (login account) created it

## Future: file/document relationship

In Stage 3, documents will be attachable to plant records. Examples:
- Registration documents
- Service history / logbooks
- Compliance certificates
- Insurance documents
- Photos

## Future: reporting needs

- All plant by category
- Plant by status (operational, maintenance, standby)
- Plant with overdue service dates
- Plant by location
- Total plant value
- Plant assigned to each employee
- Service schedule calendar view
