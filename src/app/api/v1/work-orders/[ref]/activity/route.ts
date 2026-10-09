import { listActivityHandler } from "@/server/api/work-orders";

export async function GET(
  request: Request,
  context: RouteContext<"/api/v1/work-orders/[ref]/activity">,
) {
  return listActivityHandler(request, (await context.params).ref);
}
