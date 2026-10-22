import OpenAI from "openai";

const refusal = "I can help with Liggy: creating and reviewing e-invoices, uploading invoice documents, customer records, invoice history and PDFs, daily or monthly reports, account access, and the AI invoice workflow. I can’t help with unrelated topics.";

const appTopics = /\b(liggy|e[- ]?invoice|invoice|customer|business record|daily sales|monthly insight|sales report|agentic|agent workflow|ai workflow|ai (?:invoice|agent|check|review|extract)|approve|approval|preview|pdf|download|upload|history|email|sign in|sign out|log in|log out|account|password|saved data|database)\b|\bhow (?:do|can) i use (?:this|the) app\b|\bhow to use liggy\b|\bwhat can liggy do\b/i;
const greetings = /^(hi|hello|hey|good morning|good afternoon|good evening|thanks|thank you)[!. ]*$/i;
const followUp = /\b(it|that|this|them|those|after that|what next|then|also|where do i|how about|what about|can i)\b/i;

const instructions = `You are Liggy Help, the in-app assistant for the Liggy e-invoice and business records application. Answer only questions about how to use Liggy and its features. Refuse all unrelated requests briefly and direct the user back to Liggy help topics.

Liggy workflow facts:
- Users create an account with username, email, and password. Each account has separate customers, invoices, and reports.
- On E-Invoice, a user can type invoice details or upload a supported document (PDF, image, TXT, JSON, or CSV).
- The invoice agent extracts or checks invoice details and prepares a draft. The user should review and edit the displayed fields and preview before approving.
- Approving saves the invoice PDF and invoice history, updates that account's customer record, and feeds the daily sales report and monthly insights. Rejecting does not save an approved invoice.
- A customer email is optional. After save, Liggy asks whether to send the invoice when an email address is available. Email delivery also requires the app owner to configure SMTP.
- Saved PDFs can be previewed or downloaded from the invoice screen and Invoice History.
- Daily Sales Report summarizes approved invoices dated today; Monthly Insights summarizes the current month. Both are based on saved invoices for the signed-in account.
- Do not claim that you can see, change, approve, or send a user's records. Explain where the user can do those actions in the app.
- Do not give tax or legal compliance guarantees. Recommend checking the invoice details before approval.

Respond in plain, concise language. If the question is ambiguous, ask one short follow-up. Return JSON with shape {"reply":"..."}.`;

export async function processMessage(message, history = []) {
  const trimmed = String(message || "").trim();
  if (trimmed.length > 2000) throw new Error("Message is too long.");
  if (greetings.test(trimmed)) return { reply: "Hi! I’m Liggy Help. Ask me how to create or review an invoice, find a saved PDF, manage customer records, or read your sales reports." };
  const previousUserAskedAboutLiggy = history.some((entry) => entry.role === "user" && appTopics.test(entry.content));
  const inScope = appTopics.test(trimmed) || (followUp.test(trimmed) && previousUserAskedAboutLiggy);
  if (!inScope) return { reply: refusal };
  const apiKey = process.env.OPENAI_API_KEY;
  const baseURL = process.env.OPENAI_BASE_URL || process.env.OPENAI_URL;
  const model = process.env.OPENAI_MODEL;
  if (!apiKey || !baseURL || !model) {
    return { reply: "I can explain the Liggy workflow, but the AI help service is not configured yet. Set OPENAI_API_KEY, OPENAI_BASE_URL, and OPENAI_MODEL in the project-root .env file, restart the backend, and try again." };
  }

  const client = new OpenAI({
    apiKey,
    baseURL,
  });
  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: instructions },
      ...history.slice(-8).map(({ role, content }) => ({ role, content })),
      { role: "user", content: trimmed },
    ],
    response_format: { type: "json_object" },
    temperature: 0.1,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("Liggy Help returned an empty response.");
  const result = JSON.parse(content);
  return { reply: typeof result.reply === "string" && result.reply.trim() ? result.reply.trim() : refusal };
}
