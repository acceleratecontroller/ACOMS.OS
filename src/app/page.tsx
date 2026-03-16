import Link from "next/link";

export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Dashboard</h1>
      <p className="text-sm text-gray-500 mb-8">
        Welcome to ACOMS.OS — your central operations platform.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <DashboardCard
          title="Employee Register"
          description="Manage employee records, positions, and departments."
          href="/employees"
        />
        <DashboardCard
          title="Asset Register"
          description="Track tools, phones, laptops, PPE, and other portable items."
          href="/assets"
        />
        <DashboardCard
          title="Plant Register"
          description="Manage cars, trucks, excavators, and heavy equipment."
          href="/plant"
        />
      </div>

      <div className="mt-8 p-4 bg-white rounded border text-sm text-gray-500">
        <p className="font-medium text-gray-700 mb-2">Coming later:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>WIP Tracker</li>
          <li>Job Creation</li>
          <li>Corrective Actions Register</li>
          <li>File / Document Attachments</li>
          <li>Reporting and Dashboards</li>
        </ul>
      </div>
    </div>
  );
}

function DashboardCard({
  title,
  description,
  href,
}: {
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="block p-5 bg-white rounded border hover:border-blue-400 hover:shadow-sm transition-all"
    >
      <h2 className="font-semibold text-gray-900 mb-2">{title}</h2>
      <p className="text-sm text-gray-500">{description}</p>
    </Link>
  );
}
