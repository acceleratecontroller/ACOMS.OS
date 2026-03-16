"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/shared/components/PageHeader";
import { DataTable, Column } from "@/shared/components/DataTable";
import { StatusBadge } from "@/shared/components/StatusBadge";

interface Asset {
  id: string;
  assetNumber: string;
  name: string;
  category: string;
  location: string | null;
  status: string;
  assignedTo: { firstName: string; lastName: string } | null;
}

const columns: Column<Asset>[] = [
  { key: "assetNumber", label: "Asset #" },
  { key: "name", label: "Name" },
  { key: "category", label: "Category" },
  { key: "location", label: "Location" },
  {
    key: "assignedTo",
    label: "Assigned To",
    render: (item) =>
      item.assignedTo
        ? `${item.assignedTo.firstName} ${item.assignedTo.lastName}`
        : "—",
  },
  {
    key: "status",
    label: "Status",
    render: (item) => <StatusBadge status={item.status} />,
  },
];

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/assets")
      .then((res) => res.json())
      .then((data) => {
        setAssets(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageHeader
        title="Asset Register"
        description="Track tools, phones, laptops, PPE, and other portable items."
        action={{ label: "Add Asset", href: "/assets/new" }}
      />
      {loading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : (
        <DataTable
          columns={columns}
          data={assets}
          linkPrefix="/assets"
          emptyMessage="No assets found. Click 'Add Asset' to create one."
        />
      )}
    </div>
  );
}
