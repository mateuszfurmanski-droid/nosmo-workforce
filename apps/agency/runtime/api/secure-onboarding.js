import {createSecureOnboardingHandler} from "../onboarding-security.js";

export default createSecureOnboardingHandler(
  ()=>import("./person-card/onboarding/[...path].js"),
  {bucket:"onboarding",limit:120,windowMs:60_000,maxBodyBytes:128*1024}
);
