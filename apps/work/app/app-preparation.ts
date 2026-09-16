export type AppDraft = { recipient: string; subject: string; body: string; purpose: string };

export function internationalPhone(value: string): string {
  const compact = value.trim().replace(/[ ()-]/g, "").replace(/^00/, "+");
  return /^\+[1-9]\d{7,14}$/.test(compact) ? compact : "";
}

export function preparedCommunicationUrl(app: string, draft: AppDraft): string | null {
  const phone = internationalPhone(draft.recipient);
  if (["WhatsApp", "Messages", "Call"].includes(app) && !phone) return null;
  if (app === "Call") return `tel:${phone}`;
  if (!draft.body.trim()) return null;
  if (app === "WhatsApp") return `https://wa.me/${phone.slice(1)}?text=${encodeURIComponent(draft.body)}`;
  if (app === "Messages") return `sms:${phone}?body=${encodeURIComponent(draft.body)}`;
  if (app === "Gmail") {
    const email = draft.recipient.trim();
    if (!/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,}$/.test(email)) return null;
    const query = new URLSearchParams({ view: "cm", fs: "1", to: email, su: draft.subject.replace(/[\r\n]/g, " "), body: draft.body });
    return `https://mail.google.com/mail/?${query.toString()}`;
  }
  return null;
}
