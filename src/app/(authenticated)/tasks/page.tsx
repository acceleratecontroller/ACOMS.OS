import { ControllerEmbed } from "@/shared/components/ControllerEmbed";

export default function TaskManagerPage() {
  return (
    <div className="relative -m-4 md:-m-8 -mt-16 md:-mt-8">
      <ControllerEmbed
        path="/embed/tasks"
        className="w-full"
        minHeight="100vh"
      />
      <div className="absolute bottom-2 right-3 text-[10px] text-gray-300 pointer-events-none">
        Powered by ACOMS Controller
      </div>
    </div>
  );
}
