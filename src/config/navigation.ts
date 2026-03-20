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
  { label: "Settings", href: "/settings/security", icon: "S" },
];

// Future modules will be added here:
// { label: "WIP Tracker", href: "/wip", icon: "W" },
// { label: "Jobs", href: "/jobs", icon: "J" },
// { label: "Corrective Actions", href: "/corrective-actions", icon: "C" },
