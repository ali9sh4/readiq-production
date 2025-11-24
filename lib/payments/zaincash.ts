import crypto from "crypto";
import axios from "axios";

export class ZainCash {
  private merchantId: string;
  private secretKey: string;
  private msisdn: string;
  private baseUrl: string;

  constructor() {
    this.merchantId = process.env.ZAINCASH_MERCHANT_ID || "";
    this.secretKey = process.env.ZAINCASH_SECRET_KEY || "";
    this.msisdn = process.env.ZAINCASH_MSISDN || "";
    this.baseUrl = process.env.ZAINCASH_BASE_URL || "https://test.zaincash.iq";

    console.log("🔍 Loaded credentials:", {
      merchantId: this.merchantId ? "✅ Set" : "❌ Missing",
      secretKey: this.secretKey ? "✅ Set" : "❌ Missing",
      msisdn: this.msisdn ? "✅ Set" : "❌ Missing",
      baseUrl: this.baseUrl,
    });

    // ✅ REMOVED: Don't throw error in constructor
    // if (!this.merchantId || !this.secretKey || !this.msisdn) {
    //   throw new Error("ZainCash credentials missing");
    // }
  }

  // ✅ ADD: Validate credentials when actually used
  private validateCredentials(): void {
    if (!this.merchantId || !this.secretKey || !this.msisdn) {
      throw new Error(
        "ZainCash credentials not configured. Please set ZAINCASH_MERCHANT_ID, ZAINCASH_SECRET_KEY, and ZAINCASH_MSISDN environment variables."
      );
    }
  }

  /**
   * ✅ Generate JWT token with expiration
   */
  private generateToken(data: any): string {
    this.validateCredentials(); // ✅ Check here

    const now = Math.floor(Date.now() / 1000);

    const payload = {
      ...data,
      iat: now,
      exp: now + 60 * 60 * 4,
    };

    const header = Buffer.from(
      JSON.stringify({ alg: "HS256", typ: "JWT" })
    ).toString("base64url");

    const payloadEncoded = Buffer.from(JSON.stringify(payload)).toString(
      "base64url"
    );

    const signature = crypto
      .createHmac("sha256", this.secretKey)
      .update(`${header}.${payloadEncoded}`)
      .digest("base64url");

    return `${header}.${payloadEncoded}.${signature}`;
  }

  /**
   * ✅ Verify JWT token
   */
  public verifyToken(token: string): any {
    this.validateCredentials(); // ✅ Check here

    try {
      const [header, payload, signature] = token.split(".");

      if (!header || !payload || !signature) {
        throw new Error("Invalid token format");
      }

      const expectedSig = crypto
        .createHmac("sha256", this.secretKey)
        .update(`${header}.${payload}`)
        .digest("base64url");

      if (signature !== expectedSig) {
        throw new Error("Invalid signature");
      }   

      const decoded = JSON.parse(Buffer.from(payload, "base64url").toString());

      if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
        throw new Error("Token expired");
      }

      return decoded;
    } catch (error) {
      throw new Error(`Token verification failed: ${error}`);
    }
  }

  /**
   * ✅ Create transaction - POST /transaction/init
   */
  public async createTransaction(
    amount: number,
    orderId: string,
    serviceType: string = "Course Payment"
  ): Promise<any> {
    this.validateCredentials(); // ✅ Check here

    console.log("🔵 Creating ZainCash transaction...");

    if (amount < 250) {
      throw new Error("Minimum transaction amount is 250 IQD");
    }

    const roundedAmount = Math.round(amount);

    const tokenData = {
      amount: roundedAmount,
      serviceType: serviceType.substring(0, 50),
      msisdn: this.msisdn,
      orderId: orderId,
      redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/zaincash/webhook`,
    };

    console.log("📦 Token data:", tokenData);

    const token = this.generateToken(tokenData);

    const formData = new URLSearchParams();
    formData.append("token", token);
    formData.append("merchantId", this.merchantId);
    formData.append("lang", "ar");

    console.log("📤 Sending to:", `${this.baseUrl}/transaction/init`);

    try {
      const response = await axios.post(
        `${this.baseUrl}/transaction/init`,
        formData.toString(),
        {
          timeout: 10000,
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      );

      console.log(
        "📥 Raw response data:",
        JSON.stringify(response.data, null, 2)
      );

      if (response.data.err) {
        const errorMsg =
          response.data.err.msg ||
          response.data.err.message ||
          "خطأ من زين كاش";
        console.error("❌ ZainCash error:", errorMsg);
        throw new Error(errorMsg);
      }

      if (!response.data || !response.data.id) {
        console.error("❌ response.data.id is missing");
        console.error("Available fields:", Object.keys(response.data || {}));
        throw new Error("Transaction ID missing in response");
      }

      const transactionId = response.data.id;
      const paymentUrl = `${this.baseUrl}/transaction/pay?id=${transactionId}`;

      console.log("✅ Transaction created:", {
        id: transactionId,
        url: paymentUrl,
      });

      return {
        id: transactionId,
        url: paymentUrl,
      };
    } catch (error: any) {
      if (error.response?.data?.err) {
        const zaincashError =
          error.response.data.err.msg || error.response.data.err.message;
        console.error("❌ ZainCash error:", zaincashError);
        throw new Error(zaincashError);
      }

      if (error.response) {
        console.error("❌ ZainCash API Error Response:");
        console.error("Status:", error.response.status);
        console.error("Data:", JSON.stringify(error.response.data, null, 2));
      } else if (error.request) {
        console.error("❌ No response received");
      } else {
        console.error("❌ Error:", error.message);
      }

      throw new Error(error.message || "فشل في إنشاء معاملة زين كاش");
    }
  }

  /**
   * ✅ Check transaction status - POST /transaction/get
   */
  public async getTransactionStatus(transactionId: string): Promise<any> {
    this.validateCredentials(); // ✅ Check here

    const tokenData = {
      id: transactionId,
      msisdn: this.msisdn,
    };

    const token = this.generateToken(tokenData);

    const formData = new URLSearchParams();
    formData.append("token", token);
    formData.append("merchantId", this.merchantId);

    try {
      const response = await axios.post(
        `${this.baseUrl}/transaction/get`,
        formData.toString(),
        {
          timeout: 10000,
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      );

      if (!response.data) {
        throw new Error("Invalid response from ZainCash API");
      }

      return response.data;
    } catch (error: any) {
      console.error("ZainCash status check error:", {
        message: error.message,
        response: error.response?.data,
      });

      throw new Error(
        error.response?.data?.err?.msg || "Failed to check transaction status"
      );
    }
  }
}

export const zaincash = new ZainCash();
