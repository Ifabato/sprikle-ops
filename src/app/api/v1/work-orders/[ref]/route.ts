import { editWorkOrderHandler, getWorkOrderHandler } from "@/server/api/work-orders";

type Context = RouteContext<"/api/v1/work-orders/[ref]">;

export async function GET(request: Request, context: Context) {
  return getWorkOrderHandler(request, (await context.params).ref);
}

export async function PATCH(request: Request, context: Context) {
  return editWorkOrderHandler(request, (await context.params).ref);
}
