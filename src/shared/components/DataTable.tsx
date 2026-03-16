"use client";

import Link from "next/link";

export interface Column<T> {
  key: keyof T | string;
  label: string;
  render?: (item: T) => React.ReactNode;
}

interface DataTableProps<T extends { id: string }> {
  columns: Column<T>[];
  data: T[];
  linkPrefix: string; // e.g. "/employees" — each row links to /employees/[id]
  emptyMessage?: string;
}

export function DataTable<T extends { id: string }>({
  columns,
  data,
  linkPrefix,
  emptyMessage = "No records found.",
}: DataTableProps<T>) {
  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 bg-white rounded border">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto bg-white rounded border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-gray-50">
            {columns.map((col) => (
              <th
                key={String(col.key)}
                className="text-left px-4 py-3 font-medium text-gray-700"
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr
              key={item.id}
              className="border-b last:border-b-0 hover:bg-gray-50 transition-colors"
            >
              {columns.map((col, colIdx) => (
                <td key={String(col.key)} className="px-4 py-3">
                  {colIdx === 0 ? (
                    <Link
                      href={`${linkPrefix}/${item.id}`}
                      className="text-blue-600 hover:underline font-medium"
                    >
                      {col.render
                        ? col.render(item)
                        : String((item as Record<string, unknown>)[String(col.key)] ?? "")}
                    </Link>
                  ) : col.render ? (
                    col.render(item)
                  ) : (
                    String((item as Record<string, unknown>)[String(col.key)] ?? "")
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
