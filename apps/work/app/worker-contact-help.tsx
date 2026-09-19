"use client";
import { useState } from "react";

export default function WorkerContactHelp({ language }: { language: string }) {
  const [system, setSystem] = useState<"android" | "iphone" | null>(null);
  const [contacts, setContacts] = useState<"samsung" | "google" | null>(null);
  const t = (en: string, pl: string) => language === "pl" ? pl : en;
  const steps = system === "iphone" ? [
    t("Open Contacts → Lists.", "Otworz Kontakty → Listy."),
    t("Hold your work list → Export. Select names, phone numbers and emails → Done.", "Przytrzymaj liste do pracy → Eksportuj. Wybierz nazwy, telefony i email → Gotowe."),
    t("Save to Files → choose a folder → Save.", "Zachowaj w Plikach → wybierz folder → Zachowaj."),
  ] : contacts === "samsung" ? [
    t("Open Contacts → Menu → Manage contacts.", "Otworz Kontakty → Menu → Zarzadzaj kontaktami."),
    t("Import or export contacts → Export → device storage.", "Importuj lub eksportuj kontakty → Eksportuj → pamiec telefonu."),
    t("Find the .vcf file in My Files. Check the export scope: some versions include all contacts.", "Znajdz plik .vcf w Moje pliki. Sprawdz zakres eksportu: niektore wersje obejmuja wszystkie kontakty."),
  ] : [
    t("Open Google Contacts → Fix & manage.", "Otworz Kontakty Google → Napraw i zarzadzaj."),
    t("Export to file → choose your work account → Export to .VCF file.", "Eksportuj do pliku → wybierz konto do pracy → Eksportuj do pliku .VCF."),
    t("Save the file in Downloads.", "Zapisz plik w folderze Pobrane."),
  ];
  const ready = system === "iphone" || (system === "android" && contacts !== null);
  return <div className="worker-contact-help">
    <h3>{t("Need a contacts file?", "Potrzebujesz pliku kontaktow?")}</h3>
    <p>{t("Choose your phone. We will show you how.", "Wybierz telefon. Pokazemy Ci, jak to zrobic.")}</p>
    <div className="contact-system-options" role="group" aria-label={t("Phone system", "System telefonu")}>
      <button type="button" aria-pressed={system === "android"} onClick={() => { setSystem("android"); setContacts(null); }}>Android</button>
      <button type="button" aria-pressed={system === "iphone"} onClick={() => { setSystem("iphone"); setContacts(null); }}>iPhone</button>
    </div>
    {system === "android" && <>
      <p>{t("Which Contacts app do you use?", "Ktorej aplikacji Kontakty uzywasz?")}</p>
      <div className="contact-system-options" role="group" aria-label={t("Contacts app", "Aplikacja Kontakty")}>
        <button type="button" aria-pressed={contacts === "samsung"} onClick={() => setContacts("samsung")}>Samsung</button>
        <button type="button" aria-pressed={contacts === "google"} onClick={() => setContacts("google")}>Google</button>
      </div>
    </>}
    {ready && <section className="contact-selected-guide" aria-label={t("Contact import instructions", "Instrukcja importu kontaktow")}>
      <ol>{steps.map((step, i) => <li key={i}>{step}</li>)}
        <li>{t("Return to NOSMO → I have a contacts file → choose the saved .vcf file.", "Wroc do NOSMO → Mam plik kontaktow → wybierz zapisany plik .vcf.")}</li>
      </ol>
      <p>{t("Use work contacts only. Your original contacts stay on your phone.", "Uzyj tylko kontaktow do pracy. Oryginalne kontakty zostaja na telefonie.")}</p>
      <details><summary>{t("Cannot find the file?", "Nie widzisz pliku?")}</summary>
        <p>{t("Search for .vcf in Files or My Files. Menu names can vary by phone version. If your contacts are on another phone, export there and transfer the file to this phone using your own email or Drive.", "Wyszukaj .vcf w Plikach lub Moje pliki. Nazwy menu moga zalezec od wersji telefonu. Jesli kontakty masz na innym telefonie, wyeksportuj je tam i przenies plik na ten telefon przez swoj email lub Dysk.")}</p>
      </details>
    </section>}
  </div>;
}
