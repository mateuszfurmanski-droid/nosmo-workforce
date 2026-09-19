import assert from 'node:assert/strict';
import test from 'node:test';
import {parseVCard, parseContactCsv, parseContactFile, matchesWorkKeywords} from '../app/contact-intake.ts';

test('Google CSV preserves companies, notes, multiple numbers, quoted commas and newlines', () => {
  const rows = parseContactCsv('\uFEFFName,Phone 1 - Value,E-mail 1 - Value,Organization 1 - Name,Organization 1 - Title,Notes\r\n"Alex, Builder","07700900123 ::: +44 7700 900124",alex@example.com,Example Agency,Site Manager,"First line\nSecond ""quoted"" line"\r\n');
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0].name, ['Alex, Builder']);
  assert.deepEqual(rows[0].tel, ['07700900123', '+44 7700 900124']);
  assert.equal(rows[0].company, 'Example Agency');
  assert.equal(rows[0].role, 'Site Manager');
  assert.equal(rows[0].note, 'First line\nSecond "quoted" line');
});

test('modern Google and Outlook/NOSMO headers and semicolon exports are recognised', () => {
  assert.deepEqual(parseContactCsv('First Name,Last Name,Phone 1 - Value,Organization Name\nAlex,Example,07700900123,Acme')[0].name, ['Alex Example']);
  const contact = parseContactCsv('Name;Phone;Email;Company;Role;Note\nAlex;07700900123 | 07700900124;a@example.com;Acme;Manager;Note')[0];
  assert.equal(contact.tel.length, 2);
  assert.equal(contact.company, 'Acme');
  assert.deepEqual(parseContactCsv('First Name,Last Name,Mobile Phone,E-mail Address\nAlex,Example,07700900123,a@example.com')[0].email, ['a@example.com']);
});

test('vCard retains grouped fields, organisations, escaped punctuation and folded notes', () => {
  const [contact] = parseVCard('BEGIN:VCARD\r\nVERSION:3.0\r\nN:Example;Alex;;;\r\nitem1.TEL;TYPE=CELL:tel:+447700900123\r\nEMAIL:mailto:a@example.com\r\nORG:Example\\; Ltd;Building\r\nTITLE:Site Manager\r\nNOTE:agency\\nlong\r\n  note\r\nEND:VCARD');
  assert.deepEqual(contact.name, ['Alex Example']);
  assert.deepEqual(contact.tel, ['+447700900123']);
  assert.equal(contact.company, 'Example; Ltd / Building');
  assert.equal(contact.note, 'agency\nlong note');
});

test('Samsung quoted-printable UTF-8 names and soft line breaks decode', () => {
  const [contact] = parseVCard('BEGIN:VCARD\nFN;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:Jo=C3=B3=\nrg\nTEL:07700900123\nEND:VCARD');
  assert.equal(contact.name[0], 'Joórg');
});

test('keywords match name, company, notes, labels and email domain including construction typo', () => {
  assert.equal(matchesWorkKeywords({name:['Alex co struction']}, 'construction'), true);
  assert.equal(matchesWorkKeywords({name:['Alex'],company:'Acme Ltd'}, 'agency, acme'), true);
  assert.equal(matchesWorkKeywords({note:'Site MANAGER'}, 'manager'), true);
  assert.equal(matchesWorkKeywords({labels:'Agency'}, 'agency'), true);
  assert.equal(matchesWorkKeywords({email:['alex@acme.com']}, 'acme.com'), true);
  assert.equal(matchesWorkKeywords({name:['Family']}, 'agency, manager'), false);
  assert.equal(matchesWorkKeywords({name:['Family']}, ''), true);
});

test('empty, unrelated, broken and excessive exports fail instead of reporting success', () => {
  for (const text of ['', 'BEGIN:VCARD\nEND:VCARD', 'BEGIN:VCARD\nFN:Unclosed']) assert.throws(() => parseVCard(text));
  assert.throws(() => parseContactCsv('Cost,Date\n100,2026'));
  assert.throws(() => parseContactCsv('Name,Phone\n"broken,07700900123'));
  assert.throws(() => parseContactCsv('Name,Phone\n' + 'Alex,07700900123\n'.repeat(5001)));
  assert.throws(() => parseContactFile('Name,Phone\nAlex,123', 'data.xlsx'));
});
