"use client";

import {
  RecurringTask,
  formatDate,
  isOverdue,
  isDueToday,
  isDueSoon,
  ownerName,
  frequencyLabel,
} from "./types";

export function RecurringTaskRow({
  task,
  isAdmin,
  onEdit,
  onComplete,
  onArchive,
  onRestore,
}: {
  task: RecurringTask;
  isAdmin: boolean;
  onEdit: () => void;
  onComplete: () => void;
  onArchive: () => void;
  onRestore: () => void;
}) {
  const overdue = isOverdue(task.nextDue);
  const dueToday = isDueToday(task.nextDue);
  const soon = isDueSoon(task.nextDue);

  let statusText = "On Track";
  let statusColor = "bg-green-100 text-green-700";
  if (overdue) {
    const todayMs = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).getTime();
    const [y, m, d] = task.nextDue!.substring(0, 10).split("-").map(Number);
    const dueMs = new Date(y, m - 1, d).getTime();
    const days = Math.floor((todayMs - dueMs) / (24 * 60 * 60 * 1000));
    statusText = `Overdue ${days}d`;
    statusColor = "bg-red-100 text-red-700";
  } else if (dueToday) {
    statusText = "Due Today";
    statusColor = "bg-orange-100 text-orange-700";
  } else if (soon) {
    statusText = "Due Soon";
    statusColor = "bg-yellow-100 text-yellow-700";
  }

  return (
    <>
      {/* Desktop */}
      <div
        onClick={onEdit}
        className={`hidden md:grid md:grid-cols-8 gap-2 px-4 py-3 items-center border-b last:border-b-0 transition-all cursor-pointer hover:bg-blue-50/60 ${
          overdue ? "bg-red-50 border-l-4 border-l-red-500" : dueToday ? "bg-orange-50 border-l-4 border-l-orange-500" : soon ? "bg-yellow-50" : ""
        }`}
      >
        <div className="col-span-2">
          <div className="font-semibold text-sm text-gray-900">{task.title}</div>
          {task.description && <p className="text-xs text-gray-500 italic truncate">{task.description}</p>}
        </div>
        <div className="text-xs text-gray-600 font-medium truncate">{ownerName(task.owner)}</div>
        <div className="text-xs text-gray-600">{frequencyLabel(task.frequencyType, task.frequencyValue)}</div>
        <div className="text-xs text-gray-600">{task.lastCompleted ? formatDate(task.lastCompleted) : "Never"}</div>
        <div className={`text-xs font-medium ${overdue ? "text-red-600 font-bold" : "text-gray-600"}`}>
          {task.nextDue ? formatDate(task.nextDue) : "Not set"}
        </div>
        <span className={`text-[11px] font-semibold px-2 py-1 rounded-full text-center ${statusColor}`}>
          {statusText}
        </span>
        {isAdmin && (
          <div className="flex items-center gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
            <button onClick={onComplete} className="p-1.5 rounded hover:bg-green-100 text-green-600 transition-colors" title="Mark completed">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </button>
            {task.isArchived ? (
              <button onClick={onRestore} className="p-1.5 rounded hover:bg-green-100 text-green-600 transition-colors" title="Restore">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                </svg>
              </button>
            ) : (
              <button onClick={onArchive} className="p-1.5 rounded hover:bg-red-100 text-red-500 transition-colors" title="Archive">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Mobile */}
      <div
        onClick={onEdit}
        className={`md:hidden rounded-md border px-3 py-2 mb-1 transition-shadow cursor-pointer active:bg-blue-50 hover:shadow-md ${
          overdue ? "bg-red-50 border-l-4 border-l-red-500" : dueToday ? "bg-orange-50 border-l-4 border-l-orange-500" : soon ? "bg-yellow-50" : "bg-white"
        }`}
      >
        <div className="flex items-start justify-between mb-2">
          <span className="font-semibold text-sm text-gray-900 flex-1">{task.title}</span>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ml-2 ${statusColor}`}>
            {statusText}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1 text-xs mb-2">
          <div><span className="text-gray-400">Owner:</span> <span className="font-medium text-gray-700">{ownerName(task.owner)}</span></div>
          <div><span className="text-gray-400">Frequency:</span> <span className="font-medium text-gray-700">{frequencyLabel(task.frequencyType, task.frequencyValue)}</span></div>
          <div><span className="text-gray-400">Last Done:</span> <span className="font-medium text-gray-700">{task.lastCompleted ? formatDate(task.lastCompleted) : "Never"}</span></div>
          <div><span className="text-gray-400">Next Due:</span> <span className={`font-medium ${overdue ? "text-red-600" : "text-gray-700"}`}>{task.nextDue ? formatDate(task.nextDue) : "Not set"}</span></div>
        </div>
        {task.description && <p className="text-xs text-gray-500 italic bg-gray-50 rounded p-2 mb-2">{task.description}</p>}
      </div>
    </>
  );
}
