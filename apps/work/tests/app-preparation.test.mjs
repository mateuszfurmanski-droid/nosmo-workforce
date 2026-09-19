import test from 'node:test';
import assert from 'node:assert/strict';
import { internationalPhone, preparedCommunicationUrl } from '../app/app-preparation.ts';
const base={recipient:'+44 7700 900123',subject:'Work enquiry',body:'Hello & thanks\nTomorrow? #1 + details',purpose:'work'};
test('WhatsApp carries exactly one recipient and the entire multiline text',()=>{
 const url=new URL(preparedCommunicationUrl('WhatsApp',base));
 assert.equal(url.hostname,'wa.me');assert.equal(url.pathname,'/447700900123');assert.equal(url.searchParams.get('text'),base.body);assert.equal([...url.searchParams].length,1);
});
test('invalid, ambiguous and locally formatted numbers do not guess a recipient',()=>{
 for(const recipient of ['07700900123','+447700900123,+447700900124','+447700900123?text=oops','+4400abc',''])assert.equal(preparedCommunicationUrl('WhatsApp',{...base,recipient}),null);
 assert.equal(internationalPhone('0044 (7700) 900-123'),'+447700900123');
});
test('SMS encodes special characters without adding recipient parameters',()=>{
 const url=preparedCommunicationUrl('Messages',base);assert.equal(url,'sms:+447700900123?body='+encodeURIComponent(base.body));
});
test('call uses only the confirmed number and never transmits notes',()=>{
 assert.equal(preparedCommunicationUrl('Call',{...base,body:''}),'tel:+447700900123');
});
test('Gmail encodes subject/body and rejects recipient header injection',()=>{
 const url=new URL(preparedCommunicationUrl('Gmail',{...base,recipient:'worker@example.com',subject:'Hello\r\nBcc: other@example.com'}));
 assert.equal(url.searchParams.get('to'),'worker@example.com');assert.equal(url.searchParams.get('body'),base.body);assert.equal(url.searchParams.has('bcc'),false);assert.equal(url.searchParams.get('su').includes('\n'),false);
 for(const recipient of ['a@example.com,b@example.com','a@example.com\r\nBcc:b@example.com','javascript:alert(1)'])assert.equal(preparedCommunicationUrl('Gmail',{...base,recipient}),null);
});
test('no empty-message or unknown-app handoff',()=>{
 assert.equal(preparedCommunicationUrl('WhatsApp',{...base,body:' '}),null);assert.equal(preparedCommunicationUrl('Other',base),null);
});
