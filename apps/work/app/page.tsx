"use client";
import { useEffect, useMemo, useState } from "react";
import jobSeed from "./job-seed.json";
import { isDirectVacancyUrl } from "./job-link";
import {
  LIVE_SEARCH_MAX_POLLS,
  LIVE_SEARCH_POLL_INTERVAL_MS,
  mergeUniqueVacancies,
} from "./search-v2";
import "./camera.css";
import "./dark.css";
import "./compact-theme.css";
import "./apps-command.css";
import {
  Bell,
  Bot,
  BriefcaseBusiness,
  Building2,
  Camera,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  CircleUserRound,
  Clock3,
  DraftingCompass,
  Download,
  ExternalLink,
  FileText,
  FolderOpen,
  Languages,
  Link2,
  Mail,
  MapPin,
  MessageCircle,
  Moon,
  Phone,
  Plus,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Smartphone,
  Sun,
  Trash2,
  Upload,
  X,
} from "lucide-react";
type Status = "New" | "To apply" | "Applied" | "Reply" | "Interview" | "Offer" | "Rejected" | "Closed";
type Job = {
  id: number;
  company: string;
  role: string;
  area: string;
  status: Status;
  date: string;
  shift: string;
  contact: string;
  phone: string;
  whatsapp: boolean;
  note?: string;
  category?: string;
  distance?: string;
  transport?: string;
  travelTime?: string;
  days?: string;
  contract?: string;
  pay?: string;
  cv?: string;
  method?: string;
  applicationLink?: string;
  replyLink?: string;
  source?: string;
  description?: string;
  recruiter?: string;
  priority?: string;
  agency?: string;
  startDate?: string;
  experience?: string;
  english?: string;
  coverLetter?: string;
  listingAge?: string;
  publishedAt?: string;
  dateEvidence?: string;
  freshnessVerified?: boolean;
  checkedAt?: string;
  bestContact?: string;
  followUp?: string;
  applicationHistory?: Array<{ date: string; status: Status; note: string }>;
  linkVerified?: boolean;
};
type Profile = {
  name: string;
  email: string;
  applicationEmail: string;
  availableFrom: string;
  travel: string;
  preferredWork: string;
  preferredShifts: string;
};
type DynamicCv = { id: string; title: string; file: File; tags: string[] };
type GlobalSearchKind = "Work" | "Tools & materials";
type JobSearchCriteria = {
  location: string;
  radiusMiles: 5 | 15 | 30 | 50;
  postedWithinDays: 7 | 14 | 30;
  workPattern: "Any" | "Contract" | "Permanent" | "Temporary";
};
type ThemeBase = "light" | "dark";
type ThemePreset = "midnight-black" | "nexus-blue" | "eco-green" | "silent-gold" | "windows-grey" | "arctic-white";
type AppLanguage = "en" | "pl";
type LanguagePreference = "auto" | AppLanguage;
type PwaInstallState = "checking" | "ready" | "manual" | "installing" | "installed";
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}
type SearchMeta = {
  batch: number;
  requested: number;
  returned: number;
  candidates: number;
  sourceGroups: number;
  webSearchCalls: number;
  webSearchActions: number;
  consultedSources: number;
  directCandidates: number;
  rejected: number;
  partial: boolean;
  freshnessDays: number;
  newDays: number;
  newThisWeek: number;
  datedCurrent: number;
  activeWithoutDate: number;
  freshAfter: string;
  laneErrors: Array<{ lane: string; message: string }>;
};
type BackgroundSearchTask = { responseId: string; laneId: string };
type PendingLiveSearch = {
  tasks: BackgroundSearchTask[];
  query: string;
  batch: number;
  startedAt: number;
  laneErrors: Array<{ lane: string; message: string }>;
};

const PENDING_LIVE_SEARCH_KEY = "nosmo-pending-live-search";
const PENDING_LIVE_SEARCH_MAX_AGE_MS = 9 * 60 * 1000;
const JOB_SEARCH_CRITERIA_KEY = "nosmo-job-search-criteria";
const DEFAULT_JOB_SEARCH_CRITERIA: JobSearchCriteria = {
  location: "Leeds",
  radiusMiles: 15,
  postedWithinDays: 30,
  workPattern: "Any",
};

function normalizeJobSearchCriteria(value: unknown): JobSearchCriteria {
  const record = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const radius = Number(record.radiusMiles);
  const freshness = Number(record.postedWithinDays);
  const pattern = String(record.workPattern || "");
  return {
    location: String(record.location || "").trim().slice(0, 80) || DEFAULT_JOB_SEARCH_CRITERIA.location,
    radiusMiles: ([5, 15, 30, 50].includes(radius) ? radius : DEFAULT_JOB_SEARCH_CRITERIA.radiusMiles) as JobSearchCriteria["radiusMiles"],
    postedWithinDays: ([7, 14, 30].includes(freshness) ? freshness : DEFAULT_JOB_SEARCH_CRITERIA.postedWithinDays) as JobSearchCriteria["postedWithinDays"],
    workPattern: (["Any", "Contract", "Permanent", "Temporary"].includes(pattern) ? pattern : DEFAULT_JOB_SEARCH_CRITERIA.workPattern) as JobSearchCriteria["workPattern"],
  };
}

function liveSearchKey(query: string, criteria: JobSearchCriteria, jobTypes: string[]) {
  return JSON.stringify({
    query: query.trim().toLowerCase(),
    criteria,
    jobTypes: [...jobTypes].sort(),
  });
}

function normalizeBackgroundTasks(value: unknown) {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap((item) => {
    const record = item && typeof item === "object" ? item as Record<string, unknown> : {};
    const responseId = typeof record.responseId === "string" ? record.responseId : "";
    const laneId = typeof record.laneId === "string" ? record.laneId : "";
    if (!/^resp_[A-Za-z0-9_-]{10,210}$/.test(responseId) || !/^[a-z][a-z0-9_-]{1,39}$/.test(laneId) || seen.has(responseId)) return [];
    seen.add(responseId);
    return [{ responseId, laneId }];
  }).slice(0, 4);
}

function normalizeLaneErrors(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 8).flatMap((item) => {
    const record = item && typeof item === "object" ? item as Record<string, unknown> : {};
    const lane = typeof record.lane === "string" ? record.lane.slice(0, 80) : "";
    const message = typeof record.message === "string" ? record.message.slice(0, 180) : "";
    return lane && message ? [{ lane, message }] : [];
  });
}

function backgroundTaskGroupKey(tasks: BackgroundSearchTask[]) {
  return tasks.map((task) => task.responseId).sort().join("|");
}

function readPendingLiveSearch(): PendingLiveSearch | null {
  if (typeof window === "undefined") return null;
  try {
    const value = JSON.parse(window.sessionStorage.getItem(PENDING_LIVE_SEARCH_KEY) || "null") as Partial<PendingLiveSearch> | null;
    const tasks = normalizeBackgroundTasks(value?.tasks);
    if (
      !value ||
      !tasks.length ||
      typeof value.query !== "string" ||
      !Number.isInteger(value.batch) ||
      typeof value.startedAt !== "number" ||
      Date.now() - value.startedAt > PENDING_LIVE_SEARCH_MAX_AGE_MS
    ) {
      window.sessionStorage.removeItem(PENDING_LIVE_SEARCH_KEY);
      return null;
    }
    return {
      tasks,
      query: value.query,
      batch: value.batch,
      startedAt: value.startedAt,
      laneErrors: normalizeLaneErrors(value.laneErrors),
    } as PendingLiveSearch;
  } catch {
    return null;
  }
}

function savePendingLiveSearch(value: PendingLiveSearch) {
  try {
    window.sessionStorage.setItem(PENDING_LIVE_SEARCH_KEY, JSON.stringify(value));
  } catch {}
}

function clearPendingLiveSearch(tasks: BackgroundSearchTask[]) {
  try {
    const pending = readPendingLiveSearch();
    if (!pending || backgroundTaskGroupKey(pending.tasks) === backgroundTaskGroupKey(tasks)) {
      window.sessionStorage.removeItem(PENDING_LIVE_SEARCH_KEY);
    }
  } catch {}
}

function waitForSearchPoll(ms = LIVE_SEARCH_POLL_INTERVAL_MS) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

function searchBatchDetail(meta: SearchMeta) {
  const olderDated = Math.max(0, meta.datedCurrent - meta.newThisWeek);
  const capacity = meta.returned < meta.requested
    ? `Fewer than ${meta.requested} current direct links were available.`
    : `Maximum batch of ${meta.requested} returned.`;
  const sourceWarning = meta.laneErrors.length ? " One source group could not complete." : "";
  return `${meta.sourceGroups} source ${meta.sourceGroups === 1 ? "group" : "groups"} ran ${meta.webSearchCalls} real web ${meta.webSearchCalls === 1 ? "search" : "searches"}. ${meta.newThisWeek} posted in the last ${meta.newDays} days. ${olderDated} more dated within ${meta.freshnessDays} days. ${meta.activeWithoutDate} active direct pages had no visible date. ${capacity}${sourceWarning}`;
}

function searchEmptyDetail(meta: SearchMeta | null, preserveEarlier: boolean) {
  const diagnostics = meta
    ? `Ask Nexus ran ${meta.webSearchCalls} live web ${meta.webSearchCalls === 1 ? "search" : "searches"}, found ${meta.candidates} candidate links and passed ${meta.directCandidates} through direct-link and date checks. `
    : "";
  return `${diagnostics}${preserveEarlier ? "Your earlier jobs were not removed. " : ""}Search the next batch to try different sources.`;
}
type FileSystemWritableLike = {
  write: (data: Blob) => Promise<void>;
  close: () => Promise<void>;
};
type FileSystemFileHandleLike = {
  createWritable: () => Promise<FileSystemWritableLike>;
};
type FileSystemDirectoryHandleLike = {
  getDirectoryHandle: (name: string, options: { create: boolean }) => Promise<FileSystemDirectoryHandleLike>;
  getFileHandle: (name: string, options: { create: boolean }) => Promise<FileSystemFileHandleLike>;
};
type DirectoryPickerWindow = Window & {
  showDirectoryPicker?: (options?: { mode?: "read" | "readwrite" }) => Promise<FileSystemDirectoryHandleLike>;
};
type DocumentCategory = "All" | "CVs" | "Cards & licences" | "Certificates & training" | "ID / Right to Work" | "Other";
type NexusDocumentCategory = Exclude<DocumentCategory, "All">;
type NexusDocumentType = "cv" | "cscs_card" | "certificate" | "training" | "right_to_work" | "id_document" | "job_advert" | "drawing" | "reference" | "payslip" | "timesheet" | "work_photo" | "other";
type NexusDrawing = {
  project: string;
  drawingNumber: string;
  drawingTitle: string;
  revision: string;
  discipline: string;
  scale: string;
  status: string;
};
type NexusImportAnalysis = {
  documentType: NexusDocumentType;
  category: NexusDocumentCategory;
  title: string;
  summary: string;
  confidence: number;
  document: {
    issuer: string;
    documentNumberMasked: string;
    issuedDate: string;
    expiryDate: string;
    status: "valid" | "expiring" | "expired" | "no_expiry" | "unknown";
  };
  skills: string[];
  roleTitles: string[];
  profile: Profile;
  job: {
    company: string;
    role: string;
    area: string;
    shift: string;
    contract: string;
    pay: string;
    contact: string;
    phone: string;
    applicationLink: string;
    description: string;
    source: string;
  };
  drawing: NexusDrawing;
  agencyReply: {
    isAgencyReply: boolean;
    agencyName: string;
    contactName: string;
    role: string;
    company: string;
    location: string;
    requestSummary: string;
    requestedItems: AgencyPackItemKey[];
  };
  warnings: string[];
};
type NexusImportItem = {
  id: string;
  file: File;
  state: "queued" | "analysing" | "review" | "applied" | "error";
  analysis?: NexusImportAnalysis;
  error?: string;
};
type SmartDocument = {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  title: string;
  category: NexusDocumentCategory;
  documentType: NexusDocumentType;
  summary: string;
  issuer: string;
  documentNumberMasked: string;
  issuedDate: string;
  expiryDate: string;
  status: NexusImportAnalysis["document"]["status"];
  skills: string[];
  drawing?: NexusDrawing;
  importedAt: string;
};
type IntegrationSource = "WhatsApp" | "Messages" | "Contacts" | "Screenshots" | "Documents";
type ImportRecord = {
  id: string;
  source: IntegrationSource;
  title: string;
  detail: string;
  importedAt: string;
  phoneCount: number;
  emailCount: number;
};
type WorkContactCategory = "Agency" | "Manager" | "Worker" | "Other";
type WorkContact = {
  id: string;
  name: string;
  company?: string;
  role?: string;
  note?: string;
  phones: string[];
  emails: string[];
  category: WorkContactCategory;
  trade: string;
  region: string;
  source: "Phone" | "VCF" | "Android Share";
  importedAt: string;
};
type NativeSharePayload = {
  id: string;
  kind: "job" | "contact";
  sourceLabel: string;
  sourceMime: string;
  rawText: string;
  contactName: string;
  company: string;
  phone: string;
  email: string;
  whatsapp: boolean;
  role: string;
  location: string;
  pay: string;
  reference: string;
  applicationLink: string;
  note: string;
  fromOcr: boolean;
};
type NativeShareConflict = {
  payload: NativeSharePayload;
  existingId: string | number;
  existingLabel: string;
};
declare global {
  interface Window {
    __NOSMO_RECEIVE_NATIVE_SHARE__?: (payload: NativeSharePayload) => void;
    NosmoAndroid?: { ackShare: (id: string) => void };
  }
}
type AgencyPackItemKey = "references" | "right_to_work" | "address" | "cscs" | "certificates" | "id";
type AgencyPackDetails = {
  referenceOne: string;
  referenceTwo: string;
  address: string;
  shareCode: string;
  shareCodeExpiry: string;
  extraCertificates: string;
};
type AgencyReplyState = "idle" | "analysing" | "review" | "error";
type RawPhoneContact = { name?: string[]; tel?: string[]; email?: string[] };
type ContactPickerNavigator = Navigator & {
  contacts?: {
    select: (
      properties: Array<"name" | "tel" | "email">,
      options: { multiple: boolean },
    ) => Promise<RawPhoneContact[]>;
  };
};
type EmployerRecord = { company: string; area: string; contact: string; phone: string; whatsapp: boolean; agency: boolean; source: string; jobs: Job[]; current: Job };
type AvailabilityValue = "green" | "yellow" | "red";
type AvailabilitySyncState = "loading" | "synced" | "saved" | "sign-in-required" | "error";
type ConnectedAgency = { agencyId: string; name: string };
type WorkerConnectionInvite = {
  token: string;
  agency: ConnectedAgency;
  suggestedTrade: string | null;
  suggestedLocation: string | null;
  expiresAt: string;
};
const SMART_DOCUMENTS_KEY = "nosmo-nexus-documents";
const WORK_CONTACTS_KEY = "nosmo-work-contacts";
const WORK_CONTACT_TAGGING_VERSION = "agency-tags-v2";
const NATIVE_SHARE_IDS_KEY = "nosmo-native-share-ids";
const NEXUS_DOCUMENT_ACCEPT = ".pdf,.doc,.docx,.rtf,.odt,.txt,.md,.json,.html,.xml,.csv,.tsv,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.webp,.gif,application/pdf,image/png,image/jpeg,image/webp,image/gif";
const NEXUS_DRAWING_ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp";
const NEXUS_DOCUMENT_MAX_FILES = 5;
const NEXUS_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;
const AGENCY_PACK_ITEMS: Array<{ id: AgencyPackItemKey; label: string; help: string; sensitive?: boolean }> = [
  { id: "references", label: "Two latest references", help: "Names and roles only unless you explicitly add more." },
  { id: "right_to_work", label: "Right to Work share code", help: "Private and time-limited. Enter it only after the agency asks.", sensitive: true },
  { id: "address", label: "Current address", help: "Private. It stays out of the message until you tick this item.", sensitive: true },
  { id: "cscs", label: "CSCS card", help: "Share the saved card file when one is available." },
  { id: "certificates", label: "Additional certificates", help: "Choose only certificates relevant to this job." },
  { id: "id", label: "Photo ID", help: "Highly private. Share only when required and with the intended agency.", sensitive: true },
];
const EMPTY_AGENCY_REPLY: NexusImportAnalysis["agencyReply"] = {
  isAgencyReply: false,
  agencyName: "",
  contactName: "",
  role: "",
  company: "",
  location: "",
  requestSummary: "",
  requestedItems: [],
};

function nexusDocumentLabel(type: NexusDocumentType) {
  return ({
    cv: "CV",
    cscs_card: "CSCS card",
    certificate: "Certificate",
    training: "Training record",
    right_to_work: "Right to Work",
    id_document: "Identity document",
    job_advert: "Job advert",
    drawing: "Construction drawing",
    reference: "Reference",
    payslip: "Payslip",
    timesheet: "Timesheet",
    work_photo: "Work photo",
    other: "Work document",
  } as Record<NexusDocumentType, string>)[type];
}

function nexusDocumentStatus(status: SmartDocument["status"]) {
  if (status === "valid") return "VALID";
  if (status === "expiring") return "EXPIRING";
  if (status === "expired") return "EXPIRED";
  if (status === "no_expiry") return "NO EXPIRY";
  return "SAVED";
}

