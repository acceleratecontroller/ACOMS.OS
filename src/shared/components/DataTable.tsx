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

function getCellValue<T>(item: T, col: Column<T>) {
  if (col.render) return col.render(item);
  return String((item as Record<string, unknown>)[String(col.key)] ?? "");
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
    <>
      {/* Desktop table — hidden on small screens */}
      <div className="hidden md:block overflow-x-auto bg-white rounded-lg border shadow-sm">
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
                        {getCellValue(item, col)}
                      </span>
                    ) : (
                      getCellValue(item, col)
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile card list — visible only on small screens */}
      <div className="md:hidden space-y-2">
        {data.map((item) => (
          <div
            key={item.id}
            onClick={() => onRowClick?.(item)}
            className={`bg-white rounded-lg border shadow-sm p-4 ${
              onRowClick ? "active:bg-blue-50 cursor-pointer" : ""
            }`}
          >
            {/* First column as the card title */}
            <div className="text-blue-600 font-medium text-sm mb-2">
              {getCellValue(item, columns[0])}
            </div>
            {/* Second column (usually name) as subtitle if it exists */}
            {columns.length > 1 && (
              <div className="text-gray-900 font-medium text-sm mb-2">
                {getCellValue(item, columns[1])}
              </div>
            )}
            {/* Remaining columns as key-value pairs */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
              {columns.slice(2).map((col) => (
                <div key={String(col.key)}>
                  <span className="text-gray-400">{col.label}: </span>
                  <span className="text-gray-700">{getCellValue(item, col)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
