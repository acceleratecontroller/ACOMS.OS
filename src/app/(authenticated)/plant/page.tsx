"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/shared/components/PageHeader";
import { DataTable, Column } from "@/shared/components/DataTable";
import { StatusBadge } from "@/shared/components/StatusBadge";

interface PlantItem {
  id: string;
  plantNumber: string;
  name: string;
  category: string;
  location: string | null;
  status: string;
  registrationNumber: string | null;
  assignedTo: { firstName: string; lastName: string } | null;
}

const columns: Column<PlantItem>[] = [
  { key: "plantNumber", label: "Plant #" },
  { key: "name", label: "Name" },
  { key: "category", label: "Category" },
  { key: "registrationNumber", label: "Rego" },
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

export default function PlantPage() {
  const [plant, setPlant] = useState<PlantItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/plant")
      .then((res) => res.json())
      .then((data) => {
        setPlant(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageHeader
        title="Plant Register"
        description="Manage cars, trucks, excavators, and heavy equipment."
        action={{ label: "Add Plant", href: "/plant/new" }}
      />
      {loading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : (
        <DataTable
          columns={columns}
          data={plant}
          linkPrefix="/plant"
          emptyMessage="No plant items found. Click 'Add Plant' to create one."
        />
      )}
    </div>
  );
}
