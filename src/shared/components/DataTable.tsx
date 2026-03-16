"use client";

export interface Column<T> {
  key: keyof T | string;
  label: string;
  render?: (item: T) => React.ReactNode;
  /** Hide this column from mobile card view (still visible on desktop table) */
  hideOnMobile?: boolean;
  /** Small inline SVG icon shown before the value on mobile cards */
  mobileIcon?: React.ReactNode;
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
      <div className="md:hidden space-y-1">
        {data.map((item) => {
          const mobileCols = columns.filter((c) => !c.hideOnMobile);
          const detailCols = mobileCols.slice(2, -1);
          return (
            <div
              key={item.id}
              onClick={() => onRowClick?.(item)}
              className={`bg-white rounded-md border px-3 py-2 transition-shadow ${
                onRowClick ? "active:bg-blue-50 cursor-pointer hover:shadow-md" : ""
              }`}
            >
              {/* Header: ID + Name, status right */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-blue-600 font-medium text-sm shrink-0">
                    {getCellValue(item, mobileCols[0])}
                  </span>
                  {mobileCols.length > 1 && (
                    <span className="text-gray-900 font-medium text-sm truncate">
                      {getCellValue(item, mobileCols[1])}
                    </span>
                  )}
                </div>
                {mobileCols.length > 2 && (
                  <span className="shrink-0">
                    {getCellValue(item, mobileCols[mobileCols.length - 1])}
                  </span>
                )}
              </div>
              {/* Detail line */}
              {detailCols.length > 0 && (
                <div className="flex flex-wrap items-center gap-x-3 text-xs text-gray-500 mt-0.5">
                  {detailCols.map((col) => (
                    <span key={String(col.key)} className="inline-flex items-center gap-1">
                      {col.mobileIcon && <span className="text-gray-400">{col.mobileIcon}</span>}
                      <span className="text-gray-600">{getCellValue(item, col)}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
