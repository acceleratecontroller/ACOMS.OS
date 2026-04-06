import { PageHeader } from "@/shared/components/PageHeader";

const placeholderForms = [
  {
    title: "Leave Request",
    description: "Submit annual leave, sick leave, or personal leave requests.",
    icon: "L",
    color: "bg-blue-100 text-blue-600",
  },
  {
    title: "Hazard Report",
    description: "Report workplace hazards or unsafe conditions.",
    icon: "H",
    color: "bg-red-100 text-red-600",
  },
  {
    title: "Incident Report",
    description: "Report workplace incidents or near-misses.",
    icon: "I",
    color: "bg-orange-100 text-orange-600",
  },
  {
    title: "Equipment Request",
    description: "Request new equipment, PPE, or tool replacements.",
    icon: "E",
    color: "bg-purple-100 text-purple-600",
  },
  {
    title: "Maintenance Request",
    description: "Report equipment faults or request maintenance.",
    icon: "M",
    color: "bg-yellow-100 text-yellow-700",
  },
  {
    title: "Timesheet Correction",
    description: "Request corrections to your timesheet records.",
    icon: "T",
    color: "bg-green-100 text-green-600",
  },
];

export default function StaffFormsPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        title="Forms & Requests"
        description="Submit forms and requests to your management team."
      />

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <p className="text-sm text-blue-800">
          Forms and requests are coming soon. This section will allow you to submit
          and track various workplace forms directly from the staff portal.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {placeholderForms.map((form) => (
          <div
            key={form.title}
            className="bg-white rounded-lg border border-dashed border-gray-300 p-5 opacity-60"
          >
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 ${form.color}`}>
                {form.icon}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-gray-900">{form.title}</h3>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-medium">
                    Coming Soon
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">{form.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
