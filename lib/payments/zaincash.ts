import crypto from "crypto";
import axios from "axios";

export class ZainCash {
  private merchantId: string;
  private secretKey: string;
  private msisdn: string;
  private apiUrl: string;

  constructor() {
    this.merchantId = process.env.ZAINCASH_MERCHANT_ID || "";
    this.secretKey = process.env.ZAINCASH_SECRET_KEY || "";
    this.msisdn = process.env.ZAINCASH_MSISDN || "";
    this.apiUrl = "https://api.zaincash.iq/transaction/pay";
  }

  private generateToken(data: any): string {
    const header = Buffer.from(
      JSON.stringify({ alg: "HS256", typ: "JWT" })
    ).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({ ...data, iat: Math.floor(Date.now() / 1000) })
    ).toString("base64url");
    const signature = crypto
      .createHmac("sha256", this.secretKey)
      .update(`${header}.${payload}`)
      .digest("base64url");
    return `${header}.${payload}.${signature}`;
  }

  public verifyToken(token: string): any {
    const [header, payload, signature] = token.split(".");
    const expectedSig = crypto
      .createHmac("sha256", this.secretKey)
      .update(`${header}.${payload}`)
      .digest("base64url");
    if (signature !== expectedSig) throw new Error("Invalid signature");
    return JSON.parse(Buffer.from(payload, "base64url").toString());
  }

  public async createTransaction(
    amount: number,
    orderId: string
  ): Promise<any> {
    const token = this.generateToken({
      merchantId: this.merchantId,
      amount: Math.round(amount),
      serviceType: "Course Payment",
      msisdn: this.msisdn,
      orderId,
      redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/zaincash/webhook`,
      production: process.env.NODE_ENV === "production",
      lang: "ar",
    });

    const response = await axios.post(
      this.apiUrl,
      { token },
      {
        timeout: 10000,
      }
    );
    if (!response.data || !response.data.id) {
      throw new Error("Invalid response from ZainCash");
    }
    return response.data;
  }
}

export const zaincash = new ZainCash();
