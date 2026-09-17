export type NexusContext = {
  contacts: { id: string; name: string; company?: string; phones: string[]; emails: string[] }[];
  documents: { id: string; title: string; documentType: string; status: string }[];
  agencyReply: { isAgencyReply: boolean; agencyName: string; contactName: string; role: string; requestSummary: string; requestedItems: string[] };
};
export type NexusMessage = { role: "user" | "assistant"; content: string };
export type NexusPlan = { reply: string; ready: boolean; contactId: string; recipient: string; documentIds: string[]; subject: string; body: string };
const allowedApps = new Set(["Gmail", "WhatsApp", "Call", "Messages", "Indeed", "LinkedIn", "Reed", "Totaljobs", "CV-Library", "Drive", "Calendar", "CSCS / CITB"]);
function record(value: unknown): Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid object"); return value as Record<string, unknown>; }
function str(value: unknown, max: number) { if (typeof value !== "string" || value.length > max) throw new Error("Invalid text"); return value.trim(); }
function list(value: unknown, max: number): unknown[] { if (!Array.isArray(value) || value.length > max) throw new Error("Invalid list"); return value; }

export function parseNexusRequest(value: unknown) {
  const input = record(value);
  const app = str(input.app, 40);
  if (!allowedApps.has(app)) throw new Error("Unknown app");
  const messages = list(input.messages, 10).map((item): NexusMessage => {
    const msg = record(item);
    if (msg.role !== "user" && msg.role !== "assistant") throw new Error("Invalid role");
    return { role: msg.role, content: str(msg.content, 3000) };
  });
  if (!messages.length || messages.at(-1)?.role !== "user" || !messages.at(-1)?.content) throw new Error("Missing request");
  const source = record(input.context);
  const contacts = list(source.contacts, 50).map((item) => {
    const c = record(item);
    return { id: str(c.id, 160), name: str(c.name, 160), company: str(c.company || "", 160), phones: list(c.phones, 5).map(x => str(x, 60)), emails: list(c.emails, 5).map(x => str(x, 160)) };
  });
  const documents = list(source.documents, 50).map((item) => {
    const d = record(item);
    return { id: str(d.id, 160), title: str(d.title, 200), documentType: str(d.documentType, 60), status: str(d.status, 40) };
  });
  if (new Set(contacts.map(c => c.id)).size !== contacts.length || new Set(documents.map(d => d.id)).size !== documents.length) throw new Error("Duplicate IDs");
  const a = record(source.agencyReply);
  const agencyReply = { isAgencyReply: a.isAgencyReply === true, agencyName: str(a.agencyName, 160), contactName: str(a.contactName, 160), role: str(a.role, 160), requestSummary: str(a.requestSummary, 600), requestedItems: list(a.requestedItems, 8).map(x => str(x, 60)) };
  return { app, language: input.language === "pl" ? "pl" : "en", messages, context: { contacts, documents, agencyReply } };
}

// Model output is a proposal. Only exact references in this request may become an action.
export function validateNexusPlan(value: unknown, context: NexusContext, app: string): NexusPlan {
  const p = record(value);
  if (typeof p.ready !== "boolean") throw new Error("Invalid readiness");
  const plan: NexusPlan = { reply: str(p.reply, 3000), ready: p.ready, contactId: str(p.contactId, 160), recipient: str(p.recipient, 160), documentIds: list(p.documentIds, 20).map(x => str(x, 160)), subject: str(p.subject, 300), body: str(p.body, 5000) };
  if (!plan.reply) throw new Error("Missing reply");
  if (plan.documentIds.some(id => !context.documents.some(d => d.id === id))) throw new Error("Unknown document");
  if (plan.documentIds.some(id => context.documents.some(d => d.id === id && d.status === "expired"))) throw new Error("Expired document");
  const contact = context.contacts.find(c => c.id === plan.contactId);
  if (plan.contactId && !contact) throw new Error("Unknown contact");
  if (plan.recipient && (!contact || !(app === "Gmail" ? contact.emails : contact.phones).includes(plan.recipient))) throw new Error("Ungrounded recipient");
  if (plan.ready && ["Gmail", "WhatsApp", "Messages", "Call"].includes(app) && !plan.recipient) throw new Error("Missing recipient");
  if (!plan.ready) { plan.recipient = ""; plan.body = ""; plan.subject = ""; plan.documentIds = []; }
  return plan;
}

export const nexusPlanSchema = {
  type: "object", additionalProperties: false,
  required: ["reply", "ready", "contactId", "recipient", "documentIds", "subject", "body"],
  properties: {
    reply: { type: "string" }, ready: { type: "boolean" }, contactId: { type: "string" }, recipient: { type: "string" },
    documentIds: { type: "array", items: { type: "string" } }, subject: { type: "string" }, body: { type: "string" },
  },
};
