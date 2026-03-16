import { Sidebar } from "@/shared/components/Sidebar";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-4 pt-18 md:p-6 md:pt-6">{children}</main>
    </div>
  );
}
