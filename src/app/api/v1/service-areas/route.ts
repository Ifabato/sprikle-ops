import { listServiceAreasHandler } from "@/server/api/work-orders";

export const GET = (request: Request) => listServiceAreasHandler(request);
