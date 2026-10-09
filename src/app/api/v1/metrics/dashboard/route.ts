import { dashboardHandler } from "@/server/api/metrics";

export const GET = (request: Request) => dashboardHandler(request);
