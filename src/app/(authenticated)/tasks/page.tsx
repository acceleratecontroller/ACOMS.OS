import { ControllerEmbed } from "@/shared/components/ControllerEmbed";

export default function TaskManagerPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 leading-tight">Task Manager</h1>
          <p className="text-sm text-gray-500 mt-0.5">Powered by ACOMS Controller</p>
        </div>
      </div>
      <ControllerEmbed
        path="/embed/tasks"
        className="w-full"
        minHeight="calc(100vh - 140px)"
      />
    </div>
  );
}
