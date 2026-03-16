"use client";

export interface Column<T> {
  key: keyof T | string;
  label: string;
  render?: (item: T) => React.ReactNode;
}

interface DataTableProps<T extends { id: string }> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
}

export function DataTable<T extends { id: string }>({
  columns,
  data,
  onRowClick,
  emptyMessage = "No records found.",
}: DataTableProps<T>) {
  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 bg-white rounded-lg border">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto bg-white rounded-lg border shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-gray-50">
            {columns.map((col) => (
              <th
                key={String(col.key)}
                className="text-left px-4 py-3 font-medium text-gray-600 text-xs uppercase tracking-wider"
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
              onClick={() => onRowClick?.(item)}
              className={`border-b last:border-b-0 transition-colors ${
                onRowClick
                  ? "hover:bg-blue-50 cursor-pointer"
                  : "hover:bg-gray-50"
              }`}
            >
              {columns.map((col, colIdx) => (
                <td key={String(col.key)} className="px-4 py-3">
                  {colIdx === 0 ? (
                    <span className="text-blue-600 font-medium">
                      {col.render
                        ? col.render(item)
                        : String((item as Record<string, unknown>)[String(col.key)] ?? "")}
                    </span>
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
