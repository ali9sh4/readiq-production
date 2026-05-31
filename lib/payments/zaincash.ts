import crypto from "crypto";
import axios from "axios";

export class ZainCash {
  private merchantId: string;
  private secretKey: string;
  private msisdn: string;
  private baseUrl: string;

  constructor() {
    // .trim() every credential: a trailing newline/space on a Vercel env var
    // (easy to paste in by accident) silently corrupts the HMAC key → every
    // JWT signature is rejected by ZainCash → the generic "خطأ من زين كاش".
    // Trim once at read time so no downstream path can hit a whitespaced value.
    this.merchantId = (process.env.ZAINCASH_MERCHANT_ID || "").trim();
    this.secretKey = (process.env.ZAINCASH_SECRET_KEY || "").trim();
    this.msisdn = (process.env.ZAINCASH_MSISDN || "").trim();
    this.baseUrl = (
      process.env.ZAINCASH_BASE_URL || "https://test.zaincash.iq"
    ).trim();

    // Credentials are validated lazily in validateCredentials() at call time,
    // not in the constructor — so an unconfigured deploy fails only when a
    // payment is actually attempted, and importing this module never throws.
    // (Deliberately no console.log of credential presence here: it ran on
    // every cold start and leaked which secrets are set into the logs.)
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

      // Constant-time comparison. `crypto.timingSafeEqual` throws if the
      // buffers differ in length, so guard that first — a length mismatch is
      // itself an invalid signature.
      const sigBuf = Buffer.from(signature);
      const expBuf = Buffer.from(expectedSig);
      if (
        sigBuf.length !== expBuf.length ||
        !crypto.timingSafeEqual(sigBuf, expBuf)
      ) {
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
   * Create a transaction for a WALLET TOP-UP - POST /transaction/init.
   *
   * Separate from `createTransaction` (the frozen pay-per-course path) for one
   * reason: that method hard-codes `redirectUrl` to the legacy
   * `/api/payments/zaincash/webhook` handler. A top-up must redirect to its own
   * callback on a PINNED production host (preview deploy URLs aren't stable and
   * ZainCash won't have them whitelisted). So the caller passes `redirectUrl`
   * in explicitly. Everything else — JWT signing via `generateToken`, the
   * form-encoded POST, the response/error parsing — is identical.
   */
  public async createTopupTransaction(
    amount: number,
    orderId: string,
    redirectUrl: string,
    serviceType: string = "Wallet Topup"
  ): Promise<{ id: string; url: string }> {
    this.validateCredentials();

    if (amount < 250) {
      // ZainCash's own hard floor. The app's higher floor (1,000 IQD) is
      // enforced upstream in the init route.
      throw new Error("Minimum transaction amount is 250 IQD");
    }

    const roundedAmount = Math.round(amount);

    const tokenData = {
      amount: roundedAmount,
      serviceType: serviceType.substring(0, 50),
      msisdn: this.msisdn,
      orderId,
      redirectUrl,
    };

    const token = this.generateToken(tokenData);

    const formData = new URLSearchParams();
    formData.append("token", token);
    formData.append("merchantId", this.merchantId);
    formData.append("lang", "ar");

    try {
      const response = await axios.post(
        `${this.baseUrl}/transaction/init`,
        formData.toString(),
        {
          timeout: 10000,
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        }
      );

      if (response.data?.err) {
        // ZainCash's error shape is inconsistent: sometimes an object
        // ({ err: { msg } }), sometimes a bare string ({ err: "token_not_valid_expired" }).
        // Surface whichever it is verbatim — never collapse it to the generic
        // Arabic fallback, which once masked the real cause for an hour. See
        // docs/ZAINCASH_DEBUG_LEARNINGS.md.
        const e = response.data.err;
        const errorMsg =
          typeof e === "string"
            ? e
            : e?.msg || e?.message || "خطأ من زين كاش";
        throw new Error(errorMsg);
      }

      if (!response.data || !response.data.id) {
        throw new Error("Transaction ID missing in response");
      }

      const transactionId = response.data.id as string;
      return {
        id: transactionId,
        url: `${this.baseUrl}/transaction/pay?id=${transactionId}`,
      };
    } catch (error: any) {
      if (error.response?.data?.err) {
        const e = error.response.data.err;
        const zaincashError =
          typeof e === "string" ? e : e?.msg || e?.message;
        throw new Error(zaincashError || "فشل في إنشاء معاملة زين كاش");
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
