"use client";

import { useEffect, useRef, useState } from 'react';
import { DEFAULT_WORK_KEYWORDS, matchesWorkKeywords } from './contact-intake';

type Candidate = { id: string; name: string; company?: string; role?: string; note?: string; phones: string[]; emails: string[] };
type Props = { language: string; contacts: Candidate[]; onCancel: () => void; onSave: (ids: string[]) => Promise<void> };

function matchingIds(contacts: Candidate[], keywords: string) {
  return contacts.filter(c => matchesWorkKeywords({ ...c, name: [c.name], email: c.emails }, keywords)).map(c => c.id);
}

export default function ContactImportReview({language, contacts, onCancel, onSave}: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [keywords, setKeywords] = useState(DEFAULT_WORK_KEYWORDS);
  const [selected, setSelected] = useState(() => new Set(matchingIds(contacts, DEFAULT_WORK_KEYWORDS)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [limit, setLimit] = useState(100);
  const [onlyMatching, setOnlyMatching] = useState(false);
  const t = (en: string, pl: string) => language === 'pl' ? pl : en;
  const matching = new Set(matchingIds(contacts, keywords));
  const visible = contacts.filter(c => !onlyMatching || matching.has(c.id));

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  async function save() {
    setBusy(true); setError('');
    try { await onSave([...selected]); }
    catch { setError(t('Could not save the contacts. Try again; your selection is still here.', 'Nie udalo sie zapisac kontaktow. Sprobuj ponownie; wybor zostal zachowany.')); }
    finally { setBusy(false); }
  }

  return <dialog ref={dialog} className="contact-import-review" aria-labelledby="contact-import-title" onCancel={event => {event.preventDefault(); if (!busy) onCancel();}}>
    <h2 id="contact-import-title">{t('Your work contacts', 'Twoje kontakty do pracy')}</h2>
    <p>{t('Found', 'Znaleziono')}: <b>{contacts.length}</b> · {t('Selected', 'Wybrano')}: <b>{selected.size}</b></p>
    <p>{t('Work keywords select likely matches. Check the list and add anyone we missed. Only selected contacts are saved privately in NOSMO.', 'Slowa do pracy zaznaczaja dopasowania. Sprawdz liste i dodaj pominiete osoby. Tylko wybrane kontakty zapisujemy prywatnie w NOSMO.')}</p>
    <fieldset disabled={busy}>
      <label className="contact-import-keywords">{t('Keywords or company names, separated by commas', 'Slowa lub nazwy firm, oddzielone przecinkami')}
        <textarea value={keywords} maxLength={2000} onChange={e => {const value = e.target.value; setKeywords(value); setSelected(new Set(matchingIds(contacts, value))); setLimit(100);}} />
      </label>
      <small>{t('Changing keywords updates the selection. A blank field selects everyone.', 'Zmiana slow aktualizuje wybor. Puste pole zaznacza wszystkich.')}</small>
      <div className="contact-import-tools">
        <button type="button" onClick={() => setSelected(new Set(contacts.map(c => c.id)))}>{t('Select all', 'Zaznacz wszystkich')}</button>
        <button type="button" onClick={() => setSelected(new Set())}>{t('Clear selection', 'Odznacz wszystkich')}</button>
        <label><input type="checkbox" checked={onlyMatching} onChange={e => {setOnlyMatching(e.target.checked); setLimit(100);}} />{t('Show matches only', 'Pokaz tylko dopasowania')}</label>
      </div>
      {selected.size === 0 && <p role="status">{t('No contacts selected. Change keywords or select people below.', 'Nie zaznaczono kontaktow. Zmien slowa lub wybierz osoby ponizej.')}</p>}
      <div className="contact-import-candidates">
        {visible.slice(0, limit).map(contact => <label key={contact.id}>
          <input type="checkbox" checked={selected.has(contact.id)} onChange={() => setSelected(current => {const next = new Set(current); if (next.has(contact.id)) next.delete(contact.id); else next.add(contact.id); return next;})}/>
          <span><b>{contact.name}</b><small>{[contact.company, contact.role, ...contact.phones, ...contact.emails].filter(Boolean).join(' · ')}</small></span>
        </label>)}
      </div>
      {visible.length > limit && <button type="button" onClick={() => setLimit(n => n + 100)}>{t('Show more', 'Pokaz wiecej')} ({visible.length - limit})</button>}
    </fieldset>
    {error && <p role="alert">{error}</p>}
    <div className="contact-import-tools">
      <button type="button" disabled={busy} onClick={onCancel}>{t('Cancel', 'Anuluj')}</button>
      <button type="button" disabled={busy || !selected.size} onClick={() => void save()}>{busy ? t('Saving...', 'Zapisywanie...') : `${t('Import selected', 'Importuj wybrane')} (${selected.size})`}</button>
    </div>
  </dialog>;
}
