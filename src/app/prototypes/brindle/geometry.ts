// Scene geometry for the Brindle strands (all coordinates in a 1000 x 1000 viewBox that is
// stretched over the stage). Pure data and math; no DOM.

export type Mode = "desktop" | "mobile";
export type Pt = readonly [number, number];

export const OWNERS = ["T. Reyes", "J. Okafor", "M. Lindqvist"] as const;
export type Owner = (typeof OWNERS)[number];

/** Jobs in normalized scene space (u, v in 0..1) and their row slot in the product view. */
export const JOB_LAYOUT: Record<string, { owner: Owner; at: Pt; slot: 0 | 1 }> = {
  "WO-000118": { owner: "T. Reyes", at: [0.4, 0.22], slot: 0 },
  "WO-000124": { owner: "T. Reyes", at: [0.82, 0.4], slot: 1 },
  "WO-000121": { owner: "J. Okafor", at: [0.52, 0.5], slot: 0 },
  "WO-000127": { owner: "J. Okafor", at: [0.9, 0.16], slot: 1 },
  "WO-000115": { owner: "M. Lindqvist", at: [0.3, 0.72], slot: 0 },
  "WO-000126": { owner: "M. Lindqvist", at: [0.68, 0.64], slot: 1 },
};

/** Strand waypoints between the request origin and the record (normalized scene space). */
const STRAND_VIA: Record<Owner, Pt[]> = {
  "T. Reyes": [
    [0.2, 0.34],
    JOB_LAYOUT["WO-000118"]!.at,
    [0.62, 0.46],
    JOB_LAYOUT["WO-000124"]!.at,
    [0.88, 0.78],
  ],
  "J. Okafor": [
    [0.24, 0.1],
    JOB_LAYOUT["WO-000121"]!.at,
    [0.7, 0.26],
    JOB_LAYOUT["WO-000127"]!.at,
    [0.97, 0.56],
  ],
  "M. Lindqvist": [
    [0.14, 0.56],
    JOB_LAYOUT["WO-000115"]!.at,
    [0.5, 0.82],
    JOB_LAYOUT["WO-000126"]!.at,
    [0.78, 0.92],
  ],
};

export const ORIGIN: Pt = [0.0, 0.18];

interface ModeSpec {
  /** Scene region (normalized u,v -> viewBox). */
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  /** Where the strands converge: the top centre of the record window. */
  end: Pt;
  /** Product-view rows (viewBox y) and row extent (viewBox x). */
  rowsY: readonly [number, number, number];
  rowX: readonly [number, number];
  /** Slot centres in a row (viewBox x). */
  slotX: readonly [number, number];
}

export const MODES: Record<Mode, ModeSpec> = {
  desktop: {
    x0: 470,
    x1: 980,
    y0: 70,
    y1: 560,
    end: [500, 588],
    rowsY: [676, 750, 824],
    rowX: [200, 600],
    slotX: [285, 492],
  },
  mobile: {
    x0: 40,
    x1: 900,
    y0: 36,
    y1: 360,
    end: [500, 404],
    rowsY: [522, 592, 662],
    rowX: [40, 960],
    slotX: [235, 720],
  },
};

export function toView(mode: Mode, [u, v]: Pt): Pt {
  const m = MODES[mode];
  return [m.x0 + u * (m.x1 - m.x0), m.y0 + v * (m.y1 - m.y0)];
}

/** Catmull-Rom spline through points, as cubic Bezier path data. */
export function spline(points: readonly Pt[], tension = 0.5): string {
  if (points.length < 2) return "";
  const p = [points[0]!, ...points, points[points.length - 1]!];
  let d = `M ${p[1]![0].toFixed(1)} ${p[1]![1].toFixed(1)}`;
  for (let i = 1; i < p.length - 2; i++) {
    const [p0, p1, p2, p3] = [p[i - 1]!, p[i]!, p[i + 1]!, p[i + 2]!];
    const c1: Pt = [
      p1[0] + ((p2[0] - p0[0]) * tension) / 3,
      p1[1] + ((p2[1] - p0[1]) * tension) / 3,
    ];
    const c2: Pt = [
      p2[0] - ((p3[0] - p1[0]) * tension) / 3,
      p2[1] - ((p3[1] - p1[1]) * tension) / 3,
    ];
    d += ` C ${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

const scaled = (pts: readonly Pt[], [sx, sy]: Pt): Pt[] => pts.map(([x, y]) => [x * sx, y * sy]);

/** The woven strand for an owner: request origin -> their jobs -> the record. `s` maps the
 *  1000-unit viewBox to pixels so strokes and dash lengths stay true (no non-scaling-stroke). */
export function strandPath(mode: Mode, owner: Owner, s: Pt = [1, 1]): string {
  const pts = [
    toView(mode, ORIGIN),
    ...STRAND_VIA[owner].map((pt) => toView(mode, pt)),
    MODES[mode].end,
  ];
  return spline(scaled(pts, s));
}

/** The same strand resolved into its product-view row: a straight line with the same point count. */
export function rowPath(mode: Mode, owner: Owner, s: Pt = [1, 1]): string {
  const m = MODES[mode];
  const y = m.rowsY[OWNERS.indexOf(owner)]!;
  const n = STRAND_VIA[owner].length + 2;
  const pts: Pt[] = Array.from({ length: n }, (_, i) => [
    m.rowX[0] + ((m.rowX[1] - m.rowX[0]) * i) / (n - 1),
    y,
  ]);
  return spline(scaled(pts, s));
}

/** A job's position (viewBox) in the scene and in its product-view row slot. */
export function jobPositions(mode: Mode, reference: string): { scene: Pt; row: Pt } {
  const job = JOB_LAYOUT[reference]!;
  const m = MODES[mode];
  return {
    scene: toView(mode, job.at),
    row: [m.slotX[job.slot], m.rowsY[OWNERS.indexOf(job.owner)]!],
  };
}
