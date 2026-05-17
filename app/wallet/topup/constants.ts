export const TOPUP_PAYMENT_METHODS = {
  zaincash: {
    id: "zaincash",
    label: "محفظة زين كاش",
    number: "07886552919",
    holder: null,
  },
  rafidain: {
    id: "rafidain",
    label: "ماستر كارد الرافدين",
    number: "9550100094",
    holder: "ALI SUHAIL SHIHAB",
  },
} as const;

export type TopupPaymentMethodId = keyof typeof TOPUP_PAYMENT_METHODS;
export type TopupPaymentMethod =
  (typeof TOPUP_PAYMENT_METHODS)[TopupPaymentMethodId];

export const TOPUP_WHATSAPP_NUMBER = "07702706976";

export function topupWhatsappIntl(local: string = TOPUP_WHATSAPP_NUMBER): string {
  const digits = local.replace(/\D/g, "");
  const withoutLeadingZero = digits.startsWith("0") ? digits.slice(1) : digits;
  return `964${withoutLeadingZero}`;
}
