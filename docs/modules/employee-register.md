# Employee Register

## Purpose

The Employee Register is the central record of all company staff. It tracks who works for the company, their role, department, and employment status.

**Important distinction:** An Employee record is a business record about a real person. It is separate from the User table (which is about system login accounts). Not every employee needs a system login.

## Key fields

| Field | Required? | Description |
|-------|-----------|------------|
| Employee Number | Yes | Unique company ID (e.g. "EMP-001"). Manually entered. |
| First Name | Yes | Employee's first name |
| Last Name | Yes | Employee's last name |
| Email | No | Work email address |
| Phone | No | Contact phone number |
| Position | Yes | Job title or role |
| Department | No | Department name |
| Start Date | Yes | Date employment started |
| End Date | No | Date employment ended (blank if still employed) |
| Status | Yes | ACTIVE, INACTIVE, or TERMINATED |
| Notes | No | Free-text notes |

## Statuses

| Status | Meaning |
|--------|---------|
| **ACTIVE** | Currently employed |
| **INACTIVE** | Temporarily not active (e.g. leave) |
| **TERMINATED** | No longer employed |

## Expected workflows

### Adding a new employee
1. Admin clicks "Add Employee" on the list page
2. Fills in required fields (employee number, name, position, start date)
3. Sets status to Active
4. Saves

### Updating an employee
1. Admin clicks on an employee in the list
2. Clicks "Edit"
3. Updates fields as needed
4. Saves changes

### Archiving an employee
1. Admin clicks on an employee
2. Clicks "Archive"
3. Confirms the action
4. Employee is hidden from the default list but not deleted
5. Can be found and restored from the archived view (future enhancement)

## Permissions

| Action | ADMIN | STAFF (future) |
|--------|-------|---------------|
| View list | Yes | Own record only |
| Create | Yes | No |
| Edit | Yes | No |
| Archive | Yes | No |

## Relationships

- **Assets** can be assigned to an Employee (see Asset Register)
- **Plant** can optionally be assigned to an Employee (see Plant Register)
- Each record tracks which **User** (login account) created it

## Future: file/document relationship

In Stage 3, documents will be attachable to employee records. Examples:
- Employment contracts
- Certifications
- ID copies
- Training records

These will be stored via the FileProvider abstraction, not directly in the database.

## Future: reporting needs

- List of all active employees by department
- Employee count by status
- Employees with upcoming end dates
- Assets assigned to each employee
- Employment history / status changes over time
