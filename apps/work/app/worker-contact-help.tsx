"use client";

export default function WorkerContactHelp({ language }: { language: string }) {
  const t = (en: string, pl: string) => language === "pl" ? pl : en;
  return <div className="worker-contact-help">
    <h3>{t("How to bring your contacts into NOSMO", "Jak dodac kontakty do NOSMO")}</h3>
    <div>
      <p>{t("You do not need to make a spreadsheet. Your Contacts app can create the file for you. Follow the steps for your device below. The file ends in .vcf (vCard); you do not need to copy numbers one by one.", "Nie musisz tworzyc arkusza. Aplikacja Kontakty moze utworzyc plik za Ciebie. Ponizej znajdziesz kroki dla swojego urzadzenia. Plik ma koncowke .vcf (vCard); nie musisz kopiowac numerow pojedynczo.")}</p>
      <section aria-label="iPad / iPhone"><h4>iPad / iPhone</h4>
        <ol>
          <li>{t("Open Contacts, then Lists.", "Otworz Kontakty, potem Listy.")}</li>
          <li>{t("Touch and hold your work contacts list, then choose Export. You can create a work-only list first.", "Przytrzymaj liste kontaktow do pracy i wybierz Eksportuj. Mozesz najpierw utworzyc liste tylko do pracy.")}</li>
          <li>{t("Choose names, phone numbers and emails, then Done. Use Save to Files in the share menu, choose Downloads in iCloud Drive or On My iPad / iPhone, then Save.", "Wybierz nazwy, numery i adresy email, potem Gotowe. W menu udostepniania wybierz Zachowaj w Plikach, potem Pobrane w iCloud Drive lub Na moim iPadzie / iPhonie i Zachowaj.")}</li>
          <li>{t("Return here and choose I have a contacts file. Select the file you just saved.", "Wroc tutaj i wybierz Mam plik kontaktow. Wskaz zapisany plik.")}</li>
        </ol>
        <a href="https://support.apple.com/guide/ipad/ipada42ba52d/ipados" target="_blank" rel="noopener noreferrer">{t("Apple instructions", "Instrukcja Apple")}</a>
      </section>
      <section aria-label="Samsung / Android"><h4>Samsung / Android</h4>
        <ol>
          <li>{t("If Choose work contacts is available here, use it: you can select contacts directly without a file.", "Jesli widzisz tutaj Wybierz kontakty do pracy, uzyj tego przycisku: wybierzesz kontakty bez pliku.")}</li>
          <li>{t("Otherwise open Contacts, then Menu, Manage contacts, Import or export contacts.", "W przeciwnym razie otworz Kontakty, potem Menu, Zarzadzaj kontaktami, Importuj lub eksportuj kontakty.")}</li>
          <li>{t("Choose Export and device storage. Review which contacts will be exported; some versions export all contacts.", "Wybierz Eksportuj i pamiec urzadzenia. Sprawdz zakres eksportu; niektore wersje eksportuja wszystkie kontakty.")}</li>
          <li>{t("Return here, choose I have a contacts file and select the exported .vcf file. If you cannot find it, open My Files and search for .vcf.", "Wroc tutaj, wybierz Mam plik kontaktow i wskaz wyeksportowany plik .vcf. Jesli go nie widzisz, otworz Moje pliki i wyszukaj .vcf.")}</li>
        </ol>
        <a href="https://www.samsung.com/uk/support/mobile-devices/how-do-i-manage-my-contacts/" target="_blank" rel="noopener noreferrer">{t("Samsung instructions", "Instrukcja Samsung")}</a>
      </section>
      <h4>{t("Contacts on another device?", "Kontakty na innym urzadzeniu?")}</h4><p>{t("Export the .vcf file on the phone that holds your contacts. Share that file to your own email or save it in your own Drive. On this iPad, download it to Files, return to NOSMO and choose I have a contacts file. Use your work contacts only.", "Wyeksportuj plik .vcf na telefonie, na ktorym masz kontakty. Udostepnij ten plik na swoj email lub zapisz na swoim Dysku. Na tym iPadzie pobierz go do Plikow, wroc do NOSMO i wybierz Mam plik kontaktow. Uzyj tylko kontaktow do pracy.")}</p>
      <p>{t("NOSMO cannot create a file from a contact book it cannot access. If the contacts are on a different device, export them there first.", "NOSMO nie utworzy pliku z ksiazki kontaktow, do ktorej nie ma dostepu. Jesli kontakty sa na innym urzadzeniu, wyeksportuj je tam.")}</p>
    </div>
  </div>;
}
