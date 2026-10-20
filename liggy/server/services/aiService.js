
import OpenAI from "openai";

const instructions = `
You are Liggy, an AI assistant for small businesses.

Help users with:
- Everyday business administration
- Preparing invoice drafts
- Extracting information from descriptions of sales
- Identifying missing information

Be friendly, clear, and practical.

When a user asks for an invoice:
1. Extract only information provided by the user.
2. Never invent a buyer name, email, date, or price.
3. Use null for missing values.
4. Calculate the subtotal only when quantity and unit price
   are both known.
5. Do not invent tax rates or claim legal compliance.
6. Explain which information needs to be checked.
7. Remind the user to review the draft before using it.

For other requests, answer helpfully and set invoice to null.

Return valid JSON with this exact shape:
{
  "reply": "Your response to the user",
  "invoice": null
}

When an invoice is requested, replace null with an object
containing:
buyer_name, buyer_email, description, quantity,
unit_price, currency, invoice_date, total_before_tax,
and missing_fields.

Use strings for text fields, numbers for quantity and prices,
null for unknown fields, and an array of strings for missing_fields.
`;

export async function processMessage(message) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is missing from server/.env");
  }

  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });

  const response = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: instructions
      },
      {
        role: "user",
        content: message
      }
    ],
    response_format: {
      type: "json_object"
    },
    temperature: 0.2
  });

  const content = response.choices[0]?.message?.content;

  if (!content) {
    throw new Error("The AI returned an empty response.");
  }

  const result = JSON.parse(content);

  if (result.invoice) {
    const invoice = result.invoice;

    if (
      typeof invoice.quantity === "number" &&
      typeof invoice.unit_price === "number"
    ) {
      invoice.total_before_tax = Number(
        (invoice.quantity * invoice.unit_price).toFixed(2)
      );
    } else {
      invoice.total_before_tax = null;
    }
  }

  return result;
}
