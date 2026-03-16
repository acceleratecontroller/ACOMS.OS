import { Sidebar } from "@/shared/components/Sidebar";
import { GlobalSearch } from "@/shared/components/GlobalSearch";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <div className="sticky top-14 md:top-0 z-20 bg-gray-100 px-4 py-3 md:px-6 md:py-4 border-b border-gray-200">
          <GlobalSearch />
        </div>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
