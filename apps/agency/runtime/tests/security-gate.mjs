import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {
  AGENCY_ADMIN_ROLES,
  AGENCY_ROLES,
  productionSslOptions,
  ratePolicy,
  requiredAgencyRoles,
  roleAllowed,
  safeApiErrorBody,
  sameOriginRequest,
  secureExternalUrl,
  securityHeaders,
} from "../security-core.js";

const here=path.dirname(fileURLToPath(import.meta.url));
const runtime=path.resolve(here,"..");
const repoRoot=path.resolve(runtime,"../../..");
const read=rel=>fs.readFileSync(path.join(repoRoot,rel),"utf8");

// Authorization / least privilege.
assert.equal(roleAllowed("OWNER",AGENCY_ROLES),true);
assert.equal(roleAllowed("ADMIN",AGENCY_ROLES),true);
assert.equal(roleAllowed("RECRUITER",AGENCY_ROLES),true);
assert.equal(roleAllowed("worker",AGENCY_ROLES),false);
assert.equal(roleAllowed("INVITED",AGENCY_ROLES),false);
assert.equal(roleAllowed("OWNER",AGENCY_ADMIN_ROLES),true);
assert.equal(roleAllowed("ADMIN",AGENCY_ADMIN_ROLES),true);
assert.equal(roleAllowed("RECRUITER",AGENCY_ADMIN_ROLES),false);
assert.equal(requiredAgencyRoles("POST","/api/agency/account",true),AGENCY_ADMIN_ROLES);
assert.equal(requiredAgencyRoles("POST","/api/person-card/agency/account",true),AGENCY_ADMIN_ROLES);
assert.equal(requiredAgencyRoles("GET","/api/agency/pipeline",true),AGENCY_ROLES);
assert.equal(requiredAgencyRoles("POST","/api/agency/account",false),null,"first authenticated agency creation must remain possible");

// Browser mutation / CSRF origin model.
const originEnv={NODE_ENV:"production",NOSMO_AGENCY_PUBLIC_ORIGIN:"https://agency.example.test"};
assert.equal(sameOriginRequest({headers:{origin:"https://agency.example.test"},protocol:"https"},originEnv),true);
assert.equal(sameOriginRequest({headers:{referer:"https://agency.example.test/settings"},protocol:"https"},originEnv),true);
assert.equal(sameOriginRequest({headers:{origin:"https://evil.example"},protocol:"https"},originEnv),false);
assert.equal(sameOriginRequest({headers:{},protocol:"https"},originEnv),false);

// Production database TLS and outbound URL policy.
assert.deepEqual(productionSslOptions({NODE_ENV:"production"}),{rejectUnauthorized:true});
assert.equal(productionSslOptions({NODE_ENV:"test"}),undefined);
assert.ok(secureExternalUrl("https://work.example.test",{production:true}));
assert.equal(secureExternalUrl("http://work.example.test",{production:true}),null);
assert.equal(secureExternalUrl("javascript:alert(1)",{production:true}),null);
assert.ok(secureExternalUrl("http://127.0.0.1:4178",{production:false}));

// Security headers.
const headers=securityHeaders({production:true});
assert.equal(headers["X-Content-Type-Options"],"nosniff");
assert.equal(headers["X-Frame-Options"],"DENY");
assert.ok(headers["Content-Security-Policy"].includes("frame-ancestors 'none'"));
assert.ok(headers["Content-Security-Policy"].includes("object-src 'none'"));
assert.ok(headers["Strict-Transport-Security"].includes("includeSubDomains"));
assert.ok(headers["Permissions-Policy"].includes("camera=()"));

// Safe production error projection.
assert.deepEqual(
  safeApiErrorBody({error:"NEXUS_IMPORT_FAILED",detail:"select * from secret_table",stack:"private-path"},409),
  {error:"NEXUS_IMPORT_FAILED"}
);
assert.deepEqual(
  safeApiErrorBody({error:"password=secret at /srv/private/app.js",detail:"db internals"},500),
  {error:"NOSMO_INTERNAL_ERROR"}
);

// Rate policy exists for abuse-sensitive operations.
assert.ok(ratePolicy("GET","/api/login").limit<=30);
assert.ok(ratePolicy("POST","/api/agency/invites").limit<=60);
assert.ok(ratePolicy("POST","/api/agency/nexus/query").limit<=60);
assert.ok(ratePolicy("PATCH","/api/agency/requests/id").limit<=180);

// Runtime entrypoints must not bypass the security gate.
const apiEntry=read("apps/agency/runtime/api/[...path].js");
const packageJson=JSON.parse(read("apps/agency/runtime/package.json"));
const vercel=JSON.parse(read("apps/agency/runtime/vercel.json"));
const securityEntry=read("apps/agency/runtime/security-entry.js");
const bootstrap=read("apps/agency/runtime/security-bootstrap.js");
const onboardingSecurity=read("apps/agency/runtime/onboarding-security.js");
assert.ok(apiEntry.includes("security-entry.js"),"Agency Vercel API must route through security-entry");
assert.equal(packageJson.scripts.start,"node secure-host.js","standalone runtime must use secured host");
assert.ok(packageJson.scripts.check.includes("tests/security-gate.mjs"),"security QA must remain in normal check");
assert.ok(bootstrap.includes("installSecurePgPool"));
assert.ok(bootstrap.includes("productionSslOptions"));
assert.ok(securityEntry.startsWith('import "./security-bootstrap.js"'),"PG/log hardening must load before legacy runtime");
assert.ok(securityEntry.includes("NOSMO_MALFORMED_JSON"));
assert.ok(securityEntry.includes("NOSMO_PAYLOAD_TOO_LARGE"));
assert.ok(securityEntry.includes("NOSMO_UNSAFE_OBJECT_KEYS"));
assert.ok(securityEntry.includes("AMBIGUOUS_TENANT_CONTEXT_DENIED"));
assert.ok(securityEntry.includes("ROLE_ACCESS_DENIED"));
assert.ok(onboardingSecurity.startsWith('import "./security-bootstrap.js"'));

