"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import WorkerContactHelp from "./worker-contact-help";

type Props = {
  language: string;
  showResume: boolean;
  onContacts: () => Promise<void>;
  onContactFile: (files: FileList | null) => Promise<void>;
  onDocuments: (files: FileList | null) => Promise<void>;
  onFinish: () => void;
  contactNotice: string;
  documentNotice: string;
};

// Only the setup progress is stored here, separately for each signed-in account.
// Opening setup never reads contacts, uploads files or grants sharing consent.
export default function WorkerFirstLogin(props: Props) {
  const { isLoaded, isSignedIn, user } = useUser();
  const userId = user?.id;
  const [state, setState] = useState({ userId: "", step: 0, open: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [canPickContacts, setCanPickContacts] = useState(false);
  const pl = props.language === "pl";
  const t = (en: string, polish: string) => pl ? polish : en;

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !userId) {
      setState({ userId: "", step: 0, open: false });
      return;
    }
    let step = 0;
    let done = false;
    try {
      const saved = JSON.parse(localStorage.getItem(`nosmo-setup-v1:${userId}`) || "null");
      if (saved && Number.isInteger(saved.step) && saved.step >= 0 && saved.step <= 2) {
        step = saved.step;
        done = saved.done === true;
      }
    } catch { /* Setup remains available when storage is blocked or malformed. */ }
    const contacts = (navigator as Navigator & { contacts?: { select?: unknown } }).contacts;
    setCanPickContacts(typeof contacts?.select === "function");
    setState({ userId, step, open: !done });
    setError("");
  }, [isLoaded, isSignedIn, userId]);

  if (!isLoaded || !isSignedIn || !userId || state.userId !== userId) return null;

  function save(step: number, done = false) {
    try { localStorage.setItem(`nosmo-setup-v1:${userId}`, JSON.stringify({ step, done })); }
    catch { setError(t("Setup progress could not be saved on this device.", "Nie udalo sie zapisac postepu na tym urzadzeniu.")); }
    setState({ userId: userId!, step, open: !done });
  }

  async function run(action: () => Promise<void>) {
    setError("");
    setBusy(true);
    try { await action(); }
    catch { setError(t("Nothing confirmed yet. Please try again or choose Later.", "Brak potwierdzenia. Sprobuj ponownie lub wybierz Pozniej.")); }
    finally { setBusy(false); }
  }

  if (!state.open) return props.showResume ? (
    <button className="worker-setup-resume" type="button" onClick={() => save(0)}>
      {t("Set up my Worker Card", "Przygotuj moja karte pracownika")}
    </button>
  ) : null;

  return <section className="worker-setup" aria-labelledby="worker-setup-title" aria-busy={busy}>
    <small>{t("GET STARTED", "ZACZNIJ TUTAJ")} · {state.step + 1}/3</small>
    <h2 id="worker-setup-title">{[
      t("Add your work contacts", "Dodaj kontakty do pracy"),
      t("Add your CV or work cards", "Dodaj CV lub karty zawodowe"),
      t("Your next step", "Twoj nastepny krok"),
    ][state.step]}</h2>
    {state.step === 0 && <>
      <p>{t("Add your recruiters and work contacts. Nothing is sent to an agency.", "Dodaj rekruterow i kontakty do pracy. Nic nie wyslemy do agencji.")}</p>
      {canPickContacts ? <button type="button" disabled={busy} onClick={() => void run(props.onContacts)}>
        {t("Choose work contacts", "Wybierz kontakty do pracy")}
      </button> : null}      <WorkerContactHelp language={props.language}/>
      <details><summary>{t("I have a contacts file", "Mam plik kontaktow")}</summary>
        <label>{t("Choose contacts file", "Wybierz plik kontaktow")}<input type="file" disabled={busy} accept=".vcf,text/vcard,text/x-vcard" onChange={(event) => {
          const files = event.currentTarget.files;
          if (files?.length) void run(() => props.onContactFile(files));
          event.currentTarget.value = "";
        }} /></label>
      </details>
      {props.contactNotice && <p role="status">{props.contactNotice}</p>}
    </>}
    {state.step === 1 && <>
      <p>{t("Choose a CV, CSCS card or certificate. Nexus suggests the document type and details; you check them before saving.", "Wybierz CV, karte CSCS lub certyfikat. Nexus zaproponuje typ dokumentu i dane; sprawdzisz je przed zapisem.")}</p>
      <p>{t("Selected files are sent to Nexus for analysis. They are not shared with agencies. Up to 5 files, 10 MB each.", "Wybrane pliki zostana wyslane do Nexus do analizy. Nie beda udostepnione agencjom. Do 5 plikow, po 10 MB.")}</p>
      <label className="worker-setup-upload">{t("Choose files and analyse", "Wybierz pliki i przeanalizuj")}<input type="file" multiple disabled={busy} accept=".pdf,.doc,.docx,.txt,image/png,image/jpeg,image/webp" onChange={(event) => {
        const files = event.currentTarget.files;
        if (files?.length) void run(() => props.onDocuments(files));
        event.currentTarget.value = "";
      }} /></label>
      {props.documentNotice && <p role="status">{props.documentNotice}</p>}
      <p>{t("Review any results below this panel. You can also add documents later.", "Sprawdz wyniki ponizej tego panelu. Dokumenty mozesz tez dodac pozniej.")}</p>
    </>}
    {state.step === 2 && <p>{t("You can now edit your Worker Card and availability. Add more contacts or documents whenever you need them. WhatsApp and SMS are not connected automatically; choose only work messages to share or import.", "Teraz mozesz uzupelnic karte pracownika i dostepnosc. Kontakty i dokumenty dodasz takze pozniej. WhatsApp i SMS nie sa laczone automatycznie; wybieraj tylko wiadomosci dotyczace pracy do udostepnienia lub importu.")}</p>}
    {error && <p role="alert">{error}</p>}
    {busy && <p role="status">{t("Processing your selection...", "Przetwarzanie wybranych danych...")}</p>}
    <div className="worker-setup-actions">
      {state.step > 0 && <button type="button" disabled={busy} onClick={() => save(state.step - 1)}>{t("Back", "Wstecz")}</button>}
      {state.step < 2 ? <button type="button" disabled={busy} onClick={() => save(state.step + 1)}>{t("Continue / skip this step", "Dalej / pomin ten krok")}</button>
        : <button type="button" disabled={busy} onClick={() => { save(2, true); props.onFinish(); }}>{t("Open my Worker Card", "Otworz moja karte")}</button>}
      <button type="button" disabled={busy} onClick={() => setState((current) => ({ ...current, open: false }))}>{t("Later", "Pozniej")}</button>
    </div>
  </section>;
}
