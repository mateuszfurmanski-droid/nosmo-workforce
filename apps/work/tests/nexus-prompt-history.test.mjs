import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanPromptHistory, rememberPrompt, rankPrompts, promptHistoryKey } from '../app/nexus-prompt-history.ts';
test('repeated requests move first without duplicates across case and whitespace',()=>{
 assert.deepEqual(rememberPrompt(['Hello agency','Other task'],'  hello   agency  '),['hello   agency','Other task']);
});
test('history rejects corrupt entries and bounds retained text',()=>{
 assert.deepEqual(cleanPromptHistory({text:'unsafe'}),[]);
 assert.deepEqual(cleanPromptHistory([null,{},'','x'.repeat(3001),'Valid']),['Valid']);
 assert.equal(cleanPromptHistory(Array.from({length:30},(_,i)=>`Task ${i}`)).length,20);
});
test('typing ranks relevant requests without dropping other saved choices',()=>{
 assert.deepEqual(rankPrompts(['Plan shift','Send documents','Reply agency'],'documents'),['Send documents','Plan shift','Reply agency']);
});
test('account storage keys are separate and guest has no persistent history',()=>{
 assert.equal(promptHistoryKey(),null);
 assert.notEqual(promptHistoryKey('user_a'),promptHistoryKey('user_b'));
});
