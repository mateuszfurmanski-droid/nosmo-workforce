"use client";

export default function WorkerContactHelp({ language }: { language: string }) {
  const t = (en: string, pl: string) => language === "pl" ? pl : en;
  return <div className="worker-contact-help">
    <h3>{t("How to bring your contacts into NOSMO", "Jak dodac kontakty do NOSMO")}</h3>
    <div>
      <p>{t("You do not need to make a spreadsheet. Your Contacts app can create the file for you. Do this on the phone where you use NOSMO. Follow the steps for your Contacts app below. The file ends in .vcf (vCard); you do not need to copy numbers one by one.", "Nie musisz tworzyc arkusza. Aplikacja Kontakty moze utworzyc plik za Ciebie. Zrob to na telefonie, na ktorym uzywasz NOSMO. Ponizej znajdziesz kroki dla swojej aplikacji Kontakty. Plik ma koncowke .vcf (vCard); nie musisz kopiowac numerow pojedynczo.")}</p>
      <section aria-label="iPhone"><h4>iPhone</h4>
        <ol>
          <li>{t("Open Contacts, then Lists.", "Otworz Kontakty, potem Listy.")}</li>
          <li>{t("Touch and hold your work contacts list, then choose Export. You can create a work-only list first.", "Przytrzymaj liste kontaktow do pracy i wybierz Eksportuj. Mozesz najpierw utworzyc liste tylko do pracy.")}</li>
          <li>{t("Choose names, phone numbers and emails, then Done. Use Save to Files in the share menu, choose Downloads in iCloud Drive or On My iPhone, then Save.", "Wybierz nazwy, numery i adresy email, potem Gotowe. W menu udostepniania wybierz Zachowaj w Plikach, potem Pobrane w iCloud Drive lub Na moim iPhonie i Zachowaj.")}</li>
          <li>{t("Return to NOSMO on the same phone and choose I have a contacts file. Select the file you just saved.", "Wroc do NOSMO na tym samym telefonie i wybierz Mam plik kontaktow. Wskaz zapisany plik.")}</li>
        </ol>
        <a href="https://support.apple.com/guide/iphone/iphone" target="_blank" rel="noopener noreferrer">{t("Apple instructions", "Instrukcja Apple")}</a>
      </section>
      <section aria-label="Android — Samsung Contacts"><h4>{t("Android — Samsung Contacts", "Android — Kontakty Samsung")}</h4>
        <ol>
          <li>{t("If Choose work contacts is available here, use it: you can select contacts directly without a file.", "Jesli widzisz tutaj Wybierz kontakty do pracy, uzyj tego przycisku: wybierzesz kontakty bez pliku.")}</li>
          <li>{t("Otherwise open Contacts, then Menu, Manage contacts, Import or export contacts.", "W przeciwnym razie otworz Kontakty, potem Menu, Zarzadzaj kontaktami, Importuj lub eksportuj kontakty.")}</li>
          <li>{t("Choose Export and device storage. Review which contacts will be exported; some versions export all contacts.", "Wybierz Eksportuj i pamiec urzadzenia. Sprawdz zakres eksportu; niektore wersje eksportuja wszystkie kontakty.")}</li>
          <li>{t("Return to NOSMO on the same phone, choose I have a contacts file and select the exported .vcf file. If you cannot find it, open My Files and search for .vcf.", "Wroc do NOSMO na tym samym telefonie, wybierz Mam plik kontaktow i wskaz wyeksportowany plik .vcf. Jesli go nie widzisz, otworz Moje pliki i wyszukaj .vcf.")}</li>
        </ol>
        <a href="https://www.samsung.com/uk/support/mobile-devices/how-do-i-manage-my-contacts/" target="_blank" rel="noopener noreferrer">{t("Samsung instructions", "Instrukcja Samsung")}</a>
      </section>
      <section aria-label="Android — Google Contacts">
        <h4>{t("Android — Google Contacts", "Android — Kontakty Google")}</h4>
        <ol>
          <li>{t("Open Google Contacts on your phone.", "Otworz Kontakty Google na telefonie.")}</li>
          <li>{t("Open Fix & manage, then Export to file. Menu names may vary with the app version.", "Otworz Napraw i zarzadzaj, potem Eksportuj do pliku. Nazwy menu moga zalezec od wersji aplikacji.")}</li>
          <li>{t("Choose the account with your work contacts, then Export to .VCF file. Save it in Downloads.", "Wybierz konto z kontaktami do pracy, potem Eksportuj do pliku .VCF. Zapisz go w folderze Pobrane.")}</li>
          <li>{t("Return to NOSMO on the same phone, choose I have a contacts file and select the saved .vcf file from Downloads.", "Wroc do NOSMO na tym samym telefonie, wybierz Mam plik kontaktow i wskaz zapisany plik .vcf z folderu Pobrane.")}</li>
        </ol>
        <a href="https://support.google.com/contacts/answer/7199294?co=GENIE.Platform%3DAndroid" target="_blank" rel="noopener noreferrer">{t("Google instructions", "Instrukcja Google")}</a>
      </section>
      <h4>{t("Optional: contacts on another phone", "Opcjonalnie: kontakty na innym telefonie")}</h4>
      <p>{t("Export the .vcf file on that phone. Send it to your own email or save it in your own Drive, then download it on the phone where you use NOSMO. Choose I have a contacts file and select it. You do not need this step if your contacts are already on this phone.", "Wyeksportuj plik .vcf na tamtym telefonie. Wyslij go na swoj email lub zapisz na swoim Dysku, potem pobierz na telefonie, na ktorym uzywasz NOSMO. Wybierz Mam plik kontaktow i wskaz plik. Ten krok nie jest potrzebny, jesli kontakty sa juz na tym telefonie.")}</p>
      <p>{t("Import work contacts only. Exporting creates a copy and does not move contacts out of your Contacts app.", "Importuj tylko kontakty do pracy. Eksport tworzy kopie i nie przenosi kontaktow z aplikacji Kontakty.")}</p>
    </div>
  </div>;
}