const rewrites=vercel.rewrites||[];
assert.ok(rewrites.some(r=>r.source==="/api/person-card/onboarding/availability"&&r.destination==="/api/secure-onboarding-availability"));
assert.ok(rewrites.some(r=>r.source==="/api/person-card/onboarding/:path*"&&r.destination.includes("/api/secure-onboarding")));
const globalHeaderRule=(vercel.headers||[]).find(rule=>rule.source==="/(.*)");
const headerMap=Object.fromEntries((globalHeaderRule?.headers||[]).map(h=>[h.key,h.value]));
assert.ok(headerMap["Content-Security-Policy"]?.includes("frame-ancestors 'none'"));
assert.ok(headerMap["Strict-Transport-Security"]?.includes("max-age="));
assert.equal(headerMap["X-Frame-Options"],"DENY");

// Worker recruiter-safe privacy contract.
const compat=read("apps/agency/runtime/compat.js");
const onboarding=read("apps/agency/runtime/api/person-card/onboarding/[...path].js");
assert.ok(compat.includes("scope='RECRUITER_SAFE'"),"Worker-owned Agency access must remain consent scoped");
assert.ok(compat.includes("privateWorkerFieldsIncluded:false"),"compatibility API privacy marker missing");
assert.ok(onboarding.includes('consent:"explicit"'));
assert.ok(onboarding.includes("privateDocumentsIncluded:false"));
assert.ok(onboarding.includes("contactDetailsIncluded:false"));
assert.ok(onboarding.includes("cvTextIncluded:false"));
assert.ok(onboarding.includes("contactDetailsShared:false"));
assert.ok(onboarding.includes("cvTextShared:false"));

// Obvious SQL interpolation with req.* is forbidden in database handlers.
for(const rel of [
  "apps/agency/runtime/server.js",
  "apps/agency/runtime/compat.js",
  "apps/agency/runtime/api/person-card/onboarding/[...path].js",
  "apps/agency/runtime/api/person-card/onboarding/availability.js",
]){
  const source=read(rel);
  assert.equal(/\$\{\s*req(?:\.|\[)/.test(source),false,`request value interpolated directly into SQL/template in ${rel}`);
}

// Repository secret scan: conservative patterns for high-confidence committed credentials.
const textExtensions=new Set([".js",".mjs",".cjs",".json",".md",".yml",".yaml",".sql",".html",".css",".webmanifest",".txt",".toml"]);
const secretPatterns=[
  ["private-key",new RegExp("-----BEGIN "+"(?:RSA |EC |OPENSSH )?"+"PRIVATE KEY-----")],
  ["github-token",/\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}\b/],
  ["github-fine-grained",/\bgithub_pat_[A-Za-z0-9_]{20,}\b/],
  ["aws-access-key",/\bAKIA[0-9A-Z]{16}\b/],
  ["openai-key",/\bsk-[A-Za-z0-9_-]{20,}\b/],
  ["postgres-password-url",/postgres(?:ql)?:\/\/[^:\s/@]+:[^@\s/]{8,}@/i],
];
const findings=[];
const committedEnvFiles=[];
function walk(dir){
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    if([".git","node_modules",".next","dist","coverage"].includes(entry.name))continue;
    const full=path.join(dir,entry.name);
    const rel=path.relative(repoRoot,full).replaceAll(path.sep,"/");
    if(entry.isDirectory()){walk(full);continue}
    if(entry.name.startsWith(".env")&&entry.name!==".env.example")committedEnvFiles.push(rel);
    if(!textExtensions.has(path.extname(entry.name))||fs.statSync(full).size>2_000_000)continue;
    const source=fs.readFileSync(full,"utf8");
    for(const [name,pattern] of secretPatterns){if(pattern.test(source))findings.push(`${name}:${rel}`)}
  }
}
walk(repoRoot);
assert.deepEqual(committedEnvFiles,[],`committed environment files found: ${committedEnvFiles.join(", ")}`);
assert.deepEqual(findings,[],`possible committed secrets found: ${findings.join(", ")}`);

console.log(JSON.stringify({
  schema:"nosmo-security-gate-static-qa/v1",
  status:"PASS",
  authorization:true,
  csrfOrigin:true,
  productionTlsVerification:true,
  securityHeaders:true,
  safeErrors:true,
  ratePolicies:true,
  securedEntrypoints:true,
  workerConsentProjection:true,
  obviousSqlInterpolationRejected:true,
  committedSecretScan:true
},null,2));
