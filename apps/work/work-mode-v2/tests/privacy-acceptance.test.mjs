import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  CONNECTION_LEVELS,
  SUGGESTION_STATES,
  assertRegistry,
  applySuggestionDecision,
  createWorkCardAppTile,
  createConsentGrant,
  createSharedView,
  createConnectionAuditEvent,
} from "../contracts.mjs";
import { discoverSupportedApps } from "../local-discovery.mjs";

const registry=JSON.parse(await readFile(new URL("../construction-app-registry.json", import.meta.url),"utf8"));
assert.equal(assertRegistry(registry),true);

const trustCopy=JSON.parse(await readFile(new URL("../trust-copy.json", import.meta.url),"utf8"));
assert.ok(
  trustCopy.messages.en.firstUseBody.includes("App discovery happens only on this device. NOSMO does not upload or store a list of your installed apps."),
  "First-scan privacy copy must explicitly state local-only discovery"
);

let networkCalls=0;
globalThis.fetch=async()=>{networkCalls++;throw new Error("NETWORK_FORBIDDEN");};
globalThis.XMLHttpRequest=class { constructor(){networkCalls++;throw new Error("XHR_FORBIDDEN");} };
globalThis.WebSocket=class { constructor(){networkCalls++;throw new Error("WEBSOCKET_FORBIDDEN");} };
Object.defineProperty(globalThis,"navigator",{configurable:true,value:{sendBeacon(){networkCalls++;throw new Error("BEACON_FORBIDDEN");}}});

const probed=[];
const installed=new Set(["com.whatsapp","com.microsoft.teams"]);
const states=await discoverSupportedApps({
  registry,
  probeInstalled:async ({identifier})=>{probed.push(identifier);return installed.has(identifier);},
  now:()=> "2026-08-27T17:00:00.000Z",
});

assert.equal(networkCalls,0,"Discovery must work with all network transports trapped");

const allowedPackages=registry.apps.filter(a=>a.discoveryEnabled).flatMap(a=>a.platforms.android.packageIds).sort();
assert.deepEqual([...probed].sort(),allowedPackages,"Only controlled enabled identifiers may be probed");
assert.equal(states.length,registry.apps.filter(a=>a.discoveryEnabled).length);
assert.ok(states.every(s=>s.deviceLocalOnly===true));

const whatsapp=states.find(s=>s.appDefinitionId==="whatsapp");
assert.equal(whatsapp.detected,true);
assert.equal(whatsapp.suggestionState,SUGGESTION_STATES.NEW);

const whatsappDef=registry.apps.find(a=>a.appDefinitionId==="whatsapp");
assert.throws(()=>createWorkCardAppTile({appDefinition:whatsappDef,localState:whatsapp}),/EXPLICIT_USER_APPROVAL_REQUIRED/);

const notNow=applySuggestionDecision(whatsapp,"NOT_NOW");
assert.equal(notNow.suggestionState,SUGGESTION_STATES.NOT_NOW);
assert.throws(()=>createWorkCardAppTile({appDefinition:whatsappDef,localState:notNow}),/EXPLICIT_USER_APPROVAL_REQUIRED/);

const never=applySuggestionDecision(whatsapp,"NEVER_SUGGEST");
assert.equal(never.suggestionState,SUGGESTION_STATES.NEVER_SUGGEST);
assert.equal(never.deviceLocalOnly,true);

const approved=applySuggestionDecision(whatsapp,"ADD");
const tile=createWorkCardAppTile({appDefinition:whatsappDef,localState:approved,approvedByUserAt:"2026-08-27T17:01:00.000Z"});
assert.equal(tile.connectionLevel,CONNECTION_LEVELS.OPEN);
assert.equal(tile.deviceLocalOnly,true);

const consent=createConsentGrant({
  consentGrantId:"cg-1",personId:"person-1",appDefinitionId:"future-connected-app",
  exactScopes:["work_profile.read"],purpose:"Recruiter-safe candidate matching"
});
assert.deepEqual(consent.exactScopes,["work_profile.read"]);

const shared=createSharedView({
  sharedViewId:"sv-1",personId:"person-1",recipient:"agency:example",
  includedFields:["displayName","trade","availability"],purpose:"Candidate introduction",expiresAt:"2026-09-03T17:00:00.000Z"
});
assert.equal(shared.recipient,"agency:example");

assert.throws(()=>createConnectionAuditEvent({
  eventId:"evt-bad",eventType:"DISCOVERY",details:{installedApps:["x","y"]}
}),/INSTALLED_APP_INVENTORY_FORBIDDEN_IN_AUDIT/);

const event=createConnectionAuditEvent({
  eventId:"evt-1",appDefinitionId:"whatsapp",eventType:"WORK_CARD_TILE_ADDED",details:{connectionLevel:"OPEN"}
});
assert.equal(event.appDefinitionId,"whatsapp");
assert.equal(JSON.stringify(event).includes("com.whatsapp"),false);

for(const app of registry.apps){
  if(app.discoveryEnabled){
    assert.equal(app.identifierStatus,"verified-controlled");
    assert.ok(app.platforms.android.packageIds.length>0);
  }
}

console.log("WORK_MODE_V2_PRIVACY_ACCEPTANCE_PASS");
