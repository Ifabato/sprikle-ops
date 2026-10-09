import { transitionHandler } from "@/server/api/work-orders";

export async function POST(
  request: Request,
  context: RouteContext<"/api/v1/work-orders/[ref]/transitions">,
) {
  return transitionHandler(request, (await context.params).ref);
}
