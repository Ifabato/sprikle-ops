import { listAssigneesHandler } from "@/server/api/work-orders";

export const GET = (request: Request) => listAssigneesHandler(request);
