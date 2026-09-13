"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Trash2 } from "lucide-react";

const LOCAL_DATABASE = "mateusz-praca";
const RETAIN_LOCAL_KEYS = new Set([
  "mateusz-theme",
  "nosmo-theme-preset",
  "nosmo-language",
]);

type DeleteDatabaseResult = "deleted" | "blocked" | "error";

function copyRetainedPreferences() {
  const retained = new Map<string, string>();
  for (const key of RETAIN_LOCAL_KEYS) {
    const value = window.localStorage.getItem(key);
    if (value !== null) retained.set(key, value);
  }
  return retained;
}

function deleteLocalDatabase(): Promise<DeleteDatabaseResult> {
  if (!("indexedDB" in window)) return Promise.resolve("deleted");
  return new Promise((resolve) => {
    const request = window.indexedDB.deleteDatabase(LOCAL_DATABASE);
    request.onsuccess = () => resolve("deleted");
    request.onerror = () => resolve("error");
    request.onblocked = () => resolve("blocked");
  });
}

async function clearLocalPersonalData() {
  const retained = copyRetainedPreferences();
  window.localStorage.clear();
  for (const [key, value] of retained) window.localStorage.setItem(key, value);
  window.sessionStorage.clear();
  return deleteLocalDatabase();
}

export default function LocalPrivacyControl() {
  const [mount, setMount] = useState<Element | null>(null);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    const findMount = () => {
      const next = document.querySelector(".settings-data-actions");
      setMount((current) => (current === next ? current : next));
    };
    findMount();
    const observer = new MutationObserver(findMount);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  if (!mount) return null;
  const polish = document.documentElement.lang.toLowerCase().startsWith("pl");
  const label = polish ? "Wyczyść lokalne dane osobowe" : "Clear local personal data";

  const clear = async () => {
    const first = window.confirm(
      polish
        ? "Usunąć z tego urządzenia lokalne dane NOSMO Work: profil, zapisane oferty, kontakty, dokumenty, CV, zdjęcia i importowane pliki? Motyw i język zostaną zachowane. Dane serwerowe i zgody Agency nie zostaną usunięte."
        : "Remove local NOSMO Work data from this device: profile, saved jobs, contacts, documents, CVs, photos and imported files? Theme and language will be kept. Server-side data and Agency consent will not be deleted.",
    );
    if (!first) return;
    const second = window.confirm(
      polish
        ? "To usuwa lokalne pliki bez możliwości cofnięcia. Kontynuować?"
        : "This permanently removes the local files from this device. Continue?",
    );
    if (!second) return;

    setClearing(true);
    const database = await clearLocalPersonalData();
    if (database === "blocked") {
      setClearing(false);
      window.alert(
        polish
          ? "Inna karta NOSMO Work blokuje usunięcie plików. Zamknij pozostałe karty NOSMO Work i spróbuj ponownie."
          : "Another NOSMO Work tab is blocking file deletion. Close other NOSMO Work tabs and try again.",
      );
      return;
    }
    if (database === "error") {
      setClearing(false);
      window.alert(
        polish
          ? "Nie udało się potwierdzić usunięcia lokalnych plików. Dane przeglądarki zostały wyczyszczone, ale przed użyciem wspólnego urządzenia usuń dane witryny NOSMO Work w ustawieniach przeglądarki."
          : "Local file deletion could not be confirmed. Browser data was cleared, but before using a shared device also clear NOSMO Work site data in browser settings.",
      );
      return;
    }
    window.location.reload();
  };

  return createPortal(
    <button
      type="button"
      className="settings-restore"
      data-nosmo-clear-local-data="true"
      disabled={clearing}
      onClick={() => void clear()}
    >
      <Trash2 />
      {clearing ? (polish ? "Czyszczenie..." : "Clearing...") : label}
    </button>,
    mount,
  );
}