function smartDocumentStorageKey(document: Pick<SmartDocument, "id" | "category">) {
  return document.category === "CVs" ? `dynamic-cv-${document.id}` : `nexus-document-${document.id}`;
}
function externalUrl(job: Job) {
  return (isDirectVacancyUrl(job.applicationLink) ? job.applicationLink : "") ||
    (isDirectVacancyUrl(job.replyLink) ? job.replyLink : "") || "";
}
function sourceLabel(job: Job) {
  const url = externalUrl(job);
  if (url) try { return new URL(url).hostname.replace(/^www\./, ""); } catch {}
  return job.source || "Job source";
}
function nextAction(job: Job) {
  if (job.status === "New") return "Review the advert and decide whether to apply";
  if (job.status === "To apply") return job.cv ? `Apply using ${job.cv}` : "Select a CV from Documents, then apply";
  if (job.status === "Applied") return job.followUp ? `Follow up on ${job.followUp}` : "Set a follow-up date";
  if (job.status === "Reply") return "Read the reply and respond";
  if (job.status === "Interview") return "Prepare for the interview";
  if (job.status === "Offer") return "Review the offer and confirm your decision";
  return "No action required";
}
function needsAttention(job: Job) {
  return ["To apply", "Reply", "Interview", "Offer"].includes(job.status) ||
    (job.status === "Applied" && !job.followUp);
}
function openExternal(url: string) {
  if (!url) return;
  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "external noopener noreferrer";
  document.body.appendChild(link);
  link.click();
  link.remove();
}
function initials(name: string) {
  return name.trim().split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "NW";
}
function uniquePhones(text: string) {
  const matches = text.match(/(?:\+?44\s?\(?0?\)?|0)(?:[\s().-]*\d){9,10}/g) || [];
  return [...new Set(matches.map((value) => value.replace(/[^\d+]/g, "")))];
}
function uniqueEmails(text: string) {
  const matches = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
  return [...new Set(matches.map((value) => value.toLowerCase()))];
}
function normaliseContactPhone(phone: string) {
  let value = phone.trim().replace(/[^\d+]/g, "").replace(/^0044/, "+44");
  if (value.startsWith("+440")) value = `+44${value.slice(4)}`;
  if (value.startsWith("0") && value.length >= 10) value = `+44${value.slice(1)}`;
  return value;
}
function inferContactTrade(name: string) {
  const value = name.toLowerCase();
  const rules: Array<[string[], string]> = [
    [["fire door", "firedoor"], "Fire doors"],
    [["joiner", "joinery", "carpenter", "carpentry", "shopfit", "kitchen fitter"], "Joinery"],
    [["painter", "decorator", "decorating"], "Painting"],
    [["electrician", "electrical", "spark"], "Electrical"],
    [["plumber", "plumbing", "heating", "gas engineer"], "Plumbing"],
    [["bricklayer", "brickwork", "mason"], "Brickwork"],
    [["dryliner", "drylining", "partition", "ceiling fixer"], "Drylining"],
    [["plasterer", "plastering", "renderer"], "Plastering"],
    [["roofer", "roofing"], "Roofing"],
    [["groundworker", "groundworks", "360", "dumper"], "Groundworks"],
    [["welder", "welding", "fabricator", "fabrication"], "Welding"],
    [["driver", "delivery", "courier", "transport"], "Driving"],
    [["labourer", "labour", "operative"], "Labouring"],
    [["manager", "supervisor", "foreman", "director", "project lead"], "Management"],
  ];
  return rules.find(([terms]) => terms.some((term) => value.includes(term)))?.[1] || "Not tagged";
}
function inferContactRegion(name: string) {
  const value = name.toLowerCase();
  const regions: Array<[string[], string]> = [
    [["leeds", " ls"], "Leeds"],
    [["bradford", " bd"], "Bradford"],
    [["huddersfield", " hd"], "Huddersfield"],
    [["wakefield", " wf"], "Wakefield"],
    [["halifax", " hx"], "Halifax"],
    [["dewsbury"], "Dewsbury"],
    [["harrogate"], "Harrogate"],
    [["wetherby"], "Wetherby"],
    [["castleford"], "Castleford"],
    [["pontefract"], "Pontefract"],
    [["keighley"], "Keighley"],
    [["shipley"], "Shipley"],
    [["pudsey"], "Pudsey"],
    [["morley"], "Morley"],
    [["batley"], "Batley"],
    [["york", " yo"], "York"],
    [["manchester", " mcr"], "Manchester"],
    [["sheffield"], "Sheffield"],
    [["doncaster"], "Doncaster"],
    [["barnsley"], "Barnsley"],
    [["burnley"], "Burnley"],
    [["london"], "London"],
  ];
  return regions.find(([terms]) => terms.some((term) => value.includes(term)))?.[1] || "Not tagged";
}
function inferContactCategory(name: string, trade: string): WorkContactCategory {
  const value = name.toLowerCase();
  const agencyTerms = [
    "agency", "recruit", "recruitment", "staffing", "jobs", "labour supply",
    "randstad", "reed", "encon", "bamford", "daniel owen", "mcginley", "1st select",
    "search consultancy", "setsquare", "optima", "resourcing", "trades & labour",
    "fawkes", "thorn baker", "linsco", "psr solutions", "building careers", "corepeople",
    "morson", "rullion", "fusion people", "barker ross", "key group", "pyramid8",
    "linear recruitment", "think recruitment", "options resourcing", "winner recruitment",
  ];
  if (agencyTerms.some((term) => value.includes(term))) return "Agency";
  if (["manager", "supervisor", "foreman", "director", "boss", "client", "project lead", "contracts manager", "site mgr"].some((term) => value.includes(term))) return "Manager";
  if (trade !== "Not tagged") return "Worker";
  return "Other";
}
function makeWorkContacts(contacts: RawPhoneContact[], source: WorkContact["source"], importedAt = new Date().toISOString()) {
  return contacts.map((contact, index): WorkContact => {
    const name = contact.name?.find(Boolean)?.trim() || `Unnamed contact ${index + 1}`;
    const phones = [...new Set((contact.tel || []).map(normaliseContactPhone).filter(Boolean))];
    const emails = [...new Set((contact.email || []).map((email) => email.trim().toLowerCase()).filter(Boolean))];
    const trade = inferContactTrade(name);
    const identity = phones[0] || emails[0] || name.toLowerCase();
    return {
      id: `contact-${identity.replace(/[^a-z0-9]+/gi, "-")}-${index}`,
      name,
      phones,
      emails,
      category: inferContactCategory(name, trade),
      trade,
      region: inferContactRegion(name),
      source,
      importedAt,
    };
  });
}
function parseVCardContacts(text: string) {
  const unfolded = text.replace(/\r?\n[ \t]/g, "");
  const cards = unfolded.match(/BEGIN:VCARD[\s\S]*?END:VCARD/gi) || [];
  const rawContacts = cards.map((card): RawPhoneContact => {
    const lines = card.split(/\r?\n/);
    const field = (prefix: string) => lines
      .filter((line) => line.toUpperCase().split(/[;:]/, 1)[0] === prefix)
      .map((line) => line.slice(line.indexOf(":") + 1).trim())
      .filter(Boolean);
    const formattedName = field("FN")[0];
    const parts = field("N")[0]?.split(";") || [];
    const fallbackName = [parts[1], parts[2], parts[0], parts[3]].filter(Boolean).join(" ");
    return { name: [formattedName || fallbackName || "Unnamed contact"], tel: field("TEL"), email: field("EMAIL") };
  });
  return makeWorkContacts(rawContacts, "VCF");
}
function contactIdentity(contact: WorkContact) {
  return contact.phones[0] || contact.emails[0] || contact.name.trim().toLowerCase();
}
function mergeWorkContacts(current: WorkContact[], incoming: WorkContact[]) {
  const merged = new Map<string, WorkContact>();
  for (const contact of [...current, ...incoming]) {
    const key = contactIdentity(contact);
    const previous = merged.get(key);
    if (!previous) {
      merged.set(key, contact);
      continue;
    }
    merged.set(key, {
      ...previous,
      name: previous.name.startsWith("Unnamed contact") ? contact.name : previous.name,
      phones: [...new Set([...previous.phones, ...contact.phones])],
      emails: [...new Set([...previous.emails, ...contact.emails])],
      category: previous.category === "Other" ? contact.category : previous.category,
      trade: previous.trade === "Not tagged" ? contact.trade : previous.trade,
      region: previous.region === "Not tagged" ? contact.region : previous.region,
      company: previous.company || contact.company,
      role: previous.role || contact.role,
      note: previous.note || contact.note,
    });
  }
  return [...merged.values()].sort((a, b) => a.name.localeCompare(b.name));
}
function nativeShareWasProcessed(id: string) {
  try {
    const ids = JSON.parse(localStorage.getItem(NATIVE_SHARE_IDS_KEY) || "[]") as string[];
    return Array.isArray(ids) && ids.includes(id);
  } catch {
    return false;
  }
}
function rememberNativeShareId(id: string) {
  let ids: string[] = [];
  try {
    const saved = JSON.parse(localStorage.getItem(NATIVE_SHARE_IDS_KEY) || "[]") as string[];
    if (Array.isArray(saved)) ids = saved;
  } catch {}
  localStorage.setItem(NATIVE_SHARE_IDS_KEY, JSON.stringify([...ids.filter((item) => item !== id), id].slice(-100)));
}
function nativeShareSource(payload: NativeSharePayload): IntegrationSource {
  if (payload.fromOcr) return "Screenshots";
  if (payload.kind === "contact" || payload.sourceMime.toLowerCase().includes("vcard")) return "Contacts";
  if (payload.sourceLabel.toLowerCase().includes("whatsapp")) return "WhatsApp";
  return "Messages";
}
function nativeContactFromPayload(payload: NativeSharePayload, id = `android-contact-${payload.id}`): WorkContact {
  const name = payload.contactName.trim() || payload.company.trim() || "Shared work contact";
  const context = `${name} ${payload.company} ${payload.role} ${payload.location}`;
  const trade = inferContactTrade(context);
  const phone = normaliseContactPhone(payload.phone);
  const email = payload.email.trim().toLowerCase();
  return {
    id,
    name,
    company: payload.company.trim(),
    role: payload.role.trim(),
    note: payload.note.trim(),
    phones: phone ? [phone] : [],
    emails: email ? [email] : [],
    category: inferContactCategory(context, trade),
    trade,
    region: inferContactRegion(context),
    source: "Android Share",
    importedAt: new Date().toISOString(),
  };
}
function nativeJobFromPayload(payload: NativeSharePayload, id = Date.now()): Job {
  const directLink = isDirectVacancyUrl(payload.applicationLink) ? payload.applicationLink : "";
  const reference = payload.reference.trim() ? `Reference: ${payload.reference.trim()}` : "";
  const sharedLink = payload.applicationLink && !directLink ? `Shared link: ${payload.applicationLink}` : "";
  return {
    id,
    company: payload.company.trim() || "Shared employer",
    role: payload.role.trim() || "Shared job",
    area: payload.location.trim() || "Not stated",
    status: "New",
    date: new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" }).format(new Date()),
    shift: "Not stated",
    contact: payload.email.trim() || payload.contactName.trim() || payload.sourceLabel,
    phone: normaliseContactPhone(payload.phone),
    whatsapp: payload.whatsapp,
    pay: payload.pay.trim(),
    note: [reference, sharedLink].filter(Boolean).join(" · "),
    applicationLink: directLink,
    source: `Android Share · ${payload.sourceLabel || "Unknown source"}`,
    description: payload.rawText.trim() || payload.note.trim(),
    recruiter: payload.contactName.trim(),
  };
}
function findNativeContactDuplicate(payload: NativeSharePayload, contacts: WorkContact[]) {
  const phone = normaliseContactPhone(payload.phone);
  if (phone) {
    const phoneMatch = contacts.find((contact) => contact.phones.some((item) => normaliseContactPhone(item) === phone));
    if (phoneMatch) return phoneMatch;
  }
  const email = payload.email.trim().toLowerCase();
  return email ? contacts.find((contact) => contact.emails.some((item) => item.trim().toLowerCase() === email)) : undefined;
}
function findNativeJobDuplicate(payload: NativeSharePayload, jobs: Job[]) {
  const directLink = isDirectVacancyUrl(payload.applicationLink) ? payload.applicationLink.replace(/\/$/, "") : "";
  if (directLink) {
    const linkMatch = jobs.find((job) => isDirectVacancyUrl(job.applicationLink) && job.applicationLink?.replace(/\/$/, "") === directLink);
    if (linkMatch) return linkMatch;
  }
  const company = payload.company.trim().toLowerCase();
  const role = payload.role.trim().toLowerCase();
  if (!company || !role) return undefined;
  return jobs.find((job) => job.company.trim().toLowerCase() === company && job.role.trim().toLowerCase() === role);
}
function contactsCsv(contacts: WorkContact[]) {
  const headers = ["Name", "Company", "Role", "Category", "Trade", "Region", "Phone", "Email", "Source", "Imported", "Note"];
  const escape = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const rows = contacts.map((contact) => [
    contact.name,
    contact.company || "",
    contact.role || "",
    contact.category,
    contact.trade,
    contact.region,
    contact.phones.join(" | "),
    contact.emails.join(" | "),
    contact.source,
    contact.importedAt,
    contact.note || "",
  ].map(escape).join(","));
  return [headers.map(escape).join(","), ...rows].join("\n");
}
function escapeSpreadsheetXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
async function makeContactsWorkbook(contacts: WorkContact[]) {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const headers = ["Name", "Company", "Role", "Category", "Trade", "Region", "Phone", "Email", "Source", "Imported", "Note"];
  const values = [headers, ...contacts.map((contact) => [
    contact.name,
    contact.company || "",
    contact.role || "",
    contact.category,
    contact.trade,
    contact.region,
    contact.phones.join(" | "),
    contact.emails.join(" | "),
    contact.source,
    contact.importedAt,
    contact.note || "",
  ])];
  const rows = values.map((row, rowIndex) => `<row r="${rowIndex + 1}">${row.map((cell, columnIndex) => `<c r="${String.fromCharCode(65 + columnIndex)}${rowIndex + 1}" t="inlineStr"${rowIndex === 0 ? ' s="1"' : ""}><is><t>${escapeSpreadsheetXml(cell)}</t></is></c>`).join("")}</row>`).join("");
  const endRow = Math.max(1, values.length);
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`);
  zip.folder("_rels")?.file(".rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
  zip.folder("xl")?.file("workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Work Contacts" sheetId="1" r:id="rId1"/></sheets></workbook>`);
  zip.folder("xl")?.folder("_rels")?.file("workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  zip.folder("xl")?.file("styles.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Arial"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Arial"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF171020"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFill="1" applyFont="1"/></cellXfs></styleSheet>`);
  zip.folder("xl")?.folder("worksheets")?.file("sheet1.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:K${endRow}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="1" width="30" customWidth="1"/><col min="2" max="3" width="24" customWidth="1"/><col min="4" max="6" width="18" customWidth="1"/><col min="7" max="8" width="26" customWidth="1"/><col min="9" max="10" width="20" customWidth="1"/><col min="11" max="11" width="42" customWidth="1"/></cols><sheetData>${rows}</sheetData><autoFilter ref="A1:K${endRow}"/></worksheet>`);
  const blob = await zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  return new File([blob], "NOSMO-Work-Contacts.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
function safeFileStem(name: string) {
  return name.trim().replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "") || "NOSMO_Worker";
}
function whatsappUrl(phone = "", text = "") {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = `44${digits.slice(1)}`;
  const params = new URLSearchParams();
  if (digits) params.set("phone", digits);
  if (text) params.set("text", text);
  const query = params.toString();
  return `https://api.whatsapp.com/send${query ? `?${query}` : ""}`;
}
function agencyPackMessage(
  profileName: string,
  source: NexusImportAnalysis["agencyReply"],
  selected: AgencyPackItemKey[],
  details: AgencyPackDetails,
) {
  const firstName = profileName.trim().split(/\s+/)[0] || "Mateusz";
  const greeting = source.contactName ? `Hi ${source.contactName.split(/\s+/)[0]},` : "Hi,";
  const roleContext = [source.role, source.company, source.location].filter(Boolean).join(" · ");
  const lines = [greeting];
  if (roleContext) lines.push(`Thanks for the message about ${roleContext}.`);
  else lines.push("Thanks for your message.");
  if (!selected.length) {
    lines.push("I can prepare the documents you need. Please confirm which items are required and I will send only those.");
  } else {
    lines.push("I have prepared the requested information:");
    if (selected.includes("references")) {
      const references = [details.referenceOne, details.referenceTwo].filter(Boolean).join("; ");
      lines.push(`- Two latest references${references ? `: ${references}` : ""}`);
    }
    if (selected.includes("right_to_work")) {
      const expiry = details.shareCodeExpiry ? ` (valid until ${details.shareCodeExpiry})` : "";
      lines.push(`- Right to Work share code: ${details.shareCode}${expiry}`);
    }
    if (selected.includes("address")) lines.push(`- Current address: ${details.address}`);
    if (selected.includes("cscs")) lines.push("- CSCS card: ready to attach");
    if (selected.includes("certificates")) lines.push(`- Additional certificates${details.extraCertificates ? `: ${details.extraCertificates}` : ": ready to attach"}`);
    if (selected.includes("id")) lines.push("- Photo ID: ready to attach");
  }
  lines.push("Please let me know if anything else is required.", `Thanks, ${firstName}`);
  return lines.join("\n");
}
const liveSearches = [
  { label: "Joinery / carpentry", url: "https://uk.indeed.com/jobs?q=joiner+carpenter&l=Leeds%2C+West+Yorkshire" },
  { label: "Sales", url: "https://uk.indeed.com/jobs?q=trade+counter+sales&l=Leeds%2C+West+Yorkshire" },
  { label: "Painter / decorator", url: "https://uk.indeed.com/jobs?q=painter+decorator&l=Leeds%2C+West+Yorkshire" },
  { label: "Delivery / van driver", url: "https://uk.indeed.com/jobs?q=delivery+van+driver&l=Leeds%2C+West+Yorkshire" },
];
const legacySeed: Job[] = [
  {
    id: 1,
    company: "Premier Inn Huddersfield Central",
    role: "Housekeeping Team Member",
    area: "Huddersfield",
    status: "Applied",
    date: "27 Aug",
    shift: "Short morning shifts",
    contact: "Whitbread careers portal",
    phone: "",
    whatsapp: false,
    note: "CV: Housekeeping",
    category: "HOTEL / HOUSEKEEPING",
    distance: "Approx. 2 mi",
    transport: "HIGH",
    travelTime: "20–30 min",
    cv: "07 — HOTEL HOUSEKEEPING",
    method: "Manual careers portal",
    applicationLink: "https://www.whitbreadcareers.com/",
    source: "Local Jobs sheet",
  },
  {
    id: 2,
    company: "Myton Food Group / Morrisons",
    role: "Production Operative - Warehouse / Despatch Nights",
    area: "Farmers Boy Manufacturing, Huddersfield",
    status: "To apply",
    date: "27 Aug",
    shift: "22:00–06:00",
    contact: "Morrisons careers portal",
    phone: "",
    whatsapp: false,
    note: "Morrisons confirmed formal applications must use careers site.",
    category: "WAREHOUSE",
    distance: "Approx. 2.5–3 mi",
    transport: "HIGH to MEDIUM",
    travelTime: "25–40 min",
    days: "5 days out of 7",
    contract: "Fixed-term, full-time",
    cv: "02 — WAREHOUSE",
    method: "Apply on Morrisons careers site",
    applicationLink:
      "https://www.morrisons.jobs/jobs/production-operative-warehouse-in-bradford.26421",
    replyLink: "https://www.morrisons.jobs/",
    source: "Local Jobs sheet",
  },
  {
    id: 3,
    company: "Huddersfield Teaching Hospitals",
    role: "Catering Assistant",
    area: "Huddersfield",
    status: "Applied",
    date: "27 Aug",
    shift: "Part-time / flexible",
    contact: "NHS Jobs / Trac",
    phone: "",
    whatsapp: false,
    note: "CV: Kitchen & Catering",
  },
  {
    id: 4,
    company: "Carlton Bolling",
    role: "General Kitchen Assistant",
    area: "BD3",
    status: "Applied",
    date: "27 Aug",
    shift: "Part-time / term-time",
    contact: "School recruitment",
    phone: "",
    whatsapp: false,
  },
  {
    id: 5,
    company: "Mitie",
    role: "Cleaner · Ref 102125",
    area: "Undercliffe Health Care Centre, HD3 4RA",
    status: "Reply",
    date: "27 Aug",
    shift: "Part-time",
    contact: "Mitie careers",
    phone: "",
    whatsapp: false,
    note: "Email reply: application must be completed through Mitie Careers.",
    category: "CLEANING",
    distance: "Approx. 0.5–1 mi",
    transport: "HIGH",
    travelTime: "10–20 min",
    pay: "£12.71/h",
    cv: "01 — CLEANING",
    method: "Manual careers portal",
    applicationLink: "https://careers.mitie.com/",
    replyLink: "https://careers.mitie.com/",
    source: "Email reply",
  },
  {
    id: 6,
    company: "Hollins Hall Hotel",
    role: "Housekeeping / Breakfast",
    area: "Baildon",
    status: "To apply",
    date: "Today",
    shift: "Early shifts",
    contact: "Hotel reception",
    phone: "",
    whatsapp: true,
  },
  {
    id: 7,
    company: "SBFM",
    role: "Cleaner",
    area: "Huddersfield",
    status: "To apply",
    date: "Today",
    shift: "Morning",
    contact: "Recruitment team",
    phone: "",
    whatsapp: false,
  },
];
void legacySeed;
const seed = jobSeed as Job[];
const JOBS_SEED_VERSION = "mateusz-leeds-jobs-v1";
const tone: Record<Status, string> = {
  New: "pill grey",
  "To apply": "pill grey",
  Applied: "pill blue",
  Reply: "pill amber",
  Interview: "pill green",
  Offer: "pill green",
  Rejected: "pill red",
  Closed: "pill red",
};
const jobTypeOptions = [
  "Site joiner", "Bench joiner", "Carpenter", "Shopfitter",
  "Working foreman", "Joinery supervisor", "Fire door installer",
  "Kitchen fitter", "1st fix joinery", "2nd fix joinery",
  "Painter & decorator", "Industrial painter", "Spray painter",
  "Sales representative", "Trade counter sales", "Retail sales",
  "Business development", "Account manager", "Customer service",
  "Delivery driver", "Multi-drop driver", "Van driver", "Courier",
  "Warehouse & delivery", "Construction", "Other suitable work",
] as const;
function inferCvJobTypes(text: string) {
  const value = text.toLowerCase();
  const rules: Array<[string[], string[]]> = [
    [["joiner", "carpenter", "shopfit", "fire door", "kitchen", "first fix", "1st fix", "second fix", "2nd fix"], ["Site joiner", "Carpenter", "Shopfitter", "Fire door installer", "Kitchen fitter", "1st fix joinery", "2nd fix joinery"]],
    [["supervisor", "foreman", "team lead"], ["Working foreman", "Joinery supervisor"]],
    [["paint", "decorat", "spray"], ["Painter & decorator", "Industrial painter", "Spray painter"]],
    [["sales", "customer", "business", "account"], ["Sales representative", "Trade counter sales", "Retail sales", "Business development", "Account manager", "Customer service"]],
    [["driver", "delivery", "courier", "van"], ["Delivery driver", "Multi-drop driver", "Van driver", "Courier"]],
  ];
  const found = rules.flatMap(([words, tags]) => words.some((word) => value.includes(word)) ? tags : []);
  return [...new Set(found.length ? found : ["Site joiner", "Carpenter", "Shopfitter", "Working foreman", "Joinery supervisor", "Painter & decorator", "Sales representative", "Delivery driver"] )];
}
const defaultProfile: Profile = {
  name: "NOSMO Worker",
  email: "",
  applicationEmail: "",
  availableFrom: "",
  travel: "Full UK driving licence · Leeds",
  preferredWork: "Full-time · contract · permanent",
  preferredShifts: "Flexible hours · local or travelling roles",
};
const PROFILE_PHOTO_KEY = "nosmo-worker-profile-photo";
const THEME_PRESETS: Array<{ id: ThemePreset; label: string; description: Record<AppLanguage, string> }> = [
  { id: "midnight-black", label: "Midnight Black", description: { en: "Black + greyscale", pl: "Czern + odcienie szarosci" } },
  { id: "nexus-blue", label: "Nexus Blue", description: { en: "Navy + electric blue", pl: "Granat + elektryczny niebieski" } },
  { id: "eco-green", label: "Eco Green", description: { en: "Forest + mint", pl: "Leśna zieleń + mięta" } },
  { id: "silent-gold", label: "Silent Gold", description: { en: "Graphite + gold", pl: "Grafit + złoto" } },
  { id: "windows-grey", label: "Windows Grey", description: { en: "Steel + teal", pl: "Stal + morski" } },
  { id: "arctic-white", label: "Architect White", description: { en: "White + blue", pl: "Biel + niebieski" } },
];
const LANGUAGE_OPTIONS: Array<{ id: LanguagePreference; label: Record<AppLanguage, string>; description: Record<AppLanguage, string> }> = [
  { id: "auto", label: { en: "Automatic", pl: "Automatyczny" }, description: { en: "Use system language", pl: "Użyj języka systemu" } },
  { id: "en", label: { en: "English", pl: "Angielski" }, description: { en: "English interface", pl: "Interfejs po angielsku" } },
  { id: "pl", label: { en: "Polish", pl: "Polski" }, description: { en: "Polish interface", pl: "Interfejs po polsku" } },
];
const UI_TEXT = {
  en: {
    askPrompt: "What are you looking for?",
    appearance: "Appearance",
    appearanceHelp: "Choose a compact NOSMO colour system",
    colourTheme: "Colour theme",
    language: "Language",
    languageHelp: "Automatic uses your phone or browser language",
    languageChoice: "Interface language",
    replyAlerts: "Reply alerts",
    whatsappContacts: "Show WhatsApp contacts",
    integrations: "Integrations & import",
    integrationsHelp: "WhatsApp, messages, contacts, screenshots and files",
    imported: "imported",
    setUp: "Set up",
    localFolder: "Local app folder",
    cvDatabase: "CVs + job database",
    savedAutomatically: "Saved automatically",
    downloadJobs: "Download local Jobs sheet",
    restoreData: "Restore original data",
    settingsTitle: "Settings",
    settingsIntro: "Keep NOSMO Work simple, local and private.",
    preferences: "Preferences",
    workControls: "Work controls",
    dataPrivacy: "Data & privacy",
    localByDefault: "Local by default",
    dataHelp: "Storage, backup and original demo data",
    allSettings: "All settings",
    appsTitle: "Apps",
    appsIntro: "Work tools first. Connected services stay folded until you need them.",
    workTools: "WORK TOOLS",
    connectedApps: "CONNECTED APPS",
    connectedAppsHelp: "Email, messages, job boards and site services",
    manageApps: "Manage apps & imports",
    manageAppsHelp: "Contacts, messages, files and connected accounts",
    appsCount: "12 apps",
    privateSetup: "PRIVATE + SETUP",
    privateLauncher: "Private launcher — you choose what NOSMO imports",
    workerCard: "Worker Card",
    documents: "Documents",
    jobs: "Jobs",
    drawings: "Drawings",
    nexusUpload: "Nexus Upload",
    workCamera: "Work Camera",
    privateVault: "Private Vault",
    addApp: "Add App",
    googleAccount: "Google Account",
  },
  pl: {
    askPrompt: "Czego szukasz?",
    appearance: "Wygląd",
    appearanceHelp: "Wybierz kompaktowy motyw kolorów NOSMO",
    colourTheme: "Motyw kolorów",
    language: "Język",
    languageHelp: "Tryb automatyczny używa języka telefonu lub przeglądarki",
    languageChoice: "Język interfejsu",
    replyAlerts: "Powiadomienia o odpowiedziach",
    whatsappContacts: "Pokazuj kontakty WhatsApp",
    integrations: "Integracje i import",
    integrationsHelp: "WhatsApp, wiadomości, kontakty, zrzuty ekranu i pliki",
    imported: "zaimportowano",
    setUp: "Skonfiguruj",
    localFolder: "Lokalny folder aplikacji",
    cvDatabase: "CV i baza ofert pracy",
    savedAutomatically: "Zapisywane automatycznie",
    downloadJobs: "Pobierz lokalny arkusz ofert",
    restoreData: "Przywróć dane początkowe",
    settingsTitle: "Ustawienia",
    settingsIntro: "NOSMO Work pozostaje prosty, lokalny i prywatny.",
    preferences: "Preferencje",
    workControls: "Ustawienia pracy",
    dataPrivacy: "Dane i prywatność",
    localByDefault: "Domyślnie lokalnie",
    dataHelp: "Pamięć, kopia zapasowa i początkowe dane demonstracyjne",
    allSettings: "Wszystkie ustawienia",
    appsTitle: "Aplikacje",
    appsIntro: "Najpierw narzędzia pracy. Połączone usługi są schowane, dopóki ich nie potrzebujesz.",
    workTools: "NARZĘDZIA PRACY",
    connectedApps: "POŁĄCZONE APLIKACJE",
    connectedAppsHelp: "E-mail, wiadomości, portale pracy i usługi budowlane",
    manageApps: "Zarządzaj aplikacjami i importem",
    manageAppsHelp: "Kontakty, wiadomości, pliki i połączone konta",
    appsCount: "12 aplikacji",
    privateSetup: "PRYWATNE + KONFIGURACJA",
    privateLauncher: "Prywatny panel — Ty wybierasz, co NOSMO importuje",
    workerCard: "Karta pracownika",
    documents: "Dokumenty",
    jobs: "Praca",
    drawings: "Rysunki",
    nexusUpload: "Import Nexus",
    workCamera: "Aparat pracy",
    privateVault: "Prywatny sejf",
    addApp: "Dodaj aplikację",
    googleAccount: "Konto Google",
  },
} as const;
function isThemePreset(value: string | null): value is ThemePreset {
  return THEME_PRESETS.some((preset) => preset.id === value);
}
function themeBaseForPreset(preset: ThemePreset): ThemeBase {
  return preset === "midnight-black" || preset === "nexus-blue" || preset === "silent-gold" ? "dark" : "light";
}
function detectSystemLanguage(): AppLanguage {
  if (typeof navigator === "undefined") return "en";
  const systemLanguage = navigator.languages?.[0] || navigator.language || "en";
  return systemLanguage.toLowerCase().startsWith("pl") ? "pl" : "en";
}
function openLocalDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("mateusz-praca", 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("files"))
        request.result.createObjectStore("files");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function saveLocalFile(key: string, value: Blob) {
  const db = await openLocalDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("files", "readwrite");
    tx.objectStore("files").put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
async function readLocalFile(key: string) {
  const db = await openLocalDb();
  const value = await new Promise<File | undefined>((resolve, reject) => {
    const request = db.transaction("files").objectStore("files").get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return value;
}
async function deleteLocalFile(key: string) {
  const db = await openLocalDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("files", "readwrite");
    tx.objectStore("files").delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
function jobsCsv(jobs: Job[]) {
  const fields: (keyof Job)[] = [
    "priority",
    "company",
    "agency",
    "role",
    "category",
    "area",
    "distance",
    "transport",
    "travelTime",
    "shift",
    "days",
    "contract",
    "pay",
    "startDate",
    "experience",
    "english",
    "cv",
    "coverLetter",
    "method",
    "applicationLink",
    "contact",
    "phone",
    "date",
    "listingAge",
    "status",
    "note",
    "replyLink",
    "source",
    "bestContact",
  ];
  const esc = (value: unknown) =>
    `"${String(value ?? "").replaceAll('"', '""')}"`;
  return [
    fields.join(","),
    ...jobs.map((job) => fields.map((field) => esc(job[field])).join(",")),
  ].join("\n");
}
function parseJobsCsv(text: string): Job[] {
  const lines = text.replace(/\r/g, "").split("\n").filter(Boolean);
  if (lines.length < 2) return [];
  const split = (line: string) => {
    const out: string[] = [];
    let cell = "",
      quoted = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') quoted = !quoted;
      else if (c === "," && !quoted) {
        out.push(cell.trim());
        cell = "";
      } else cell += c;
    }
    out.push(cell.trim());
    return out;
  };
  const headers = split(lines[0]);
  const col = (row: string[], name: string) =>
    row[headers.findIndex((header) => header.toLowerCase() === name.toLowerCase())] || "";
  return lines.slice(1).map((line, index) => {
    const row = split(line);
    const raw = col(row, "Status").toUpperCase();
    const status: Status = raw.includes("APPLIED")
      ? "Applied"
      : raw.includes("OFFER")
        ? "Offer"
        : raw.includes("REJECT")
          ? "Rejected"
          : raw.includes("REPLY")
            ? "Reply"
            : raw.includes("INTERVIEW")
              ? "Interview"
              : raw.includes("CLOSED")
                ? "Closed"
                : raw.includes("NEW")
                  ? "New"
                  : "To apply";
    return {
      id: Date.now() + index,
      company: col(row, "Employer") || col(row, "Company") || "Unknown employer",
      priority: col(row, "priority") || col(row, "Priority"),
      agency: col(row, "agency") || col(row, "Agency"),
      role: col(row, "Job Title") || col(row, "Role") || "Job",
      area: col(row, "area") || col(row, "Exact location / postcode") || col(row, "Location") || "Huddersfield",
      status,
      date: col(row, "date") || col(row, "Date found") || "Imported",
      shift: col(row, "Shift hours") || col(row, "Shift") || "Not stated",
      contact: col(row, "Email") || col(row, "Application method"),
      phone: col(row, "Phone"),
      whatsapp: Boolean(col(row, "WhatsApp number / info")),
      note: col(row, "note") || col(row, "Notes"),
      category: col(row, "category") || col(row, "Category"),
      distance: col(row, "distance") || col(row, "Distance from HD3 4UP"),
      transport: col(row, "transport") || col(row, "Bus/public transport feasibility"),
      travelTime: col(row, "travelTime") || col(row, "Estimated travel time"),
      days: col(row, "days") || col(row, "Days"),
      contract: col(row, "contract") || col(row, "Contract type"),
      pay: col(row, "pay") || col(row, "Pay"),
      startDate: col(row, "startDate") || col(row, "Start date"),
      experience: col(row, "experience") || col(row, "Experience required"),
      english: col(row, "english") || col(row, "English level / requirements"),
      cv: col(row, "cv") || col(row, "CV TO USE"),
      coverLetter: col(row, "coverLetter") || col(row, "Cover letter needed"),
      method: col(row, "method") || col(row, "Application method"),
      applicationLink: col(row, "applicationLink") || col(row, "Application link"),
      replyLink: col(row, "replyLink") || col(row, "Contact source URL"),
      source: col(row, "source") || "Imported sheet",
      listingAge: col(row, "listingAge") || col(row, "Listing age"),
      bestContact: col(row, "bestContact") || col(row, "Best first contact"),
      description:
        col(row, "Full job description") ||
        col(row, "Job description") ||
        col(row, "Description") ||
        col(row, "Advert text"),
      recruiter: col(row, "Recruiter") || col(row, "Contact name"),
    } as Job;
  });
}
export default function Home() {
  const [active, setActive] = useState("Worker Card"),
    [jobs, setJobs] = useState<Job[]>(seed),
    [query, setQuery] = useState(""),
    [jobsFilterQuery, setJobsFilterQuery] = useState(""),
    [jobSearchCriteria, setJobSearchCriteria] = useState<JobSearchCriteria>(DEFAULT_JOB_SEARCH_CRITERIA),
    [searchCriteriaReady, setSearchCriteriaReady] = useState(false),
    [liveSearchJobs, setLiveSearchJobs] = useState<Job[] | null>(null),
    [globalSearchStatus, setGlobalSearchStatus] = useState<"idle" | "running" | "error">("idle"),
    [globalSearchError, setGlobalSearchError] = useState(""),
    [globalSearchKind, setGlobalSearchKind] = useState<GlobalSearchKind>("Work"),
    [searchSessionQuery, setSearchSessionQuery] = useState(""),
    [searchBatch, setSearchBatch] = useState(0),
    [searchMeta, setSearchMeta] = useState<SearchMeta | null>(null),
    [searchNeedsSignIn, setSearchNeedsSignIn] = useState(false),
    [filter, setFilter] = useState<Status | "All">("All"),
    [modal, setModal] = useState(false),
    [autopilotModal, setAutopilotModal] = useState(false),
    [autopilotStep, setAutopilotStep] = useState<"ready" | "running" | "done">("ready"),
    [autopilotCount, setAutopilotCount] = useState(0),
    [autopilotError, setAutopilotError] = useState(""),
    [cvBuilder, setCvBuilder] = useState(false),
    [dynamicCvs, setDynamicCvs] = useState<DynamicCv[]>([]),
    [oldCv, setOldCv] = useState<File | null>(null),
    [searchModal, setSearchModal] = useState(false),
    [askNexusModal, setAskNexusModal] = useState(false),
    [workCameraModal, setWorkCameraModal] = useState(false),
    [workPhoto, setWorkPhoto] = useState<File | null>(null),
    [cameraMessage, setCameraMessage] = useState(""),
    [driveSetupState, setDriveSetupState] = useState<"ask" | "later" | "started">("ask"),
    [searchStep, setSearchStep] = useState<"criteria" | "found">("criteria"),
    [profileModal, setProfileModal] = useState(false),
    [selected, setSelected] = useState<Job | null>(null),
    [profile, setProfile] = useState<Profile>(defaultProfile),
    [profilePhotoUrl, setProfilePhotoUrl] = useState(""),
    [profilePhotoNotice, setProfilePhotoNotice] = useState(""),
    [ready, setReady] = useState(false),
    [alerts, setAlerts] = useState(true),
    [showWhatsapp, setShowWhatsapp] = useState(true),
    [theme, setTheme] = useState<ThemeBase>("light"),
    [themePreset, setThemePreset] = useState<ThemePreset>("arctic-white"),
    [languagePreference, setLanguagePreference] = useState<LanguagePreference>("auto"),
    [language, setLanguage] = useState<AppLanguage>("en"),
    [pwaInstallState, setPwaInstallState] = useState<PwaInstallState>("checking"),
    [pwaInstallPrompt, setPwaInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null),
    [pwaInstallHelp, setPwaInstallHelp] = useState(false),
    [pwaOfflineReady, setPwaOfflineReady] = useState(false),
    [availability, setAvailability] = useState<"green" | "yellow" | "red">(
      "green",
    ),
    [cvToast, setCvToast] = useState<string | null>(null),
    [documentCategory, setDocumentCategory] = useState<DocumentCategory>("All"),
    [selectedJobTypes, setSelectedJobTypes] = useState<string[]>([]),
    [smartDocuments, setSmartDocuments] = useState<SmartDocument[]>([]),
    [nexusImportItems, setNexusImportItems] = useState<NexusImportItem[]>([]),
    [nexusImportNotice, setNexusImportNotice] = useState(""),
    [integrationGuideOpen, setIntegrationGuideOpen] = useState(false),
    [importRecords, setImportRecords] = useState<ImportRecord[]>([]),
    [importNotice, setImportNotice] = useState(""),
    [workContacts, setWorkContacts] = useState<WorkContact[]>([]),
    [contactsReady, setContactsReady] = useState(false),
    [contactQuery, setContactQuery] = useState(""),
    [contactCategory, setContactCategory] = useState<"All" | WorkContactCategory>("All"),
    [contactTrade, setContactTrade] = useState("All"),
    [contactRegion, setContactRegion] = useState("All"),
    [contactEditor, setContactEditor] = useState<WorkContact | null>(null),
    [nativeShareConflict, setNativeShareConflict] = useState<NativeShareConflict | null>(null),
    [availabilitySyncState, setAvailabilitySyncState] = useState<AvailabilitySyncState>("loading"),
    [connectedAgencies, setConnectedAgencies] = useState<ConnectedAgency[]>([]),
    [availabilitySyncedAt, setAvailabilitySyncedAt] = useState(""),
    [connectionInvite, setConnectionInvite] = useState<WorkerConnectionInvite | null>(null),
    [pendingConnectionToken, setPendingConnectionToken] = useState(""),
    [connectionNotice, setConnectionNotice] = useState(""),
    [connectingAgency, setConnectingAgency] = useState(false),
    [availabilityMenu, setAvailabilityMenu] = useState<"card" | null>(null),
    [agencyPackOpen, setAgencyPackOpen] = useState(false),
    [agencyReplyState, setAgencyReplyState] = useState<AgencyReplyState>("idle"),
    [agencyReplyAnalysis, setAgencyReplyAnalysis] = useState<NexusImportAnalysis["agencyReply"]>(EMPTY_AGENCY_REPLY),
    [agencyReplyFileName, setAgencyReplyFileName] = useState(""),
    [agencyPackSelections, setAgencyPackSelections] = useState<AgencyPackItemKey[]>([]),
    [agencyPackContactId, setAgencyPackContactId] = useState(""),
    [agencyPackDetails, setAgencyPackDetails] = useState<AgencyPackDetails>({
      referenceOne: "Daniel Pelc - Site Manager, previous project",
      referenceTwo: "Big Red Construction - final handover project",
      address: "",
      shareCode: "",
      shareCodeExpiry: "",
      extraCertificates: "",
    }),
    [agencyPackDraft, setAgencyPackDraft] = useState(""),
    [agencyPackNotice, setAgencyPackNotice] = useState("");
  const ui = UI_TEXT[language];
  const selectedTheme = THEME_PRESETS.find((preset) => preset.id === themePreset) || THEME_PRESETS[0];
  const selectedLanguage = LANGUAGE_OPTIONS.find((option) => option.id === languagePreference) || LANGUAGE_OPTIONS[0];
  const contactTrades = useMemo(() => [...new Set(workContacts.map((contact) => contact.trade))].sort(), [workContacts]);
  const contactRegions = useMemo(() => [...new Set(workContacts.map((contact) => contact.region))].sort(), [workContacts]);
  const visibleWorkContacts = useMemo(() => {
    const needle = contactQuery.trim().toLowerCase();
    return workContacts.filter((contact) => {
      if (contactCategory !== "All" && contact.category !== contactCategory) return false;
      if (contactTrade !== "All" && contact.trade !== contactTrade) return false;
      if (contactRegion !== "All" && contact.region !== contactRegion) return false;
      if (!needle) return true;
      return [contact.name, contact.company, contact.role, contact.note, contact.category, contact.trade, contact.region, ...contact.phones, ...contact.emails].join(" ").toLowerCase().includes(needle);
    });
  }, [contactCategory, contactQuery, contactRegion, contactTrade, workContacts]);
  const agencyContacts = useMemo(
    () => workContacts.filter((contact) => contact.category === "Agency" && (contact.phones.length > 0 || contact.emails.length > 0)),
    [workContacts],
  );
  const agencyPackDocuments = useMemo(() => {
    const selected: SmartDocument[] = [];
    if (agencyPackSelections.includes("references")) selected.push(...smartDocuments.filter((document) => document.documentType === "reference").slice(0, 2));
    if (agencyPackSelections.includes("cscs")) selected.push(...smartDocuments.filter((document) => document.documentType === "cscs_card").slice(0, 1));
    if (agencyPackSelections.includes("certificates")) selected.push(...smartDocuments.filter((document) => document.category === "Certificates & training").slice(0, 4));
    if (agencyPackSelections.includes("id")) selected.push(...smartDocuments.filter((document) => document.documentType === "id_document").slice(0, 1));
    return [...new Map(selected.map((document) => [document.id, document])).values()];
  }, [agencyPackSelections, smartDocuments]);
  useEffect(() => {
    if (!ready || !contactsReady || nativeShareConflict) return;
    const receiveNativeShare = (payload: NativeSharePayload) => {
      if (!payload || typeof payload.id !== "string" || (payload.kind !== "job" && payload.kind !== "contact")) return;
      processNativeShare(payload);
    };
    window.__NOSMO_RECEIVE_NATIVE_SHARE__ = receiveNativeShare;
    if (window.NosmoAndroid) document.documentElement.dataset.nativeHost = "android";
    return () => {
      if (window.__NOSMO_RECEIVE_NATIVE_SHARE__ === receiveNativeShare) delete window.__NOSMO_RECEIVE_NATIVE_SHARE__;
      delete document.documentElement.dataset.nativeHost;
    };
  }, [ready, contactsReady, nativeShareConflict, processNativeShare]);
  useEffect(() => {
    const savedTheme: ThemeBase = localStorage.getItem("mateusz-theme") === "dark" ? "dark" : "light";
    const storedPreset = localStorage.getItem("nosmo-theme-preset");
    const savedPreset: ThemePreset = isThemePreset(storedPreset)
      ? storedPreset
      : savedTheme === "dark" ? "midnight-black" : "arctic-white";
    const savedBase = themeBaseForPreset(savedPreset);
    document.documentElement.dataset.theme = savedBase;
    document.documentElement.dataset.skin = savedPreset;
    const savedDriveSetup = localStorage.getItem("nosmo-drive-setup");
    queueMicrotask(() => {
      setTheme(savedBase);
      setThemePreset(savedPreset);
      if (savedDriveSetup === "later" || savedDriveSetup === "started") setDriveSetupState(savedDriveSetup);
    });
  }, []);
  useEffect(() => {
    const storedLanguage = localStorage.getItem("nosmo-language");
    const preference: LanguagePreference = storedLanguage === "en" || storedLanguage === "pl" ? storedLanguage : "auto";
    const resolved = preference === "auto" ? detectSystemLanguage() : preference;
    document.documentElement.lang = resolved;
    queueMicrotask(() => {
      setLanguagePreference(preference);
      setLanguage(resolved);
    });
    const handleSystemLanguageChange = () => {
      if ((localStorage.getItem("nosmo-language") || "auto") !== "auto") return;
      setLanguage(detectSystemLanguage());
    };
    window.addEventListener("languagechange", handleSystemLanguageChange);
    return () => window.removeEventListener("languagechange", handleSystemLanguageChange);
  }, []);
  useEffect(() => {
    let mounted = true;
    const standaloneQuery = window.matchMedia("(display-mode: standalone)");
    const isStandalone = () =>
      standaloneQuery.matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    const handleDisplayMode = () => {
      if (mounted && isStandalone()) setPwaInstallState("installed");
    };
    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      if (!mounted || isStandalone()) return;
      setPwaInstallPrompt(event as BeforeInstallPromptEvent);
      setPwaInstallState("ready");
    };
    const handleInstalled = () => {
      if (!mounted) return;
      setPwaInstallPrompt(null);
      setPwaInstallHelp(false);
      setPwaInstallState("installed");
    };

    queueMicrotask(() => {
      if (mounted) setPwaInstallState(isStandalone() ? "installed" : "manual");
    });
    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    standaloneQuery.addEventListener("change", handleDisplayMode);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then(() => navigator.serviceWorker.ready)
        .then(() => {
          if (mounted) setPwaOfflineReady(true);
        })
        .catch(() => {
          if (mounted) setPwaOfflineReady(false);
        });
    }

    return () => {
      mounted = false;
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
      standaloneQuery.removeEventListener("change", handleDisplayMode);
    };
  }, []);
  useEffect(() => {
    let saved = DEFAULT_JOB_SEARCH_CRITERIA;
    try {
      saved = normalizeJobSearchCriteria(JSON.parse(localStorage.getItem(JOB_SEARCH_CRITERIA_KEY) || "null"));
    } catch {}
    queueMicrotask(() => {
      setJobSearchCriteria(saved);
      setSearchCriteriaReady(true);
    });
  }, []);
  useEffect(() => {
    if (!searchCriteriaReady) return;
    localStorage.setItem(JOB_SEARCH_CRITERIA_KEY, JSON.stringify(jobSearchCriteria));
  }, [jobSearchCriteria, searchCriteriaReady]);
  async function installWorkerApp() {
    if (pwaInstallState === "installed" || pwaInstallState === "installing") return;
    if (!pwaInstallPrompt) {
      setPwaInstallHelp((visible) => !visible);
      return;
    }
    setPwaInstallState("installing");
    try {
      await pwaInstallPrompt.prompt();
      const choice = await pwaInstallPrompt.userChoice;
      setPwaInstallPrompt(null);
      if (choice.outcome === "accepted") {
        setPwaInstallState("installing");
      } else {
        setPwaInstallState("manual");
        setPwaInstallHelp(true);
      }
    } catch {
      setPwaInstallPrompt(null);
      setPwaInstallState("manual");
      setPwaInstallHelp(true);
    }
  }
  function changeTheme(next: ThemePreset) {
    const base = themeBaseForPreset(next);
    setTheme(base);
    setThemePreset(next);
    localStorage.setItem("mateusz-theme", base);
    localStorage.setItem("nosmo-theme-preset", next);
  }
  function changeLanguage(next: LanguagePreference) {
    const resolved = next === "auto" ? detectSystemLanguage() : next;
    setLanguagePreference(next);
    setLanguage(resolved);
    localStorage.setItem("nosmo-language", next);
  }
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.skin = themePreset;
  }, [theme, themePreset]);
  async function saveWorkPhoto() {
    if (!workPhoto) return;
    const stamp = new Date().toISOString().replaceAll(":", "-").replace(".", "-");
    const extension = workPhoto.name.split(".").pop() || "jpg";
    const filename = `NOSMO-work-${stamp}.${extension}`;
    try {
      const picker = (window as DirectoryPickerWindow).showDirectoryPicker;
      if (picker) {
        const chosenFolder = await picker({ mode: "readwrite" });
        const workFolder = await chosenFolder.getDirectoryHandle("NOSMO Work Photos", { create: true });
        const fileHandle = await workFolder.getFileHandle(filename, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(workPhoto);
        await writable.close();
        setCameraMessage("Saved in NOSMO Work Photos.");
        return;
      }
      const url = URL.createObjectURL(workPhoto);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
      setCameraMessage("Saved through Downloads. Move it to your NOSMO Work Photos folder.");
    } catch (error) {
      if ((error as Error).name !== "AbortError") setCameraMessage("The photo was not saved. Choose the work folder and try again.");
    }
  }
  function configureGoogleDrive() {
    localStorage.setItem("nosmo-drive-setup", "started");
    setDriveSetupState("started");
    openExternal("https://drive.google.com/drive/my-drive");
  }
  function remindDriveLater() {
    localStorage.setItem("nosmo-drive-setup", "later");
    setDriveSetupState("later");
  }
  function openIntegrations() {
    setActive("Integrations");
  }
  function finishIntegrationGuide() {
    localStorage.setItem("nosmo-integrations-guide-seen", "yes");
    setIntegrationGuideOpen(false);
  }
  function rememberImports(nextRecords: ImportRecord[]) {
    setImportRecords((current) => {
      const next = [...nextRecords, ...current].slice(0, 100);
      localStorage.setItem("nosmo-import-inbox", JSON.stringify(next));
      return next;
    });
  }
  function rememberWorkContacts(nextContacts: WorkContact[]) {
    setWorkContacts((current) => {
      const next = mergeWorkContacts(current, nextContacts).slice(0, 2000);
      localStorage.setItem(WORK_CONTACTS_KEY, JSON.stringify(next));
      return next;
    });
  }
  function updateWorkContact(id: string, update: Partial<Pick<WorkContact, "category" | "trade" | "region">>) {
    setWorkContacts((current) => {
      const next = current
        .map((contact) => contact.id === id ? { ...contact, ...update } : contact)
        .sort((a, b) => a.name.localeCompare(b.name));
      localStorage.setItem(WORK_CONTACTS_KEY, JSON.stringify(next));
      return next;
    });
  }
  function saveContactTags(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!contactEditor) return;
    const form = new FormData(event.currentTarget);
    updateWorkContact(contactEditor.id, {
      category: String(form.get("category")) as WorkContactCategory,
      trade: String(form.get("trade") || "Not tagged").trim() || "Not tagged",
      region: String(form.get("region") || "Not tagged").trim() || "Not tagged",
    });
    setContactEditor(null);
    setImportNotice(`${contactEditor.name} tags updated. The contact workbook is refreshing in the background.`);
  }
  function acknowledgeNativeShare(id: string) {
    rememberNativeShareId(id);
    window.NosmoAndroid?.ackShare(id);
  }
  function recordNativeShare(payload: NativeSharePayload, action: "saved" | "updated" | "separate") {
    const source = nativeShareSource(payload);
    const phones = payload.phone ? 1 : 0;
    const emails = payload.email ? 1 : 0;
    const title = payload.kind === "job"
      ? payload.role.trim() || payload.company.trim() || "Shared job"
      : payload.contactName.trim() || payload.company.trim() || "Shared work contact";
    const sourceText = payload.sourceLabel || "Android Share";
    const detail = `${action === "updated" ? "Updated an existing record" : action === "separate" ? "Saved as a separate record" : "Saved after review"} from ${sourceText}.${payload.fromOcr ? " OCR text only; the original image was not retained." : ""}`;
    const text = payload.rawText.trim() || payload.note.trim();
    if (text) void saveLocalFile(
      `nosmo-import-${payload.id}`,
      new Blob([text], { type: "text/plain;charset=utf-8" }),
    ).catch(() => {});
    rememberImports([{
      id: payload.id,
      source,
      title,
      detail,
      importedAt: new Date().toISOString(),
      phoneCount: phones,
      emailCount: emails,
    }]);
  }
  function saveNativeContact(payload: NativeSharePayload, action: "saved" | "updated" | "separate", existingId?: string | number) {
    const incoming = nativeContactFromPayload(
      payload,
      action === "separate" ? `android-contact-${payload.id}-${Date.now()}` : `android-contact-${payload.id}`,
    );
    setWorkContacts((current) => {
      if (action !== "updated") return [...current, incoming].sort((a, b) => a.name.localeCompare(b.name)).slice(0, 2000);
      return current.map((contact) => contact.id === String(existingId) ? {
        ...contact,
        name: incoming.name === "Shared work contact" ? contact.name : incoming.name,
        company: incoming.company || contact.company,
        role: incoming.role || contact.role,
        note: incoming.note || contact.note,
        phones: [...new Set([...contact.phones, ...incoming.phones])],
        emails: [...new Set([...contact.emails, ...incoming.emails])],
        category: contact.category === "Other" ? incoming.category : contact.category,
        trade: contact.trade === "Not tagged" ? incoming.trade : contact.trade,
        region: contact.region === "Not tagged" ? incoming.region : contact.region,
      } : contact).sort((a, b) => a.name.localeCompare(b.name));
    });
    recordNativeShare(payload, action);
    setActive("Integrations");
    setImportNotice(action === "updated" ? `${incoming.name} updated after your confirmation.` : `${incoming.name} added to Contact register.`);
    acknowledgeNativeShare(payload.id);
  }
  function saveNativeJob(payload: NativeSharePayload, action: "saved" | "updated" | "separate", existingId?: string | number) {
    const incoming = nativeJobFromPayload(payload, Date.now() + Math.floor(Math.random() * 1000));
    setJobs((current) => {
      if (action !== "updated") return [incoming, ...current];
      return current.map((job) => job.id === Number(existingId) ? {
        ...job,
        company: payload.company.trim() || job.company,
        role: payload.role.trim() || job.role,
        area: payload.location.trim() || job.area,
        contact: payload.email.trim() || payload.contactName.trim() || job.contact,
        phone: normaliseContactPhone(payload.phone) || job.phone,
        whatsapp: job.whatsapp || payload.whatsapp,
        pay: payload.pay.trim() || job.pay,
        note: [...new Set([job.note, incoming.note].filter(Boolean))].join(" · "),
        applicationLink: incoming.applicationLink || job.applicationLink,
        source: incoming.source,
        description: payload.rawText.trim() || payload.note.trim() || job.description,
        recruiter: payload.contactName.trim() || job.recruiter,
      } : job);
    });
    recordNativeShare(payload, action);
    setActive("Applications");
    setImportNotice(action === "updated" ? `${incoming.role} updated after your confirmation.` : `${incoming.role} added to Jobs.`);
    acknowledgeNativeShare(payload.id);
  }
  function saveNativeShare(payload: NativeSharePayload, action: "saved" | "updated" | "separate", existingId?: string | number) {
    if (payload.kind === "contact") saveNativeContact(payload, action, existingId);
    else saveNativeJob(payload, action, existingId);
  }
  function processNativeShare(payload: NativeSharePayload) {
    if (nativeShareWasProcessed(payload.id)) {
      window.NosmoAndroid?.ackShare(payload.id);
      return;
    }
    if (payload.kind === "contact") {
      const duplicate = findNativeContactDuplicate(payload, workContacts);
      if (duplicate) {
        setNativeShareConflict({ payload, existingId: duplicate.id, existingLabel: duplicate.name });
        return;
      }
    } else {
      const duplicate = findNativeJobDuplicate(payload, jobs);
      if (duplicate) {
        setNativeShareConflict({ payload, existingId: duplicate.id, existingLabel: `${duplicate.role} · ${duplicate.company}` });
        return;
      }
    }
    saveNativeShare(payload, "saved");
  }
  function resolveNativeShareConflict(action: "updated" | "separate" | "discard") {
    if (!nativeShareConflict) return;
    const conflict = nativeShareConflict;
    setNativeShareConflict(null);
    if (action === "discard") {
      setImportNotice("Shared item discarded. Nothing was changed.");
      acknowledgeNativeShare(conflict.payload.id);
      return;
    }
    saveNativeShare(conflict.payload, action, conflict.existingId);
  }
  function updateNexusImportItem(id: string, update: Partial<NexusImportItem>) {
    setNexusImportItems((current) => current.map((item) => item.id === id ? { ...item, ...update } : item));
  }
  async function analyseNexusFiles(files: FileList | null, context: "document" | "drawing" = "document") {
    if (!files?.length) return;
    const chosen = Array.from(files).slice(0, NEXUS_DOCUMENT_MAX_FILES);
    const items: NexusImportItem[] = chosen.map((file, index) => {
      const id = `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`;
      const supported = /\.(pdf|doc|docx|rtf|odt|txt|md|json|html|xml|csv|tsv|xls|xlsx|ppt|pptx|png|jpe?g|webp|gif)$/i.test(file.name);
      const error = !supported
        ? "This format is not supported yet."
        : !file.size || file.size > NEXUS_DOCUMENT_MAX_BYTES
          ? "The file must be smaller than 10 MB."
          : "";
      return { id, file, state: error ? "error" : "queued", error };
    });
    setNexusImportItems(items);
    setNexusImportNotice(files.length > NEXUS_DOCUMENT_MAX_FILES
      ? `Nexus can analyse ${NEXUS_DOCUMENT_MAX_FILES} files at once. The first ${NEXUS_DOCUMENT_MAX_FILES} were selected.`
      : "Nexus is preparing your files.");
    let readyCount = 0;
    let errorCount = items.filter((item) => item.state === "error").length;
    for (const item of items) {
      if (item.state === "error") continue;
      updateNexusImportItem(item.id, { state: "analysing", error: "" });
      try {
        const formData = new FormData();
        formData.append("file", item.file, item.file.name);
        formData.append("context", context);
        const response = await fetch("/api/nexus-import", { method: "POST", body: formData });
        const payload = await response.json().catch(() => ({})) as { analysis?: NexusImportAnalysis; error?: string };
        if (!response.ok || !payload.analysis) throw new Error(payload.error || "Nexus could not analyse this file.");
        readyCount += 1;
        updateNexusImportItem(item.id, { state: "review", analysis: payload.analysis, error: "" });
      } catch (error) {
        errorCount += 1;
        updateNexusImportItem(item.id, { state: "error", error: error instanceof Error ? error.message : "Nexus could not analyse this file." });
      }
    }
    setNexusImportNotice(readyCount
      ? `${readyCount} file${readyCount === 1 ? " is" : "s are"} ready for approval.${errorCount ? ` ${errorCount} could not be analysed.` : ""}`
      : "No files were ready. Check the errors below and try again.");
  }
  function rememberSmartDocument(document: SmartDocument) {
    setSmartDocuments((current) => {
      const next = [document, ...current.filter((item) => item.id !== document.id)].slice(0, 200);
      localStorage.setItem(SMART_DOCUMENTS_KEY, JSON.stringify(next));
      return next;
    });
  }
  async function applyNexusImport(item: NexusImportItem) {
    if (!item.analysis || item.state !== "review") return;
    const analysis = item.analysis;
    const document: SmartDocument = {
      id: item.id,
      fileName: item.file.name,
      fileType: item.file.type,
      fileSize: item.file.size,
      title: analysis.title,
      category: analysis.category,
      documentType: analysis.documentType,
      summary: analysis.summary,
      issuer: analysis.document.issuer,
      documentNumberMasked: analysis.document.documentNumberMasked,
      issuedDate: analysis.document.issuedDate,
      expiryDate: analysis.document.expiryDate,
      status: analysis.document.status,
      skills: analysis.skills,
      drawing: analysis.drawing,
      importedAt: new Date().toISOString(),
    };
    try {
      await saveLocalFile(smartDocumentStorageKey(document), item.file);
      rememberSmartDocument(document);

      const destinations = ["Documents"];
      if (analysis.documentType === "cv") {
        const inferred = analysis.roleTitles.length
          ? analysis.roleTitles
          : inferCvJobTypes(`${analysis.title} ${analysis.summary} ${analysis.skills.join(" ")}`);
        const tags = [...new Set(inferred)].slice(0, 12);
        setDynamicCvs((current) => {
          const next = [...current.filter((cv) => cv.id !== item.id), { id: item.id, title: analysis.title, file: item.file, tags }];
          localStorage.setItem("mateusz-dynamic-cvs", JSON.stringify(next.map(({id,title,tags: cvTags}) => ({id,title,tags:cvTags}))));
          return next;
        });
        setSelectedJobTypes((current) => [...new Set([...current, ...tags])]);
        destinations.push("CV search profile");
      } else if (analysis.roleTitles.length) {
        setSelectedJobTypes((current) => [...new Set([...current, ...analysis.roleTitles])]);
      }

      if (analysis.documentType === "job_advert" && analysis.job.role) {
        const directLink = isDirectVacancyUrl(analysis.job.applicationLink) ? analysis.job.applicationLink : "";
        const importedJob: Job = {
          id: Number(item.id.match(/^\d+/)?.[0] || item.id.replace(/\D/g, "").slice(0, 13)) || 1,
          company: analysis.job.company || "Employer not stated",
          role: analysis.job.role,
          area: analysis.job.area || "Location not stated",
          status: "New",
          date: "Imported today",
          shift: analysis.job.shift || "Hours not stated",
          contact: analysis.job.contact,
          phone: analysis.job.phone,
          whatsapp: false,
          contract: analysis.job.contract,
          pay: analysis.job.pay,
          applicationLink: directLink,
          method: directLink ? "Apply via the advert link" : "Review the saved advert",
          description: analysis.job.description || analysis.summary,
          source: analysis.job.source || item.file.name,
          note: `Imported by Nexus from ${item.file.name}. Review the original document before applying.`,
        };
        setJobs((current) => {
          const duplicate = current.some((job) => `${job.company}|${job.role}`.toLowerCase() === `${importedJob.company}|${importedJob.role}`.toLowerCase());
          return duplicate ? current : [importedJob, ...current];
        });
        destinations.push("Jobs");
      }
      if (analysis.documentType === "drawing") destinations.push("Drawings");

      const suggestion = analysis.profile;
      const hasProfileSuggestion = Object.values(suggestion).some(Boolean);
      if (hasProfileSuggestion) {
        setProfile((current) => {
          const next: Profile = {
            name: current.name === defaultProfile.name && suggestion.name ? suggestion.name : current.name,
            email: current.email || suggestion.email,
            applicationEmail: current.applicationEmail || suggestion.applicationEmail || suggestion.email,
            availableFrom: current.availableFrom || suggestion.availableFrom,
            travel: (!current.travel || current.travel === defaultProfile.travel) && suggestion.travel ? suggestion.travel : current.travel,
            preferredWork: (!current.preferredWork || current.preferredWork === defaultProfile.preferredWork) && suggestion.preferredWork ? suggestion.preferredWork : current.preferredWork,
            preferredShifts: (!current.preferredShifts || current.preferredShifts === defaultProfile.preferredShifts) && suggestion.preferredShifts ? suggestion.preferredShifts : current.preferredShifts,
          };
          localStorage.setItem("mateusz-job-profile", JSON.stringify(next));
          return next;
        });
        destinations.push("empty Worker Card fields");
      }
      updateNexusImportItem(item.id, { state: "applied" });
      setNexusImportNotice(`${analysis.title} added to ${[...new Set(destinations)].join(", ")}.`);
    } catch {
      updateNexusImportItem(item.id, { state: "error", error: "The file could not be saved on this device." });
    }
  }
  function dismissNexusImportItem(id: string) {
    setNexusImportItems((current) => current.filter((item) => item.id !== id));
  }
  async function openSmartDocument(document: SmartDocument) {
    const stored = await readLocalFile(smartDocumentStorageKey(document)).catch(() => undefined);
    if (!stored) {
      setNexusImportNotice("This local file is no longer available on this device.");
      return;
    }
    const url = URL.createObjectURL(stored);
    const link = window.document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    window.document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
  async function importFiles(source: IntegrationSource, files: FileList | null) {
    if (!files?.length) return;
    const records: ImportRecord[] = [];
    const importedContacts: WorkContact[] = [];
    for (const [index, file] of Array.from(files).entries()) {
      const id = `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`;
      const readable = file.type.startsWith("text/") || /\.(txt|csv|json|vcf)$/i.test(file.name);
      const text = readable ? await file.text().catch(() => "") : "";
      const phones = uniquePhones(text);
      const emails = uniqueEmails(text);
      const vCards = source === "Contacts" ? (text.match(/BEGIN:VCARD/gi) || []).length : 0;
      const contactRows = source === "Contacts" ? parseVCardContacts(text) : [];
      importedContacts.push(...contactRows);
      await saveLocalFile(`nosmo-import-${id}`, file);
      const detail = source === "Screenshots"
        ? "Saved locally. Number reading will activate in the Android OCR step."
        : source === "Contacts" && vCards
          ? `${vCards} contact${vCards === 1 ? "" : "s"} found in the contact file.`
          : `${phones.length} phone number${phones.length === 1 ? "" : "s"} and ${emails.length} email${emails.length === 1 ? "" : "s"} detected.`;
      records.push({
        id,
        source,
        title: file.name,
        detail,
        importedAt: new Date().toISOString(),
        phoneCount: phones.length || vCards,
        emailCount: emails.length,
      });
    }
    rememberImports(records);
    if (importedContacts.length) rememberWorkContacts(importedContacts);
    setImportNotice(`${records.length} item${records.length === 1 ? "" : "s"} added to your private Import Inbox.`);
  }
  async function importPhoneContacts() {
    const contactPicker = (navigator as ContactPickerNavigator).contacts;
    if (!contactPicker?.select) {
      document.getElementById("nosmo-contact-file")?.click();
      return;
    }
    try {
      const contacts = await contactPicker.select(["name", "tel", "email"], { multiple: true });
      if (!contacts.length) return;
      const importedAt = new Date().toISOString();
      const contactRows = makeWorkContacts(contacts, "Phone", importedAt);
      const phones = [...new Set(contacts.flatMap((contact) => contact.tel || []))];
      const emails = [...new Set(contacts.flatMap((contact) => contact.email || []))];
      const id = `${Date.now()}-contacts`;
      await saveLocalFile(
        `nosmo-import-${id}`,
        new Blob([JSON.stringify(contacts)], { type: "application/json" }),
      );
      rememberImports([{
        id,
        source: "Contacts",
        title: `${contacts.length} selected phone contact${contacts.length === 1 ? "" : "s"}`,
        detail: `${phones.length} phone number${phones.length === 1 ? "" : "s"} and ${emails.length} email${emails.length === 1 ? "" : "s"} imported locally.`,
        importedAt,
        phoneCount: phones.length,
        emailCount: emails.length,
      }]);
      rememberWorkContacts(contactRows);
      setImportNotice(`${contacts.length} contact${contacts.length === 1 ? "" : "s"} added to Work Contacts and your private Import Inbox.`);
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        setImportNotice("Contacts were not imported. Try a .vcf contact file instead.");
      }
    }
  }
  function clearImportInbox() {
    importRecords.forEach((record) => deleteLocalFile(`nosmo-import-${record.id}`).catch(() => {}));
    localStorage.removeItem("nosmo-import-inbox");
    setImportRecords([]);
    setImportNotice("Import Inbox cleared from this device.");
  }
  useEffect(() => {
    (async () => {
      if (localStorage.getItem("mateusz-jobs-seed-version") !== JOBS_SEED_VERSION) {
        setJobs(seed);
        localStorage.setItem("mateusz-jobs-seed-version", JOBS_SEED_VERSION);
        setReady(true);
        return;
      }
      const sheet = await readLocalFile("Jobs.csv").catch(() => undefined);
      if (sheet) {
        setJobs(parseJobsCsv(await sheet.text()));
      } else {
        const cached = localStorage.getItem("mateusz-job-hub");
        if (cached) {
          try { setJobs(JSON.parse(cached)); } catch {}
        }
      }
      setReady(true);
    })();
  }, []);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("nosmo-import-inbox") || "[]") as ImportRecord[];
      if (Array.isArray(saved)) queueMicrotask(() => setImportRecords(saved.slice(0, 100)));
    } catch {}
  }, []);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let savedContacts: WorkContact[] = [];
      try {
        const parsed = JSON.parse(localStorage.getItem(WORK_CONTACTS_KEY) || "[]") as WorkContact[];
        if (Array.isArray(parsed)) savedContacts = parsed;
      } catch {}
      if (localStorage.getItem("nosmo-work-contact-tagging-version") !== WORK_CONTACT_TAGGING_VERSION) {
        savedContacts = savedContacts.map((contact) => {
          const trade = contact.trade === "Not tagged" ? inferContactTrade(contact.name) : contact.trade;
          return {
            ...contact,
            trade,
            region: contact.region === "Not tagged" ? inferContactRegion(contact.name) : contact.region,
            category: contact.category === "Other" ? inferContactCategory(contact.name, trade) : contact.category,
          };
        });
        localStorage.setItem("nosmo-work-contact-tagging-version", WORK_CONTACT_TAGGING_VERSION);
        localStorage.setItem(WORK_CONTACTS_KEY, JSON.stringify(savedContacts));
      }
      if (!savedContacts.length) {
        let contactImports: ImportRecord[] = [];
        try {
          const parsed = JSON.parse(localStorage.getItem("nosmo-import-inbox") || "[]") as ImportRecord[];
          if (Array.isArray(parsed)) contactImports = parsed.filter((record) => record.source === "Contacts");
        } catch {}
        const recovered = await Promise.all(contactImports.map(async (record) => {
          const file = await readLocalFile(`nosmo-import-${record.id}`).catch(() => undefined);
          if (!file) return [];
          const text = await file.text().catch(() => "");
          try {
            const raw = JSON.parse(text) as RawPhoneContact[];
            return Array.isArray(raw) ? makeWorkContacts(raw, "Phone", record.importedAt) : [];
          } catch {
            return parseVCardContacts(text);
          }
        }));
        savedContacts = mergeWorkContacts([], recovered.flat());
      }
      if (cancelled) return;
      setWorkContacts(savedContacts.slice(0, 2000));
      setContactsReady(true);
    })();
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    if (!contactsReady) return;
    let cancelled = false;
    localStorage.setItem(WORK_CONTACTS_KEY, JSON.stringify(workContacts));
    const csvFile = new File([contactsCsv(workContacts)], "NOSMO-Work-Contacts.csv", { type: "text/csv" });
    saveLocalFile("NOSMO-Work-Contacts.csv", csvFile).catch(() => {});
    void makeContactsWorkbook(workContacts).then((workbook) => {
      if (!cancelled) return saveLocalFile("NOSMO-Work-Contacts.xlsx", workbook);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [contactsReady, workContacts]);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(SMART_DOCUMENTS_KEY) || "[]") as SmartDocument[];
      if (Array.isArray(saved)) queueMicrotask(() => setSmartDocuments(saved.slice(0, 200)));
    } catch {}
  }, []);
  useEffect(() => {
    const metadata = JSON.parse(localStorage.getItem("mateusz-dynamic-cvs") || "[]") as Array<{id:string;title:string;tags:string[]}>;
    Promise.all(metadata.map(async (item) => ({ ...item, file: await readLocalFile(`dynamic-cv-${item.id}`) })))
      .then((items) => {
        const loaded = items.filter((item): item is DynamicCv => Boolean(item.file));
        setDynamicCvs(loaded);
        setSelectedJobTypes((current) => [...new Set([...current, ...loaded.flatMap((cv) => cv.tags)])]);
      }).catch(() => {});
  }, []);
  useEffect(() => {
    let cancelled = false;
    readLocalFile(PROFILE_PHOTO_KEY)
      .then((file) => {
        if (!cancelled && file) setProfilePhotoUrl(URL.createObjectURL(file));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    return () => {
      if (profilePhotoUrl.startsWith("blob:")) URL.revokeObjectURL(profilePhotoUrl);
    };
  }, [profilePhotoUrl]);
  useEffect(() => {
    if (!profilePhotoNotice) return;
    const timer = window.setTimeout(() => setProfilePhotoNotice(""), 3500);
    return () => window.clearTimeout(timer);
  }, [profilePhotoNotice]);
  useEffect(() => {
    if (ready) {
      localStorage.setItem("mateusz-job-hub", JSON.stringify(jobs));
      saveLocalFile(
        "Jobs.csv",
        new File([jobsCsv(jobs)], "Jobs.csv", { type: "text/csv" }),
      ).catch(() => {});
    }
  }, [jobs, ready]);
  useEffect(() => {
    // Remove CVs that older demo versions created automatically. Only files
    // explicitly imported or made by the user may appear in Documents.
    Promise.all(
      [0, 1, 2, 3].flatMap((i) => [
        deleteLocalFile(`cv-${i}`).catch(() => {}),
        deleteLocalFile(`cv-docx-${i}`).catch(() => {}),
      ]),
    ).catch(() => {});
  }, []);
  useEffect(() => {
    const x = localStorage.getItem("mateusz-job-profile");
    let savedProfile: Profile | null = null;
    if (x) try { savedProfile = JSON.parse(x) as Profile; } catch {}
    const savedAlerts = localStorage.getItem("mateusz-alerts") !== "off";
    const savedShowWhatsapp = localStorage.getItem("mateusz-whatsapp") !== "off";
    const a = localStorage.getItem("mateusz-availability");
    if (localStorage.getItem("mateusz-location-version") !== "leeds-v1") {
      savedProfile = defaultProfile;
      localStorage.setItem("mateusz-job-profile", JSON.stringify(defaultProfile));
      localStorage.setItem("mateusz-location-version", "leeds-v1");
    }
    queueMicrotask(() => {
      if (savedProfile) setProfile(savedProfile);
      setAlerts(savedAlerts);
      setShowWhatsapp(savedShowWhatsapp);
      if (a === "green" || a === "yellow" || a === "red") setAvailability(a);
    });
  }, []);
  useEffect(() => {
    void loadWorkerStatus();
    const token = new URLSearchParams(window.location.search).get("connect")?.trim() || "";
    if (token) {
      queueMicrotask(() => {
        setPendingConnectionToken(token);
        setActive("Worker Card");
        void loadConnectionInvite(token);
      });
    }
    // Initial identity and invite resolution only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!cvToast) return;
    const timer = window.setTimeout(() => setCvToast(null), 4500);
    return () => window.clearTimeout(timer);
  }, [cvToast]);
  const visible = useMemo(
    () =>
      jobs.filter(
        (j) =>
          (filter === "All" || j.status === filter) &&
          `${j.company} ${j.role} ${j.area}`
            .toLowerCase()
            .includes(jobsFilterQuery.toLowerCase()),
      ),
    [jobs, filter, jobsFilterQuery],
  );
  const employerRecords = useMemo(() => {
    const grouped = new Map<string, Job[]>();
    visible.forEach((job) => grouped.set(job.company, [...(grouped.get(job.company) || []), job]));
    return [...grouped.entries()].map(([company, companyJobs]) => {
      const current = companyJobs.find((job) => ["Reply", "Interview", "Offer"].includes(job.status)) || companyJobs[0];
      const contactJob = companyJobs.find((job) => job.phone || job.contact.includes("@")) || current;
      return { company, area: current.area, contact: contactJob.contact, phone: contactJob.phone, whatsapp: companyJobs.some((job) => job.whatsapp), agency: companyJobs.some((job) => Boolean(job.agency)), source: current.source || sourceLabel(current), jobs: companyJobs, current };
    });
  }, [visible]);
  function resetLiveSearchSession() {
    setLiveSearchJobs(null);
    setSearchSessionQuery("");
    setSearchBatch(0);
    setSearchMeta(null);
    setSearchNeedsSignIn(false);
    setGlobalSearchStatus("idle");
    setGlobalSearchError("");
  }
  function updateJobSearchCriteria<K extends keyof JobSearchCriteria>(key: K, value: JobSearchCriteria[K]) {
    setJobSearchCriteria((current) => ({ ...current, [key]: value }));
    resetLiveSearchSession();
  }
  async function runGlobalSearch(requestedKind: GlobalSearchKind = globalSearchKind) {
    const value = query.trim();
    if (!value) return;
    const searchKey = liveSearchKey(value, jobSearchCriteria, selectedJobTypes);
    setGlobalSearchKind(requestedKind);
    if (requestedKind === "Work") {
      setActive("Applications");
      setAskNexusModal(false);
      setFilter("All");
    } else {
      setActive("Overview");
    }
    setGlobalSearchError("");
    setSearchNeedsSignIn(false);
    if (requestedKind === "Work") {
      const savedPending = readPendingLiveSearch();
      const resumable = savedPending?.query === searchKey ? savedPending : null;
      const continuing = searchSessionQuery === searchKey && liveSearchJobs !== null;
      const currentResults = continuing ? liveSearchJobs || [] : [];
      const nextBatch = resumable?.batch || (continuing ? searchBatch + 1 : 1);
      setSearchBatch(nextBatch);
      if (!continuing) {
        setLiveSearchJobs(null);
        setSearchMeta(null);
      }
      setGlobalSearchStatus("running");
      try {
        const existing = [...jobs, ...currentResults].map(({ company, role, area, applicationLink }) => ({ company, role, area, applicationLink }));
        let tasks = resumable?.tasks || [];
        let laneErrors = resumable?.laneErrors || [];
        let pollAfterMs = LIVE_SEARCH_POLL_INTERVAL_MS;
        if (!tasks.length) {
          const response = await fetch("/api/autopilot", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ query: value, batch: nextBatch, profile, jobTypes: selectedJobTypes, criteria: jobSearchCriteria, existing }),
          });
          const started = await response.json().catch(() => ({}));
          const startedTasks = normalizeBackgroundTasks(started.tasks);
          if (!response.ok || response.status !== 202 || !startedTasks.length) {
            const failure = new Error(started.error || "Live AI search could not start.") as Error & { code?: string };
            failure.code = started.code;
            throw failure;
          }
          tasks = startedTasks;
          laneErrors = normalizeLaneErrors(started.laneErrors);
          pollAfterMs = Number(started.pollAfterMs) || LIVE_SEARCH_POLL_INTERVAL_MS;
          savePendingLiveSearch({ tasks, query: searchKey, batch: nextBatch, startedAt: Date.now(), laneErrors });
        }
        let data: Record<string, unknown> | null = null;
        let consecutiveConnectionFailures = 0;
        for (let poll = 0; poll < LIVE_SEARCH_MAX_POLLS; poll += 1) {
          await waitForSearchPoll(pollAfterMs);
          let response: Response;
          try {
            response = await fetch("/api/autopilot", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ action: "poll", tasks, laneErrors, batch: nextBatch, criteria: jobSearchCriteria, existing }),
            });
          } catch {
            consecutiveConnectionFailures += 1;
            if (consecutiveConnectionFailures <= 4) continue;
            throw new Error("Connection was interrupted. Tap Search again to resume the same live search.");
          }
          const progress = await response.json().catch(() => ({}));
          if (response.status === 202) {
            consecutiveConnectionFailures = 0;
            pollAfterMs = Number(progress.pollAfterMs) || LIVE_SEARCH_POLL_INTERVAL_MS;
            continue;
          }
          if (!response.ok) {
            if (progress.terminal === true) clearPendingLiveSearch(tasks);
            if (progress.terminal !== true && consecutiveConnectionFailures < 4) {
              consecutiveConnectionFailures += 1;
              continue;
            }
            const failure = new Error(progress.error || "Live AI search is unavailable.") as Error & { code?: string };
            failure.code = progress.code;
            throw failure;
          }
          data = progress;
          clearPendingLiveSearch(tasks);
          break;
        }
        if (!data) throw new Error("Search is still running. Tap Search again to resume it without starting over.");
        const normalized: Job[] = (Array.isArray(data.jobs) ? data.jobs : []).map((job: Partial<Job>, i: number) => ({
          id: job.id || Date.now() + i,
          company: job.company || "Employer",
          role: job.role || "New opportunity",
          area: job.area || "Leeds",
          status: "New",
          date: "Today",
          shift: job.shift || "Check listing",
          contact: job.contact || "",
          phone: job.phone || "",
          whatsapp: Boolean(job.whatsapp),
          ...job,
        } as Job));
        const added = mergeUniqueVacancies(currentResults, normalized, 20);
        const merged = [...currentResults, ...added];
        setLiveSearchJobs(merged);
        setSearchSessionQuery(searchKey);
        setSearchBatch(Number(data.batch) || nextBatch);
        setSearchMeta({
          batch: Number(data.batch) || nextBatch,
          requested: Number(data.requested) || 20,
          returned: added.length,
          candidates: Number(data.totalCandidates) || 0,
          sourceGroups: Number(data.sourceGroups) || 0,
          webSearchCalls: Number(data.webSearchCalls) || 0,
          webSearchActions: Number(data.webSearchActions) || 0,
          consultedSources: Number(data.consultedSources) || 0,
          directCandidates: Number(data.directCandidates) || 0,
          rejected: Number(data.rejected) || 0,
          partial: data.partial !== false,
          freshnessDays: Number(data.freshnessDays) || 30,
          newDays: Number(data.newDays) || 7,
          newThisWeek: Number(data.newThisWeek) || 0,
          datedCurrent: Number(data.datedCurrent) || 0,
          activeWithoutDate: Number(data.activeWithoutDate) || 0,
          freshAfter: String(data.freshAfter || ""),
          laneErrors: Array.isArray(data.laneErrors) ? data.laneErrors as Array<{ lane: string; message: string }> : [],
        });
        setJobs((current) => [...mergeUniqueVacancies(current, added, 20), ...current]);
        setGlobalSearchStatus("idle");
      } catch (error) {
        setGlobalSearchStatus("error");
        setGlobalSearchError(error instanceof Error ? error.message : "Live AI search is unavailable.");
        setSearchNeedsSignIn(Boolean(error && typeof error === "object" && "code" in error && error.code === "sign_in_required"));
      }
    }
    window.setTimeout(() => document.getElementById(requestedKind === "Work" ? "jobs-live-search" : "work-search-results")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }
  async function shareWorkCard() {
    const text = `${profile.name}\nAvailability: ${availability === "red" ? "Busy" : availability === "yellow" ? `Ready on ${displayDate}` : "Available"}\nRoles: Site joiner, working foreman, sales, painter, delivery driver\nLocation: Leeds, West Yorkshire\nWork preferences: ${profile.preferredWork}\nTravel: ${profile.travel}`;
    if (navigator.share) await navigator.share({ title: `${profile.name} - NOSMO Work Card`, text });
    else await navigator.clipboard.writeText(text);
  }
  async function workerApi<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`/api/worker${path}`, {
      credentials: "same-origin",
      ...init,
      headers: {
        ...(init.body ? { "content-type": "application/json" } : {}),
        ...init.headers,
      },
    });
    const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) {
      const error = new Error(typeof payload.error === "string" ? payload.error : `HTTP_${response.status}`) as Error & { status?: number };
      error.status = response.status;
      throw error;
    }
    return payload as T;
  }
  function availabilityFromServer(value: unknown): AvailabilityValue | null {
    if (value === "available") return "green";
    if (value === "busy") return "red";
    if (value === "ready_on_date") return "yellow";
    return null;
  }
  function workerStatusBody(next: AvailabilityValue, availableFrom: string, currentProfile = profile) {
    return {
      status: next === "green" ? "available" : next === "red" ? "busy" : "ready_on_date",
      availableFrom: next === "yellow" ? availableFrom : null,
      displayName: currentProfile.name,
      primaryTrade: selectedJobTypes[0] || "Joinery",
      targetRoles: selectedJobTypes.length
        ? selectedJobTypes
        : ["Site joiner", "Fire door installer", "Working foreman"],
      location: "Leeds, West Yorkshire",
      preferredWork: currentProfile.preferredWork,
      preferredShifts: currentProfile.preferredShifts,
      travel: currentProfile.travel,
    };
  }
  async function loadWorkerStatus() {
    setAvailabilitySyncState("loading");
    try {
      const result = await workerApi<{
        persisted: boolean;
        connectedAgencies: ConnectedAgency[];
        profile: null | { availability: { status?: string; availableFrom?: string | null }; updatedAt?: string };
      }>("/status");
      const serverAvailability = availabilityFromServer(result.profile?.availability.status);
      if (serverAvailability) {
        setAvailability(serverAvailability);
        localStorage.setItem("mateusz-availability", serverAvailability);
      }
      const serverDate = result.profile?.availability.availableFrom;
      if (serverDate) {
        setProfile((current) => {
          const next = { ...current, availableFrom: serverDate };
          localStorage.setItem("mateusz-job-profile", JSON.stringify(next));
          return next;
        });
      }
      setConnectedAgencies(result.connectedAgencies || []);
      setAvailabilitySyncedAt(result.profile?.updatedAt || "");
      setAvailabilitySyncState(result.connectedAgencies?.length ? "synced" : "saved");
    } catch (error) {
      setAvailabilitySyncState((error as Error & { status?: number }).status === 401 ? "sign-in-required" : "error");
    }
  }
  async function syncAvailability(next: AvailabilityValue, availableFrom: string, currentProfile = profile) {
    setAvailabilitySyncState("loading");
    try {
      const result = await workerApi<{
        updatedAt: string;
        connectedAgencies: ConnectedAgency[];
      }>("/status", {
        method: "PATCH",
        body: JSON.stringify(workerStatusBody(next, availableFrom, currentProfile)),
      });
      setConnectedAgencies(result.connectedAgencies || []);
      setAvailabilitySyncedAt(result.updatedAt || new Date().toISOString());
      setAvailabilitySyncState(result.connectedAgencies?.length ? "synced" : "saved");
      return true;
    } catch (error) {
      setAvailabilitySyncState((error as Error & { status?: number }).status === 401 ? "sign-in-required" : "error");
      return false;
    }
  }
  async function loadConnectionInvite(token: string) {
    setConnectionNotice("Checking secure agency invitation...");
    try {
      const result = await workerApi<{
        agency: ConnectedAgency;
        suggestedTrade: string | null;
        suggestedLocation: string | null;
        expiresAt: string;
      }>(`/connection?token=${encodeURIComponent(token)}`);
      setConnectionInvite({ token, ...result });
      setConnectionNotice("");
    } catch (error) {
      const status = (error as Error & { status?: number }).status;
      setConnectionNotice(status === 401
        ? "Sign in with ChatGPT to review this agency connection."
        : "This agency connection link is unavailable or has expired.");
    }
  }
  async function acceptAgencyConnection() {
    if (!connectionInvite) return;
    setConnectingAgency(true);
    setConnectionNotice("Saving your status and connecting the agency...");
    const statusSaved = await syncAvailability(availability, profile.availableFrom);
    if (!statusSaved) {
      setConnectionNotice("Your status could not be saved. Sign in and try again.");
      setConnectingAgency(false);
      return;
    }
    try {
      await workerApi("/connection", {
        method: "POST",
        body: JSON.stringify({
          token: connectionInvite.token,
          displayName: profile.name,
          primaryTrade: selectedJobTypes[0] || "Joinery",
          location: "Leeds, West Yorkshire",
        }),
      });
      setConnectionNotice(`${connectionInvite.agency.name} is connected. Future status changes update automatically.`);
      setConnectionInvite(null);
      setPendingConnectionToken("");
      window.history.replaceState({}, "", window.location.pathname);
      await loadWorkerStatus();
    } catch {
      setConnectionNotice("The agency could not be connected. Ask them for a new secure link.");
    } finally {
      setConnectingAgency(false);
    }
  }
  function openAgencyPackManual() {
    const clearedDetails = { ...agencyPackDetails, address: "", shareCode: "", shareCodeExpiry: "" };
    setAgencyReplyState("review");
    setAgencyReplyAnalysis(EMPTY_AGENCY_REPLY);
    setAgencyReplyFileName("");
    setAgencyPackSelections([]);
    setAgencyPackContactId("");
    setAgencyPackDetails(clearedDetails);
    setAgencyPackNotice("");
    setAgencyPackDraft(agencyPackMessage(profile.name, EMPTY_AGENCY_REPLY, [], clearedDetails));
    setAgencyPackOpen(true);
  }
  function toggleAgencyPackItem(item: AgencyPackItemKey) {
    const next = agencyPackSelections.includes(item)
      ? agencyPackSelections.filter((selected) => selected !== item)
      : [...agencyPackSelections, item];
    setAgencyPackSelections(next);
    setAgencyPackDraft(agencyPackMessage(profile.name, agencyReplyAnalysis, next, agencyPackDetails));
    setAgencyPackNotice("");
  }
  function updateAgencyPackDetails(update: Partial<AgencyPackDetails>) {
    const next = { ...agencyPackDetails, ...update };
    setAgencyPackDetails(next);
    setAgencyPackDraft(agencyPackMessage(profile.name, agencyReplyAnalysis, agencyPackSelections, next));
    setAgencyPackNotice("");
  }
  function agencyPackMissingDetails() {
    const missing: string[] = [];
    if (agencyPackSelections.includes("references") && (!agencyPackDetails.referenceOne.trim() || !agencyPackDetails.referenceTwo.trim())) missing.push("both references");
    if (agencyPackSelections.includes("right_to_work") && !agencyPackDetails.shareCode.trim()) missing.push("Right to Work share code");
    if (agencyPackSelections.includes("address") && !agencyPackDetails.address.trim()) missing.push("current address");
    return missing;
  }
  async function analyseAgencyReplyScreenshot(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    const clearedDetails = { ...agencyPackDetails, address: "", shareCode: "", shareCodeExpiry: "" };
    setAgencyPackOpen(true);
    setAgencyReplyState("analysing");
    setAgencyReplyFileName(file.name);
    setAgencyReplyAnalysis(EMPTY_AGENCY_REPLY);
    setAgencyPackSelections([]);
    setAgencyPackContactId("");
    setAgencyPackDetails(clearedDetails);
    setAgencyPackDraft(agencyPackMessage(profile.name, EMPTY_AGENCY_REPLY, [], clearedDetails));
    setAgencyPackNotice("Nexus is reading only the agency request. Nothing will be shared.");
    if (!file.type.startsWith("image/") || !file.size || file.size > NEXUS_DOCUMENT_MAX_BYTES) {
      setAgencyReplyState("error");
      setAgencyPackNotice("Choose a JPG, PNG or WEBP screenshot smaller than 10 MB.");
      return;
    }
    const id = `${Date.now()}-agency-reply-${Math.random().toString(36).slice(2, 8)}`;
    try {
      await saveLocalFile(`nosmo-import-${id}`, file);
      rememberImports([{
        id,
        source: "Screenshots",
        title: file.name,
        detail: "Saved locally for an Agency Reply Pack review. No document or message was shared.",
        importedAt: new Date().toISOString(),
        phoneCount: 0,
        emailCount: 0,
      }]);
      const formData = new FormData();
      formData.append("file", file, file.name);
      formData.append("context", "agency_reply");
      const response = await fetch("/api/nexus-import", { method: "POST", body: formData });
      const payload = await response.json().catch(() => ({})) as { analysis?: NexusImportAnalysis; error?: string };
      if (!response.ok || !payload.analysis) throw new Error(payload.error || "Nexus could not read this screenshot.");
      const reply = payload.analysis.agencyReply || EMPTY_AGENCY_REPLY;
      setAgencyReplyAnalysis(reply);
      const nameNeedles = [reply.contactName, reply.agencyName].map((value) => value.trim().toLowerCase()).filter(Boolean);
      const matchingContact = agencyContacts.find((contact) => nameNeedles.some((needle) => contact.name.toLowerCase().includes(needle) || needle.includes(contact.name.toLowerCase())));
      setAgencyPackContactId(matchingContact?.id || "");
      setAgencyPackDraft(agencyPackMessage(profile.name, reply, [], clearedDetails));
      setAgencyReplyState("review");
      setAgencyPackNotice(reply.isAgencyReply
        ? "Request recognised. Tick only the information you approve for this agency."
        : "Nexus could not confirm a document request. Review the screenshot and prepare the pack manually if needed.");
    } catch (error) {
      setAgencyReplyState("error");
      setAgencyPackNotice(error instanceof Error ? error.message : "Nexus could not read this screenshot.");
    }
  }
  async function copyAgencyPackDraft() {
    const missing = agencyPackMissingDetails();
    if (missing.length) {
      setAgencyPackNotice(`Complete ${missing.join(" and ")} before copying.`);
      return;
    }
    if (!agencyPackDraft.trim()) return;
    try {
      await navigator.clipboard.writeText(agencyPackDraft.trim());
      setAgencyPackNotice("Message copied. Paste it into the correct WhatsApp chat and check it before sending.");
    } catch {
      setAgencyPackNotice("Copy was blocked by the browser. Select the message text and copy it manually.");
    }
  }
  function openAgencyPackWhatsApp() {
    const missing = agencyPackMissingDetails();
    if (missing.length) {
      setAgencyPackNotice(`Complete ${missing.join(" and ")} before opening WhatsApp.`);
      return;
    }
    const contact = agencyContacts.find((agency) => agency.id === agencyPackContactId);
    openExternal(whatsappUrl(contact?.phones[0] || "", agencyPackDraft.trim()));
    setAgencyPackNotice(contact?.phones[0]
      ? `WhatsApp opened for ${contact.name}. Check attachments and press Send yourself.`
      : "WhatsApp opened with the draft. Choose the intended agency, check attachments and press Send yourself.");
  }
  async function shareAgencyPackFiles() {
    if (!agencyPackDocuments.length) {
      setAgencyPackNotice("No matching saved file is available. Open Documents and attach the requested file manually.");
      return;
    }
    const files = (await Promise.all(agencyPackDocuments.map(async (document) => {
      const stored = await readLocalFile(smartDocumentStorageKey(document)).catch(() => undefined);
      return stored ? new File([stored], document.fileName, { type: document.fileType || stored.type }) : undefined;
    }))).filter((file): file is File => Boolean(file));
    if (!files.length) {
      setAgencyPackNotice("The selected originals are no longer available on this device.");
      return;
    }
    try {
      if (navigator.share && navigator.canShare?.({ files })) {
        await navigator.share({ title: `${profile.name} - requested work documents`, files });
        setAgencyPackNotice(`System share opened with ${files.length} approved file${files.length === 1 ? "" : "s"}. Verify the recipient before sending.`);
      } else {
        setAgencyPackNotice("This browser cannot share several files. Open Documents and attach them in WhatsApp manually.");
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") setAgencyPackNotice("The file share menu did not open. Try attaching the files from Documents.");
    }
  }
  function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setJobs((v) => [
      {
        id: Date.now(),
        company: String(f.get("company")),
        role: String(f.get("role")),
        area: String(f.get("area") || "Leeds"),
        status: "To apply",
        date: "Today",
        shift: String(f.get("shift") || "Flexible"),
        contact: String(f.get("contact") || ""),
        phone: String(f.get("phone") || ""),
        whatsapp: Boolean(f.get("whatsapp")),
      },
      ...v,
    ]);
    setModal(false);
  }
  function parseCsv(text: string, mode: "merge" | "replace" = "merge") {
    const imported = parseJobsCsv(text);
    if (!imported.length) return;
    if (mode === "replace") setJobs(imported);
    else setJobs((v) => [
        ...imported.filter(
          (n) => !v.some((j) => j.company === n.company && j.role === n.role),
        ),
        ...v,
      ]);
    setModal(false);
  }
  function importFile(file?: File) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => parseCsv(String(reader.result || ""));
    reader.readAsText(file);
  }
  async function downloadJobsSheet() {
    const sheet = await readLocalFile("Jobs.csv").catch(() => undefined);
    downloadFile(sheet || new File([jobsCsv(jobs)], "Jobs.csv", { type: "text/csv" }));
  }
  async function downloadContactsSheet(format: "xlsx" | "csv") {
    if (format === "csv") {
      const sheet = await readLocalFile("NOSMO-Work-Contacts.csv").catch(() => undefined);
      downloadFile(sheet || new File([contactsCsv(workContacts)], "NOSMO-Work-Contacts.csv", { type: "text/csv" }));
      return;
    }
    const workbook = await readLocalFile("NOSMO-Work-Contacts.xlsx").catch(() => undefined);
    downloadFile(workbook || await makeContactsWorkbook(workContacts));
  }
  const discovered: Job[] = seed.slice(0, 3);
  function addDiscovered() {
    setJobs((v) => [
      ...discovered.filter(
        (n) => !v.some((j) => j.company === n.company && j.role === n.role),
      ),
      ...v,
    ]);
    setSearchStep("found");
  }
  async function runAutopilot() {
    setAutopilotStep("running");
    setAutopilotError("");
    try {
      const response = await fetch("/api/autopilot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ profile, jobTypes: selectedJobTypes, existing: jobs.map(({ company, role }) => ({ company, role })) }),
      });
      if (!response.ok) throw new Error("Live search is not connected yet.");
      const data = await response.json();
      if (!Array.isArray(data.jobs) || !data.jobs.length) throw new Error("No verified live jobs were returned.");
      const found = data.jobs;
    const normalized: Job[] = found.map((job: Partial<Job>, i: number) => ({
      id: job.id || Date.now() + i,
      company: job.company || "Employer",
      role: job.role || "New opportunity",
      area: job.area || "Leeds",
      status: "To apply",
      date: "Today",
      shift: job.shift || "Check listing",
      contact: job.contact || "",
      phone: job.phone || "",
      whatsapp: Boolean(job.whatsapp),
      ...job,
    } as Job));
    setJobs((current) => [...normalized.filter((n) => !current.some((j) => j.company === n.company && j.role === n.role)), ...current]);
    setAutopilotCount(normalized.length);
    setAutopilotStep("done");
    } catch (error) {
      setAutopilotError(error instanceof Error ? error.message : "Live search is unavailable.");
      setAutopilotCount(0);
      setAutopilotStep("done");
    }
  }
  function applyJob(job: Job) {
    if (isDirectVacancyUrl(job.applicationLink)) {
      setJobs((v) =>
        v.map((j) =>
          j.id === job.id
            ? {
                ...j,
                status: "To apply",
                note: `${j.note || ""} Manual portal opened today; confirm submission to mark Applied.`.trim(),
              }
            : j,
        ),
      );
      setSelected({
        ...job,
        note: `${job.note || ""} Manual portal opened today; confirm submission to mark Applied.`.trim(),
      });
      openExternal(job.applicationLink);
      return;
    }
    if (job.contact.includes("@")) {
      window.location.href = `mailto:${job.contact}?subject=${encodeURIComponent(`Application: ${job.role} – ${profile.name}`)}`;
      setJobs((v) =>
        v.map((j) =>
          j.id === job.id ? { ...j, status: "To apply", date: "Today", note: `${j.note || ""} Email draft opened; confirm it was sent before marking Applied.`.trim() } : j,
        ),
      );
      setSelected({ ...job, status: "To apply", date: "Today", note: `${job.note || ""} Email draft opened; confirm it was sent before marking Applied.`.trim() });
    }
  }
  function update(s: Status) {
    if (!selected) return;
    const event = { date: "Today", status: s, note: s === "Applied" ? "Application marked as sent by the worker." : `Status changed to ${s}.` };
    const changed = { ...selected, status: s, date: "Today", applicationHistory: [...(selected.applicationHistory || []), event] };
    setJobs((v) =>
      v.map((j) =>
        j.id === selected.id ? changed : j,
      ),
    );
    setSelected(changed);
  }
  function setFollowUp(value: string) {
    if (!selected) return;
    const changed = { ...selected, followUp: value };
    setJobs((items) => items.map((job) => job.id === selected.id ? changed : job));
    setSelected(changed);
  }
  function removeJob() {
    if (!selected) return;
    setJobs((v) => v.filter((j) => j.id !== selected.id));
    setSelected(null);
  }
  function saveProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const next = {
      name: String(f.get("name")),
      email: String(f.get("email")),
      applicationEmail: String(f.get("applicationEmail")),
      availableFrom: String(f.get("availableFrom")),
      travel: String(f.get("travel")),
      preferredWork: String(f.get("preferredWork")),
      preferredShifts: String(f.get("preferredShifts")),
    };
    setProfile(next);
    localStorage.setItem("mateusz-job-profile", JSON.stringify(next));
    void syncAvailability(availability, next.availableFrom, next);
    setProfileModal(false);
  }
  async function saveProfilePhoto(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setProfilePhotoNotice("Choose a photo file.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setProfilePhotoNotice("The photo is too large. Maximum size is 10 MB.");
      return;
    }
    try {
      await saveLocalFile(PROFILE_PHOTO_KEY, file);
      setProfilePhotoUrl(URL.createObjectURL(file));
      setProfilePhotoNotice("Profile photo saved on this device.");
    } catch {
      setProfilePhotoNotice("The photo could not be saved. Try again.");
    }
  }
  function setAvailabilityState(next: AvailabilityValue) {
    let nextProfile = profile;
    if (next === "yellow") {
      const today = new Date().toISOString().slice(0, 10);
      if (!profile.availableFrom || profile.availableFrom < today) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        nextProfile = { ...profile, availableFrom: tomorrow.toISOString().slice(0, 10) };
        setProfile(nextProfile);
        localStorage.setItem("mateusz-job-profile", JSON.stringify(nextProfile));
      }
    }
    setAvailability(next);
    localStorage.setItem("mateusz-availability", next);
    setAvailabilityMenu(null);
    void syncAvailability(next, nextProfile.availableFrom, nextProfile);
  }
  function chooseAvailabilityDate(value: string) {
    const next = { ...profile, availableFrom: value };
    setProfile(next);
    localStorage.setItem("mateusz-job-profile", JSON.stringify(next));
    const nextAvailability: AvailabilityValue = value ? "yellow" : "green";
    setAvailability(nextAvailability);
    localStorage.setItem("mateusz-availability", nextAvailability);
    setAvailabilityMenu(null);
    void syncAvailability(nextAvailability, value, next);
  }
  async function createCv(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const title = String(data.get("cvTitle") || "General CV").trim() || "General CV";
    const lines = [
      profile.name,
      `${profile.email} | ${String(data.get("phone") || "")}`,
      "",
      title.toUpperCase(),
      "",
      "PROFILE",
      String(data.get("summary") || "Reliable and motivated candidate seeking work in the Leeds area."),
      "",
      "EXPERIENCE",
      String(data.get("experience") || "Details to be discussed at interview."),
      "",
      "SKILLS",
      String(data.get("skills") || "Reliable, punctual, organised and able to work as part of a team."),
      "",
      "EDUCATION & TRAINING",
      String(data.get("education") || "Available on request."),
      "",
      `AVAILABILITY: ${String(data.get("availability") || profile.preferredShifts)}`,
      oldCv ? `Source CV supplied: ${oldCv.name}` : "",
      "References available on request.",
    ].filter(Boolean);
    const [{ jsPDF }, docx] = await Promise.all([import("jspdf"), import("docx")]);
    const pdf = new jsPDF({ unit: "pt", format: "a4" });
    let y = 54;
    lines.forEach((line, i) => {
      const wrapped = pdf.splitTextToSize(line, 490);
      pdf.setFont("helvetica", i === 0 || line === line.toUpperCase() ? "bold" : "normal");
      pdf.setFontSize(i === 0 ? 20 : 10);
      pdf.text(wrapped, 52, y);
      y += wrapped.length * (i === 0 ? 24 : 14) + (line === "" ? 5 : 0);
    });
    const fileStem = `${safeFileStem(profile.name)}_${safeFileStem(title)}`;
    const pdfFile = new File([pdf.output("blob")], `${fileStem}.pdf`, { type: "application/pdf" });
    const document = new docx.Document({ sections: [{ children: lines.map((line, i) => new docx.Paragraph({ text: line, heading: i === 0 ? docx.HeadingLevel.TITLE : line === line.toUpperCase() && line.length < 30 ? docx.HeadingLevel.HEADING_1 : undefined })) }] });
    const docxFile = new File([await docx.Packer.toBlob(document)], `${fileStem}.docx`, { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    const id = String(Date.now());
    const tags = inferCvJobTypes(`${title} ${String(data.get("experience") || "")} ${String(data.get("skills") || "")}`);
    const record: DynamicCv = { id, title, file: pdfFile, tags };
    const nextDynamic = [...dynamicCvs, record];
    setDynamicCvs(nextDynamic);
    setSelectedJobTypes((current) => [...new Set([...current, ...tags])]);
    localStorage.setItem("mateusz-dynamic-cvs", JSON.stringify(nextDynamic.map(({id,title,tags}) => ({id,title,tags}))));
    await Promise.all([saveLocalFile(`dynamic-cv-${id}`, pdfFile), saveLocalFile(`dynamic-cv-docx-${id}`, docxFile)]);
    setCvToast(`${title} (PDF + DOCX)`);
    setCvBuilder(false);
    setOldCv(null);
  }
  async function shareFile(file: File, title: string) {
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ title, files: [file] });
      return;
    }
    downloadFile(file);
  }
  async function importReadyCv(file?: File) {
    if (!file) return;
    const id = String(Date.now());
    const cleanName = file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
    let readableText = "";
    if (/text|rtf/.test(file.type) || /\.(txt|rtf)$/i.test(file.name)) readableText = await file.text().catch(() => "");
    const tags = inferCvJobTypes(`${cleanName} ${readableText}`);
    const record: DynamicCv = { id, title: cleanName || "Imported CV", file, tags };
    const next = [...dynamicCvs, record];
    setDynamicCvs(next);
    setSelectedJobTypes((current) => [...new Set([...current, ...tags])]);
    localStorage.setItem("mateusz-dynamic-cvs", JSON.stringify(next.map(({id,title,tags}) => ({id,title,tags}))));
    await saveLocalFile(`dynamic-cv-${id}`, file);
    setCvToast(`${record.title} · ${tags.join(", ")}`);
  }
  function downloadFile(file: File) {
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function saveCvsToDownloads() {
    dynamicCvs.forEach((cv) => downloadFile(cv.file));
    for (const cv of dynamicCvs) {
      const docx = await readLocalFile(`dynamic-cv-docx-${cv.id}`).catch(() => undefined);
      if (docx) downloadFile(docx);
    }
  }
  const displayDate = profile.availableFrom
    ? new Date(profile.availableFrom + "T12:00:00").toLocaleDateString(
        "en-GB",
        { day: "numeric", month: "long", year: "numeric" },
      )
    : "Not set";
  const availabilityLabel = availability === "red"
    ? "Busy"
    : availability === "yellow"
      ? `Ready on ${displayDate}`
      : "Available";
  const localFolder = `${profile.name || "Worker"} - Work`;
  const smartDocumentIds = new Set(smartDocuments.map((document) => document.id));
  const standaloneCvs = dynamicCvs.filter((cv) => !smartDocumentIds.has(cv.id));
  const documentCounts: Record<DocumentCategory, number> = {
    All: smartDocuments.length + standaloneCvs.length + 4,
    CVs: dynamicCvs.length,
    "Cards & licences": 2 + smartDocuments.filter((document) => document.category === "Cards & licences").length,
    "Certificates & training": 1 + smartDocuments.filter((document) => document.category === "Certificates & training").length,
    "ID / Right to Work": 1 + smartDocuments.filter((document) => document.category === "ID / Right to Work").length,
    Other: smartDocuments.filter((document) => document.category === "Other").length,
  };
  const drawingDocuments = smartDocuments.filter((document) => document.documentType === "drawing");
  function renderNexusImportReview() {
    if (!nexusImportItems.length) return null;
    return <div className="nexus-import-list">
      {nexusImportItems.map((item) => {
        const analysis = item.analysis;
        const profileChanges = analysis ? Object.values(analysis.profile).filter(Boolean).length : 0;
        const drawing = analysis?.drawing;
        return <article key={item.id} className={`nexus-import-item ${item.state}`}>
          <i>{item.state === "analysing" || item.state === "queued" ? <Clock3 /> : item.state === "error" ? <X /> : analysis?.documentType === "drawing" ? <DraftingCompass /> : <FileText />}</i>
          <div className="nexus-import-copy">
            <b>{analysis?.title || item.file.name}</b>
            <small>{item.state === "analysing" ? "Nexus is reading and classifying this file..." : item.state === "queued" ? "Waiting for analysis..." : item.state === "error" ? item.error : item.state === "applied" ? "Added to your private workspace" : `${nexusDocumentLabel(analysis!.documentType)} · ${Math.round(analysis!.confidence * 100)}% confidence`}</small>
            {analysis && item.state !== "applied" && <>
              <p>{analysis.summary || "No summary was available."}</p>
              <div className="nexus-extracted-tags">
                <em>{analysis.category}</em>
                {drawing?.drawingNumber && <em>Drawing {drawing.drawingNumber}</em>}
                {drawing?.revision && <em>Rev {drawing.revision}</em>}
                {drawing?.discipline && <em>{drawing.discipline}</em>}
                {analysis.document.issuer && <em>{analysis.document.issuer}</em>}
                {analysis.document.expiryDate && <em>Expires {analysis.document.expiryDate}</em>}
                {analysis.skills.slice(0, 4).map((skill) => <em key={skill}>{skill}</em>)}
              </div>
              <small className="nexus-destinations">
                Will add to Documents
                {analysis.documentType === "cv" ? " + CV search profile" : ""}
                {analysis.documentType === "job_advert" && analysis.job.role ? " + Jobs" : ""}
                {analysis.documentType === "drawing" ? " + Drawings" : ""}
                {profileChanges ? " + empty Worker Card fields" : ""}
              </small>
              {analysis.warnings.length > 0 && <p className="nexus-warning">Check: {analysis.warnings.join(" · ")}</p>}
            </>}
          </div>
          <div className="nexus-import-actions">
            {item.state === "review" && <button className="approve" onClick={() => void applyNexusImport(item)}><Check />Approve & add</button>}
            {item.state !== "analysing" && item.state !== "queued" && <button aria-label={`Remove ${item.file.name}`} onClick={() => dismissNexusImportItem(item.id)}><X />{item.state === "applied" ? "Done" : "Remove"}</button>}
          </div>
        </article>;
      })}
    </div>;
  }
  return (
    <main className="shell">
      <section className="work">
        <div className="worker-nexus-bar">
          <button aria-label="Open Ask Nexus" aria-expanded={askNexusModal} onClick={() => setAskNexusModal(true)}>
            <img src="/nexus-logo-ui-mark-n.png" alt="NEXUS"/>
            <span><small>ASK NEXUS</small><b>{ui.askPrompt}</b></span>
            <ChevronDown />
          </button>
        </div>
        <header>
          <b className="mobile-title">NOSMO Work</b>
          <button className="bell">
            <Bell />
            <i />
          </button>
        </header>
        <div className="content">
          {active === "Overview" && (
            <section className="home-person">
              <button className="home-avatar" onClick={() => setActive("Worker Card")} aria-label="View Worker Card">{profile.name.split(" ").map((part) => part[0]).join("").slice(0,2)}</button>
              <div><small>NOSMO WORK</small><h1>{profile.name || "Worker"}</h1><p>{profile.preferredWork}</p></div>
              <button className={`home-availability ${availability}`} onClick={() => setActive("Worker Card")}><i/>{availabilityLabel}<ChevronRight/></button>
            </section>
          )}
          {active === "Overview" && (
            <section id="work-search" className="unified-search unified-search-primary panel">
              <div className="unified-search-title"><Bot/><div><small>NOSMO WORK AGENT</small><h2>What are you looking for?</h2></div></div>
              <div className="unified-search-kinds" role="radiogroup" aria-label="Search category">
                {(["Work", "Tools & materials"] as GlobalSearchKind[]).map((kind) => <button key={kind} role="radio" aria-checked={globalSearchKind === kind} className={globalSearchKind === kind ? "on" : ""} onClick={() => setGlobalSearchKind(kind)}>{kind}</button>)}
              </div>
              <div className="unified-search-box"><Search/><input disabled={globalSearchStatus === "running"} value={query} onChange={(e) => { setQuery(e.target.value); resetLiveSearchSession(); }} onKeyDown={(e) => { if (e.key === "Enter") runGlobalSearch(); }} placeholder={globalSearchKind === "Tools & materials" ? "e.g. impact driver, OSB boards, 5x80 screws" : "Role, company, agency, location, rate or hours"}/><button disabled={globalSearchStatus === "running"} onClick={() => runGlobalSearch()}>{globalSearchStatus === "running" ? "Searching..." : "Search"}</button></div>
              <p>{globalSearchKind === "Tools & materials" ? "Compare merchants, collection and delivery. Nothing is ordered without your final confirmation." : "Search runs in the background. Progress is checked automatically and short connection drops are retried."}</p>
            </section>
          )}
          {active === "Overview" && query.trim() && (
            <section id="work-search-results" className="home-search-results">
              <div className="home-results-head"><div><small>SEARCH RESULTS</small><h2>{globalSearchKind}</h2></div><span>{globalSearchKind === "Work" ? `${liveSearchJobs?.length ?? 0} saved in this search` : "Search options"}</span></div>
              {globalSearchKind === "Work" && globalSearchStatus === "running" && <div className="search-live-state panel"><i/><b>Ask Nexus is searching 4 source groups for batch {searchBatch || 1}...</b><small>Job boards, agencies, employers and local sources run independently. Progress is checked automatically.</small></div>}
              {globalSearchKind === "Work" && globalSearchStatus === "error" && <div className="search-live-error panel"><b>Live search did not complete</b><small>{globalSearchError}</small>{searchNeedsSignIn && <a className="search-signin" href="/signin-with-chatgpt?return_to=%2F" target="_top">Sign in with ChatGPT</a>}</div>}
              {globalSearchKind === "Work" && liveSearchJobs && <>
                {searchMeta && <div className="search-batch-summary"><Check/><span><b>Batch {searchMeta.batch}: {searchMeta.returned} current direct {searchMeta.returned === 1 ? "vacancy" : "vacancies"}</b><small>{searchBatchDetail(searchMeta)}</small></span></div>}
                {liveSearchJobs.length ? <div className="panel"><Table jobs={liveSearchJobs} open={setSelected}/></div> : <div className="search-empty panel"><Search/><b>No current direct vacancies in this batch</b><small>{searchEmptyDetail(searchMeta, true)}</small></div>}
                {globalSearchStatus === "idle" && <div className="search-more"><small>Each background batch finds up to 20 direct vacancies. Dated results use your saved freshness limit; undated results must pass a live-page check. Results are appended and duplicates are skipped.</small><button onClick={() => runGlobalSearch()}>Search next 20</button></div>}
              </>}
              {globalSearchKind === "Tools & materials" && <section className="tool-search panel"><div className="merchant-results">{[{name:"Screwfix",note:"Check live price, local stock and Click & Collect",url:"https://www.screwfix.com/search?search="},{name:"Toolstation",note:"Compare delivery and collection options",url:"https://www.toolstation.com/search?q="},{name:"Wickes",note:"Check materials and delivery availability",url:"https://www.wickes.co.uk/search?text="}].map((merchant) => <article key={merchant.name}><Building2/><div><b>{merchant.name}</b><small>{merchant.note}</small></div><button onClick={() => openExternal(merchant.url + encodeURIComponent(query))}>Open search <ExternalLink/></button></article>)}</div><div className="order-safety"><Check/><div><b>Worker confirmation required</b><p>Nothing is ordered or paid for until you review the basket and confirm it.</p></div></div></section>}
            </section>
          )}
          {(active === "Applications" || active === "Employers") && (
            <>
              <div className="jobs-command-row">
                <div className="apply-switch" role="tablist" aria-label="Jobs workspace">
                  <button role="tab" aria-selected={active === "Applications"} className={active === "Applications" ? "on" : ""} onClick={() => setActive("Applications")}><BriefcaseBusiness/>Jobs</button>
                  <button role="tab" aria-selected={active === "Employers"} className={active === "Employers" ? "on" : ""} onClick={() => { setFilter("All"); setActive("Employers"); }}><Building2/>Employers</button>
                </div>
                <button className="jobs-add-button" onClick={() => setModal(true)}><Plus/>Add job</button>
              </div>
              {active === "Applications" && (
                <section id="jobs-live-search" className="jobs-live-search panel">
                  <header>
                    <div className="unified-search-title"><Bot/><div><small>NOSMO WORK AGENT</small><h2>Find work</h2></div></div>
                    <span className="jobs-saved-count">{jobs.length} saved</span>
                  </header>
                  <div className="unified-search-box">
                    <Search/>
                    <input
                      disabled={globalSearchStatus === "running"}
                      value={query}
                      onChange={(e) => { setQuery(e.target.value); resetLiveSearchSession(); }}
                      onKeyDown={(e) => { if (e.key === "Enter") runGlobalSearch("Work"); }}
                      placeholder="Role, trade, company or keywords"
                    />
                    <button disabled={globalSearchStatus === "running" || !query.trim()} onClick={() => runGlobalSearch("Work")}>
                      {globalSearchStatus === "running"
                        ? "Searching..."
                        : liveSearchJobs !== null && searchSessionQuery === liveSearchKey(query, jobSearchCriteria, selectedJobTypes)
                          ? "Search next 20"
                          : "Search"}
                    </button>
                  </div>
                  <details className="jobs-search-preferences">
                    <summary>
                      <span><b>Search preferences</b><small>{jobSearchCriteria.location || "Any location"} · {jobSearchCriteria.radiusMiles} miles · last {jobSearchCriteria.postedWithinDays} days · {jobSearchCriteria.workPattern}</small></span>
                      <ChevronDown/>
                    </summary>
                    <div className="jobs-search-criteria" aria-label="Job search criteria">
                      <label><span>Location</span><input disabled={globalSearchStatus === "running"} value={jobSearchCriteria.location} onChange={(e) => updateJobSearchCriteria("location", e.target.value)} placeholder="Leeds"/></label>
                      <label><span>Distance</span><select disabled={globalSearchStatus === "running"} value={jobSearchCriteria.radiusMiles} onChange={(e) => updateJobSearchCriteria("radiusMiles", Number(e.target.value) as JobSearchCriteria["radiusMiles"])}><option value="5">5 miles</option><option value="15">15 miles</option><option value="30">30 miles</option><option value="50">50 miles</option></select></label>
                      <label><span>Posted within</span><select disabled={globalSearchStatus === "running"} value={jobSearchCriteria.postedWithinDays} onChange={(e) => updateJobSearchCriteria("postedWithinDays", Number(e.target.value) as JobSearchCriteria["postedWithinDays"])}><option value="7">7 days</option><option value="14">14 days</option><option value="30">30 days</option></select></label>
                      <label><span>Work type</span><select disabled={globalSearchStatus === "running"} value={jobSearchCriteria.workPattern} onChange={(e) => updateJobSearchCriteria("workPattern", e.target.value as JobSearchCriteria["workPattern"])}><option>Any</option><option>Contract</option><option>Permanent</option><option>Temporary</option></select></label>
                    </div>
                  </details>
                  <p className="jobs-search-promise"><Check/><span>Up to 20 verified direct vacancies per batch. New results are saved here automatically; duplicates are skipped.</span></p>
                  {globalSearchStatus === "running" && <div className="search-live-state"><i/><b>Searching 4 source groups for batch {searchBatch || 1}...</b><small>Job boards, agencies, employers and local sources run independently.</small></div>}
                  {globalSearchStatus === "error" && <div className="search-live-error"><b>Live search did not complete</b><small>{globalSearchError}</small>{searchNeedsSignIn && <a className="search-signin" href="/signin-with-chatgpt?return_to=%2F" target="_top">Sign in with ChatGPT</a>}</div>}
                  {searchMeta && globalSearchStatus === "idle" && <div className="search-batch-summary"><Check/><span><b>Batch {searchMeta.batch}: {searchMeta.returned} new {searchMeta.returned === 1 ? "job" : "jobs"} saved in Jobs</b><small>{searchBatchDetail(searchMeta)}</small></span></div>}
                </section>
              )}
              <div className="jobs-library-toolbar">
                <div className="jobs-library-heading">
                  <small>{active === "Employers" ? "CONTACTS" : "SAVED JOBS"}</small>
                  <b>{active === "Employers" ? `${employerRecords.length} employers and agencies` : `${visible.length} of ${jobs.length} jobs`}</b>
                </div>
                <div className="jobs-library-actions">
                  <div className="search">
                    <Search />
                    <input
                      value={jobsFilterQuery}
                      onChange={(e) => setJobsFilterQuery(e.target.value)}
                      placeholder={active === "Employers" ? "Find employer or agency..." : "Filter saved jobs..."}
                    />
                  </div>
                  {active === "Applications" && (
                    <label className="jobs-status-picker">
                      <span>Status</span>
                      <select aria-label="Filter jobs by status" value={filter} onChange={(event) => setFilter(event.target.value as Status | "All")}>
                        {(["All", "New", "To apply", "Applied", "Reply", "Interview", "Offer", "Rejected", "Closed"] as const).map((status) => <option key={status}>{status}</option>)}
                      </select>
                      <ChevronDown/>
                    </label>
                  )}
                </div>
              </div>
              {active !== "Employers" ? (
                <>
                  {(filter === "All" || filter === "New") && (
                    <section id="jobs-live-results" className="panel jobs-new-results">
                      <Head title={`New jobs (${visible.filter((job) => job.status === "New").length})`} text="Fresh vacancies found by Ask Nexus and saved automatically"/>
                      <Table jobs={visible.filter((job) => job.status === "New")} open={setSelected}/>
                    </section>
                  )}
                  {filter !== "New" && <ApplicationsTracker jobs={visible.filter((job) => job.status !== "New")} open={setSelected} />}
                </>
              ) : (
                <div className="employers compact-employers">
                  {employerRecords.map((employer) => (
                    <article key={employer.company}>
                      <Logo name={employer.company}/>
                      <div className="employer-summary"><h3>{employer.company}</h3><p><MapPin />{employer.area}</p></div>
                      <em className={tone[employer.current.status]}>{employer.current.status}</em>
                      <div className="compact-contact-actions">
                        <a
                          className={!employer.phone ? "disabled" : ""}
                          href={employer.phone ? `tel:${employer.phone}` : undefined}
                          aria-label={`Call ${employer.company}`}
                        >
                          <Phone />
                        </a>
                        <a
                          className={!employer.contact.includes("@") ? "disabled" : ""}
                          href={
                            employer.contact.includes("@")
                              ? `mailto:${employer.contact}`
                              : undefined
                          }
                          aria-label={`Email ${employer.company}`}
                        >
                          <Mail />
                        </a>
                        {showWhatsapp && (
                          <a
                            className={
                              employer.whatsapp && employer.phone ? "wa" : "disabled"
                            }
                            href={
                              employer.whatsapp && employer.phone
                                ? whatsappUrl(employer.phone, `Hello, I am contacting you about work opportunities with ${employer.company}.`)
                                : undefined
                            }
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`WhatsApp ${employer.company}`}
                          >
                            <MessageCircle />
                          </a>
                        )}
                      </div>
                      <small className="employer-inline-meta">{employer.agency ? "Agency" : "Employer"} · {employer.jobs.filter((job) => !["New", "To apply"].includes(job.status)).length} confirmed · {nextAction(employer.current)}</small>
                      <button className="role" onClick={() => setSelected(employer.current)}>
                        <span>{employer.jobs.length} {employer.jobs.length === 1 ? "job" : "jobs"}</span>
                        <ChevronRight />
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}
          {active === "Documents" && (
            <>
              <header className="documents-page-head">
                <div>
                  <small>PRIVATE WORK FILES</small>
                  <h1>Documents</h1>
                  <p>{documentCounts.All} saved · CVs, cards, certificates and work evidence</p>
                </div>
                <label className="documents-add-button">
                  <Upload />Add files
                  <input
                    type="file"
                    multiple
                    accept={NEXUS_DOCUMENT_ACCEPT}
                    onChange={(event) => {
                      void analyseNexusFiles(event.target.files);
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
              </header>
              <div className="documents-intake-note">
                <Bot />
                <span><b>Nexus sorts every selected file</b><small>Review before save · up to 5 files, 10 MB each · nothing is added until you approve</small></span>
              </div>
              {(nexusImportNotice || nexusImportItems.length > 0) && <section className="nexus-document-intake nexus-document-review panel" aria-label="Nexus document review">
                {nexusImportNotice && <p className="nexus-intake-notice">{nexusImportNotice}</p>}
                {renderNexusImportReview()}
              </section>}
              <details className="document-agency-action">
                <summary><MessageCircle /><span><b>Agency document request</b><small>Prepare a controlled reply only when a recruiter asks</small></span><ChevronDown /></summary>
                <div>
                  <p>Nexus can read the recruiter&apos;s screenshot. You approve every document and private detail before WhatsApp opens.</p>
                  <span>
                    <label><Camera />Read screenshot<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { void analyseAgencyReplyScreenshot(event.target.files); event.currentTarget.value = ""; }} /></label>
                    <button type="button" onClick={openAgencyPackManual}>Prepare manually</button>
                  </span>
                </div>
              </details>
              <nav className="document-categories" aria-label="Document categories">
                {(["All", "CVs", "Cards & licences", "Certificates & training", "ID / Right to Work", "Other"] as DocumentCategory[]).map((category) => {
                  const count = documentCounts[category];
                  return (
                  <button key={category} className={documentCategory === category ? "on" : ""} onClick={() => setDocumentCategory(category)}>
                    <span><b>{category}</b><small>{count}</small></span>
                  </button>
                  );
                })}
              </nav>
              {documentCategory === "CVs" && <section className="cv-library">
                <div className="cv-command-bar">
                  <button type="button" onClick={() => setCvBuilder(true)}><Plus/><span><b>{dynamicCvs.length ? "Create another CV" : "Create a CV"}</b><small>Build a focused PDF and DOCX</small></span></button>
                  <label><Upload/><span><b>Import ready CV</b><small>PDF, DOC, DOCX, TXT, RTF or ODT</small></span><input type="file" accept=".pdf,.doc,.docx,.txt,.rtf,.odt,application/pdf,text/plain" onChange={(event) => { importReadyCv(event.target.files?.[0]); event.currentTarget.value = ""; }}/></label>
                </div>
                <div className="cv-document-list panel">
                  {dynamicCvs.map((cv) => (
                    <article key={cv.id}>
                      <i><FileText/></i>
                      <span className="cv-document-copy"><b>{cv.title}</b><small>{cv.file.name} · Private on this device</small><span>{cv.tags.map((tag) => <em key={tag}>{tag}</em>)}</span></span>
                      <span className="cv-document-actions"><button className="cv-file-button cv-open" onClick={() => { const url=URL.createObjectURL(cv.file); window.location.assign(url); }}>Open</button><button className="cv-file-button cv-share" onClick={() => shareFile(cv.file, cv.title)}>Share</button></span>
                    </article>
                  ))}
                  {!dynamicCvs.length && <div className="cv-private-empty"><ShieldCheck/><span><b>No CV saved yet</b><small>Create one or import an existing file. Personal documents are never included in the public app.</small></span></div>}
                </div>
              </section>}
              {documentCategory !== "CVs" && <section className="document-register panel">
                <div className="panel-head"><h2>{documentCategory === "All" ? "All documents" : documentCategory}</h2><p>Private files stored in your NOSMO Work record.</p></div>
                {[
                  ["CSCS Skilled Worker", "Card · valid until 18 Mar 2027", "VALID", "Cards & licences"],
                  ["SMSTS Certificate", "Training · expires 04 Nov 2026", "EXPIRING", "Certificates & training"],
                  ["Full UK Driving Licence", "Licence · no expiry stored", "NO EXPIRY", "Cards & licences"],
                  ["Right to Work", "Private record · verification only", "PRIVATE", "ID / Right to Work"],
                ].filter((doc) => documentCategory === "All" || doc[3] === documentCategory).map((doc) => <button key={doc[0]}><FileText/><span><b>{doc[0]}</b><small>{doc[1]}</small></span><em className={doc[2] === "EXPIRING" ? "pill amber" : doc[2] === "PRIVATE" ? "pill grey" : "pill green"}>{doc[2]}</em><ChevronRight/></button>)}
                {smartDocuments.filter((document) => documentCategory === "All" || document.category === documentCategory).map((document) => {
                  const status = nexusDocumentStatus(document.status);
                  const detail = [nexusDocumentLabel(document.documentType), document.issuer, document.expiryDate ? `expires ${document.expiryDate}` : "", document.documentNumberMasked].filter(Boolean).join(" · ");
                  return <button key={document.id} className="smart-document-row" onClick={() => void openSmartDocument(document)}>
                    <Bot/><span><b>{document.title}</b><small>{detail || document.fileName}</small></span><em className={status === "EXPIRING" ? "pill amber" : status === "EXPIRED" ? "pill red" : status === "SAVED" ? "pill grey" : "pill green"}>{status}</em><ChevronRight/>
                  </button>;
                })}
                {documentCategory === "All" && standaloneCvs.map((cv) => <button key={`all-${cv.id}`} onClick={() => { const url=URL.createObjectURL(cv.file); const link=window.document.createElement("a"); link.href=url; link.target="_blank"; link.rel="noopener noreferrer"; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 60_000); }}><FileText/><span><b>{cv.title}</b><small>CV · {cv.file.name} · saved on this device</small></span><em className="pill green">READY</em><ChevronRight/></button>)}
                {documentCategory === "Other" && documentCounts.Other === 0 && <div className="empty"><FileText/><b>No other documents yet</b><small>Add site evidence, references or another work document here.</small></div>}
              </section>}
            </>
          )}
          {active === "Drawings" && (
            <>
              <Title
                eyebrow="PROJECT INFORMATION"
                title="Drawings"
                text="Keep site drawings together. Nexus reads the title block and records the project, drawing number, revision, discipline and scale."
              />
              <section className="nexus-document-intake drawings-intake panel" aria-labelledby="drawings-upload-title">
                <header>
                  <i><DraftingCompass /></i>
                  <div>
                    <small>ASK NEXUS · DRAWING INTAKE</small>
                    <h2 id="drawings-upload-title">Add a drawing</h2>
                    <p>Upload a PDF or a clear photo of the drawing. Nexus reads the title block before anything is added.</p>
                  </div>
                  <label className="nexus-upload-button">
                    <Upload />Choose drawings
                    <input
                      type="file"
                      multiple
                      accept={NEXUS_DRAWING_ACCEPT}
                      aria-label="Upload construction drawings"
                      onChange={(event) => {
                        void analyseNexusFiles(event.target.files, "drawing");
                        event.currentTarget.value = "";
                      }}
                    />
                  </label>
                </header>
                <div className="nexus-intake-trust"><ShieldCheck /><span><b>Review the title block</b><small>Up to 5 files, 10 MB each. Confirm the drawing number and revision before saving. Originals stay on this device.</small></span></div>
                {nexusImportNotice && <p className="nexus-intake-notice">{nexusImportNotice}</p>}
                {renderNexusImportReview()}
              </section>
              <section className="drawings-register panel" aria-labelledby="drawings-register-title">
                <header>
                  <div><small>DRAWING REGISTER</small><h2 id="drawings-register-title">Project drawings</h2></div>
                  <em>{drawingDocuments.length} saved</em>
                </header>
                {drawingDocuments.length ? <div className="drawings-grid">
                  {drawingDocuments.map((document) => {
                    const drawing = document.drawing;
                    const drawingTitle = drawing?.drawingTitle || document.title;
                    const drawingNumber = drawing?.drawingNumber || document.fileName;
                    const drawingContext = [drawing?.discipline, drawing?.scale ? `Scale ${drawing.scale}` : "", drawing?.status].filter(Boolean).join(" · ");
                    return <button key={document.id} className="drawing-card" onClick={() => void openSmartDocument(document)}>
                      <i><DraftingCompass /></i>
                      <span>
                        <small>{drawing?.project || "PROJECT DRAWING"}</small>
                        <b>{drawingTitle}</b>
                        <strong>{drawingNumber}</strong>
                        <em>{drawingContext || `Saved ${new Date(document.importedAt).toLocaleDateString("en-GB")}`}</em>
                      </span>
                      <mark>{drawing?.revision ? `REV ${drawing.revision}` : "SAVED"}</mark>
                      <ChevronRight />
                    </button>;
                  })}
                </div> : <div className="drawings-empty"><DraftingCompass /><b>No drawings saved yet</b><small>Add a PDF or a clear site photo. Nexus will prepare the drawing register entry for your approval.</small></div>}
              </section>
            </>
          )}
          {active === "Worker Card" && (
            <>
              <section className="profile panel">
                <div className="profile-top">
                  <label className="profile-photo-picker" title="Add or change profile photo">
                    <span className="profile-photo-circle">
                      {profilePhotoUrl ? <img src={profilePhotoUrl} alt={`${profile.name} profile`} /> : initials(profile.name)}
                    </span>
                    <i aria-hidden="true"><Camera /></i>
                    <input
                      type="file"
                      accept="image/*"
                      aria-label="Add or change profile photo"
                      onChange={(event) => {
                        void saveProfilePhoto(event.target.files?.[0]);
                        event.target.value = "";
                      }}
                    />
                  </label>
                  <div>
                    <h2>{profile.name}</h2>
                    <p>Joinery · Sales · Painter · Delivery</p>
                    <small>
                      <MapPin />
                      Leeds, West Yorkshire · Full UK driving licence
                    </small>
                  </div>
                  <div className="profile-actions">
                    <button onClick={() => setProfileModal(true)}>Edit</button>
                    <button className="share-profile" onClick={shareWorkCard}><Send/>Share</button>
                  </div>
                </div>
                {profilePhotoNotice && <div className="profile-photo-notice" role="status"><Check />{profilePhotoNotice}</div>}
                {connectionInvite && (
                  <section className="worker-connection-invite" aria-labelledby="worker-connection-title">
                    <ShieldCheck />
                    <div>
                      <small>ONE-TIME AGENCY CONNECTION</small>
                      <h3 id="worker-connection-title">Connect {connectionInvite.agency.name}?</h3>
                      <p>Approve recruiter-safe Work Profile access. Your live status will then update in Agency automatically; no availability messages are sent.</p>
                      {(connectionInvite.suggestedTrade || connectionInvite.suggestedLocation) && <em>{[connectionInvite.suggestedTrade, connectionInvite.suggestedLocation].filter(Boolean).join(" · ")}</em>}
                    </div>
                    <button type="button" disabled={connectingAgency} onClick={() => void acceptAgencyConnection()}>{connectingAgency ? "Connecting..." : "Connect agency"}</button>
                  </section>
                )}
                {!connectionInvite && pendingConnectionToken && availabilitySyncState === "sign-in-required" && (
                  <section className="worker-connection-invite needs-sign-in">
                    <ShieldCheck />
                    <div><small>SECURE AGENCY CONNECTION</small><h3>Sign in to review this link</h3><p>The invitation stays pending until you explicitly approve it.</p></div>
                    <a href={`/signin-with-chatgpt?return_to=${encodeURIComponent(`/?connect=${pendingConnectionToken}`)}`} target="_top">Sign in</a>
                  </section>
                )}
                <section className="availability-command" aria-labelledby="availability-command-title">
                  <div className="availability-command-head">
                    <div>
                      <small>LIVE WORK STATUS</small>
                      <h3 id="availability-command-title">Availability</h3>
                      <p>One status. Connected agencies update automatically.</p>
                    </div>
                    <div className="availability-picker card-availability-picker">
                      <button type="button" className="availability-led-trigger" aria-haspopup="menu" aria-expanded={availabilityMenu === "card"} onClick={() => setAvailabilityMenu(availabilityMenu === "card" ? null : "card")}>
                        <i className={`availability-led ${availability}`} aria-hidden="true" /><span>{availabilityLabel}</span><ChevronDown />
                      </button>
                      {availabilityMenu === "card" && <div className="availability-menu-popover" role="menu">
                        <button role="menuitemradio" aria-checked={availability === "green"} onClick={() => setAvailabilityState("green")}><i className={`availability-led green ${availability === "green" ? "lit" : "unlit"}`}/><span><b>Available</b><small>Ready for work now</small></span></button>
                        <button role="menuitemradio" aria-checked={availability === "red"} onClick={() => setAvailabilityState("red")}><i className={`availability-led red ${availability === "red" ? "lit" : "unlit"}`}/><span><b>Busy</b><small>Not taking work now</small></span></button>
                        <label className={availability === "yellow" ? "on" : ""}><i className={`availability-led yellow ${availability === "yellow" ? "lit" : "unlit"}`}/><span><b>Ready on date</b><small>Choose the first day</small></span><CalendarDays/><input type="date" value={profile.availableFrom} min={new Date().toISOString().slice(0, 10)} onInput={(event) => { chooseAvailabilityDate(event.currentTarget.value); setAvailabilityMenu(null); }} /></label>
                      </div>}
                    </div>
                  </div>
                  <div className={`availability-sync-row ${availabilitySyncState}`} role="status">
                    <ShieldCheck />
                    <span>
                      <b>{availabilitySyncState === "synced"
                        ? `Shared with ${connectedAgencies.length} connected agenc${connectedAgencies.length === 1 ? "y" : "ies"}`
                        : availabilitySyncState === "saved"
                          ? "Saved on this device"
                          : availabilitySyncState === "loading"
                            ? "Updating status..."
                            : availabilitySyncState === "sign-in-required"
                              ? "Sign in for agency sync"
                              : "Agency sync unavailable"}</b>
                      <small>{availabilitySyncState === "synced"
                        ? `${connectedAgencies.map((agency) => agency.name).join(", ")}${availabilitySyncedAt ? ` · updated ${new Date(availabilitySyncedAt).toLocaleString("en-GB")}` : ""}`
                        : availabilitySyncState === "saved"
                          ? "No agency connected yet."
                          : availabilitySyncState === "sign-in-required"
                            ? "Your device status is unchanged."
                            : availabilitySyncState === "error"
                              ? "Your device status is unchanged."
                              : "No message is sent."}</small>
                    </span>
                    {availabilitySyncState === "sign-in-required"
                      ? <a href="/signin-with-chatgpt?return_to=%2F" target="_top">Sign in</a>
                      : availabilitySyncState === "error"
                        ? <button type="button" onClick={() => void syncAvailability(availability, profile.availableFrom)}>Retry</button>
                        : null}
                  </div>
                  {connectionNotice && <small className="worker-connection-notice"><Check />{connectionNotice}</small>}
                </section>
                <details className="worker-card-details">
                  <summary><span><b>Work profile</b><small>Preferences, skills, projects and references</small></span><ChevronDown /></summary>
                  <div className="fields">
                  {[
                    ["Email", profile.email],
                    ["Application email", profile.applicationEmail],
                    ["Travel", profile.travel],
                    ["Preferred work", profile.preferredWork],
                    ["Preferred shifts", profile.preferredShifts],
                  ].map((x) => (
                    <label key={x[0]}>
                      {x[0]}
                      <b>{x[1]}</b>
                    </label>
                  ))}
                  </div>
                  <div className="work-card-columns">
                  <article><small>RECENT PROJECTS</small><h3>Tesco national refurbishment programme</h3><p>Site Joiner · Dormy / Optimal FM · 2026</p><h3>Seven-storey residential development</h3><p>Finishing, snagging and final handover · Big Red Construction · 2025</p></article>
                  <article><small>SKILLS</small><div className="work-tags"><span>2nd Fix</span><span>Fire Doors</span><span>Fit-out</span><span>Snagging</span><span>Drawings</span><span>Working foreman</span></div><small>LICENCES & TICKETS</small><p>CSCS Skilled Worker · SMSTS · Full UK driving licence</p></article>
                  <article><small>REFERENCES & NOTES</small><h3>Daniel Pelc</h3><p>Site Manager · previous project · Ready</p><h3>Big Red Construction</h3><p>Final handover project · Available on request</p><p>Employer and agency notes remain private until the worker chooses to share them.</p></article>
                  </div>
                </details>
              </section>
            </>
          )}
          {active === "Apps" && (
            <section className="nexus-command-page" aria-labelledby="apps-command-title">
              <header className="nexus-command-head">
                <div>
                  <span className="nexus-command-identity"><small>NOSMO WORK</small><em>Powered by NEXUS</em></span>
                  <h1 id="apps-command-title">{ui.appsTitle}</h1>
                  <p>{ui.appsIntro}</p>
                </div>
                <span className="nexus-command-security" title="Private launcher"><ShieldCheck/></span>
              </header>

              <div className="nexus-command-section-title"><small>{ui.workTools}</small><span/></div>
              <section className="nexus-command-grid" aria-label="Work tools">
                <button type="button" className="nexus-command-module" onClick={()=>setActive("Drawings")}><i className="nexus-command-icon"><DraftingCompass/></i><span>{ui.drawings}</span><em className="nexus-command-signal is-core" aria-hidden="true"/></button>
                <label className="nexus-upload-app">
                  <span className="nexus-command-module nexus-command-upload" role="button" tabIndex={0} onKeyDown={(event)=>{if(event.key === "Enter" || event.key === " "){event.preventDefault();event.currentTarget.querySelector("input")?.click()}}}>
                    <i className="nexus-command-icon"><Upload/></i><span>{ui.nexusUpload}</span><em className="nexus-command-signal is-core" aria-hidden="true"/>
                    <input
                      type="file"
                      multiple
                      accept={NEXUS_DOCUMENT_ACCEPT}
                      aria-label="Upload files to Nexus"
                      onChange={(event) => {
                        const files = event.target.files;
                        if (files?.length) {
                          setDocumentCategory("All");
                          setActive("Documents");
                          void analyseNexusFiles(files);
                        }
                        event.currentTarget.value = "";
                      }}
                    />
                  </span>
                </label>
                <button type="button" className="nexus-command-module" onClick={()=>{setWorkPhoto(null);setCameraMessage("");setWorkCameraModal(true)}}><i className="nexus-command-icon"><Camera/></i><span>{ui.workCamera}</span><em className="nexus-command-signal is-core" aria-hidden="true"/></button>
                <button type="button" className="nexus-command-module" onClick={()=>{setDocumentCategory("ID / Right to Work");setActive("Documents")}}><i className="nexus-command-icon"><ShieldCheck/></i><span>{ui.privateVault}</span><em className="nexus-command-signal is-core" aria-hidden="true"/></button>
              </section>

              <details className="nexus-command-disclosure">
                <summary>
                  <span><small>{ui.connectedApps}</small><b>{ui.connectedAppsHelp}</b></span>
                  <em>{ui.appsCount}</em>
                  <ChevronDown/>
                </summary>
                <section className="nexus-command-grid nexus-command-grid--external" aria-label="Connected work apps">
                  {[
                    {name:"Gmail",src:"/app-icons/gmail.svg",glyph:"",icon:null,url:"https://mail.google.com/",tone:"gmail"},
                    {name:"WhatsApp",src:"/app-icons/whatsapp.svg",glyph:"",icon:null,url:whatsappUrl(),tone:"whatsapp"},
                    {name:"Call",src:"",glyph:"",icon:Phone,url:"tel:",tone:"call"},
                    {name:"Messages",src:"",glyph:"",icon:Send,url:"sms:",tone:"messages"},
                    {name:"Indeed",src:"/app-icons/indeed.svg",glyph:"",icon:null,url:"https://uk.indeed.com/",tone:"indeed"},
                    {name:"LinkedIn",src:"",glyph:"in",icon:null,url:"https://www.linkedin.com/jobs/",tone:"linkedin"},
                    {name:"Reed",src:"",glyph:"R•••",icon:null,url:"https://www.reed.co.uk/jobs",tone:"reed"},
                    {name:"Totaljobs",src:"",glyph:"tj",icon:null,url:"https://www.totaljobs.com/",tone:"totaljobs"},
                    {name:"CV-Library",src:"",glyph:"CV",icon:null,url:"https://www.cv-library.co.uk/",tone:"cvlib"},
                    {name:"Drive",src:"/app-icons/drive.svg",glyph:"",icon:null,url:"https://drive.google.com/",tone:"drive"},
                    {name:"Calendar",src:"",glyph:"",icon:CalendarDays,url:"https://calendar.google.com/",tone:"calendar"},
                    {name:"CSCS / CITB",src:"",glyph:"CSCS",icon:null,url:"https://www.cscs.uk.com/",tone:"cscs"},
                  ].map((app)=>{const Icon=app.icon;return <button type="button" className={`nexus-command-module nexus-command-module--external tone-${app.tone}`} key={app.name} onClick={()=>openExternal(app.url)}><i className="nexus-command-icon">{app.src ? <img src={app.src} alt=""/> : Icon ? <Icon/> : <b className={`nexus-command-glyph glyph-${app.tone}`}>{app.glyph}</b>}</i><span>{app.name}</span><ExternalLink className="nexus-command-action" aria-hidden="true"/></button>})}
                </section>
              </details>

              <section className="nexus-command-manage" aria-label="App and import settings">
                <button type="button" onClick={openIntegrations}><i><Plus/></i><span><b>{ui.manageApps}</b><small>{ui.manageAppsHelp}</small></span><ChevronRight/></button>
                {(driveSetupState === "later" || driveSetupState === "started") && <button type="button" onClick={configureGoogleDrive}><i><CircleUserRound/></i><span><b>{ui.googleAccount}</b><small>{driveSetupState === "started" ? "Connected" : "Setup incomplete"}</small></span><ChevronRight/></button>}
              </section>

              <footer className="nexus-command-privacy"><ShieldCheck/><span>{ui.privateLauncher}</span></footer>
            </section>
          )}
          {active === "Settings" && (
            <>
              <header className="settings-page-head">
                <div><small>WORKSPACE</small><h1>{ui.settingsTitle}</h1><p>{ui.settingsIntro}</p></div>
                <span><ShieldCheck/>{ui.localByDefault}</span>
              </header>
              <section className="settings panel">
                <p className="settings-section-label">{ui.preferences}</p>
                <details className="settings-collapsible theme-setting">
                  <summary>
                    <span className="theme-setting-label">
                      {theme === "dark" ? <Moon /> : <Sun />}
                      <span><b>{ui.appearance}</b><small>{ui.appearanceHelp}</small></span>
                    </span>
                    <span className="settings-summary-value"><i className={`theme-dot ${themePreset}`}/><b>{selectedTheme.label}</b><ChevronDown/></span>
                  </summary>
                  <div className="theme-presets" role="group" aria-label={ui.colourTheme}>
                    {THEME_PRESETS.map((preset) => (
                      <button key={preset.id} className={themePreset === preset.id ? "on" : ""} aria-pressed={themePreset === preset.id} onClick={() => changeTheme(preset.id)}>
                        <i className={`theme-swatch ${preset.id}`}><span/><span/></i>
                        <span><b>{preset.label}</b><small>{preset.description[language]}</small></span>
                        {themePreset === preset.id && <Check/>}
                      </button>
                    ))}
                  </div>
                </details>
                <details className="settings-collapsible language-setting">
                  <summary>
                    <span className="theme-setting-label">
                      <Languages />
                      <span><b>{ui.language}</b><small>{ui.languageHelp}</small></span>
                    </span>
                    <span className="settings-summary-value"><b>{selectedLanguage.label[language]}</b><ChevronDown/></span>
                  </summary>
                  <div className="language-options" role="radiogroup" aria-label={ui.languageChoice}>
                    {LANGUAGE_OPTIONS.map((option) => (
                      <button key={option.id} role="radio" aria-checked={languagePreference === option.id} className={languagePreference === option.id ? "on" : ""} onClick={() => changeLanguage(option.id)}>
                        <Languages />
                        <span><b>{option.label[language]}</b><small>{option.description[language]}</small></span>
                        {languagePreference === option.id && <Check/>}
                      </button>
                    ))}
                  </div>
                </details>
                <button
                  id="worker-pwa-install"
                  type="button"
                  className="settings-action pwa-install-action"
                  data-state={pwaInstallState}
                  aria-describedby={pwaInstallHelp ? "worker-pwa-install-help" : undefined}
                  disabled={pwaInstallState === "installed" || pwaInstallState === "installing"}
                  onClick={() => void installWorkerApp()}
                >
                  <span>
                    <Download />
                    <span>
                      {language === "pl" ? "Zainstaluj NOSMO Work" : "Install NOSMO Work"}
                      <small>
                        {pwaOfflineReady
                          ? language === "pl" ? "Pliki trybu offline sa gotowe" : "Offline app files are ready"
                          : language === "pl" ? "Przygotowywanie trybu offline" : "Preparing offline app files"}
                      </small>
                    </span>
                  </span>
                  <b>
                    {pwaInstallState === "installed"
                      ? language === "pl" ? "Zainstalowano" : "Installed"
                      : pwaInstallState === "ready"
                        ? language === "pl" ? "Instaluj" : "Install"
                        : pwaInstallState === "installing"
                          ? language === "pl" ? "Instalowanie" : "Installing"
                          : language === "pl" ? "Jak zainstalowac" : "How to install"}
                  </b>
                  <ChevronRight />
                </button>
                {pwaInstallHelp && pwaInstallState !== "installed" && (
                  <div id="worker-pwa-install-help" className="pwa-install-help" role="status">
                    <Download />
                    <span>
                      <b>{language === "pl" ? "Instalacja z menu przegladarki" : "Install from the browser menu"}</b>
                      <small>
                        {language === "pl"
                          ? "Android Chrome: menu z trzema kropkami, Dodaj do ekranu glownego, a potem Instaluj. iPhone/iPad Safari: Udostepnij, Dodaj do ekranu poczatkowego."
                          : "Android Chrome: three-dot menu, Add to Home screen, then Install. iPhone/iPad Safari: Share, then Add to Home Screen."}
                      </small>
                      <small>{language === "pl" ? "Widok podstawowy dziala offline. Wyszukiwanie ofert nadal wymaga internetu." : "The core workspace works offline. Live job search still requires internet."}</small>
                    </span>
                  </div>
                )}
                <p className="settings-section-label">{ui.workControls}</p>
                <div>
                  <span>
                    <Bell />
                    {ui.replyAlerts}
                  </span>
                  <button
                    className={alerts ? "toggle" : "toggle off"}
                    aria-label={ui.replyAlerts}
                    aria-pressed={alerts}
                    onClick={() => {
                      const n = !alerts;
                      setAlerts(n);
                      localStorage.setItem("mateusz-alerts", n ? "on" : "off");
                    }}
                  >
                    <i />
                  </button>
                </div>
                <div>
                  <span>
                    <MessageCircle />
                    {ui.whatsappContacts}
                  </span>
                  <button
                    className={showWhatsapp ? "toggle" : "toggle off"}
                    aria-label={ui.whatsappContacts}
                    aria-pressed={showWhatsapp}
                    onClick={() => {
                      const n = !showWhatsapp;
                      setShowWhatsapp(n);
                      localStorage.setItem("mateusz-whatsapp", n ? "on" : "off");
                    }}
                  >
                    <i />
                  </button>
                </div>
                <button className="settings-action" onClick={openIntegrations}>
                  <span>
                    <Smartphone />
                    <span>
                      {ui.integrations}
                      <small>{ui.integrationsHelp}</small>
                    </span>
                  </span>
                  <b>{importRecords.length ? `${importRecords.length} ${ui.imported}` : ui.setUp}</b>
                  <ChevronRight />
                </button>
                <details className="settings-data-disclosure">
                  <summary>
                    <span className="theme-setting-label"><FolderOpen/><span><b>{ui.dataPrivacy}</b><small>{ui.dataHelp}</small></span></span>
                    <span className="settings-summary-value"><b>{ui.localByDefault}</b><ChevronDown/></span>
                  </summary>
                  <div className="settings-data-body">
                    <div className="settings-data-row"><span><CircleUserRound/>{ui.localFolder}</span><b>{profile.name || "User"} - Praca</b></div>
                    <div className="settings-data-row"><span><Check/>{ui.cvDatabase}</span><b>{ui.savedAutomatically}</b></div>
                    <div className="settings-data-actions">
                      <button className="settings-download" onClick={downloadJobsSheet}><Download/>{ui.downloadJobs}</button>
                      <button
                        className="settings-restore"
                        onClick={() => {
                          localStorage.removeItem("mateusz-job-hub");
                          setJobs(seed);
                        }}
                      ><Trash2/>{ui.restoreData}</button>
                    </div>
                  </div>
                </details>
                <small className="settings-version">NOSMO WORK · V1.0102</small>
              </section>
            </>
          )}
          {active === "Integrations" && (
            <>
              <header className="integrations-page-head">
                <button className="integrations-back" onClick={() => setActive("Settings")}><ChevronRight/>Settings</button>
                <div><small>PRIVATE WORKSPACE</small><h1>Imports & contacts</h1><p>Bring in work information only when you choose it.</p></div>
                <button className="integrations-help" onClick={() => setIntegrationGuideOpen(true)}>How it works</button>
              </header>
              <div className="integration-trust-line"><ShieldCheck/><span><b>You stay in control</b><small>NOSMO never silently reads your phone. Every contact, chat or image is selected by you.</small></span></div>
              {importNotice && <div className="integration-notice"><Check />{importNotice}</div>}
              <section className="work-contact-register panel" aria-labelledby="work-contacts-title">
                <header>
                  <div>
                    <small>WORK CONTACTS</small>
                    <h2 id="work-contacts-title">Contact register</h2>
                    <p>{workContacts.length} contact{workContacts.length === 1 ? "" : "s"} saved locally · {agencyContacts.length} agenc{agencyContacts.length === 1 ? "y" : "ies"} · {visibleWorkContacts.length} shown</p>
                  </div>
                  <div className="contact-export-actions">
                    <button onClick={() => void downloadContactsSheet("xlsx")} disabled={!workContacts.length}><Download />XLSX</button>
                    <button onClick={() => void downloadContactsSheet("csv")} disabled={!workContacts.length}><FileText />CSV</button>
                  </div>
                </header>
                <div className="contact-register-note"><ShieldCheck/><span><b>Nexus keeps names exactly as saved in your phone</b><small>Initial tags are suggested locally. Change a category immediately or open Tags to correct trade and region.</small></span></div>
                <div className="contact-register-filters">
                  <label className="contact-register-search"><Search/><input value={contactQuery} onChange={(event) => setContactQuery(event.target.value)} placeholder="Name, phone, email, trade or region"/></label>
                  <select aria-label="Contact category" value={contactCategory} onChange={(event) => setContactCategory(event.target.value as "All" | WorkContactCategory)}>
                    <option value="All">All categories</option>
                    {(["Agency", "Manager", "Worker", "Other"] as WorkContactCategory[]).map((category) => <option key={category}>{category}</option>)}
                  </select>
                  <select aria-label="Contact trade" value={contactTrade} onChange={(event) => setContactTrade(event.target.value)}>
                    <option value="All">All trades</option>
                    {contactTrades.map((trade) => <option key={trade}>{trade}</option>)}
                  </select>
                  <select aria-label="Contact region" value={contactRegion} onChange={(event) => setContactRegion(event.target.value)}>
                    <option value="All">All regions</option>
                    {contactRegions.map((region) => <option key={region}>{region}</option>)}
                  </select>
                </div>
                {!workContacts.length ? (
                  <div className="contact-register-empty"><CircleUserRound/><b>No work contacts yet</b><small>Select phone contacts below or import a VCF file. Each person will become a separate row.</small></div>
                ) : !visibleWorkContacts.length ? (
                  <div className="contact-register-empty"><Search/><b>No matching contacts</b><small>Change the search or one of the filters.</small></div>
                ) : (
                  <div className="contact-register-list">
                    {visibleWorkContacts.map((contact) => (
                      <article key={contact.id}>
                        <i>{initials(contact.name)}</i>
                        <div className="contact-register-person"><b>{contact.name}</b><small>{[contact.company, contact.role, contact.trade, contact.region, contact.source].filter(Boolean).join(" · ")}</small></div>
                        <select
                          className={`contact-category contact-category-select ${contact.category.toLowerCase()}`}
                          aria-label={`Category for ${contact.name}`}
                          value={contact.category}
                          onChange={(event) => updateWorkContact(contact.id, { category: event.target.value as WorkContactCategory })}
                        >
                          {(["Agency", "Manager", "Worker", "Other"] as WorkContactCategory[]).map((category) => <option key={category}>{category}</option>)}
                        </select>
                        <div className="contact-register-links">
                          <button type="button" className="contact-tag-button" onClick={() => setContactEditor(contact)}><Settings/>Tags</button>
                          {contact.phones[0] && <a href={`tel:${contact.phones[0]}`}><Phone/>{contact.phones[0]}{contact.phones.length > 1 ? ` +${contact.phones.length - 1}` : ""}</a>}
                          {showWhatsapp && contact.phones[0] && <a className="wa" href={whatsappUrl(contact.phones[0])} target="_blank" rel="noreferrer" aria-label={`WhatsApp ${contact.name}`}><MessageCircle/></a>}
                          {contact.emails[0] && <a href={`mailto:${contact.emails[0]}`}><Mail/>{contact.emails[0]}{contact.emails.length > 1 ? ` +${contact.emails.length - 1}` : ""}</a>}
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
              <details className="integration-source-disclosure">
                <summary>
                  <span><Upload/><span><b>Import from phone</b><small>WhatsApp, text messages, contacts or screenshots</small></span></span>
                  <em>4 sources</em>
                  <ChevronDown/>
                </summary>
                <section className="integration-grid" aria-label="Import sources">
                  <article>
                    <i><MessageCircle /></i>
                    <div><h3>WhatsApp</h3><p>Import an exported work chat. Names, phone numbers and email addresses are detected locally.</p><small>Android app: Share → NOSMO Work opens a review before saving.</small></div>
                    <label>Import chat<input type="file" accept=".txt,text/plain" onChange={(event) => { void importFiles("WhatsApp", event.target.files); event.target.value = ""; }} /></label>
                  </article>
                  <article>
                    <i><Send /></i>
                    <div><h3>Text messages</h3><p>Select an SMS export or shared text file to collect work-related numbers and email addresses.</p><small>No automatic inbox access.</small></div>
                    <label>Import file<input type="file" accept=".txt,.csv,.json,text/plain,text/csv,application/json" onChange={(event) => { void importFiles("Messages", event.target.files); event.target.value = ""; }} /></label>
                  </article>
                  <article>
                    <i><CircleUserRound /></i>
                    <div><h3>Contacts</h3><p>Choose individual phone contacts. On supported Android browsers the system contact picker opens directly.</p><small>Fallback: import a .vcf contact file.</small></div>
                    <button onClick={() => void importPhoneContacts()}>Select contacts</button>
                    <input id="nosmo-contact-file" hidden type="file" accept=".vcf,text/vcard,text/x-vcard" onChange={(event) => { void importFiles("Contacts", event.target.files); event.target.value = ""; }} />
                  </article>
                  <article>
                    <i><Camera /></i>
                    <div><h3>Screenshots & photos</h3><p>Read an agency reply with Nexus, or save other work images in the private inbox.</p><small>Android Share uses on-device OCR and always asks you to review the result.</small></div>
                    <span className="integration-file-actions"><label>Agency reply<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { void analyseAgencyReplyScreenshot(event.target.files); event.target.value = ""; }} /></label><label>Save images<input type="file" accept="image/*" multiple onChange={(event) => { void importFiles("Screenshots", event.target.files); event.target.value = ""; }} /></label></span>
                  </article>
                </section>
              </details>
              <details className="import-inbox integration-inbox-disclosure panel" key={importRecords.length ? "items" : "empty"} defaultOpen={importRecords.length > 0}>
                <summary>
                  <div><small>PRIVATE INBOX</small><h2>Imported items</h2><p>{importRecords.length} item{importRecords.length === 1 ? "" : "s"} saved on this device</p></div>
                  <span>{importRecords.length || "Empty"}<ChevronDown/></span>
                </summary>
                {importRecords.length > 0 && <div className="integration-inbox-actions"><button onClick={clearImportInbox}><Trash2 />Clear imported items</button></div>}
                {importRecords.length === 0 ? (
                  <div className="integration-empty"><Upload /><b>Nothing imported yet</b><small>Choose one source above. NOSMO will never scan everything automatically.</small></div>
                ) : importRecords.map((record) => (
                  <article key={record.id}>
                    <i>{record.source === "Screenshots" ? <Camera /> : record.source === "Contacts" ? <CircleUserRound /> : record.source === "Documents" ? <FileText /> : <MessageCircle />}</i>
                    <div><b>{record.title}</b><small>{record.source} · {new Date(record.importedAt).toLocaleString("en-GB")}</small><p>{record.detail}</p></div>
                    {(record.phoneCount > 0 || record.emailCount > 0) && <em>{record.phoneCount} tel · {record.emailCount} email</em>}
                  </article>
                ))}
              </details>
            </>
          )}
        </div>
      </section>
      <nav className="bottom-nav worker-bottom-nav">
        <button className={active === "Worker Card" ? "on" : ""} onClick={() => setActive("Worker Card")}><CircleUserRound/>{ui.workerCard}</button>
        <button className={active === "Documents" ? "on" : ""} onClick={() => setActive("Documents")}><FileText/>{ui.documents}</button>
        <button className={active === "Applications" || active === "Employers" ? "on" : ""} onClick={() => setActive("Applications")}><BriefcaseBusiness/>{ui.jobs}</button>
        <button className={active === "Apps" ? "on" : ""} onClick={() => setActive("Apps")}><Smartphone/>{ui.appsTitle}</button>
        <button className={active === "Settings" || active === "Integrations" ? "on" : ""} onClick={() => setActive("Settings")}><Settings/>{ui.settingsTitle}</button>
      </nav>
      {contactEditor && (
        <div className="backdrop" onMouseDown={() => setContactEditor(null)}>
          <form className="modal contact-tag-editor" onSubmit={saveContactTags} onMouseDown={(event) => event.stopPropagation()}>
            <div><span><small>WORK CONTACT</small><h2>Correct contact tags</h2></span><button type="button" aria-label="Close contact tags" onClick={() => setContactEditor(null)}><X /></button></div>
            <p className="contact-editor-name">{contactEditor.name}</p>
            <label>Category
              <select name="category" defaultValue={contactEditor.category}>
                {(["Agency", "Manager", "Worker", "Other"] as WorkContactCategory[]).map((category) => <option key={category}>{category}</option>)}
              </select>
            </label>
            <label>Trade or specialism<input name="trade" defaultValue={contactEditor.trade} placeholder="e.g. Recruitment, Joinery, Fire doors" /></label>
            <label>Region<input name="region" defaultValue={contactEditor.region} placeholder="e.g. Leeds, Yorkshire, Nationwide" /></label>
            <small className="contact-editor-note"><ShieldCheck />This changes only the private NOSMO register, not the contact saved in your phone.</small>
            <button className="primary" type="submit"><Check />Save tags</button>
          </form>
        </div>
      )}
      {nativeShareConflict && (
        <div className="backdrop native-share-backdrop">
          <section className="native-share-conflict" role="dialog" aria-modal="true" aria-labelledby="native-share-conflict-title">
            <header>
              <div><small>ANDROID SHARE · REVIEW REQUIRED</small><h2 id="native-share-conflict-title">Possible duplicate</h2></div>
              <button type="button" aria-label="Discard shared item" onClick={() => resolveNativeShareConflict("discard")}><X /></button>
            </header>
            <div className="native-share-match">
              <i>{nativeShareConflict.payload.kind === "contact" ? <CircleUserRound /> : <BriefcaseBusiness />}</i>
              <span><small>ALREADY SAVED</small><b>{nativeShareConflict.existingLabel}</b></span>
            </div>
            <p>{nativeShareConflict.payload.kind === "contact"
              ? "The phone number or email matches a contact already in your private register."
              : "The application link or employer and role match a job already in Jobs."}</p>
            <div className="native-share-summary">
              <small>NEW SHARED ITEM</small>
              <b>{nativeShareConflict.payload.kind === "contact"
                ? nativeShareConflict.payload.contactName || nativeShareConflict.payload.company || "Shared contact"
                : nativeShareConflict.payload.role || "Shared job"}</b>
              <span>{[nativeShareConflict.payload.company, nativeShareConflict.payload.phone, nativeShareConflict.payload.email, nativeShareConflict.payload.location].filter(Boolean).join(" · ")}</span>
            </div>
            <div className="native-share-actions">
              <button type="button" onClick={() => resolveNativeShareConflict("discard")}>Discard</button>
              <button type="button" onClick={() => resolveNativeShareConflict("separate")}>Save separately</button>
              <button type="button" className="primary" onClick={() => resolveNativeShareConflict("updated")}><Check />Update existing</button>
            </div>
            <small className="native-share-privacy"><ShieldCheck />Nothing is overwritten until you choose Update existing.</small>
          </section>
        </div>
      )}
      {agencyPackOpen && (
        <div className="backdrop" onMouseDown={() => setAgencyPackOpen(false)}>
          <section className="agency-pack-modal" onMouseDown={(event) => event.stopPropagation()} aria-labelledby="agency-pack-title">
            <header>
              <div><small>NEXUS · ONE AGENCY ONLY</small><h2 id="agency-pack-title">Agency Reply Pack</h2></div>
              <button type="button" aria-label="Close Agency Reply Pack" onClick={() => setAgencyPackOpen(false)}><X /></button>
            </header>
            {agencyReplyState === "analysing" && <div className="agency-pack-loading"><Bot /><b>Reading the agency request...</b><small>{agencyReplyFileName ? `${agencyReplyFileName}: ` : ""}Nexus analyses the screenshot you selected. The original is saved locally; private values from older messages are excluded from the result.</small></div>}
            {agencyReplyState === "error" && <div className="agency-pack-error"><X /><b>The screenshot could not be prepared</b><p>{agencyPackNotice}</p><button type="button" onClick={() => { setAgencyReplyState("review"); setAgencyPackNotice(""); }}>Continue manually</button></div>}
            {agencyReplyState === "review" && <>
              <section className="agency-request-summary">
                <div><small>REQUEST FOUND</small><b>{agencyReplyAnalysis.requestSummary || "Manual pack - review the agency message yourself"}</b></div>
                {(agencyReplyAnalysis.agencyName || agencyReplyAnalysis.contactName || agencyReplyAnalysis.role) && <p>{[agencyReplyAnalysis.contactName, agencyReplyAnalysis.agencyName, agencyReplyAnalysis.role, agencyReplyAnalysis.location].filter(Boolean).join(" · ")}</p>}
                {agencyReplyAnalysis.requestedItems.length > 0 && <span>{agencyReplyAnalysis.requestedItems.map((item) => <em key={item}>{AGENCY_PACK_ITEMS.find((option) => option.id === item)?.label || item}</em>)}</span>}
              </section>
              <label className="agency-pack-recipient">WhatsApp recipient
                <select value={agencyPackContactId} onChange={(event) => setAgencyPackContactId(event.target.value)}>
                  <option value="">Choose in WhatsApp</option>
                  {agencyContacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name}{contact.phones[0] ? ` · ${contact.phones[0]}` : ""}</option>)}
                </select>
                <small>Only one agency is used. Nothing is broadcast from this pack.</small>
              </label>
              <div className="agency-pack-heading"><span><small>APPROVAL CHECKLIST</small><b>{agencyPackSelections.length} of {AGENCY_PACK_ITEMS.length} selected</b></span><small>Unticked items stay private</small></div>
              <div className="agency-pack-checklist">
                {AGENCY_PACK_ITEMS.map((item) => {
                  const requested = agencyReplyAnalysis.requestedItems.includes(item.id);
                  const selected = agencyPackSelections.includes(item.id);
                  return <label key={item.id} className={`${selected ? "selected" : ""} ${item.sensitive ? "sensitive" : ""}`}>
                    <input type="checkbox" checked={selected} onChange={() => toggleAgencyPackItem(item.id)} />
                    <span><b>{item.label}</b><small>{item.help}</small></span>
                    {requested && <em>REQUESTED</em>}
                    {item.sensitive && <ShieldCheck />}
                  </label>;
                })}
              </div>
              {(agencyPackSelections.includes("references") || agencyPackSelections.includes("right_to_work") || agencyPackSelections.includes("address") || agencyPackSelections.includes("certificates")) && <section className="agency-pack-private-fields">
                <header><ShieldCheck /><span><b>Private details for this draft</b><small>These fields are not saved to your Worker Card or contact register.</small></span></header>
                {agencyPackSelections.includes("references") && <div className="agency-pack-field-grid"><label>Latest reference<input value={agencyPackDetails.referenceOne} onChange={(event) => updateAgencyPackDetails({ referenceOne: event.target.value })} /></label><label>Second reference<input value={agencyPackDetails.referenceTwo} onChange={(event) => updateAgencyPackDetails({ referenceTwo: event.target.value })} /></label></div>}
                {agencyPackSelections.includes("right_to_work") && <div className="agency-pack-field-grid"><label>Right to Work share code<input autoComplete="off" value={agencyPackDetails.shareCode} onChange={(event) => updateAgencyPackDetails({ shareCode: event.target.value.toUpperCase() })} placeholder="Enter only after it is requested" /></label><label>Valid until (optional)<input type="date" value={agencyPackDetails.shareCodeExpiry} onChange={(event) => updateAgencyPackDetails({ shareCodeExpiry: event.target.value })} /></label></div>}
                {agencyPackSelections.includes("address") && <label>Current address<textarea rows={2} autoComplete="off" value={agencyPackDetails.address} onChange={(event) => updateAgencyPackDetails({ address: event.target.value })} placeholder="Enter the address you approve for this agency" /></label>}
                {agencyPackSelections.includes("certificates") && <label>Relevant extra certificates<input value={agencyPackDetails.extraCertificates} onChange={(event) => updateAgencyPackDetails({ extraCertificates: event.target.value })} placeholder="e.g. SMSTS, Fire Door Installation" /></label>}
              </section>}
              <label className="agency-pack-message">WhatsApp-ready message<textarea rows={9} value={agencyPackDraft} onChange={(event) => setAgencyPackDraft(event.target.value)} /></label>
              <section className="agency-pack-files">
                <div><FileText /><span><b>{agencyPackDocuments.length} matching saved file{agencyPackDocuments.length === 1 ? "" : "s"}</b><small>{agencyPackDocuments.length ? agencyPackDocuments.map((document) => document.title).join(" · ") : "Tick an item with an imported original, or attach it manually from Documents."}</small></span></div>
                <button type="button" disabled={!agencyPackDocuments.length} onClick={() => void shareAgencyPackFiles()}><Upload />Share approved files</button>
              </section>
              <div className="agency-pack-safety"><ShieldCheck /><span><b>No automatic send</b><small>A screenshot can suggest the checklist, but every item starts unticked. You choose the recipient, review the message and press Send in WhatsApp.</small></span></div>
              {agencyPackNotice && <div className="agency-pack-notice" role="status">{agencyPackNotice}</div>}
              <div className="agency-pack-actions">
                <button type="button" onClick={() => void copyAgencyPackDraft()}><FileText /><span><b>Copy message</b><small>Paste into WhatsApp</small></span></button>
                <button type="button" className="primary" onClick={openAgencyPackWhatsApp}><MessageCircle /><span><b>Open WhatsApp</b><small>You still press Send</small></span></button>
              </div>
            </>}
          </section>
        </div>
      )}
      {integrationGuideOpen && (
        <div className="backdrop" onClick={() => setIntegrationGuideOpen(false)}>
          <section className="integration-guide" onClick={(event) => event.stopPropagation()}>
            <header><div><small>NOSMO PRIVATE IMPORT</small><h2>Connect your work information</h2></div><button aria-label="Close setup guide" onClick={() => setIntegrationGuideOpen(false)}><X /></button></header>
            <ol>
              <li><i>1</i><div><b>Choose one source</b><p>Start with Contacts or a WhatsApp work-chat export.</p></div></li>
              <li><i>2</i><div><b>Approve the Android picker</b><p>Your phone shows exactly what you are sharing. NOSMO receives only the items you select.</p></div></li>
              <li><i>3</i><div><b>Organise your work contacts</b><p>Selected phone contacts appear in Contact Register immediately. Correct Agency, trade or region tags before using them.</p></div></li>
            </ol>
            <div className="integration-native-note"><Smartphone /><span><b>Available in the Android app</b><small>Share text, a contact card or screenshot to NOSMO Work. Review the extracted details before anything is saved.</small></span></div>
            <button className="primary" onClick={finishIntegrationGuide}>Start setup</button>
          </section>
        </div>
      )}
      {askNexusModal && (
        <div className="backdrop nexus-search-backdrop" onMouseDown={() => setAskNexusModal(false)}>
          <section className="nexus-search-window" onMouseDown={(e) => e.stopPropagation()}>
            <header><div className="unified-search-title"><Bot/><div><small>NOSMO WORK AGENT</small><h2>What are you looking for?</h2></div></div><button aria-label="Close Ask Nexus" onClick={() => setAskNexusModal(false)}><X/></button></header>
            <div className="unified-search-kinds" role="radiogroup" aria-label="Search category">{(["Work", "Tools & materials"] as GlobalSearchKind[]).map((kind) => <button key={kind} role="radio" aria-checked={globalSearchKind === kind} className={globalSearchKind === kind ? "on" : ""} onClick={() => setGlobalSearchKind(kind)}>{kind}</button>)}</div>
            <div className="unified-search-box"><Search/><input autoFocus disabled={globalSearchStatus === "running"} value={query} onChange={(e) => { setQuery(e.target.value); resetLiveSearchSession(); }} onKeyDown={(e) => { if (e.key === "Enter") runGlobalSearch(); }} placeholder={globalSearchKind === "Tools & materials" ? "e.g. impact driver, OSB boards, 5x80 screws" : "What do you need?"}/><button disabled={globalSearchStatus === "running"} onClick={() => runGlobalSearch()}>{globalSearchStatus === "running" ? "Searching..." : "Search"}</button></div>
            {query.trim() && <div className="nexus-modal-results">
              {globalSearchKind === "Work" && globalSearchStatus === "running" && <div className="search-live-state panel"><i/><b>Searching 4 source groups for batch {searchBatch || 1}...</b><small>Job boards, agencies, employers and local sources run independently.</small></div>}
              {globalSearchKind === "Work" && globalSearchStatus === "error" && <div className="search-live-error panel"><b>Live search did not complete</b><small>{globalSearchError}</small>{searchNeedsSignIn && <a className="search-signin" href="/signin-with-chatgpt?return_to=%2F" target="_top">Sign in with ChatGPT</a>}</div>}
              {globalSearchKind === "Work" && liveSearchJobs && <>
                {searchMeta && <div className="search-batch-summary"><Check/><span><b>Batch {searchMeta.batch}: {searchMeta.returned} current direct {searchMeta.returned === 1 ? "vacancy" : "vacancies"}</b><small>{searchBatchDetail(searchMeta)}</small></span></div>}
                {liveSearchJobs.length ? <div className="panel"><Table jobs={liveSearchJobs} open={(job) => { setSelected(job); setAskNexusModal(false); }}/></div> : <div className="search-empty panel"><Search/><b>No current direct vacancies in this batch</b><small>{searchEmptyDetail(searchMeta, false)}</small></div>}
                {globalSearchStatus === "idle" && <div className="search-more"><small>Up to 20 direct vacancies per background batch. Dated results use your saved freshness limit; undated results must pass a live-page check. Results are appended; duplicates are skipped.</small><button onClick={() => runGlobalSearch()}>Search next 20</button></div>}
              </>}
              {globalSearchKind === "Tools & materials" && <div className="merchant-results">{[{name:"Screwfix",url:"https://www.screwfix.com/search?search="},{name:"Toolstation",url:"https://www.toolstation.com/search?q="},{name:"Wickes",url:"https://www.wickes.co.uk/search?text="}].map((merchant) => <article key={merchant.name}><Building2/><div><b>{merchant.name}</b><small>Check live price and availability</small></div><button onClick={() => openExternal(merchant.url + encodeURIComponent(query))}>Open <ExternalLink/></button></article>)}</div>}
            </div>}
          </section>
        </div>
      )}
      {workCameraModal && (
        <div className="backdrop" onMouseDown={() => setWorkCameraModal(false)}>
          <section className="work-camera-modal" onMouseDown={(e) => e.stopPropagation()}>
            <header><div><small>NOSMO WORK CAMERA</small><h2>Work photos only</h2></div><button aria-label="Close Work Camera" onClick={() => setWorkCameraModal(false)}><X/></button></header>
            <p>Take photos of site progress, defects, documents, materials or tools. Nothing is uploaded to NOSMO.</p>
            {driveSetupState === "ask" && <div className="drive-setup-question"><img src="/app-icons/drive.svg" alt="Google Drive"/><div><b>Configure Google Drive?</b><p>You can keep a separate cloud copy of your NOSMO work photos.</p></div><div className="drive-setup-actions"><button onClick={configureGoogleDrive}>Yes, configure now</button><button onClick={remindDriveLater}>Remind me later</button></div></div>}
            {driveSetupState === "started" && <div className="drive-setup-status"><img src="/app-icons/drive.svg" alt=""/><span>Google Drive setup was opened. Photos stay local until a real connection is confirmed.</span></div>}
            <label className="camera-capture"><Camera/>Take a work photo<input type="file" accept="image/*" capture="environment" onChange={(e)=>{setWorkPhoto(e.target.files?.[0] || null);setCameraMessage("")}}/></label>
            {workPhoto && <div className="camera-file"><img src={URL.createObjectURL(workPhoto)} alt="Work photo preview"/><div><b>{workPhoto.name}</b><small>Ready to save locally</small></div></div>}
            {workPhoto && <button className="camera-save" onClick={saveWorkPhoto}><FolderOpen/>Save to NOSMO Work Photos</button>}
            {cameraMessage && <div className="camera-message"><Check/>{cameraMessage}</div>}
            <small className="camera-privacy"><ShieldCheck/>The browser asks before accessing a folder. Photos are never mixed with applications or shared automatically.</small>
          </section>
        </div>
      )}
      {cvToast && (
        <div className="toast-layer" onMouseDown={() => setCvToast(null)}>
          <aside className="cv-toast" onMouseDown={(e) => e.stopPropagation()}>
            <i><Check /></i>
            <div>
              <b>Dodales CV: {cvToast}</b>
              <span>Zaznaczylem nowe prace w wyszukiwarce.</span>
            </div>
            <button aria-label="Zamknij komunikat" onClick={() => setCvToast(null)}>
              <X />
            </button>
          </aside>
        </div>
      )}
      {autopilotModal && (
        <div className="backdrop" onMouseDown={() => setAutopilotModal(false)}>
          <section className="autopilot-modal" onMouseDown={(e) => e.stopPropagation()}>
            <button className="modal-x" onClick={() => setAutopilotModal(false)}><X/></button>
            <div className="auto-orb"><Bot/></div>
            {autopilotStep === "ready" && <><small>NOSMO WORK AGENT</small><h2>Find work that fits your real profile.</h2><p>I will use your Worker Card and {dynamicCvs.length} CV{dynamicCvs.length === 1 ? "" : "s"} from Documents to search matching work and explain each match.</p><div className="auto-checks"><span><Check/>Canonical profile</span><span><Check/>CV selection</span><span><Check/>Travel and availability</span><span><Check/>Application route</span></div><p>I never invent qualifications, share private files, or mark a portal application sent without your confirmation.</p><button className="primary" onClick={runAutopilot}><Search/>Run today&apos;s search</button></>}
            {autopilotStep === "running" && <div className="auto-running"><i/><small>NOSMO WORK AGENT</small><h2>Searching for the right work...</h2><p>Checking profile fit, CV, distance, shifts, pay and application routes.</p></div>}
            {autopilotStep === "done" && (autopilotError ? <><small>LIVE SEARCH NOT CONNECTED</small><h2>No jobs were added.</h2><p>{autopilotError} The app will never present saved listings as fresh AI results.</p><div className="live-search-links">{liveSearches.map((item) => <button key={item.label} onClick={() => openExternal(item.url)}><ExternalLink/>{item.label}</button>)}</div></> : <><small>SEARCH COMPLETE</small><h2>I found {autopilotCount} matching jobs.</h2><p>They are already saved in the app with the right CV and next application step.</p><button className="primary" onClick={() => { setAutopilotModal(false); setActive("Applications"); }}><Check/>Review the jobs</button></>)}
          </section>
        </div>
      )}
      {searchModal && (
        <div className="backdrop" onMouseDown={() => setSearchModal(false)}>
          <section
            className="ai-search"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <header>
              <div className="gpt-logo">
                <Bot />
              </div>
              <div>
                <small>CHATGPT JOB FINDER</small>
                <h2>Search for {profile.name || "this worker"}</h2>
              </div>
              <button onClick={() => setSearchModal(false)}>
                <X />
              </button>
            </header>
            {searchStep === "criteria" ? (
              <>
                <div className="chat-bubble">
                  Tell me what work fits today. I will use the same criteria as
                  yesterday and avoid duplicates already in the local Jobs sheet.
                </div>
                <div className="criteria">
                  <label>
                    <span>
                      Maximum distance from Leeds <b>15 miles</b>
                    </span>
                    <input type="range" min="1" max="30" defaultValue="15" />
                  </label>
                  <label>
                    <span>
                      Maximum travel time <b>60 min</b>
                    </span>
                    <input
                      type="range"
                      min="15"
                      max="120"
                      step="5"
                      defaultValue="60"
                    />
                  </label>
                  <div className="job-types-filter">
                    <span>
                      Job types
                      <b>{selectedJobTypes.length} selected</b>
                    </span>
                    <small className="auto-cv-note">
                      <Check /> Selected automatically from {dynamicCvs.length} uploaded CV{dynamicCvs.length === 1 ? "" : "s"}
                    </small>
                    <div className="type-actions">
                      <button
                        type="button"
                        onClick={() => setSelectedJobTypes([...jobTypeOptions])}
                      >
                        Select all
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedJobTypes([])}
                      >
                        Clear all
                      </button>
                    </div>
                    <section>
                      {jobTypeOptions.map((x) => (
                        <label key={x}>
                          <input
                            type="checkbox"
                            checked={selectedJobTypes.includes(x)}
                            onChange={(e) =>
                              setSelectedJobTypes((current) =>
                                e.target.checked
                                  ? [...current, x]
                                  : current.filter((item) => item !== x),
                              )
                            }
                          />
                          {x}
                        </label>
                      ))}
                    </section>
                  </div>
                  <div>
                    <span>Working hours</span>
                    <section>
                      {["Short mornings", "Day", "Evening", "Night"].map(
                        (x) => (
                          <label key={x}>
                            <input
                              type="checkbox"
                              defaultChecked={x !== "Day"}
                            />
                            {x}
                          </label>
                        ),
                      )}
                    </section>
                  </div>
                  <label>
                    <span>
                      Minimum pay <b>£12.21/h</b>
                    </span>
                    <input
                      type="range"
                      min="10"
                      max="20"
                      step=".25"
                      defaultValue="12.25"
                    />
                  </label>
                  <div className="criteria-flags">
                    <label>
                      <input type="checkbox" defaultChecked />
                      Public transport possible
                    </label>
                    <label>
                      <input type="checkbox" defaultChecked />
                      No experience / training offered
                    </label>
                    <label>
                      <input type="checkbox" defaultChecked />
                      Part-time or flexible preferred
                    </label>
                  </div>
                </div>
                <button
                  className="primary search-now"
                  onClick={() => openExternal("https://uk.indeed.com/jobs?q=joiner+OR+carpenter+OR+painter+OR+decorator+OR+trade+counter+sales+OR+delivery+driver&l=Leeds%2C+West+Yorkshire")}
                >
                  <Search />
                  Open live searches
                </button>
                <p className="integration-note">
                  Opens current Leeds searches in your browser. Results are not
                  added automatically; use Add job after checking the vacancy.
                </p>
              </>
            ) : (
              <>
                <div className="chat-bubble success">
                  <Check />I found {discovered.length} matching jobs. They are
                  already in the app and saved in {localFolder}.
                </div>
                <div className="found-list">
                  {discovered.map((j) => (
                    <article key={j.id}>
                      <Logo name={j.company} />
                      <div>
                        <b>{j.role}</b>
                        <small>
                          {j.company} · {j.distance} · {j.pay}
                        </small>
                      </div>
                      <span className="pill green">{j.transport}</span>
                    </article>
                  ))}
                </div>
                <div className="search-actions">
                  <button onClick={() => setSearchStep("criteria")}>
                    Change filters
                  </button>
                  <button
                    className="primary"
                    onClick={() => {
                      setSearchModal(false);
                      setActive("Applications");
                    }}
                  >
                    <Check />
                    View jobs
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      )}
      {modal && (
        <div className="backdrop" onMouseDown={() => setModal(false)}>
          <form
            className="modal"
            onSubmit={add}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div>
              <span>
                <small>NEW OPPORTUNITY</small>
                <h2>Add job or employer</h2>
              </span>
              <button type="button" onClick={() => setModal(false)}>
                <X />
              </button>
            </div>
            <label>
              Company
              <input name="company" required placeholder="Company name" />
            </label>
            <label>
              Role
              <input name="role" required placeholder="Job title" />
            </label>
            <section>
              <label>
                Area
                <input name="area" defaultValue="Leeds" />
              </label>
              <label>
                Shift
                <input name="shift" placeholder="Morning / nights" />
              </label>
            </section>
            <label>
              Email or contact
              <input name="contact" placeholder="recruitment@company.co.uk" />
            </label>
            <label>
              Phone
              <input name="phone" placeholder="01274..." />
            </label>
            <label className="check">
              <input name="whatsapp" type="checkbox" /> WhatsApp available
            </label>
            <button className="primary" type="submit">
              <Plus />
              Add to list
            </button>
            <div className="manual-import">
              <span>Already have a job database?</span>
              <label>
                <Upload /> Import CSV backup
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => importFile(e.target.files?.[0])}
                />
              </label>
              <small>
                Backup option only. ChatGPT Search now adds new jobs
                automatically.
              </small>
            </div>
          </form>
        </div>
      )}
      {cvBuilder && (
        <div className="backdrop" onMouseDown={() => setCvBuilder(false)}>
          <form className="modal cv-builder" onSubmit={createCv} onMouseDown={(e) => e.stopPropagation()}>
            <div><span><small>AI CV BUILDER</small><h2>Let me make your CV</h2></span><button type="button" onClick={() => setCvBuilder(false)}><X/></button></div>
            <p className="builder-intro">Tell me what you want to apply for. I will prepare a focused CV and save both PDF and DOCX versions on this device.</p>
            <label className="old-cv-upload"><Upload/><span><b>Send me your old CV</b><small>I&apos;ll edit it for you · PDF, DOC, DOCX, TXT, RTF, ODT or Pages</small></span><input type="file" accept=".pdf,.doc,.docx,.txt,.rtf,.odt,.pages,application/pdf,text/plain" onChange={(e) => setOldCv(e.target.files?.[0] || null)}/></label>
            {oldCv && <span className="source-ready"><Check/>{oldCv.name} ready</span>}
            <div className="or-line"><span>OR FILL IN THE DETAILS</span></div>
            <label>What work should this CV target?<input name="cvTitle" placeholder="e.g. Retail, Reception, Warehouse, Cleaning" required/></label>
            <label>Phone number<input name="phone" placeholder="07..."/></label>
            <label>Tell me about yourself<textarea name="summary" rows={3} placeholder="What kind of person and worker are you?"/></label>
            <label>Previous jobs and experience<textarea name="experience" rows={4} placeholder="Company, role, dates and what you did"/></label>
            <label>Skills<textarea name="skills" rows={3} placeholder="Cleaning, customer service, warehouse equipment, languages..."/></label>
            <label>Education and training<textarea name="education" rows={3} placeholder="School, courses, certificates"/></label>
            <label>Availability<input name="availability" defaultValue={profile.preferredShifts}/></label>
            <button className="primary" type="submit"><Bot/>Make and save my CV</button>
            <small className="dual-save"><Check/>Automatically saved as PDF + DOCX in {profile.name || "User"} - Praca <button type="button" disabled={!dynamicCvs.length} onClick={saveCvsToDownloads}>Save to Downloads</button></small>
          </form>
        </div>
      )}
      {profileModal && (
        <div className="backdrop" onMouseDown={() => setProfileModal(false)}>
          <form
            className="modal"
            onSubmit={saveProfile}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div>
              <span>
                <small>PERSONAL PROFILE</small>
                <h2>Edit worker details</h2>
              </span>
              <button type="button" onClick={() => setProfileModal(false)}>
                <X />
              </button>
            </div>
            <label>
              Name
              <input name="name" required defaultValue={profile.name} />
            </label>
            <label>
              Personal email
              <input
                name="email"
                type="email"
                required
                defaultValue={profile.email}
              />
            </label>
            <label>
              Application email
              <input
                name="applicationEmail"
                type="email"
                defaultValue={profile.applicationEmail}
              />
            </label>
            <label>
              Available from
              <input
                name="availableFrom"
                type="date"
                defaultValue={profile.availableFrom}
              />
            </label>
            <label>
              Travel
              <input name="travel" defaultValue={profile.travel} />
            </label>
            <label>
              Preferred work
              <input
                name="preferredWork"
                defaultValue={profile.preferredWork}
              />
            </label>
            <label>
              Preferred shifts
              <input
                name="preferredShifts"
                defaultValue={profile.preferredShifts}
              />
            </label>
            <button className="primary" type="submit">
              <Check />
              Save profile
            </button>
          </form>
        </div>
      )}
      {selected && (
        <div className="drawer-bg" onMouseDown={() => setSelected(null)}>
          <aside className="drawer" onMouseDown={(e) => e.stopPropagation()}>
            <button className="close" onClick={() => setSelected(null)}>
              <X />
            </button>
            <Logo name={selected.company} />
            <span className={tone[selected.status]}>{selected.status}</span>
            <h2>{selected.role}</h2>
            <h3>{selected.company}</h3>
            <p>
              <MapPin /> {selected.area}{selected.distance ? ` (${selected.distance}${selected.travelTime ? ` · ${selected.travelTime}` : ""})` : ""}
            </p>
            {(selected.description || selected.note) && (
              <section className="job-description">
                <small>FULL JOB DESCRIPTION</small>
                <p>{selected.description || selected.note}</p>
              </section>
            )}
            <div className="details">
              {[
                ["Priority", selected.priority],
                ["Category", selected.category],
                ["Agency", selected.agency],
                ["Distance", selected.distance],
                ["Public transport", selected.transport],
                ["Travel time", selected.travelTime],
                ["Shift", selected.shift],
                ["Days", selected.days],
                ["Contract", selected.contract],
                ["Pay", selected.pay],
                ["Start date", selected.startDate],
                ["Experience required", selected.experience],
                ["English requirements", selected.english],
                ["CV to use", selected.cv],
                ["Cover letter", selected.coverLetter],
                ["Application method", selected.method],
                ["Recruiter", selected.recruiter],
                ["Contact", selected.contact || "Not added yet"],
                ["Phone", selected.phone || "Not added yet"],
                ["Last activity", selected.date],
                ["Listing age", selected.listingAge],
                ["Best first contact", selected.bestContact],
                ["Notes / email reply", selected.note || "No note"],
              ]
                .filter((x) => x[1])
                .map((x) => (
                  <label key={x[0]}>
                    {x[0]}
                    <b>{x[1]}</b>
                  </label>
                ))}
            </div>
            {(isDirectVacancyUrl(selected.applicationLink) || isDirectVacancyUrl(selected.replyLink)) && (
              <a className="source-link" href={externalUrl(selected)} target="_blank" rel="external noopener noreferrer">
                <ExternalLink />
                <span><small>ORIGINAL SOURCE</small><b>{sourceLabel(selected)}</b></span>
              </a>
            )}
            {isDirectVacancyUrl(selected.replyLink) && (
              <a
                className="reply-link"
                href={selected.replyLink}
                target="_blank"
                rel="external noopener noreferrer"
              >
                <Link2 />
                Application link from reply
              </a>
            )}
            <div className="apply-row">
              <button className="apply-main" disabled={!isDirectVacancyUrl(selected.applicationLink) && !selected.contact.includes("@")} onClick={() => applyJob(selected)}>
                <Send />
                {isDirectVacancyUrl(selected.applicationLink)
                  ? "Open & apply"
                  : selected.contact.includes("@") ? "Prepare email application" : "Direct application unavailable"}
              </button>
              {isDirectVacancyUrl(selected.applicationLink) && (
                <a
                  href={selected.applicationLink}
                  target="_blank"
                  rel="external noopener noreferrer"
                >
                  <ExternalLink />
                  Open page
                </a>
              )}
            </div>
            <p className="apply-note">
              {isDirectVacancyUrl(selected.applicationLink)
                ? "Portal application: status changes to Applied only after you confirm submission."
                : selected.contact.includes("@") ? "Email application can be prepared with the correct CV." : "No direct vacancy link was found. This record cannot be marked as applied from a general website."}
            </p>
            <section className="application-action">
              <small>NEXT ACTION</small>
              <b>{nextAction(selected)}</b>
              <label>Follow-up date<input type="date" value={selected.followUp || ""} onChange={(event) => setFollowUp(event.target.value)}/></label>
            </section>
            <h4>Update status</h4>
            <div className="status-buttons">
              {(
                [
                  "New",
                  "To apply",
                  "Applied",
                  "Reply",
                  "Interview",
                  "Offer",
                  "Rejected",
                  "Closed",
                ] as Status[]
              ).map((s) => (
                <button
                  className={selected.status === s ? "on" : ""}
                  onClick={() => update(s)}
                  key={s}
                >
                  {s}
                </button>
              ))}
            </div>
            <section className="application-history">
              <small>APPLICATION HISTORY</small>
              {[...(selected.applicationHistory || [])].reverse().map((event, index) => <div key={`${event.date}-${index}`}><i/><span><b>{event.status}</b><small>{event.date} · {event.note}</small></span></div>)}
              {!selected.applicationHistory?.length && <p>No activity recorded yet. Opening a portal or email draft does not count as a sent application.</p>}
            </section>
            <div className="quick">
              <a
                className={!selected.phone ? "disabled" : ""}
                href={selected.phone ? `tel:${selected.phone}` : undefined}
              >
                <Phone />
                Call
              </a>
              <a
                className={!selected.contact.includes("@") ? "disabled" : ""}
                href={
                  selected.contact.includes("@")
                    ? `mailto:${selected.contact}`
                    : undefined
                }
              >
                <Mail />
                Email
              </a>
              {showWhatsapp && (
                <a
                  className={
                    selected.whatsapp && selected.phone ? "wa" : "disabled"
                  }
                  href={
                    selected.whatsapp && selected.phone
                      ? `https://wa.me/${selected.phone.replace(/\D/g, "")}`
                      : undefined
                  }
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageCircle />
                  WhatsApp
                </a>
              )}
            </div>
            <button className="delete-job" onClick={removeJob}>
              <Trash2 />
              Delete this entry
            </button>
          </aside>
        </div>
      )}
    </main>
  );
}
function Title({
  eyebrow,
  title,
  text,
  action,
}: {
  eyebrow: string;
  title: string;
  text: string;
  action?: () => void;
}) {
  return (
    <div className="title">
      <div>
        <small>{eyebrow}</small>
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
      {action && (
        <button className="primary" onClick={action}>
          <Plus />
          Add new
        </button>
      )}
    </div>
  );
}
function Logo({ name }: { name: string }) {
  return <div className="logo">{name[0]}</div>;
}
function Head({ title, text }: { title: string; text: string }) {
  return (
    <header className="panel-head">
      <div>
        <h2>{title}</h2>
        <p>{text}</p>
      </div>
    </header>
  );
}
function ApplicationsTracker({ jobs, open }: { jobs: Job[]; open: (job: Job) => void }) {
  const attention = jobs.filter(needsAttention);
  const recent = jobs.filter((job) => !["New", "To apply"].includes(job.status));
  return <div className="applications-tracker">
    <section className="application-summary">
      <article><span><Bell/></span><b>{attention.length}</b><small>Needs attention</small></article>
      <article><span><Send/></span><b>{jobs.filter((job) => job.status === "Applied").length}</b><small>Applications sent</small></article>
      <article><span><MessageCircle/></span><b>{jobs.filter((job) => ["Reply", "Interview", "Offer"].includes(job.status)).length}</b><small>Replies to check</small></article>
    </section>
    <section className="panel application-attention">
      <Head title="Needs attention" text="The next real action — no fake sent statuses"/>
      {attention.length ? attention.map((job) => <button key={job.id} onClick={() => open(job)}><Logo name={job.company}/><span><b>{job.role}</b><small>{job.company} · {nextAction(job)}</small></span><em className={tone[job.status]}>{job.status}</em><ChevronRight/></button>) : <div className="application-empty"><Check/><span><b>Nothing urgent</b><small>Your tracker is up to date.</small></span></div>}
    </section>
    <section className="panel application-recent">
      <Head title="Recent applications" text="Only confirmed application activity"/>
      {recent.length ? recent.map((job) => <button key={job.id} onClick={() => open(job)}><span><b>{job.role}</b><small>{job.company} · {job.area}</small></span><span className="application-next"><small>NEXT ACTION</small><b>{nextAction(job)}</b></span><span className="application-follow"><small>FOLLOW-UP</small><b>{job.followUp || "Not set"}</b></span><em className={tone[job.status]}>{job.status}</em><ChevronRight/></button>) : <div className="application-empty"><BriefcaseBusiness/><span><b>No confirmed applications yet</b><small>Opening an advert does not mark it as sent.</small></span></div>}
    </section>
  </div>;
}

function Table({ jobs, open, showStatus = true }: { jobs: Job[]; open: (j: Job) => void; showStatus?: boolean }) {
  return (
    <div className="table dense-job-list">
      {jobs.length ? (
        jobs.map((j) => (
          <button className="dense-job-row" onClick={() => open(j)} key={j.id}>
            <Logo name={j.company} />
            <span className="dense-job-copy">
              <span className="dense-title"><b>{j.role}</b>{showStatus && <em className={tone[j.status]}>{j.status}</em>}</span>
              <small className="dense-company">{j.company}{j.listingAge ? ` · ${j.listingAge}` : ""}</small>
              <span className="dense-line"><MapPin/><b>{j.area}</b>{(j.distance || j.travelTime) && <small>({[j.distance, j.travelTime].filter(Boolean).join(" · ")})</small>}</span>
              <span className="dense-line"><Clock3/><b>{j.shift || "Hours not stated"}</b><small>{[j.pay, j.days || j.contract].filter(Boolean).join(" · ") || "Pay not stated"}</small></span>
              <span className="dense-bottom">
                <span
                  className={isDirectVacancyUrl(j.applicationLink) || isDirectVacancyUrl(j.replyLink) ? "live-source" : ""}
                  role={isDirectVacancyUrl(j.applicationLink) || isDirectVacancyUrl(j.replyLink) ? "link" : undefined}
                  tabIndex={isDirectVacancyUrl(j.applicationLink) || isDirectVacancyUrl(j.replyLink) ? 0 : undefined}
                  onClick={(e) => {
                    if (!isDirectVacancyUrl(j.applicationLink) && !isDirectVacancyUrl(j.replyLink)) return;
                    e.stopPropagation();
                    openExternal(externalUrl(j));
                  }}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter" || (!isDirectVacancyUrl(j.applicationLink) && !isDirectVacancyUrl(j.replyLink))) return;
                    e.stopPropagation();
                    openExternal(externalUrl(j));
                  }}
                ><Link2/>{sourceLabel(j)}</span>
                <span>{j.contact.includes("@") ? j.contact : j.phone || "No recruiter contact"}</span>
              </span>
            </span>
            <ChevronRight className="dense-arrow" />
          </button>
        ))
      ) : (
        <div className="empty">
          <Search />
          <b>No matching jobs</b>
          <small>Try another search or filter.</small>
        </div>
      )}
    </div>
  );
}
