const SOURCE = Object.freeze({
  WORKER_APP: "Worker App · recruiter-safe",
  ROSTER: "Agency roster",
  REQUEST: "Request",
  APPLICATION: "Application",
  PLACEMENT: "Placement",
  AUDIT: "Audit event",
});

const TERMINAL_APPLICATION_STAGES = new Set([
  "PLACED",
  "REJECTED",
  "WITHDRAWN",
]);

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalise(value) {
  return text(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

function list(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string" && item.trim()) : [];
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function timestamp(value) {
  const parsed = Date.parse(text(value));
  return Number.isNaN(parsed) ? null : parsed;
}

function iso(value) {
  const parsed = timestamp(value);
  return parsed === null ? null : new Date(parsed).toISOString();
}

function newestDate(...values) {
  const dates = values.flat().map(timestamp).filter((value) => value !== null);
  return dates.length ? new Date(Math.max(...dates)).toISOString() : null;
}

function daysBetween(from, to) {
  const fromTime = timestamp(from);
  const toTime = timestamp(to);
  if (fromTime === null || toTime === null) return null;
  return Math.floor((toTime - fromTime) / 86_400_000);
}

function startOfUtcDay(value) {
  const parsed = timestamp(value);
  if (parsed === null) return null;
  const date = new Date(parsed);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function nextWeekday(now, weekday) {
  const start = startOfUtcDay(now);
  if (start === null) return null;
  const date = new Date(start);
  const offset = (weekday - date.getUTCDay() + 7) % 7;
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function humanise(value) {
  return text(value)
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/(^|\s)\S/g, (character) => character.toUpperCase());
}

function includesRequirement(requirement, evidence) {
  const target = normalise(requirement);
  if (!target) return false;
  return evidence.some((item) => {
    const candidate = normalise(item);
    return candidate === target || candidate.includes(target) || target.includes(candidate);
  });
}

function scoped(items, tenantId) {
  return Array.isArray(items)
    ? items.filter((item) => item && item.agencyId === tenantId)
    : [];
}

function safeContext(value) {
  const input = value && typeof value === "object" ? value : {};
  return {
    requestId: text(input.requestId) || null,
    personId: text(input.personId) || null,
    rosterWorkerId: text(input.rosterWorkerId) || null,
    applicationId: text(input.applicationId) || null,
  };
}

function classifyIntent(query) {
  const value = normalise(query);
  if (!value) return "UNSUPPORTED";
  if (/latest activity/.test(value) && /request/.test(value)) return "LATEST_REQUEST_ACTIVITY";
  if (/contact/.test(value) && /(opened|open)/.test(value) && /(not confirmed|unconfirmed|without confirmation)/.test(value)) {
    return "CONTACTS_UNCONFIRMED";
  }
  if (/imported/.test(value) && /(not connected|unconnected|without worker app)/.test(value)) {
    return "IMPORTED_NOT_CONNECTED";
  }
  if (/placement/.test(value) && /(missing|without)/.test(value) && /(pay|bill|rate)/.test(value)) {
    return "PLACEMENTS_MISSING_RATES";
  }
  if (/placement/.test(value) && /(next 7|seven days|7 days|start)/.test(value)) {
    return "PLACEMENTS_STARTING";
  }
  if (/offer/.test(value) && /(placement|detail)/.test(value)) return "OFFERS_NEED_PLACEMENT";
  if (/interview/.test(value) && /(outcome|result|decision|need)/.test(value)) return "INTERVIEWS_NEED_OUTCOME";
  if (/(stuck|longest)/.test(value) && /(stage|pipeline|candidate)/.test(value)) return "STUCK_IN_STAGE";
  if (/(waiting|awaiting)/.test(value) && /(response|reply)/.test(value)) return "WAITING_FOR_RESPONSE";
  if (/open request/.test(value) && /(no ready|without ready)/.test(value)) return "OPEN_REQUESTS_NO_READY";
  if (/why/.test(value) && /block/.test(value)) return "WHY_BLOCKED";
  if (/(licence|license|ticket|certificate)/.test(value) && /(expir|30 days|thirty days)/.test(value)) {
    return "LICENCES_EXPIRING";
  }
  if (/ready for (this|the|selected) request/.test(value)) return "READY_FOR_REQUEST";
  if (/(available|availability)/.test(value) && /ready/.test(value)) return "AVAILABLE_AND_READY";
  if (/match/.test(value) && /(worker|candidate|job|request)/.test(value)) return "MATCH_WORKERS";
  if (/create/.test(value) && /(job )?request/.test(value)) return "CREATE_REQUEST";
  if (/check availability/.test(value)) return "CHECK_AVAILABILITY";
  if (/review application/.test(value)) return "REVIEW_APPLICATIONS";
  if (/contact worker/.test(value)) return "CONTACT_WORKERS";
  if (/find worker/.test(value) || value === "workers") return "FIND_WORKERS";
  if (/(publish|send|reject|shortlist|change status|create placement)/.test(value)) return "ACTION_GUARD";
  return "UNSUPPORTED";
}

function extractLocation(query) {
  const match = text(query).match(/\b(?:in|for)\s+([a-z][a-z .'-]{1,80}?)(?=\s+(?:on|by|from|this|next)\b|[?.!,]|$)/i);
  if (!match) return null;
  const location = text(match[1]);
  return /^(this|the|selected) request$/i.test(location) ? null : location;
}

function queryDate(query, now) {
  const value = normalise(query);
  const weekdays = [
    ["sunday", 0],
    ["monday", 1],
    ["tuesday", 2],
    ["wednesday", 3],
    ["thursday", 4],
    ["friday", 5],
    ["saturday", 6],
  ];
  for (const [label, weekday] of weekdays) {
    if (value.includes(label)) return nextWeekday(now, weekday);
  }
  const direct = text(query).match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  return direct ? direct[1] : null;
}

function workerTarget(worker) {
  return {
    type: "worker",
    personId: worker.personId || null,
    rosterWorkerId: worker.rosterWorkerId || null,
  };
}

function requestTarget(request, type = "request") {
  return { type, requestId: request.requestId };
}

function applicationTarget(application, type = "pipeline") {
  return {
    type,
    requestId: application.requestId || null,
    applicationId: application.applicationId || null,
    personId: application.personId || null,
    rosterWorkerId: application.rosterWorkerId || null,
  };
}

function placementTarget(placement) {
  return {
    type: "pipeline",
    requestId: placement.requestId || null,
    applicationId: placement.applicationId || null,
    placementId: placement.placementId || null,
  };
}

function createResult({
  id,
  title,
  subtitle,
  detail,
  missing = [],
  sources,
  updatedAt,
  readiness = null,
  readinessReasons = [],
  status = null,
  target,
}) {
  return {
    id,
    title,
    subtitle,
    detail,
    missing: unique(missing),
    sources: unique(sources),
    updatedAt: iso(updatedAt),
    readiness,
    readinessReasons: unique(readinessReasons),
    status,
    target,
  };
}

function prepareSnapshot(tenantId, snapshot) {
  const source = snapshot && typeof snapshot === "object" ? snapshot : {};
  const candidates = scoped(source.candidates, tenantId).filter(
    (candidate) => candidate.sharingStatus === "ACTIVE",
  );
  const rosterWorkers = scoped(source.rosterWorkers, tenantId);
  const requests = scoped(source.requests, tenantId);
  const applications = scoped(source.applications, tenantId);
  const placements = scoped(source.placements, tenantId);
  const pipelineEvents = scoped(source.pipelineEvents, tenantId);
  const rosterEvents = scoped(source.rosterEvents, tenantId);
  const candidateEvents = scoped(source.candidateEvents, tenantId);

  const candidateByPerson = new Map(candidates.map((candidate) => [candidate.personId, candidate]));
  const mergedPersonIds = new Set();
  const workers = rosterWorkers.map((roster) => {
    const candidate =
      roster.sharingStatus === "ACTIVE" && roster.linkedPersonId
        ? candidateByPerson.get(roster.linkedPersonId)
        : null;
    if (!candidate) {
      return {
        ...roster,
        personId: null,
        sourceLabels: [SOURCE.ROSTER],
        workerAppVisible: false,
      };
    }
    mergedPersonIds.add(candidate.personId);
    return {
      ...roster,
      ...candidate,
      rosterWorkerId: roster.rosterWorkerId,
      linkedPersonId: candidate.personId,
      sourceLabels: [SOURCE.WORKER_APP, SOURCE.ROSTER],
      workerAppVisible: true,
      updatedAt: newestDate(candidate.updatedAt, roster.updatedAt),
    };
  });
  for (const candidate of candidates) {
    if (mergedPersonIds.has(candidate.personId)) continue;
    workers.push({
      ...candidate,
      rosterWorkerId: null,
      sourceLabels: [SOURCE.WORKER_APP],
      workerAppVisible: true,
    });
  }
  return {
    workers,
    requests,
    applications,
    placements,
    pipelineEvents,
    rosterEvents,
    candidateEvents,
  };
}

function findRequest(data, context, query) {
  if (context.requestId) {
    return data.requests.find((request) => request.requestId === context.requestId) || null;
  }
  const queryValue = normalise(query);
  const named = data.requests.filter((request) => {
    const values = [request.role, request.client, request.location]
      .map(normalise)
      .filter((value) => value.length >= 4);
    return values.some((value) => queryValue.includes(value));
  });
  if (named.length === 1) return named[0];
  const active = data.requests.filter((request) => request.status === "OPEN");
  return active.length === 1 ? active[0] : null;
}

function findApplication(data, context) {
  if (context.applicationId) {
    return data.applications.find(
      (application) => application.applicationId === context.applicationId,
    ) || null;
  }
  return null;
}

function findWorker(data, context, application = null) {
  const personId = context.personId || application?.personId || null;
  const rosterWorkerId = context.rosterWorkerId || application?.rosterWorkerId || null;
  return data.workers.find(
    (worker) =>
      (personId && worker.personId === personId) ||
      (rosterWorkerId && worker.rosterWorkerId === rosterWorkerId),
  ) || null;
}

function applicationWorker(data, application) {
  const worker = findWorker(data, {}, application);
  if (worker) return { worker, label: worker.name || "Worker", sharingRevoked: false };
  if (application.personId) {
    return { worker: null, label: "Worker sharing revoked", sharingRevoked: true };
  }
  return {
    worker: null,
    label: text(application.workerName) || "Agency roster worker",
    sharingRevoked: false,
  };
}

function availabilityOn(worker, requestedDate) {
  const status = normalise(worker.availability?.status || worker.availability);
  if (status.includes("busy") || status.includes("unavailable")) return false;
  if (status.includes("available") && !status.includes("ready on")) return true;
  if (status.includes("ready on") || status.includes("ready_on")) {
    if (!requestedDate) return false;
    const availableFrom = iso(worker.availability?.availableFrom || worker.availableFrom);
    return availableFrom ? availableFrom.slice(0, 10) <= requestedDate : false;
  }
  return false;
}

function readinessFor(worker, request, now) {
  const skills = unique([...list(worker.skills), text(worker.trade), ...list(worker.targetRoles)]);
  const licences = unique(list(worker.licences));
  const requiredSkills = list(request.skills);
  const requiredLicences = list(request.licences);
  const missingSkills = requiredSkills.filter((item) => !includesRequirement(item, skills));
  const missingLicences = requiredLicences.filter((item) => !includesRequirement(item, licences));
  const blocked = [];
  const checks = [];
  const availability = normalise(worker.availability?.status || worker.availability);

  if (availability.includes("busy") || availability.includes("unavailable")) blocked.push("worker busy");
  if (missingSkills.length) blocked.push(`missing skills: ${missingSkills.join(", ")}`);
  if (missingLicences.length) blocked.push(`missing licences: ${missingLicences.join(", ")}`);
  if (!availability || availability.includes("unknown")) checks.push("availability unknown");
  if (availability.includes("ready on") || availability.includes("ready_on")) {
    checks.push("ready on a future date");
  }
  if (!worker.workerAppVisible) checks.push("not worker-confirmed");

  const availabilityConfirmedAt = iso(worker.availabilityConfirmedAt);
  const confirmationAge = availabilityConfirmedAt ? daysBetween(availabilityConfirmedAt, now) : null;
  if (confirmationAge !== null && confirmationAge > 7) {
    checks.push("availability confirmation is over 7 days old");
  }

  for (const review of Array.isArray(worker.licenceReviews) ? worker.licenceReviews : []) {
    if (!requiredLicences.some((item) => includesRequirement(item, [review.name]))) continue;
    const days = daysBetween(now, review.expiresAt);
    if (days !== null && days < 0) blocked.push(`${review.name} has expired`);
    else if (days !== null && days <= 30) checks.push(`${review.name} expires within 30 days`);
  }

  const sharedReadiness = worker.readiness && typeof worker.readiness === "object"
    ? Object.entries(worker.readiness)
    : [];
  for (const [label, stateValue] of sharedReadiness) {
    const state = normalise(stateValue);
    if (/(blocked|expired|invalid|missing)/.test(state)) blocked.push(`${label} ${state}`);
    else if (/(check|pending|review)/.test(state)) checks.push(`${label} ${state}`);
  }

  const reasons = blocked.length ? blocked : checks.length ? checks : ["all visible requirements met"];
  return {
    status: blocked.length ? "BLOCKED" : checks.length ? "CHECK" : "READY",
    reasons: unique(reasons),
    missingSkills,
    missingLicences,
  };
}

function workerResult(worker, request, readiness, detail) {
  const location = Array.isArray(worker.locations)
    ? worker.locations[0]
    : worker.location;
  return createResult({
    id: `worker:${worker.personId || worker.rosterWorkerId}:${request?.requestId || "general"}`,
    title: worker.name || "Worker",
    subtitle: unique([text(worker.trade), text(location), text(request?.role)]).join(" · "),
    detail,
    missing: readiness
      ? [...readiness.missingSkills, ...readiness.missingLicences]
      : [],
    sources: request
      ? [...worker.sourceLabels, SOURCE.REQUEST]
      : worker.sourceLabels,
    updatedAt: newestDate(worker.updatedAt, request?.updatedAt),
    readiness: readiness?.status || null,
    readinessReasons: readiness?.reasons || [],
    status: text(worker.availability?.label || worker.availability) || null,
    target: workerTarget(worker),
  });
}

function action(id, label, kind, target = {}, requiresConfirmation = false) {
  return { id, label, kind, target, requiresConfirmation, writePerformed: false };
}

function finalResponse({
  intent,
  answer,
  groups = [],
  actions = [],
  data,
  now,
  supported = true,
}) {
  const resultGroups = groups
    .map((group) => ({ ...group, results: group.results.slice(0, 50) }))
    .filter((group) => group.results.length);
  const results = resultGroups.flatMap((group) => group.results);
  const evidence = [];
  const seenEvidence = new Set();
  for (const result of results) {
    for (const source of result.sources) {
      const key = `${source}:${result.id}`;
      if (seenEvidence.has(key)) continue;
      seenEvidence.add(key);
      evidence.push({
        source,
        resultId: result.id,
        updatedAt: result.updatedAt,
      });
    }
  }
  const readiness = results.reduce(
    (summary, result) => {
      if (result.readiness && Object.hasOwn(summary, result.readiness)) {
        summary[result.readiness] += 1;
      }
      return summary;
    },
    { READY: 0, CHECK: 0, BLOCKED: 0 },
  );
  const allDates = [
    ...results.map((result) => result.updatedAt),
    ...data.requests.map((item) => item.updatedAt),
    ...data.applications.map((item) => item.updatedAt),
    ...data.placements.map((item) => item.updatedAt),
    ...data.pipelineEvents.map((item) => item.createdAt),
    ...data.rosterEvents.map((item) => item.createdAt),
  ];
  return {
    schema: "nexus-agency-query-response/v1",
    answer,
    intent,
    supported,
    resultGroups,
    evidence: evidence.slice(0, 100),
    readiness,
    dataFreshness: {
      checkedAt: iso(now),
      newestSourceUpdate: newestDate(allDates),
      resultCount: results.length,
    },
    suggestedActions: actions,
    writePerformed: false,
  };
}

function requestCandidates(data, request, now) {
  return data.workers.map((worker) => ({
    worker,
    readiness: readinessFor(worker, request, now),
  }));
}

function readyForRequests(data, requests, now, requestedDate) {
  const ready = [];
  const review = [];
  for (const request of requests) {
    for (const { worker, readiness } of requestCandidates(data, request, now)) {
      const available = requestedDate
        ? availabilityOn(worker, requestedDate)
        : !normalise(worker.availability?.status || worker.availability).includes("busy");
      const result = workerResult(
        worker,
        request,
        readiness,
        readiness.status === "READY"
          ? `Ready for ${request.role} from all currently visible evidence.`
          : `Not Ready yet: ${readiness.reasons.join("; ")}.`,
      );
      if (available && readiness.status === "READY") ready.push(result);
      else review.push(result);
    }
  }
  return { ready, review };
}

function selectedRequestRequired(intent, data, context, query, now) {
  const request = findRequest(data, context, query);
  if (!request) {
    return finalResponse({
      intent,
      answer:
        "Select one existing request first. I cannot calculate request readiness without a tenant-scoped Request record.",
      actions: [action("open-requests", "Choose request", "OPEN_REQUESTS")],
      data,
      now,
    });
  }
  return request;
}

function applicationResult(data, application, detail, sources = [SOURCE.APPLICATION]) {
  const { worker, label, sharingRevoked } = applicationWorker(data, application);
  const request = data.requests.find((item) => item.requestId === application.requestId);
  const readinessReasons = sharingRevoked
    ? ["Worker App recruiter-safe permission is no longer active"]
    : list(application.readinessReasons);
  const readiness = sharingRevoked ? "BLOCKED" : text(application.readinessStatus) || "CHECK";
  return createResult({
    id: `application:${application.applicationId}`,
    title: label,
    subtitle: unique([text(request?.role), text(request?.location), text(application.stage)]).join(" · "),
    detail,
    missing: sharingRevoked ? ["active recruiter-safe sharing"] : [],
    sources: unique([...sources, ...(request ? [SOURCE.REQUEST] : []), ...(worker ? worker.sourceLabels : [])]),
    updatedAt: newestDate(application.updatedAt, request?.updatedAt),
    readiness,
    readinessReasons,
    status: text(application.stage),
    target: applicationTarget(application),
  });
}

function eventKey(event) {
  const details = event.details && typeof event.details === "object" ? event.details : {};
  const localMessageId =
    typeof details.localMessageId === "string" ||
    typeof details.localMessageId === "number"
      ? String(details.localMessageId).trim()
      : "";
  return localMessageId
    ? `message:${localMessageId}`
    : text(event.applicationId)
      ? `application:${event.applicationId}`
      : text(event.rosterWorkerId)
        ? `roster:${event.rosterWorkerId}`
        : `event:${event.eventId}`;
}

function contactLabel(data, event) {
  if (event.applicationId) {
    const application = data.applications.find(
      (item) => item.applicationId === event.applicationId,
    );
    if (application) return applicationWorker(data, application).label;
  }
  if (event.rosterWorkerId) {
    return data.workers.find((worker) => worker.rosterWorkerId === event.rosterWorkerId)?.name || "Agency roster worker";
  }
  return "Contact";
}

function eventDetail(event) {
  const details = event.details && typeof event.details === "object" ? event.details : {};
  const values = [details.channel, details.nextStage, details.nextStatus, details.previousStage]
    .map(text)
    .filter(Boolean);
  return values.length ? values.join(" · ") : "Audit history entry";
}

export function runAgencyNexusQuery({ tenantId, query, context, snapshot, now = new Date().toISOString() }) {
  const safeTenantId = text(tenantId);
  if (!safeTenantId) throw new Error("NEXUS_TENANT_REQUIRED");
  const safeQuery = text(query).slice(0, 500);
  const safeNow = iso(now) || new Date().toISOString();
  const safe = safeContext(context);
  const data = prepareSnapshot(safeTenantId, snapshot);
  const intent = classifyIntent(safeQuery);

  if (intent === "AVAILABLE_AND_READY") {
    const location = extractLocation(safeQuery);
    const date = queryDate(safeQuery, safeNow);
    let targetRequests = safe.requestId
      ? data.requests.filter((request) => request.requestId === safe.requestId)
      : data.requests.filter((request) => request.status === "OPEN");
    if (location) {
      targetRequests = targetRequests.filter((request) =>
        normalise(request.location).includes(normalise(location)),
      );
    }
    if (!targetRequests.length) {
      return finalResponse({
        intent,
        answer: `No matching OPEN request was found${location ? ` for ${location}` : ""}. Readiness is not guessed without a Request record.`,
        actions: [action("open-requests", "Review requests", "OPEN_REQUESTS")],
        data,
        now: safeNow,
      });
    }
    const { ready, review } = readyForRequests(data, targetRequests, safeNow, date);
    return finalResponse({
      intent,
      answer: ready.length
        ? `${ready.length} candidate${ready.length === 1 ? " is" : "s are"} Available and Ready${location ? ` for ${location}` : ""}${date ? ` on ${date}` : ""}. Review the evidence before taking action.`
        : `No candidate is both Available and Ready${location ? ` for ${location}` : ""}${date ? ` on ${date}` : ""}. The visible checks and blockers are listed below.`,
      groups: [
        { id: "ready", label: "Ready candidates", results: ready },
        { id: "review", label: "Checks and blockers", results: review.slice(0, 12) },
      ],
      actions: targetRequests.slice(0, 3).map((request) =>
        action(`matches:${request.requestId}`, `Open ${request.role} matches`, "OPEN_MATCHES", requestTarget(request, "matches")),
      ),
      data,
      now: safeNow,
    });
  }

  if (intent === "READY_FOR_REQUEST" || intent === "MATCH_WORKERS") {
    const request = selectedRequestRequired(intent, data, safe, safeQuery, safeNow);
    if (!request.requestId) return request;
    const { ready, review } = readyForRequests(data, [request], safeNow, queryDate(safeQuery, safeNow));
    return finalResponse({
      intent,
      answer: ready.length
        ? `${ready.length} candidate${ready.length === 1 ? " is" : "s are"} Ready for ${request.role}. NEXUS explains the evidence; the recruiter makes every decision.`
        : `No candidate is currently Ready for ${request.role}. Every visible Check and Blocker is shown below.`,
      groups: [
        { id: "ready", label: "Ready candidates", results: ready },
        { id: "review", label: "Checks and blockers", results: review.slice(0, 20) },
      ],
      actions: [action("open-matches", "Open Matches", "OPEN_MATCHES", requestTarget(request, "matches"))],
      data,
      now: safeNow,
    });
  }

  if (intent === "WHY_BLOCKED") {
    const application = findApplication(data, safe);
    const request = application
      ? data.requests.find((item) => item.requestId === application.requestId) || null
      : findRequest(data, safe, safeQuery);
    const worker = findWorker(data, safe, application);
    if (!worker && application?.personId) {
      const result = applicationResult(
        data,
        application,
        "Current Worker App fields are hidden because recruiter-safe sharing is no longer active.",
      );
      return finalResponse({
        intent,
        answer: "This candidate is Blocked because Worker App recruiter-safe sharing is no longer active. Agency-owned application history remains visible.",
        groups: [{ id: "blocked", label: "Blocked evidence", results: [result] }],
        actions: [action("open-pipeline", "Open pipeline", "OPEN_PIPELINE", applicationTarget(application), true)],
        data,
        now: safeNow,
      });
    }
    if (!worker || !request) {
      return finalResponse({
        intent,
        answer: "Select both an existing worker and request first. I cannot explain readiness without those tenant-scoped records.",
        actions: [action("open-matches", "Open Matches", "OPEN_MATCHES")],
        data,
        now: safeNow,
      });
    }
    const readiness = readinessFor(worker, request, safeNow);
    const result = workerResult(
      worker,
      request,
      readiness,
      readiness.reasons.join("; "),
    );
    return finalResponse({
      intent,
      answer: `${worker.name} is ${humanise(readiness.status)} for ${request.role}: ${readiness.reasons.join("; ")}.`,
      groups: [{ id: "readiness", label: "Readiness evidence", results: [result] }],
      actions: [
        action("open-worker", "Open Worker", "OPEN_WORKER", workerTarget(worker)),
        action("open-matches", "Open Matches", "OPEN_MATCHES", requestTarget(request, "matches")),
      ],
      data,
      now: safeNow,
    });
  }

  if (intent === "LICENCES_EXPIRING") {
    const results = [];
    for (const worker of data.workers) {
      for (const review of Array.isArray(worker.licenceReviews) ? worker.licenceReviews : []) {
        const days = daysBetween(safeNow, review.expiresAt);
        if (days === null || days < 0 || days > 30) continue;
        results.push(createResult({
          id: `licence:${worker.personId || worker.rosterWorkerId}:${normalise(review.name)}`,
          title: worker.name || "Worker",
          subtitle: `${review.name} · expires ${iso(review.expiresAt)?.slice(0, 10)}`,
          detail: `${days} day${days === 1 ? "" : "s"} remaining. Expiry is a Check, never an automatic rejection.`,
          sources: worker.sourceLabels,
          updatedAt: worker.updatedAt,
          readiness: "CHECK",
          readinessReasons: [`${review.name} expires within 30 days`],
          status: "EXPIRING",
          target: workerTarget(worker),
        }));
      }
    }
    results.sort((left, right) => text(left.subtitle).localeCompare(text(right.subtitle)));
    return finalResponse({
      intent,
      answer: results.length
        ? `${results.length} shared licence or certificate record${results.length === 1 ? " expires" : "s expire"} within 30 days.`
        : "No currently visible licence or certificate record has a readable expiry date within 30 days.",
      groups: [{ id: "expiring", label: "Expiring evidence", results }],
      actions: [action("open-workers", "Open Workers", "OPEN_WORKERS")],
      data,
      now: safeNow,
    });
  }

  if (intent === "OPEN_REQUESTS_NO_READY") {
    const results = data.requests
      .filter((request) => request.status === "OPEN")
      .map((request) => {
        const candidates = requestCandidates(data, request, safeNow);
        const readyCount = candidates.filter((item) => item.readiness.status === "READY").length;
        if (readyCount) return null;
        const checks = candidates.filter((item) => item.readiness.status === "CHECK").length;
        const blocked = candidates.filter((item) => item.readiness.status === "BLOCKED").length;
        return createResult({
          id: `request:${request.requestId}`,
          title: request.role,
          subtitle: `${request.client} · ${request.location}`,
          detail: `0 Ready · ${checks} Check · ${blocked} Blocked`,
          missing: candidates.length ? [] : ["candidate records"],
          sources: [SOURCE.REQUEST],
          updatedAt: request.updatedAt,
          readiness: "BLOCKED",
          readinessReasons: [candidates.length ? "no READY candidates" : "no candidates available to assess"],
          status: request.status,
          target: requestTarget(request, "matches"),
        });
      })
      .filter(Boolean);
    return finalResponse({
      intent,
      answer: results.length
        ? `${results.length} OPEN request${results.length === 1 ? " has" : "s have"} no Ready candidate.`
        : "Every OPEN request currently has at least one Ready candidate.",
      groups: [{ id: "uncovered", label: "Requests without Ready candidates", results }],
      actions: results.slice(0, 3).map((result) =>
        action(`matches:${result.target.requestId}`, `Open ${result.title} matches`, "OPEN_MATCHES", result.target),
      ),
      data,
      now: safeNow,
    });
  }

  if (intent === "WAITING_FOR_RESPONSE") {
    const results = data.applications
      .filter((application) =>
        application.stage === "CONTACTED" ||
        /await.*(response|reply)/i.test(text(application.nextAction)),
      )
      .map((application) => applicationResult(
        data,
        application,
        `Waiting since ${iso(application.lastContactAt || application.updatedAt)?.slice(0, 10) || "date not recorded"}.`,
        [SOURCE.APPLICATION, ...(application.lastContactAt ? [SOURCE.AUDIT] : [])],
      ));
    return finalResponse({
      intent,
      answer: results.length
        ? `${results.length} candidate${results.length === 1 ? " is" : "s are"} waiting for a recorded response.`
        : "No application is currently recorded as waiting for a response.",
      groups: [{ id: "waiting", label: "Waiting for response", results }],
      actions: [action("open-messages", "Open Messages", "OPEN_MESSAGES")],
      data,
      now: safeNow,
    });
  }

  if (intent === "STUCK_IN_STAGE") {
    const results = data.applications
      .filter((application) => !TERMINAL_APPLICATION_STAGES.has(application.stage))
      .map((application) => {
        const days = daysBetween(application.updatedAt, safeNow);
        return {
          days: days ?? -1,
          result: applicationResult(
            data,
            application,
            days === null
              ? "Stage update date is missing."
              : `${days} day${days === 1 ? "" : "s"} in ${application.stage}.`,
          ),
        };
      })
      .sort((left, right) => right.days - left.days)
      .map((item) => item.result);
    return finalResponse({
      intent,
      answer: results.length
        ? `${results[0].title} has the longest current stage age. Review dates and next actions below.`
        : "No active application stage is available to compare.",
      groups: [{ id: "stuck", label: "Longest in current stage", results }],
      actions: [action("open-pipeline", "Open pipeline", "OPEN_PIPELINE")],
      data,
      now: safeNow,
    });
  }

  if (intent === "INTERVIEWS_NEED_OUTCOME") {
    const results = data.applications
      .filter((application) => application.stage === "INTERVIEW")
      .map((application) => applicationResult(
        data,
        application,
        "Interview stage has no later recorded outcome.",
      ));
    return finalResponse({
      intent,
      answer: results.length
        ? `${results.length} interview${results.length === 1 ? " needs" : "s need"} a recruiter-recorded outcome.`
        : "No application is currently waiting in INTERVIEW.",
      groups: [{ id: "interviews", label: "Interviews needing outcome", results }],
      actions: [action("open-pipeline", "Review interviews", "OPEN_PIPELINE", {}, true)],
      data,
      now: safeNow,
    });
  }

  if (intent === "OFFERS_NEED_PLACEMENT") {
    const placementApplicationIds = new Set(data.placements.map((placement) => placement.applicationId));
    const results = data.applications
      .filter((application) => application.stage === "OFFERED" && !placementApplicationIds.has(application.applicationId))
      .map((application) => {
        const result = applicationResult(
          data,
          application,
          "Offer is recorded, but placement details have not been created.",
        );
        result.missing = ["placement start date", "pay rate", "bill rate"];
        return result;
      });
    return finalResponse({
      intent,
      answer: results.length
        ? `${results.length} offer${results.length === 1 ? " needs" : "s need"} placement details and explicit recruiter confirmation.`
        : "No OFFERED application is missing a placement record.",
      groups: [{ id: "offers", label: "Offers needing placement details", results }],
      actions: [action("open-pipeline", "Prepare placement", "OPEN_PIPELINE", {}, true)],
      data,
      now: safeNow,
    });
  }

  if (intent === "PLACEMENTS_STARTING") {
    const start = startOfUtcDay(safeNow);
    const end = start === null ? null : start + 7 * 86_400_000;
    const results = data.placements
      .filter((placement) => {
        const date = startOfUtcDay(placement.startDate);
        return date !== null && start !== null && end !== null && date >= start && date <= end && !["COMPLETED", "CANCELLED"].includes(placement.status);
      })
      .sort((left, right) => text(left.startDate).localeCompare(text(right.startDate)))
      .map((placement) => createResult({
        id: `placement:${placement.placementId}`,
        title: text(placement.role) || "Placement",
        subtitle: unique([text(placement.client), text(placement.location), text(placement.startDate)]).join(" · "),
        detail: `Starts ${text(placement.startDate)} · ${placement.status}`,
        missing: [
          ...(placement.payRate === null || placement.payRate === undefined ? ["pay rate"] : []),
          ...(placement.billRate === null || placement.billRate === undefined ? ["bill rate"] : []),
        ],
        sources: [SOURCE.PLACEMENT],
        updatedAt: placement.updatedAt,
        readiness: null,
        status: placement.status,
        target: placementTarget(placement),
      }));
    return finalResponse({
      intent,
      answer: results.length
        ? `${results.length} placement${results.length === 1 ? " starts" : "s start"} in the next 7 days.`
        : "No active placement starts in the next 7 days.",
      groups: [{ id: "starting", label: "Starting in 7 days", results }],
      actions: [action("open-pipeline", "Open placements", "OPEN_PIPELINE")],
      data,
      now: safeNow,
    });
  }

  if (intent === "PLACEMENTS_MISSING_RATES") {
    const results = data.placements
      .filter((placement) =>
        placement.payRate === null || placement.payRate === undefined ||
        placement.billRate === null || placement.billRate === undefined,
      )
      .map((placement) => {
        const missing = [
          ...(placement.payRate === null || placement.payRate === undefined ? ["pay rate"] : []),
          ...(placement.billRate === null || placement.billRate === undefined ? ["bill rate"] : []),
        ];
        return createResult({
          id: `placement:${placement.placementId}`,
          title: text(placement.role) || "Placement",
          subtitle: unique([text(placement.client), text(placement.location), text(placement.startDate)]).join(" · "),
          detail: `Missing ${missing.join(" and ")}. Payroll is not calculated.`,
          missing,
          sources: [SOURCE.PLACEMENT],
          updatedAt: placement.updatedAt,
          status: placement.status,
          target: placementTarget(placement),
        });
      });
    return finalResponse({
      intent,
      answer: results.length
        ? `${results.length} placement${results.length === 1 ? " is" : "s are"} missing pay or bill rates.`
        : "Every placement currently has both pay and bill rates recorded.",
      groups: [{ id: "rates", label: "Missing rates", results }],
      actions: [action("open-pipeline", "Review placements", "OPEN_PIPELINE", {}, true)],
      data,
      now: safeNow,
    });
  }

  if (intent === "CONTACTS_UNCONFIRMED") {
    const events = [...data.rosterEvents, ...data.pipelineEvents]
      .filter((event) => ["CONTACT_OPENED", "CONTACT_CONFIRMED"].includes(event.eventType))
      .sort((left, right) => (timestamp(left.createdAt) || 0) - (timestamp(right.createdAt) || 0));
    const openContacts = new Map();
    for (const event of events) {
      const key = eventKey(event);
      if (event.eventType === "CONTACT_CONFIRMED") openContacts.delete(key);
      else openContacts.set(key, event);
    }
    const results = Array.from(openContacts.values())
      .sort((left, right) => (timestamp(right.createdAt) || 0) - (timestamp(left.createdAt) || 0))
      .map((event) => {
        const application = event.applicationId
          ? data.applications.find((item) => item.applicationId === event.applicationId)
          : null;
        return createResult({
          id: `contact:${event.eventId}`,
          title: contactLabel(data, event),
          subtitle: eventDetail(event),
          detail: "External contact was opened, but SENT was not explicitly confirmed.",
          missing: ["explicit SENT confirmation"],
          sources: [SOURCE.AUDIT],
          updatedAt: event.createdAt,
          readiness: application?.readinessStatus || "CHECK",
          readinessReasons: application?.readinessReasons || ["contact outcome unconfirmed"],
          status: "OPENED · NOT SENT",
          target: { type: "messages", applicationId: event.applicationId || null, rosterWorkerId: event.rosterWorkerId || null },
        });
      });
    return finalResponse({
      intent,
      answer: results.length
        ? `${results.length} contact${results.length === 1 ? " was" : "s were"} opened externally but not confirmed as SENT.`
        : "No open contact audit event is waiting for explicit SENT confirmation.",
      groups: [{ id: "contacts", label: "Opened, not confirmed", results }],
      actions: [action("open-messages", "Open Messages", "OPEN_MESSAGES", {}, true)],
      data,
      now: safeNow,
    });
  }

  if (intent === "IMPORTED_NOT_CONNECTED") {
    const results = data.workers
      .filter((worker) => worker.rosterWorkerId && (!worker.workerAppVisible || worker.connectionStatus !== "CONNECTED"))
      .map((worker) => {
        const revoked = worker.sharingStatus === "REVOKED";
        const detail = revoked
          ? "Worker App sharing was revoked. Only the agency-owned roster record remains visible."
          : `Connection status: ${text(worker.connectionStatus) || "IMPORTED"}.`;
        return createResult({
          id: `roster:${worker.rosterWorkerId}`,
          title: worker.name || "Agency roster worker",
          subtitle: unique([text(worker.trade), text(worker.location)]).join(" · "),
          detail,
          missing: ["active Worker App recruiter-safe connection"],
          sources: [SOURCE.ROSTER],
          updatedAt: worker.updatedAt,
          readiness: revoked ? "BLOCKED" : "CHECK",
          readinessReasons: [revoked ? "recruiter-safe sharing revoked" : "not connected to Worker App"],
          status: text(worker.connectionStatus) || "IMPORTED",
          target: workerTarget(worker),
        });
      });
    return finalResponse({
      intent,
      answer: results.length
        ? `${results.length} imported roster worker${results.length === 1 ? " is" : "s are"} not connected to Worker App.`
        : "Every imported roster worker is connected to an active recruiter-safe Worker App share.",
      groups: [{ id: "unconnected", label: "Not connected", results }],
      actions: [action("open-workers", "Open Workers", "OPEN_WORKERS")],
      data,
      now: safeNow,
    });
  }

  if (intent === "LATEST_REQUEST_ACTIVITY") {
    const request = selectedRequestRequired(intent, data, safe, safeQuery, safeNow);
    if (!request.requestId) return request;
    const results = data.pipelineEvents
      .filter((event) => event.requestId === request.requestId)
      .sort((left, right) => (timestamp(right.createdAt) || 0) - (timestamp(left.createdAt) || 0))
      .slice(0, 20)
      .map((event) => {
        const application = event.applicationId
          ? data.applications.find((item) => item.applicationId === event.applicationId)
          : null;
        return createResult({
          id: `event:${event.eventId}`,
          title: humanise(event.eventType),
          subtitle: `${request.role} · ${eventDetail(event)}`,
          detail: `Recorded ${iso(event.createdAt)?.replace("T", " ").slice(0, 16) || "without a readable date"}.`,
          sources: [SOURCE.AUDIT, SOURCE.REQUEST],
          updatedAt: event.createdAt,
          readiness: application?.readinessStatus || null,
          readinessReasons: application?.readinessReasons || [],
          status: text(event.eventType),
          target: { type: "pipeline", requestId: request.requestId, applicationId: event.applicationId || null, placementId: event.placementId || null },
        });
      });
    return finalResponse({
      intent,
      answer: results.length
        ? `Showing the latest ${results.length} audit event${results.length === 1 ? "" : "s"} for ${request.role}.`
        : `No pipeline audit activity is recorded for ${request.role}.`,
      groups: [{ id: "activity", label: "Latest request activity", results }],
      actions: [action("open-pipeline", "Open request pipeline", "OPEN_PIPELINE", requestTarget(request, "pipeline"))],
      data,
      now: safeNow,
    });
  }

  if (intent === "FIND_WORKERS" || intent === "CHECK_AVAILABILITY" || intent === "CONTACT_WORKERS") {
    const results = data.workers.slice(0, 50).map((worker) => {
      const status = normalise(worker.availability?.status || worker.availability);
      const readiness = status.includes("busy") ? "BLOCKED" : status.includes("unknown") || !worker.workerAppVisible ? "CHECK" : null;
      const reasons = readiness === "BLOCKED"
        ? ["worker busy"]
        : readiness === "CHECK"
          ? [worker.workerAppVisible ? "availability unknown" : "not worker-confirmed"]
          : [];
      return workerResult(worker, null, readiness ? { status: readiness, reasons, missingSkills: [], missingLicences: [] } : null, `Availability: ${text(worker.availability?.label || worker.availability) || "Unknown"}.`);
    });
    const answer = intent === "CONTACT_WORKERS"
      ? `${results.length} visible worker record${results.length === 1 ? " is" : "s are"} available for review. Contact can be prepared, but nothing has been sent.`
      : `${results.length} current worker record${results.length === 1 ? " is" : "s are"} visible from active Worker App shares and the agency roster.`;
    return finalResponse({
      intent,
      answer,
      groups: [{ id: "workers", label: "Worker records", results }],
      actions: [
        action("open-workers", "Open Workers", "OPEN_WORKERS"),
        ...(intent === "CONTACT_WORKERS" ? [action("open-messages", "Open Messages", "OPEN_MESSAGES", {}, true)] : []),
      ],
      data,
      now: safeNow,
    });
  }

  if (intent === "REVIEW_APPLICATIONS") {
    const results = data.applications.map((application) => applicationResult(
      data,
      application,
      text(application.nextAction) || "Review the next pipeline action.",
    ));
    return finalResponse({
      intent,
      answer: `${results.length} application${results.length === 1 ? " is" : "s are"} in the current agency pipeline.`,
      groups: [{ id: "applications", label: "Applications", results }],
      actions: [action("open-pipeline", "Open pipeline", "OPEN_PIPELINE")],
      data,
      now: safeNow,
    });
  }

  if (intent === "CREATE_REQUEST") {
    return finalResponse({
      intent,
      answer: "I can prepare a request draft. Nothing will be published until you review it and use the existing Confirm publish step.",
      actions: [action("prepare-request", "Prepare request draft", "PREPARE_REQUEST", {}, true)],
      data,
      now: safeNow,
    });
  }

  if (intent === "ACTION_GUARD") {
    return finalResponse({
      intent,
      answer: "I can prepare or open that workflow, but I cannot publish, send, shortlist, reject, change status or create a placement without explicit recruiter confirmation.",
      actions: [
        action("open-requests", "Open Requests", "OPEN_REQUESTS", {}, true),
        action("open-messages", "Open Messages", "OPEN_MESSAGES", {}, true),
      ],
      data,
      now: safeNow,
    });
  }

  return finalResponse({
    intent: "UNSUPPORTED",
    supported: false,
    answer: "That question is not supported yet. Ask about readiness, expiring licences, uncovered requests, pipeline delays, contact confirmation, placements or request activity.",
    data,
    now: safeNow,
  });
}

export const agencyNexusIntents = Object.freeze({ classifyIntent });
