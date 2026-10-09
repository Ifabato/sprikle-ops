import { createWorkOrderHandler, listWorkOrdersHandler } from "@/server/api/work-orders";

export const GET = (request: Request) => listWorkOrdersHandler(request);
export const POST = (request: Request) => createWorkOrderHandler(request);
