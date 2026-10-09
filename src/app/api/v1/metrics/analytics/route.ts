import { analyticsHandler } from "@/server/api/metrics";

export const GET = (request: Request) => analyticsHandler(request);
