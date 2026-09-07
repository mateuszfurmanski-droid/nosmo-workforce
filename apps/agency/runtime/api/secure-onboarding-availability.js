import {createSecureOnboardingHandler} from "../onboarding-security.js";

export default createSecureOnboardingHandler(
  ()=>import("./person-card/onboarding/availability.js"),
  {bucket:"worker-availability",limit:180,windowMs:60_000,maxBodyBytes:32*1024}
);
