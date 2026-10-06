import { describe, expect, it } from "vitest";
import { searchParamsToRecord, workOrderListQuerySchema } from "@/validation/work-order-list-query";

const parse = (query: string) =>
  workOrderListQuerySchema.safeParse(searchParamsToRecord(new URLSearchParams(query)));

describe("workOrderListQuerySchema", () => {
  it("applies defaults: active statuses, due date ascending, 25 per page", () => {
    expect(parse("")).toEqual({
      success: true,
      data: {
        page: 1,
        pageSize: 25,
        q: undefined,
        statuses: ["OPEN", "IN_PROGRESS", "BLOCKED"],
        priorities: undefined,
        assignee: undefined,
        serviceAreaId: undefined,
        due: undefined,
        sort: "dueAt",
        order: "asc",
      },
    });
  });

  it("parses every supported parameter", () => {
    const result = parse(
      "page=3&pageSize=50&q=+lobby+&status=COMPLETED&status=CANCELLED,COMPLETED&priority=HIGH,CRITICAL" +
        "&assignee=tech-1&serviceAreaId=area-north&due=week&sort=createdAt&order=asc",
    );
    expect(result.success && result.data).toEqual({
      page: 3,
      pageSize: 50,
      q: "lobby",
      statuses: ["COMPLETED", "CANCELLED"],
      priorities: ["HIGH", "CRITICAL"],
      assignee: { kind: "user", id: "tech-1" },
      serviceAreaId: "area-north",
      due: "week",
      sort: "createdAt",
      order: "asc",
    });
  });

  it("supports status=all, assignee=me/unassigned, and per-field default order", () => {
    expect(parse("status=all").success && parse("status=all")).toMatchObject({
      data: { statuses: ["OPEN", "IN_PROGRESS", "BLOCKED", "COMPLETED", "CANCELLED"] },
    });
    expect(parse("assignee=me")).toMatchObject({ data: { assignee: { kind: "me" } } });
    expect(parse("assignee=unassigned")).toMatchObject({
      data: { assignee: { kind: "unassigned" } },
    });
    expect(parse("sort=priority")).toMatchObject({ data: { order: "desc" } });
    expect(parse("sort=updatedAt")).toMatchObject({ data: { order: "desc" } });
    expect(parse("sort=status")).toMatchObject({ data: { order: "asc" } });
    expect(parse("q=%20%20")).toMatchObject({ data: { q: undefined } });
  });

  it.each([
    ["unknown parameter", "utm_source=email"],
    ["created-date filter (deferred)", "createdFrom=2026-01-01"],
    ["page 0", "page=0"],
    ["page too large", "page=10001"],
    ["negative page", "page=-1"],
    ["fractional page", "page=1.5"],
    ["non-numeric page", "page=two"],
    ["repeated page", "page=1&page=2"],
    ["pageSize too large", "pageSize=51"],
    ["unknown status", "status=DONE"],
    ["status=all mixed with others", "status=all,OPEN"],
    ["empty status", "status="],
    ["lower-case status", "status=open"],
    ["unknown priority", "priority=URGENT"],
    ["empty priority", "priority=,"],
    ["invalid assignee", "assignee=a%20b"],
    ["repeated assignee", "assignee=me&assignee=unassigned"],
    ["invalid service area", "serviceAreaId=../x"],
    ["unknown due filter", "due=thisweek"],
    ["unknown sort", "sort=title"],
    ["unknown order", "order=up"],
    ["over-long search", `q=${"x".repeat(201)}`],
  ])("rejects %s", (_label, query) => {
    expect(parse(query).success).toBe(false);
  });
});

describe("searchParamsToRecord", () => {
  it("collects repeated keys into arrays", () => {
    expect(searchParamsToRecord(new URLSearchParams("a=1&b=2&a=3&a=4"))).toEqual({
      a: ["1", "3", "4"],
      b: "2",
    });
  });
});
