/**
 * Task module — barrel export.
 *
 * This is the public API surface for the To-Do / Recurring Tasks module.
 * When extracted to the shared-tools repo, consumers import from this index.
 */

// Business logic
export { calculateNextDue, advanceDate } from "./recurrence";
export { createTaskService, createRecurringTaskService } from "./service";
export type { TaskServiceDeps } from "./service";

// Validation
export {
  createTaskSchema,
  updateTaskSchema,
  createRecurringTaskSchema,
  updateRecurringTaskSchema,
} from "./validation";
export type {
  CreateTaskInput,
  UpdateTaskInput,
  CreateRecurringTaskInput,
  UpdateRecurringTaskInput,
} from "./validation";

// Constants
export {
  TASK_STATUS_OPTIONS,
  PRIORITY_OPTIONS,
  FREQUENCY_OPTIONS,
  SCHEDULE_OPTIONS,
  RECURRING_CATEGORY_OPTIONS,
} from "./constants";
export type { SelectOption } from "./constants";
