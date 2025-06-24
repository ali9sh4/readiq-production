import { Breadcrumbs } from "@/components/ui/breadcrumb";
import NewPropertyForm from "./new-property-form";

export default async function  CourseUpload()  {

  // ← PascalCase component name
  return (
    <div className="container mx-auto px-4 py-8">
      <Breadcrumbs
        items={[
          {
            href: "/",
            label: "الرئيسية",
          },
          {
            href: "/course-upload",
            label: "لوحة إدارة الكورسات",
          },
          {
            label: "تحميل دورة جديدة",
          },
        ]}
      />

      <h1 className="text-3xl font-bold mt-6 mb-4">تحميل دورة جديدة</h1>

      <div className="bg-white rounded-lg shadow-md p-6">
        <NewPropertyForm />
      </div>
    </div>
  );
}
