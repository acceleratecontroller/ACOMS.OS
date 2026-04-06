import { auth } from "@/shared/auth/auth";
import { prisma } from "@/shared/database/client";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { PageHeader } from "@/shared/components/PageHeader";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function StaffProfilePage() {
  const session = await auth();
  if (!session?.user?.employeeId) {
    redirect("/login");
  }

  const employee = await prisma.employee.findUnique({
    where: { id: session.user.employeeId },
    select: {
      employeeNumber: true,
      firstName: true,
      lastName: true,
      email: true,
      personalEmail: true,
      phone: true,
      address: true,
      dateOfBirth: true,
      shirtSize: true,
      pantsSize: true,
      employmentType: true,
      location: true,
      startDate: true,
      status: true,
      emergencyFirstName: true,
      emergencyLastName: true,
      emergencyRelation: true,
      emergencyPhone: true,
      emergencyPhoneAlt: true,
    },
  });

  if (!employee) {
    redirect("/login");
  }

  const formatDate = (d: Date | null) =>
    d ? new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) : "—";

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader title="My Profile" description="Your employee information. Contact your manager to request changes." />

      {/* Profile Photo Placeholder + Name */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-xl font-bold shrink-0">
            {employee.firstName[0]}{employee.lastName[0]}
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {employee.firstName} {employee.lastName}
            </h2>
            <p className="text-sm text-gray-500">{employee.employeeNumber}</p>
            <div className="mt-1">
              <StatusBadge status={employee.status} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Employment Details */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">Employment Details</h3>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Employment Type</dt>
              <dd className="font-medium text-gray-900">{employee.employmentType.replace(/_/g, " ")}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Location</dt>
              <dd className="font-medium text-gray-900">{employee.location.replace(/_/g, " ")}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Start Date</dt>
              <dd className="font-medium text-gray-900">{formatDate(employee.startDate)}</dd>
            </div>
          </dl>
        </div>

        {/* Contact Information */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">Contact Information</h3>
          <dl className="space-y-3 text-sm">
            {employee.email && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Work Email</dt>
                <dd className="font-medium text-gray-900">{employee.email}</dd>
              </div>
            )}
            {employee.personalEmail && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Personal Email</dt>
                <dd className="font-medium text-gray-900">{employee.personalEmail}</dd>
              </div>
            )}
            {employee.phone && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Phone</dt>
                <dd className="font-medium text-gray-900">{employee.phone}</dd>
              </div>
            )}
            {employee.address && (
              <div>
                <dt className="text-gray-500 mb-1">Address</dt>
                <dd className="font-medium text-gray-900">{employee.address}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Personal Details */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">Personal Details</h3>
          <dl className="space-y-3 text-sm">
            {employee.dateOfBirth && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Date of Birth</dt>
                <dd className="font-medium text-gray-900">{formatDate(employee.dateOfBirth)}</dd>
              </div>
            )}
            {employee.shirtSize && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Shirt Size</dt>
                <dd className="font-medium text-gray-900">{employee.shirtSize}</dd>
              </div>
            )}
            {employee.pantsSize && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Pants Size</dt>
                <dd className="font-medium text-gray-900">{employee.pantsSize}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Emergency Contact */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">Emergency Contact</h3>
          {employee.emergencyFirstName ? (
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Name</dt>
                <dd className="font-medium text-gray-900">
                  {employee.emergencyFirstName} {employee.emergencyLastName}
                </dd>
              </div>
              {employee.emergencyRelation && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Relationship</dt>
                  <dd className="font-medium text-gray-900">{employee.emergencyRelation}</dd>
                </div>
              )}
              {employee.emergencyPhone && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Phone</dt>
                  <dd className="font-medium text-gray-900">{employee.emergencyPhone}</dd>
                </div>
              )}
              {employee.emergencyPhoneAlt && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Alt. Phone</dt>
                  <dd className="font-medium text-gray-900">{employee.emergencyPhoneAlt}</dd>
                </div>
              )}
            </dl>
          ) : (
            <p className="text-sm text-gray-400">No emergency contact on file. Please notify your manager.</p>
          )}
        </div>
      </div>
    </div>
  );
}
