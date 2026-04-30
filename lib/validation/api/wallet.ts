import { z } from "zod";

export const RECEIPT_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

export const RECEIPT_MAX_BYTES = 5_000_000;

export const uploadReceiptBody = z.object({
  contentType: z.enum(RECEIPT_CONTENT_TYPES),
  sizeBytes: z.number().int().min(1).max(RECEIPT_MAX_BYTES),
});

export type UploadReceiptBody = z.infer<typeof uploadReceiptBody>;

export const PAYMENT_METHODS = [
  "bank_transfer",
  "personal_wallet",
  "fastpay",
  "other",
] as const;

export const TOPUP_MIN_IQD = 1_000;
export const TOPUP_MAX_IQD = 1_000_000;

export const topupRequestBody = z.object({
  amount: z.number().int().min(TOPUP_MIN_IQD).max(TOPUP_MAX_IQD),
  paymentMethod: z.enum(PAYMENT_METHODS),
  receiptKey: z.string().min(1),
  senderName: z.string().min(1).max(100),
  note: z.string().max(500).optional(),
});

export type TopupRequestBody = z.infer<typeof topupRequestBody>;

export function extFromContentType(
  ct: (typeof RECEIPT_CONTENT_TYPES)[number]
): string {
  switch (ct) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "application/pdf":
      return "pdf";
  }
}
