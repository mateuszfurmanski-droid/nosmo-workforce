"use client";
import { useEffect, useRef, useState } from "react";
import type { AppDraft } from "./app-preparation";
import type { NexusContext, NexusMessage, NexusPlan } from "./nexus-action-plan";
import { rankPrompts } from "./nexus-prompt-history";

export default function NexusAppChat({ app, language, context, onDraft, promptHistory, onRemember, onClearHistory, historyStorage }: {
  app: string; language: string; context: NexusContext;
  promptHistory: string[]; onRemember: (text: string) => void; onClearHistory: () => void; historyStorage: boolean;
  onDraft: (draft: AppDraft, documents: string[]) => void;
}) {
  const [messages, setMessages] = useState<NexusMessage[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [plan, setPlan] = useState<NexusPlan | null>(null);
  const [applied, setApplied] = useState(false);
  const [morePrompts, setMorePrompts] = useState(false);
  const composer = useRef<HTMLTextAreaElement>(null);
  const abort = useRef<AbortController | null>(null);
  const latest = useRef<HTMLDivElement>(null);
  const t = (en: string, pl: string) => language === "pl" ? pl : en;
  const examples = app === "Calendar" ? [t("Help me plan my next shift", "Pomoz mi zaplanowac nastepna zmiane"), t("Prepare a reminder for my interview", "Przygotuj przypomnienie o rozmowie")]
    : app === "Drive" ? [t("Help me organise my work documents", "Pomoz mi uporzadkowac dokumenty do pracy")]
    : app === "CSCS / CITB" ? [t("Help me check my card renewal", "Pomoz mi sprawdzic odnowienie karty")]
    : ["Indeed", "LinkedIn", "Reed", "Totaljobs", "CV-Library"].includes(app) ? [t("Help me find work near me", "Pomoz mi znalezc prace w okolicy"), t("Prepare an application for this offer", "Przygotuj aplikacje na te oferte")]
    : [t("Prepare documents for the agency that sent me an offer", "Przygotuj dokumenty dla agencji, ktora przyslala mi oferte"), t("Help me reply to a recruiter", "Pomoz mi odpowiedziec rekruterowi"), t("Prepare a message about my availability", "Przygotuj wiadomosc o mojej dostepnosci")];
  const suggestions = rankPrompts(promptHistory.length ? promptHistory : examples, text);
  useEffect(() => () => abort.current?.abort(), []);
  useEffect(() => { if (messages.length) latest.current?.scrollIntoView({ block: "nearest" }); }, [messages, busy]);
  async function ask() {
    if (!text.trim() || busy) return;
    onRemember(text.trim());
    const next: NexusMessage[] = [...messages, { role: "user", content: text.trim() }];
    setBusy(true); setError(""); setPlan(null); setApplied(false);
    const controller = new AbortController(); abort.current = controller;
    try {
      const response = await fetch("/api/nexus-actions", { method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
        body: JSON.stringify({ app, language, messages: next.slice(-9), context }) });
      const result = await response.json();
      if (!response.ok) {
        const code = result.code;
        setError(code === "sign_in_required" ? t("Sign in using the account button above to talk to Nexus. Your text is still here.", "Zaloguj sie przyciskiem konta u gory, aby porozmawiac z Nexusem. Twoj tekst zostal tutaj.")
          : code === "not_configured" ? t("Nexus AI is not configured on this Preview yet. You can use Edit details below.", "Nexus AI nie jest jeszcze skonfigurowany na tym Preview. Mozesz uzyc opcji Edytuj szczegoly ponizej.")
          : code === "rate_limited" ? t("Nexus is busy. Try again in a minute.", "Nexus jest zajety. Sprobuj ponownie za minute.")
          : code === "ai_timeout" ? t("Nexus took too long. Your text is saved here; try again.", "Nexus nie odpowiedzial na czas. Twoj tekst zostal tutaj; sprobuj ponownie.")
          : t("Nexus could not prepare an answer. Try again or use Edit details.", "Nexus nie mogl przygotowac odpowiedzi. Sprobuj ponownie lub uzyj Edytuj szczegoly."));
        return;
      }
      setMessages([...next, { role: "assistant", content: result.plan.reply }]);
      setPlan(result.plan); setText("");
    } catch {
      if (!controller.signal.aborted) setError(t("Connection interrupted. Your text is still here. Try again.", "Polaczenie przerwane. Twoj tekst zostal tutaj. Sprobuj ponownie."));
    } finally { if (!controller.signal.aborted) setBusy(false); }
  }
  return <div className="nexus-app-chat">
    {!messages.length && <p className="nexus-chat-welcome">{t("What shall we do? Tell me in your own words.", "Co robimy? Napisz po prostu swoimi slowami.")}</p>}
    <div role="log" aria-label={t("Conversation with Nexus", "Rozmowa z Nexusem")} aria-live="polite" className="nexus-chat-log">
      {messages.map((message, index) => <div className={`nexus-chat-message nexus-chat-message--${message.role}`} key={index}><strong>{message.role === "user" ? t("You", "Ty") : "NEXUS"}</strong><p>{message.content}</p></div>)}
      <div ref={latest}/>
    </div>
    <form className="nexus-chat-composer" onSubmit={(event) => { event.preventDefault(); void ask(); }}>
      <div className="nexus-prompt-suggestions" aria-label={t("Suggested messages", "Sugerowane wiadomosci")}>
        <small>{promptHistory.length ? t("Your previous requests — tap to edit", "Twoje poprzednie polecenia — kliknij, aby edytowac") : t("Try asking", "Mozesz zapytac")}</small>
        <div className="nexus-prompt-list">
          {suggestions.slice(0, morePrompts ? 20 : 3).map(prompt => <button type="button" key={prompt} title={prompt} disabled={busy} onClick={() => { setText(prompt); composer.current?.focus(); }}>{prompt}</button>)}
        </div>
        {suggestions.length > 3 && <button type="button" className="nexus-prompt-control" aria-expanded={morePrompts} onClick={() => setMorePrompts(value => !value)}>{morePrompts ? t("Show less", "Pokaz mniej") : t(`More (${suggestions.length - 3})`, `Wiecej (${suggestions.length - 3})`)}</button>}
        {!!promptHistory.length && <details><summary>{t("Manage suggestions", "Zarzadzaj podpowiedziami")}</summary><p>{historyStorage ? t("Saved for your account in this browser. Only requests submitted to Nexus are remembered.", "Zapisane dla Twojego konta w tej przegladarce. Pamietane sa tylko polecenia wyslane do Nexusa.") : t("Kept in this tab only. Sign in to remember requests on this device.", "Zostaja tylko w tej karcie. Zaloguj sie, aby pamietac polecenia na tym urzadzeniu.")}</p><button type="button" onClick={onClearHistory}>{t("Clear saved suggestions", "Wyczysc zapisane podpowiedzi")}</button></details>}
      </div>
      <label htmlFor="nexus-app-prompt">{t("Message Nexus", "Napisz do Nexusa")}</label>
      <textarea ref={composer} id="nexus-app-prompt" rows={3} maxLength={3000} value={text} disabled={busy} onChange={event => setText(event.target.value)} placeholder={t("Send documents to the agency that sent me an offer...", "Wyslij dokumenty do tej agencji co mi przyslala oferte...")} onKeyDown={event => { if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) { event.preventDefault(); void ask(); } }}/>
      <button type="submit" disabled={busy || !text.trim()}>{busy ? t("Nexus is preparing...", "Nexus przygotowuje...") : t("Ask Nexus", "Zapytaj Nexusa")}</button>
    </form>
    {error && <p role="alert">{error}</p>}
    {plan?.ready && <section className="nexus-chat-plan" aria-label={t("Review preparation", "Sprawdz przygotowanie")}>
      <h3>{t("Ready for your review", "Gotowe do sprawdzenia")}</h3>
      {plan.recipient && <p><strong>{context.contacts.find(c => c.id === plan.contactId)?.name}</strong> · {plan.recipient}</p>}
      {plan.subject && <p><strong>{plan.subject}</strong></p>}
      <p className="nexus-chat-draft">{plan.body}</p>
      {!!plan.documentIds.length && <><p>{t("Documents to attach yourself in the destination:", "Dokumenty do samodzielnego dolaczenia w wybranej apce:")}</p><ul>{plan.documentIds.map(id => <li key={id}>{context.documents.find(d => d.id === id)?.title}</li>)}</ul></>}
      <button type="button" disabled={applied} onClick={() => { onDraft({ recipient: plan.recipient, subject: plan.subject, body: plan.body, purpose: "Nexus" }, plan.documentIds); setApplied(true); }}>{applied ? t("Draft ready below", "Szkic gotowy ponizej") : t("Use this draft", "Uzyj tego szkicu")}</button>
    </section>}
    <details className="nexus-chat-context"><summary>{t("What Nexus can see", "Co widzi Nexus")}</summary><p>{t("When you ask, your message and these details are sent to AI: saved contacts, document names/types and your imported agency reply. No document files or inbox access.", "Gdy pytasz, do AI trafia Twoja wiadomosc i te dane: zapisane kontakty, nazwy i typy dokumentow oraz zaimportowana odpowiedz agencji. Bez plikow dokumentow i dostepu do skrzynki.")}</p><p>{context.contacts.length} {t("contacts", "kontaktow")} · {context.documents.length} {t("documents", "dokumentow")} · {context.agencyReply.isAgencyReply ? t("Imported agency reply available", "Jest zaimportowana odpowiedz agencji") : t("No imported agency reply", "Brak zaimportowanej odpowiedzi agencji")}</p></details>
  </div>;
}
