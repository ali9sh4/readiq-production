import { MetadataRoute } from "next";
import { db } from "@/firebase/service";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://www.rubiktech.org";

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

        // Handle Firestore Timestamp, string, or fallback to now
        let lastModified: Date;
        try {
          if (data.updatedAt?.toDate) {
            // Firestore Timestamp
            lastModified = data.updatedAt.toDate();
          } else if (data.updatedAt) {
            // String or Date
            lastModified = new Date(data.updatedAt);
            // Validate
            if (isNaN(lastModified.getTime())) {
              lastModified = new Date();
            }
          } else {
            lastModified = new Date();
          }
        } catch {
          lastModified = new Date();
        }

        return {
          url: `${baseUrl}/course/${doc.id}`,
          lastModified,
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
