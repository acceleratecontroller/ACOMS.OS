"use client";

import { useMemo, useState } from "react";
import { RecurringTask, formatDateISO, isOverdue, isDueToday, isDueSoon } from "./types";

export function RecurringCalendar({ tasks }: { tasks: RecurringTask[] }) {
  const [calendarDate, setCalendarDate] = useState(new Date());

  const calendarDays = useMemo(() => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const days: { date: Date; isCurrentMonth: boolean; isToday: boolean; tasks: RecurringTask[] }[] = [];
    const nowCal = new Date();
    const today = new Date(nowCal.getFullYear(), nowCal.getMonth(), nowCal.getDate());

    for (let i = 0; i < 42; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      d.setHours(0, 0, 0, 0);
      const dateStr = formatDateISO(d.toISOString());
      const tasksOnDay = tasks.filter(
        (t) => t.nextDue && formatDateISO(t.nextDue) === dateStr,
      );
      days.push({
        date: d,
        isCurrentMonth: d.getMonth() === month,
        isToday: d.getTime() === today.getTime(),
        tasks: tasksOnDay,
      });
    }
    return days;
  }, [calendarDate, tasks]);

  return (
    <div className="bg-white border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-gray-800 text-white">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              const d = new Date(calendarDate);
              d.setMonth(d.getMonth() - 1);
              setCalendarDate(d);
            }}
            className="text-lg px-2 py-1 rounded hover:bg-white/20 transition-colors"
          >
            &lsaquo;
          </button>
          <span className="font-semibold">
            {calendarDate.toLocaleDateString("en-AU", { month: "long", year: "numeric" })}
          </span>
          <button
            onClick={() => {
              const d = new Date(calendarDate);
              d.setMonth(d.getMonth() + 1);
              setCalendarDate(d);
            }}
            className="text-lg px-2 py-1 rounded hover:bg-white/20 transition-colors"
          >
            &rsaquo;
          </button>
        </div>
        <button
          onClick={() => setCalendarDate(new Date())}
          className="bg-blue-600 text-white px-3 py-1 rounded text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          Today
        </button>
      </div>
      <div className="grid grid-cols-7">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="px-2 py-2 bg-gray-50 text-center text-xs font-semibold text-gray-500 border-b">
            {d}
          </div>
        ))}
        {calendarDays.map((day, i) => (
          <div
            key={i}
            className={`min-h-[80px] border-r border-b p-1 ${
              !day.isCurrentMonth ? "bg-gray-50 text-gray-300" : ""
            } ${day.isToday ? "bg-blue-50" : ""}`}
          >
            <div className="text-xs text-gray-500 mb-1">{day.date.getDate()}</div>
            {day.tasks.map((t) => {
              const overdue = isOverdue(t.nextDue);
              const today = isDueToday(t.nextDue);
              const soon = isDueSoon(t.nextDue);
              return (
                <div
                  key={t.id}
                  title={t.title}
                  className={`text-[10px] px-1 py-0.5 mb-0.5 rounded truncate cursor-default ${
                    overdue
                      ? "bg-red-600 text-white"
                      : today
                        ? "bg-orange-500 text-white"
                        : soon
                          ? "bg-yellow-400 text-black"
                          : "bg-green-500 text-white"
                  }`}
                >
                  {t.title}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
