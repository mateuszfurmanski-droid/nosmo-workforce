export type ImportedContact = {
  name?: string[];
  tel?: string[];
  email?: string[];
  company?: string;
  role?: string;
  note?: string;
  labels?: string;
};

export const CONTACT_FILE_ACCEPT = '.vcf,.csv,text/vcard,text/x-vcard,text/csv';
export const CONTACT_MAX_BYTES = 5 * 1024 * 1024;
export const CONTACT_MAX_ROWS = 5000;
export const DEFAULT_WORK_KEYWORDS = 'agency, recruitment, recruiter, manager, construction, foreman, supervisor, contractor, builder, payroll, timesheet';

function clean(value: string) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/co\s*n?\s*struction/g, 'construction').replace(/\s+/g, ' ').trim();
}

export function matchesWorkKeywords(contact: ImportedContact, keywords: string): boolean {
  const terms = keywords.split(/[,;\n]/).map(clean).filter(Boolean);
  if (!terms.length) return true;
  const context = clean([...(contact.name || []), contact.company, contact.role, contact.note,
    contact.labels, ...(contact.email || [])].filter(Boolean).join(' '));
  return terms.some(term => context.includes(term));
}

function values(text: string) {
  return text.split(/\s*(?:\|+|:::|\n)\s*/).map(v => v.trim()).filter(Boolean);
}

function usable(contact: ImportedContact) {
  return [...(contact.name || []), ...(contact.tel || []), ...(contact.email || []), contact.company].some(Boolean);
}

function bounded(contacts: ImportedContact[]) {
  const result = contacts.filter(usable);
  if (result.length > CONTACT_MAX_ROWS) throw new Error('Too many contacts. Choose a file with up to 5,000 contacts.');
  if (!result.length) throw new Error('No contacts found. Choose a VCF or CSV export from Contacts.');
  return result;
}

function vCardText(value: string) {
  return value.replace(/\\([nN,;\\])/g, (_, char: string) => /n/i.test(char) ? '\n' : char).trim();
}

export function parseVCard(text: string): ImportedContact[] {
  const unfolded = text.replace(/=\r?\n/g, '').replace(/\r?\n[ \t]/g, '');
  const cards = unfolded.match(/BEGIN:VCARD[\s\S]*?END:VCARD/gi) || [];
  return bounded(cards.map(card => {
    const fields = new Map<string, string[]>();
    for (const line of card.split(/\r?\n/)) {
      const colon = line.indexOf(':');
      if (colon < 0) continue;
      const header = line.slice(0, colon);
      const key = header.split(';')[0].split('.').pop()!.toUpperCase();
      let value = line.slice(colon + 1);
      if (/ENCODING=QUOTED-PRINTABLE/i.test(header)) {
        const bytes: number[] = [];
        for (let i = 0; i < value.length; i++) {
          if (value[i] === '=' && /^[0-9A-F]{2}$/i.test(value.slice(i + 1, i + 3))) {
            bytes.push(parseInt(value.slice(i + 1, i + 3), 16)); i += 2;
          } else bytes.push(...new TextEncoder().encode(value[i]));
        }
        value = new TextDecoder().decode(new Uint8Array(bytes));
      }
      fields.set(key, [...(fields.get(key) || []), value]);
    }
    const get = (key: string) => fields.get(key) || [];
    const parts = (get('N')[0] || '').split(/(?<!\\);/).map(vCardText);
    const company = (get('ORG')[0] || '').split(/(?<!\\);/).map(vCardText).filter(Boolean).join(' / ');
    const name = vCardText(get('FN')[0] || '') || [parts[3], parts[1], parts[2], parts[0], parts[4]].filter(Boolean).join(' ') || company;
    return { name: name ? [name] : [], tel: get('TEL').map(v => vCardText(v).replace(/^tel:/i, '')),
      email: get('EMAIL').map(v => vCardText(v).replace(/^mailto:/i, '')), company,
      role: get('TITLE').map(vCardText).join(' / '), note: get('NOTE').map(vCardText).join('\n'),
      labels: get('CATEGORIES').map(vCardText).join(', ') };
  }));
}

function csvRows(text: string): string[][] {
  const first = text.split(/\r?\n/, 1)[0];
  const outsideQuotes = first.replace(/"(?:[^"]|"")*"/g, '');
  const delimiter = [';', '\t', ','].sort((a, b) => outsideQuotes.split(b).length - outsideQuotes.split(a).length)[0];
  const rows: string[][] = [];
  let row: string[] = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i++; }
      else if (!quoted && field.length) throw new Error('The CSV has an invalid quoted field. Export it again from Contacts.');
      else quoted = !quoted;
    } else if (!quoted && (char === delimiter || char === '\n' || char === '\r')) {
      row.push(field); field = '';
      if (char !== delimiter) {
        if (row.some(v => v.trim())) rows.push(row);
        row = [];
        if (char === '\r' && text[i + 1] === '\n') i++;
        if (rows.length > CONTACT_MAX_ROWS + 1) throw new Error('Too many contacts. Choose a file with up to 5,000 contacts.');
      }
    } else field += char;
  }
  if (quoted) throw new Error('The CSV is incomplete. Export it again from Contacts.');
  row.push(field);
  if (row.some(v => v.trim())) rows.push(row);
  return rows;
}

export function parseContactCsv(text: string): ImportedContact[] {
  const [header = [], ...rows] = csvRows(text.replace(/^\uFEFF/, ''));
  const keys = header.map(key => clean(key).replace(/[^a-z0-9]/g, ''));
  const phone = /^(?:(?:phone|telephone|tel)\d*(?:value)?|(?:mobile|home|business|primary|other)(?:phone|telephone)?|telefon|numertelefonu)$/;
  const email = /^(?:email\d*(?:value|address)?|emailaddress\d*)$/;
  const hasRecognisedHeader = keys.some(k => phone.test(k) || email.test(k) || ['name','fullname','firstname','givenname','imie','company','organizationname','organization1name'].includes(k));
  if (!hasRecognisedHeader) throw new Error('CSV columns were not recognised. Use a Google Contacts, Outlook or NOSMO CSV export.');
  return bounded(rows.map(row => {
    const get = (...names: string[]) => names.map(name => row[keys.indexOf(name)]?.trim()).find(Boolean) || '';
    const collect = (pattern: RegExp) => keys.flatMap((key, i) => pattern.test(key) ? values(row[i] || '') : []);
    const company = get('company', 'organizationname', 'organization1name', 'firma');
    const name = get('name', 'fullname') || [get('firstname','givenname','imie'), get('middlename','additionalname'), get('lastname','familyname','nazwisko')].filter(Boolean).join(' ') || company;
    return { name: name ? [name] : [], tel: collect(phone), email: collect(email), company,
      role: get('role','jobtitle','organizationtitle','organization1title','title'),
      note: get('note','notes','notatki'), labels: get('labels','groupmembership','categories','category') };
  }));
}

export function parseContactFile(text: string, filename: string): ImportedContact[] {
  if (/\.vcf$/i.test(filename)) return parseVCard(text);
  if (/\.csv$/i.test(filename)) return parseContactCsv(text);
  throw new Error('Choose a .vcf or .csv contacts file.');
}
