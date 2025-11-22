import { MetadataRoute } from "next";
import { db } from "@/firebase/service";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://readiq.us";

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/login`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/register`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];

  // Fetch published courses
  try {
    const coursesSnapshot = await db
      .collection("courses")
      .where("status", "==", "published")
      .where("isDeleted", "==", false)
      .get();

    const coursePages: MetadataRoute.Sitemap = coursesSnapshot.docs.map(
      (doc) => {
        const data = doc.data();
        return {
          url: `${baseUrl}/course/${doc.id}`,
          lastModified: data.updatedAt ? new Date(data.updatedAt) : new Date(),
          changeFrequency: "weekly",
          priority: 0.9,
        };
      }
    );

    return [...staticPages, ...coursePages];
  } catch (error) {
    console.error("Error generating sitemap:", error);
    return staticPages;
  }
}
