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
            <tr className="border-b bg-gray-50/80">
              {columns.map((col) => (
                <th
                  key={String(col.key)}
                  className="text-left px-3 py-2 font-medium text-gray-500 text-xs uppercase tracking-wider"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.map((item) => (
              <tr
                key={item.id}
                onClick={() => onRowClick?.(item)}
                className={`transition-colors ${
                  onRowClick
                    ? "hover:bg-blue-50/60 cursor-pointer"
                    : "hover:bg-gray-50/60"
                }`}
              >
                {columns.map((col, colIdx) => (
                  <td key={String(col.key)} className="px-3 py-2 text-gray-700">
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
      <div className="md:hidden space-y-1.5">
        {data.map((item) => (
          <div
            key={item.id}
            onClick={() => onRowClick?.(item)}
            className={`bg-white rounded-lg border shadow-sm px-3 py-2.5 ${
              onRowClick ? "active:bg-blue-50 cursor-pointer" : ""
            }`}
          >
            {/* Top row: ID + Name inline, status floated right */}
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-blue-600 font-medium text-sm shrink-0">
                  {getCellValue(item, columns[0])}
                </span>
                {columns.length > 1 && (
                  <span className="text-gray-900 font-medium text-sm truncate">
                    {getCellValue(item, columns[1])}
                  </span>
                )}
              </div>
              {/* Render the last column (usually Status) as a badge on the right */}
              {columns.length > 2 && (
                <span className="shrink-0">
                  {getCellValue(item, columns[columns.length - 1])}
                </span>
              )}
            </div>
            {/* Remaining columns as compact inline tags */}
            {columns.length > 2 && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500">
                {columns.slice(2, -1).map((col) => (
                  <span key={String(col.key)}>
                    <span className="text-gray-400">{col.label}:</span>{" "}
                    <span className="text-gray-600">{getCellValue(item, col)}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
