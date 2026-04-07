// Sidebar navigation items for the application.
// Add new modules here as they are built.

export interface NavItem {
  label: string;
  href: string;
  icon: string; // Simple emoji or text icon for now
  adminOnly?: boolean; // If true, only shown to ADMIN users
}

export const navigationItems: NavItem[] = [
  { label: "Dashboard", href: "/", icon: "H" },
  { label: "Employees", href: "/employees", icon: "E" },
  { label: "Training", href: "/training", icon: "R" },
  { label: "Assets", href: "/assets", icon: "A" },
  { label: "Plant", href: "/plant", icon: "P" },
  { label: "Task Manager", href: "/tasks", icon: "T", adminOnly: true },
  { label: "Activity Log", href: "/activity-log", icon: "L", adminOnly: true },
];

// Future modules will be added here:
// { label: "WIP Tracker", href: "/wip", icon: "W" },
// { label: "Jobs", href: "/jobs", icon: "J" },
// { label: "Corrective Actions", href: "/corrective-actions", icon: "C" },

// Staff portal navigation — shown to STAFF users in /staff route group
export const staffNavigationItems: NavItem[] = [
  { label: "Dashboard", href: "/staff", icon: "D" },
  { label: "My Profile", href: "/staff/profile", icon: "P" },
  { label: "My Training", href: "/staff/training", icon: "T" },
  { label: "My Assets & Plant", href: "/staff/assets-plant", icon: "A" },
  { label: "Forms & Requests", href: "/staff/forms", icon: "F" },
  // Future: Task Manager will be embedded from ACOMS.Controller
  // { label: "My Tasks", href: "/staff/tasks", icon: "T" },
];
