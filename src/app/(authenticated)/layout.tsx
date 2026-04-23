import { redirect } from "next/navigation";
import { auth } from "@/shared/auth/auth";
import { Sidebar } from "@/shared/components/Sidebar";
import { GlobalSearch } from "@/shared/components/GlobalSearch";
import GlobalRegionToggle from "@/shared/components/GlobalRegionToggle";
import { LogoutButton } from "@/shared/components/LogoutButton";
import { RegionFilterProvider } from "@/shared/context/RegionFilter";

export const dynamic = "force-dynamic";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // STAFF users must use the staff portal — block access to admin views
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    redirect("/staff");
  }
  return (
    <RegionFilterProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <div className="sticky top-14 md:top-0 z-20 bg-gray-100 px-4 py-3 md:px-6 md:py-4 border-b border-gray-200">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <GlobalSearch />
              <GlobalRegionToggle />
              <LogoutButton />
            </div>
          </div>
          <main className="flex-1 p-4 md:p-6">{children}</main>
        </div>
      </div>
    </RegionFilterProvider>
  );
}
