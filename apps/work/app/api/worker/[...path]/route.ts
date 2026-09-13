import { secureWorkerRequest } from "../../../worker-security";
import { handleWorkerRequest } from "../../../worker-server";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

async function dispatch(request: Request, context: RouteContext) {
  const { path } = await context.params;
  return secureWorkerRequest(request, path, () => handleWorkerRequest(request, path));
}

export const GET = dispatch;
export const POST = dispatch;
export const PATCH = dispatch;
