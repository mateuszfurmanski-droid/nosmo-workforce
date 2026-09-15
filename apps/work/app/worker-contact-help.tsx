"use client";
import { useState } from "react";

export default function WorkerContactHelp({ language }: { language: string }) {
  const [open, setOpen] = useState(false);
  const t = (en: string, pl: string) => language === "pl" ? pl : en;
  return <div className="worker-contact-help">
    <button type="button" aria-expanded={open} onClick={() => setOpen(value => !value)}>{t("I don't have a contacts file", "Nie mam pliku z kontaktami")}</button>
    {open && <div>
      <p>{t("You do not need to make a spreadsheet. Your Contacts app can create the file for you. Choose your device below.", "Nie musisz tworzyc arkusza. Aplikacja Kontakty moze utworzyc plik za Ciebie. Wybierz swoje urzadzenie ponizej.")}</p>
      <details><summary>iPad / iPhone</summary>
        <ol>
          <li>{t("Open Contacts, then Lists.", "Otworz Kontakty, potem Listy.")}</li>
          <li>{t("Touch and hold your work contacts list, then choose Export. You can create a work-only list first.", "Przytrzymaj liste kontaktow do pracy i wybierz Eksportuj. Mozesz najpierw utworzyc liste tylko do pracy.")}</li>
          <li>{t("Choose names, phone numbers and emails, then Done. Use Save to Files in the share menu.", "Wybierz nazwy, numery i adresy email, potem Gotowe. W menu udostepniania wybierz Zachowaj w Plikach.")}</li>
          <li>{t("Return here and choose I have a contacts file. Select the file you just saved.", "Wroc tutaj i wybierz Mam plik kontaktow. Wskaz zapisany plik.")}</li>
        </ol>
        <a href="https://support.apple.com/guide/ipad/ipada42ba52d/ipados" target="_blank" rel="noopener noreferrer">{t("Apple instructions", "Instrukcja Apple")}</a>
      </details>
      <details><summary>Samsung / Android</summary>
        <ol>
          <li>{t("If Choose work contacts is available here, use it: you can select contacts directly without a file.", "Jesli widzisz tutaj Wybierz kontakty do pracy, uzyj tego przycisku: wybierzesz kontakty bez pliku.")}</li>
          <li>{t("Otherwise open Contacts, then Menu, Manage contacts, Import or export contacts.", "W przeciwnym razie otworz Kontakty, potem Menu, Zarzadzaj kontaktami, Importuj lub eksportuj kontakty.")}</li>
          <li>{t("Choose Export and device storage. Review which contacts will be exported; some versions export all contacts.", "Wybierz Eksportuj i pamiec urzadzenia. Sprawdz zakres eksportu; niektore wersje eksportuja wszystkie kontakty.")}</li>
          <li>{t("Return here, choose I have a contacts file and select the exported .vcf file.", "Wroc tutaj, wybierz Mam plik kontaktow i wskaz wyeksportowany plik .vcf.")}</li>
        </ol>
        <a href="https://www.samsung.com/uk/support/mobile-devices/how-do-i-manage-my-contacts/" target="_blank" rel="noopener noreferrer">{t("Samsung instructions", "Instrukcja Samsung")}</a>
      </details>
      <p>{t("NOSMO cannot create a file from a contact book it cannot access. If the contacts are on a different device, export them there first.", "NOSMO nie utworzy pliku z ksiazki kontaktow, do ktorej nie ma dostepu. Jesli kontakty sa na innym urzadzeniu, wyeksportuj je tam.")}</p>
    </div>}
  </div>;
}
