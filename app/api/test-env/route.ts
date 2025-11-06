export async function GET() {
  return Response.json({
    merchantId: process.env.ZAINCASH_MERCHANT_ID,
    secretKey: process.env.ZAINCASH_SECRET_KEY ? "✅ Present" : "❌ Missing",
    msisdn: process.env.ZAINCASH_MSISDN,
  });
}
