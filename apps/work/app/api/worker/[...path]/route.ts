import { getChatGPTUser } from "../../../chatgpt-auth";
import { secureWorkerRequest } from "../../../worker-security";
import { handleWorkerRequest } from "../../../worker-server";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

async function dispatch(request: Request, context: RouteContext) {
  const { path } = await context.params;
  return secureWorkerRequest(request, path, async () => {
    const user = await getChatGPTUser();
    return handleWorkerRequest(request, path, user);
  });
}

export const GET = dispatch;
export const POST = dispatch;
export const PATCH = dispatch;
