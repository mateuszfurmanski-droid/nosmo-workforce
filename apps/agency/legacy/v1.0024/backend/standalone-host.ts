import path from "node:path";
import express from "express";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import jobSearchRouter from "./person-card-freeware/job-search";
import jobAiRouter from "./person-card-freeware/job-ai-match";
import onboardingRouter from "./person-card-freeware/onboarding";
import agencyRouter from "./person-card-freeware/agency";
import agencyV1FinalisationRouter from "./person-card-freeware/agency-v1-finalisation";
import authRouter from "./routes/auth";
import { authMiddleware } from "./middlewares/authMiddleware";

const app = express();
const port = Number(process.env.PORT || process.env.PERSON_CARD_FREEWARE_PORT || 4177);
const staticDir = path.resolve(process.cwd(), "modules/person-card-freeware");

app.disable("x-powered-by");
app.use(pinoHttp());
app.use(cookieParser());
app.use(express.json({ limit: "256kb" }));
app.use(express.urlencoded({ extended: false, limit: "256kb" }));
app.use(authMiddleware);

app.get("/api/person-card/_health", (_req, res) => {
  res.json({
    schema: "nosmo-person-card-freeware-health/v1",
    status: "ok",
    standalone: true,
    relationshipTreeRequired: false,
    workProfileSchema: "nexus-person-work-profile/v1",
    jobObjectSchema: "nexus-job-object/v1",
    agencyAtsSchema: "nexus-person-agency-candidate-list/v1",
    agencyV1FinalisationSchema: "nosmo-agency-v1-health/v1",
    authenticatedAgencyDesk: true,
  });
});

app.use("/api", authRouter);
app.use("/api", jobSearchRouter);
app.use("/api", jobAiRouter);
app.use("/api", onboardingRouter);
app.use("/api", agencyRouter);
app.use("/api", agencyV1FinalisationRouter);
app.use(express.static(staticDir, { index: "index.html", fallthrough: true }));

// Express 5 / path-to-regexp v8 requires a named wildcard. The braced form
// also matches `/`, preserving the SPA fallback used by the standalone app.
app.get("/{*splat}", (_req, res) => {
  res.sendFile(path.join(staticDir, "index.html"));
});

app.listen(port, "0.0.0.0", () => {
  console.log(`NOSMO Person Card Freeware listening on :${port}`);
});
