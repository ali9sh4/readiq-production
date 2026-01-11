// /app/user_dashboard/myFavorites/page.tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFavorites } from "@/app/actions/favorites_actions";
import FavoritesClient from "@/components/FavoriteClient";

export const metadata = {
  title: "المفضلة | ReadIQ",
  description: "الدورات المفضلة",
};

export default async function MyFavoritesPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("firebaseAuthToken")?.value;

  if (!token) {
    redirect("/login");
  }

  // ✅ Fetch favorites on server (fast initial load)
  const result = await getUserFavorites(token, 20);

  return (
    <FavoritesClient
      initialFavorites={result.favorites || []}
      initialHasMore={result.hasMore || false}
      initialLastDocId={result.lastDocId || null}
    />
  );
}
