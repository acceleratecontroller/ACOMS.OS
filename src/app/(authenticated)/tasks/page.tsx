import { ControllerEmbed } from "@/shared/components/ControllerEmbed";

export default function TaskManagerPage() {
  return (
    <div className="fixed inset-0 md:left-56 top-[104px] md:top-[60px]">
      <ControllerEmbed
        path="/embed/tasks"
        className="w-full h-full"
        minHeight="100%"
      />
      <div className="absolute bottom-2 right-3 text-[10px] text-gray-300 pointer-events-none">
        Powered by ACOMS Controller
      </div>
    </div>
  );
}
