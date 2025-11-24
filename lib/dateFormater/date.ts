// lib/utils/date.ts
export function formatUploadDate(timestamp?: any): string {
  if (!timestamp) return "غير محدد";

  let date: Date;
  if (timestamp?.toDate) {
    date = timestamp.toDate();
  } else {
    date = new Date(timestamp);
    if (isNaN(date.getTime())) return "غير محدد";
  }

  const now = new Date();
  const diffInHours = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60 * 60)
  );

  if (diffInHours < 1) return "منذ أقل من ساعة";
  if (diffInHours < 24) return `منذ ${diffInHours} ساعة`;
  if (diffInHours < 48) return "منذ يوم واحد";

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `منذ ${diffInDays} أيام`;

  return date.toLocaleDateString("ar-IQ", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}