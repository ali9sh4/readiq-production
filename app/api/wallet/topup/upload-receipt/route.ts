import { NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { verifyBearerToken } from "@/lib/auth/verifyBearerToken";
import { handleApiError, ok } from "@/lib/api/response";
import {
  uploadReceiptBody,
  extFromContentType,
} from "@/lib/validation/api/wallet";
import { createPresignedUploadUrl } from "@/lib/R2/presignedUpload";

const UPLOAD_EXPIRES_SECONDS = 600;

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyBearerToken(req);
    const body = uploadReceiptBody.parse(await req.json());

    const ext = extFromContentType(body.contentType);
    const rand = randomBytes(4).toString("hex");
    const key = `topup-receipts/${auth.userId}/${Date.now()}_${rand}.${ext}`;

    const uploadUrl = await createPresignedUploadUrl({
      key,
      contentType: body.contentType,
      expiresIn: UPLOAD_EXPIRES_SECONDS,
    });

    const expiresAt = new Date(
      Date.now() + UPLOAD_EXPIRES_SECONDS * 1000
    ).toISOString();

    return ok({ uploadUrl, key, expiresAt });
  } catch (err) {
    return handleApiError(err);
  }
}
