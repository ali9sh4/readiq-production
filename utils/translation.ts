// utils/translations.ts (or lib/translations.ts)

export const levelTranslations = {
  beginner: "مبتدئ",
  intermediate: "متوسط",
  advanced: "متقدم",
  all_levels: "جميع المستويات",
} as const;

export const languageTranslations = {
  arabic: "العربية",
  english: "الإنجليزية",
  french: "الفرنسية",
  spanish: "الإسبانية",
} as const;

// Helper functions
export const translateLevel = (level: string) => {
  return levelTranslations[level as keyof typeof levelTranslations] || level;
};

export const translateLanguage = (language: string) => {
  return (
    languageTranslations[language as keyof typeof languageTranslations] ||
    language
  );
};
