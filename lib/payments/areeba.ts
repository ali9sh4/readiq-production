import axios from "axios";

export class Areeba {
  private merchantId: string;
  private password: string;
  private apiUrl: string;

  constructor() {
    this.merchantId = process.env.AREEBA_MERCHANT_ID || "";
    this.password = process.env.AREEBA_API_PASSWORD || "";
    this.apiUrl = process.env.AREEBA_API_URL || "https://areeba.iq/api";
  }

  private generateAuth(): string {
    return Buffer.from(`merchant.${this.merchantId}:${this.password}`).toString(
      "base64"
    );
  }

  public async createSession(
    amount: number,
    orderId: string,
    courseTitle: string
  ): Promise<any> {
    const response = await axios.post(
      `${this.apiUrl}/rest/version/71/merchant/${this.merchantId}/session`,
      {
        apiOperation: "CREATE_CHECKOUT_SESSION",
        interaction: {
          operation: "PURCHASE",
          returnUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/areeba/webhook`,
        },
        order: {
          id: orderId,
          amount: amount.toFixed(2),
          currency: "IQD",
          description: courseTitle,
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${this.generateAuth()}`,
        },
      }
    );

    return response.data;
  }

  public async getTransactionStatus(orderId: string): Promise<any> {
    const response = await axios.get(
      `${this.apiUrl}/rest/version/71/merchant/${this.merchantId}/order/${orderId}`,
      {
        headers: {
          Authorization: `Basic ${this.generateAuth()}`,
        },
      }
    );

    return response.data;
  }
}

export const areeba = new Areeba();
