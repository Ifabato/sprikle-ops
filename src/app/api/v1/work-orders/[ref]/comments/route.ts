import { addCommentHandler, listCommentsHandler } from "@/server/api/work-orders";

type Context = RouteContext<"/api/v1/work-orders/[ref]/comments">;

export async function GET(request: Request, context: Context) {
  return listCommentsHandler(request, (await context.params).ref);
}

export async function POST(request: Request, context: Context) {
  return addCommentHandler(request, (await context.params).ref);
}
