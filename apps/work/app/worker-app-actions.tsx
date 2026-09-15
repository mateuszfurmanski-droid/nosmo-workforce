"use client";

import { useEffect, useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { CalendarDays, ChevronRight, Phone, Send } from "lucide-react";
import { preparedCommunicationUrl, type AppDraft } from "./app-preparation";
import "./worker-app-actions.css";

const apps = [
  { name: "Gmail", src: "/app-icons/gmail.svg", glyph: "", icon: null, url: "https://mail.google.com/", tone: "gmail", kind: "email" },
  { name: "WhatsApp", src: "/app-icons/whatsapp.svg", glyph: "", icon: null, url: "https://web.whatsapp.com/", tone: "whatsapp", kind: "message" },
  { name: "Call", src: "", glyph: "", icon: Phone, url: "", tone: "call", kind: "call" },
  { name: "Messages", src: "", glyph: "", icon: Send, url: "", tone: "messages", kind: "message" },
  { name: "Indeed", src: "/app-icons/indeed.svg", glyph: "", icon: null, url: "https://uk.indeed.com/", tone: "indeed", kind: "jobs" },
  { name: "LinkedIn", src: "", glyph: "in", icon: null, url: "https://www.linkedin.com/jobs/", tone: "linkedin", kind: "jobs" },
  { name: "Reed", src: "", glyph: "R•••", icon: null, url: "https://www.reed.co.uk/jobs", tone: "reed", kind: "jobs" },
  { name: "Totaljobs", src: "", glyph: "tj", icon: null, url: "https://www.totaljobs.com/", tone: "totaljobs", kind: "jobs" },
  { name: "CV-Library", src: "", glyph: "CV", icon: null, url: "https://www.cv-library.co.uk/", tone: "cvlib", kind: "jobs" },
  { name: "Drive", src: "/app-icons/drive.svg", glyph: "", icon: null, url: "https://drive.google.com/", tone: "drive", kind: "files" },
  { name: "Calendar", src: "", glyph: "", icon: CalendarDays, url: "https://calendar.google.com/", tone: "calendar", kind: "calendar" },
  { name: "CSCS / CITB", src: "", glyph: "CSCS", icon: null, url: "https://www.cscs.uk.com/", tone: "cscs", kind: "cards" },
] as const;
type Contact = { id: string; name: string; phones: string[]; emails: string[] };
type Props = { language: string; contacts: Contact[]; onOpen: (url: string) => void; visible: boolean };
const emptyDraft: AppDraft = { recipient: "", subject: "", body: "", purpose: "" };

// Account changes remount the workspace, discarding the previous account's drafts.
export function SignedInAppActions(props: Props) {
  const { isLoaded, user } = useUser();
  if (!isLoaded) return null;
  return <WorkerAppActions key={user?.id || "signed-out"} {...props} />;
}

export default function WorkerAppActions({ language, contacts, onOpen, visible }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, AppDraft>>({});
  const [notice, setNotice] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const lastTile = useRef<HTMLButtonElement | null>(null);
  const pl = language === "pl";
  const t = (en: string, polish: string) => pl ? polish : en;
  const app = apps.find((item) => item.name === selected);
  const draft = selected ? drafts[selected] || emptyDraft : emptyDraft;
  const communication = app && ["message", "email", "call"].includes(app.kind);
  const directUrl = app && communication ? preparedCommunicationUrl(app.name, draft) : null;
  useEffect(() => { if (selected && visible) heading.current?.focus(); }, [selected, visible]);

  function update(patch: Partial<AppDraft>) {
    if (!selected) return;
    setDrafts((current) => ({ ...current, [selected]: { ...(current[selected] || emptyDraft), ...patch } }));
    setNotice("");
  }
  function back() { setSelected(null); setNotice(""); requestAnimationFrame(() => lastTile.current?.focus()); }
  async function copy() {
    const text = communication ? draft.body : [draft.purpose, draft.subject, draft.body].filter(Boolean).join("\n\n");
    try { await navigator.clipboard.writeText(text); setNotice(t("Copied. Paste it in the destination app if needed.", "Skopiowano. Wklej w wybranej apce, jesli trzeba.")); }
    catch { setNotice(t("Copy was blocked. Select the text below and copy it manually.", "Kopiowanie zablokowane. Zaznacz tekst ponizej i skopiuj recznie.")); }
  }
  const taskOptions = app?.kind === "jobs" ? [t("Find work", "Szukaj pracy"), t("Prepare an application", "Przygotuj aplikacje")]
    : app?.kind === "files" ? [t("Organise work files", "Uporzadkuj pliki"), t("Prepare a document upload", "Przygotuj przeslanie dokumentow")]
    : app?.kind === "calendar" ? [t("Plan a shift", "Zaplanuj zmiane"), t("Plan an interview", "Zaplanuj rozmowe")]
    : app?.kind === "cards" ? [t("Check a card", "Sprawdz karte"), t("Plan a renewal or training", "Zaplanuj odnowienie lub szkolenie")]
    : [t("Ask about work", "Zapytaj o prace"), t("Reply to a recruiter", "Odpowiedz rekruterowi"), t("Confirm availability", "Potwierdz dostepnosc")];

  return <div hidden={!visible} className="worker-app-workspace">
    <div hidden={!!app}>
      <div className="nexus-command-section-title"><small>{t("Your apps", "Twoje apki")}</small><span/></div>
      <section className="nexus-command-grid nexus-command-grid--external" aria-label="Connected work apps">
        {apps.map((item) => { const Icon = item.icon; return <button type="button" className={`nexus-command-module nexus-command-module--external tone-${item.tone}`} key={item.name} onClick={(event) => { lastTile.current = event.currentTarget; setSelected(item.name); setNotice(""); }}>
          <i className="nexus-command-icon">{item.src ? <img src={item.src} alt=""/> : Icon ? <Icon/> : <b className={`nexus-command-glyph glyph-${item.tone}`}>{item.glyph}</b>}</i>
          <span>{item.name}</span><ChevronRight className="nexus-command-action" aria-hidden="true"/>
        </button>; })}
      </section>
    </div>
    {app && <section className="worker-app-preparation" aria-labelledby="app-preparation-title">
      <button type="button" onClick={back}>{t("Back to apps", "Wroc do apek")}</button>
      <small>NOSMO · {t("PREPARE", "PRZYGOTUJ")}</small>
      <h2 ref={heading} tabIndex={-1} id="app-preparation-title">{app.name}</h2>
      <p>{t("Prepare here. Open the destination when you are ready.", "Przygotuj tutaj. Otworz wybrana apke, gdy wszystko bedzie gotowe.")}</p>
      <label>{t("What do you want to do?", "Co chcesz zrobic?")}<select value={draft.purpose} onChange={(event) => update({ purpose: event.target.value })}>
        <option value="">{t("Choose a task", "Wybierz zadanie")}</option>{taskOptions.map((option) => <option key={option}>{option}</option>)}
      </select></label>
      {communication && <>
        <label>{t("Choose a saved contact or enter below", "Wybierz zapisany kontakt albo wpisz ponizej")}<select value="" onChange={(event) => update({ recipient: event.target.value })}>
          <option value="">{t("Choose a recipient", "Wybierz odbiorce")}</option>
          {contacts.flatMap((contact) => (app.kind === "email" ? contact.emails : contact.phones).map((value, index) => <option key={`${contact.id}-${index}`} value={value}>{contact.name} · {value}</option>))}
        </select></label>
        <label>{app.kind === "email" ? t("Recipient email", "Email odbiorcy") : t("Recipient number with country code", "Numer odbiorcy z kodem kraju")}
          <input type={app.kind === "email" ? "email" : "tel"} autoComplete="off" placeholder={app.kind === "email" ? "name@example.com" : "+44..."} value={draft.recipient} onChange={(event) => update({ recipient: event.target.value })}/>
        </label>
        {draft.recipient && <p className="worker-app-recipient">{t("Recipient", "Odbiorca")}: <strong>{contacts.filter((contact) => [...contact.phones, ...contact.emails].includes(draft.recipient)).map((contact) => contact.name).join(" / ") || t("Entered manually", "Wpisany recznie")}</strong> · {draft.recipient}</p>}
      </>}
      {(app.kind === "email" || !communication) && <label>{app.kind === "jobs" ? t("Role and location", "Stanowisko i lokalizacja") : app.kind === "calendar" ? t("Event, date and time", "Wydarzenie, data i godzina") : app.kind === "files" ? t("Files and destination folder", "Pliki i folder docelowy") : app.kind === "cards" ? t("Card or training task", "Karta lub szkolenie") : t("Subject", "Temat")}
        <input value={draft.subject} onChange={(event) => update({ subject: event.target.value })}/>
      </label>}
      <label>{app.kind === "call" ? t("Notes for your call", "Notatki do rozmowy") : communication ? t("Your full message", "Pelna tresc wiadomosci") : t("Your preparation notes", "Twoje notatki do zadania")}
        <textarea rows={6} value={draft.body} onChange={(event) => update({ body: event.target.value })}/>
      </label>
      {communication && app.kind !== "call" && <button type="button" disabled={!!draft.body} onClick={() => update({ body: pl ? "Dzien dobry, chcialbym zapytac o dostepna prace. Prosze o informacje o stanowisku, lokalizacji i terminie rozpoczecia. Dziekuje." : "Hello, I would like to ask about available work. Please send details of the role, location and start date. Thank you." })}>{t("Start with a work enquiry", "Zacznij od zapytania o prace")}</button>}
      <div className="worker-app-handoff-note">
        {app.name === "WhatsApp" ? t("Opens the selected number with your message ready. Check the conversation and press Send in WhatsApp. Files must be attached separately.", "Otworzy wybrany numer z gotowa wiadomoscia. Sprawdz rozmowe i nacisnij Wyslij w WhatsApp. Pliki dolacz osobno.")
          : app.name === "Gmail" ? t("Opens a Gmail web draft with recipient, subject and message. Gmail may ask you to sign in. Attach files there; nothing is sent here.", "Otworzy wersje WWW Gmail z odbiorca, tematem i trescia. Gmail moze poprosic o logowanie. Pliki dolacz tam; tutaj nic nie jest wysylane.")
          : app.name === "Messages" ? t("Opens your SMS app with the number and requested message. Some devices may require pasting the text; use Copy if needed.", "Otworzy SMS z numerem i przekazana trescia. Na niektorych urzadzeniach trzeba wkleic tekst; w razie potrzeby uzyj Kopiuj.")
          : app.name === "Call" ? t("Opens the dialler for this number. Your notes stay in NOSMO.", "Otworzy wybieranie tego numeru. Notatki zostana w NOSMO.")
          : t("This app currently opens its website. Copy your preparation to use there; notes, files and events are not transferred automatically.", "Ta apka na razie otwiera swoja strone. Skopiuj przygotowanie, aby uzyc go tam; notatki, pliki i wydarzenia nie sa przekazywane automatycznie.")}
      </div>
      {communication && !directUrl && <p>{app.kind === "call" ? t("Enter a valid number with +country code.", "Wpisz poprawny numer z +kodem kraju.") : t("Enter one valid recipient (+country code for phone numbers) and a message before continuing.", "Wpisz jednego poprawnego odbiorce (numer z +kodem kraju) oraz wiadomosc, aby przejsc dalej.")}</p>}
      <div className="worker-app-preparation-actions">
        <button type="button" disabled={!draft.body && !draft.subject && !draft.purpose} onClick={() => void copy()}>{t("Copy preparation", "Kopiuj przygotowanie")}</button>
        <button type="button" disabled={communication ? !directUrl : !draft.purpose && !draft.subject && !draft.body} onClick={() => {
          const url = communication ? directUrl : app.url;
          if (!url) return;
          onOpen(url);
          setNotice(t("Opening requested. Sending, calling or saving is not confirmed by NOSMO.", "Poproszono o otwarcie apki. NOSMO nie potwierdza wyslania, polaczenia ani zapisu."));
        }}>{t("Continue to", "Przejdz do")} {app.name}</button>
      </div>
      {notice && <p role="status">{notice}</p>}
      <small>{t("Drafts remain in this tab until it is reloaded or the account changes.", "Szkice zostaja w tej karcie do jej odswiezenia lub zmiany konta.")}</small>
    </section>}
  </div>;
}
