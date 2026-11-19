import { haversineKm } from "./locations.service";

export type RouteMode = "driving" | "walking";

export interface RouteStep {
  instruction: string;
  roadName: string;
  distanceMeters: number;
  durationSeconds: number;
  maneuverType: string;
  maneuverModifier?: string;
  lat: number;
  lng: number;
}

export interface ComputedRoute {
  mode: RouteMode;
  source: "osrm" | "fallback";
  distanceKm: number;
  durationMinutes: number;
  geometry: Array<[number, number]>;
  steps: RouteStep[];
  bbox: [number, number, number, number];
}

interface OsrmManeuver {
  type?: string;
  modifier?: string;
  exit?: number;
  location?: [number, number];
}

interface OsrmStep {
  name?: string;
  distance?: number;
  duration?: number;
  maneuver?: OsrmManeuver;
}

function formatModifierPhrase(modifier?: string): string {
  switch (String(modifier || "").toLowerCase()) {
    case "left":
      return "left";
    case "right":
      return "right";
    case "slight left":
      return "slight left";
    case "slight right":
      return "slight right";
    case "sharp left":
      return "sharp left";
    case "sharp right":
      return "sharp right";
    case "uturn":
      return "a U-turn";
    case "straight":
      return "straight";
    default:
      return "";
  }
}

export function buildHumanInstruction(
  step: { name?: string; maneuver?: { type?: string; modifier?: string; exit?: number } },
  mode: RouteMode
): string {
  const type = String(step.maneuver?.type || "continue").toLowerCase();
  const modifier = formatModifierPhrase(step.maneuver?.modifier);
  const roadName = typeof step.name === "string" ? step.name.trim() : "";
  const ontoRoad = roadName ? ` onto ${roadName}` : "";
  const onRoad = roadName ? ` on ${roadName}` : "";
  const verb = mode === "walking" ? "Walk" : "Head";

  switch (type) {
    case "depart":
      return `${verb}${modifier ? ` ${modifier}` : ""}${onRoad}`.trim();
    case "arrive":
      return `Arrive at destination${onRoad}`.trim();
    case "turn":
      if (modifier === "a U-turn") return `Make a U-turn${ontoRoad}`;
      return `Turn ${modifier || "ahead"}${ontoRoad}`.trim();
    case "new name":
      return `Continue${ontoRoad}`.trim();
    case "merge":
      return `Merge${modifier ? ` ${modifier}` : ""}${ontoRoad}`.trim();
    case "on ramp":
      return `Take ramp${modifier ? ` ${modifier}` : ""}${ontoRoad}`.trim();
    case "off ramp":
      return `Take exit${modifier ? ` ${modifier}` : ""}${ontoRoad}`.trim();
    case "fork":
      return `Keep ${modifier || "straight"} at fork${ontoRoad}`.trim();
    case "end of road":
      return modifier === "a U-turn"
        ? `Make a U-turn at end of road${ontoRoad}`
        : `Turn ${modifier || "ahead"} at end of road${ontoRoad}`;
    case "roundabout":
    case "rotary": {
      const exitNum = Number(step.maneuver?.exit);
      const exitText =
        Number.isFinite(exitNum) && exitNum > 0 ? `exit ${Math.trunc(exitNum)}` : "the roundabout";
      return `Take ${exitText}${ontoRoad}`.trim();
    }
    case "continue":
    default:
      if (modifier && modifier !== "straight") {
        return `Keep ${modifier}${ontoRoad}`.trim();
      }
      return `Continue straight${onRoad}`.trim();
  }
}

function computeBbox(points: Array<[number, number]>): [number, number, number, number] {
  let minLat = Infinity;
  let minLng = Infinity;
  let maxLat = -Infinity;
  let maxLng = -Infinity;
  for (const [lat, lng] of points) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }
  return [
    Number(minLat.toFixed(6)),
    Number(minLng.toFixed(6)),
    Number(maxLat.toFixed(6)),
    Number(maxLng.toFixed(6)),
  ];
}

function downsampleGeometry(
  points: Array<[number, number]>,
  maxPoints = 600
): Array<[number, number]> {
  if (points.length <= maxPoints) return points;
  const result: Array<[number, number]> = [points[0]];
  const step = (points.length - 1) / (maxPoints - 1);
  for (let i = 1; i < maxPoints - 1; i++) {
    result.push(points[Math.round(i * step)]);
  }
  result.push(points[points.length - 1]);
  return result;
}

export function buildFallbackRoute(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
  mode: RouteMode
): ComputedRoute {
  const straightKm = haversineKm(fromLat, fromLng, toLat, toLng);
  const roadFactor = mode === "walking" ? 1.18 : 1.25;
  const distanceKm = Math.max(0.05, Number((straightKm * roadFactor).toFixed(2)));
  const speedKmh = mode === "walking" ? 4.8 : 28;
  const durationMinutes = Math.max(1, Math.round((distanceKm / speedKmh) * 60));
  const fLat = Number(fromLat.toFixed(6));
  const fLng = Number(fromLng.toFixed(6));
  const tLat = Number(toLat.toFixed(6));
  const tLng = Number(toLng.toFixed(6));
  const distanceMeters = Math.max(50, Math.round(distanceKm * 1000));
  const durationSeconds = Math.max(60, durationMinutes * 60);

  const geometry: Array<[number, number]> = [
    [fLat, fLng],
    [tLat, tLng],
  ];

  return {
    mode,
    source: "fallback",
    distanceKm,
    durationMinutes,
    geometry,
    steps: [
      {
        instruction: mode === "walking" ? "Walk toward destination" : "Head toward destination",
        roadName: "",
        distanceMeters,
        durationSeconds,
        maneuverType: "depart",
        lat: fLat,
        lng: fLng,
      },
      {
        instruction: "Arrive at destination",
        roadName: "",
        distanceMeters: 0,
        durationSeconds: 0,
        maneuverType: "arrive",
        lat: tLat,
        lng: tLng,
      },
    ],
    bbox: computeBbox(geometry),
  };
}

export async function computeRoadRoute(params: {
  fromLat: number;
  fromLng: number;
  toLat: number;
  toLng: number;
  mode?: RouteMode;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<ComputedRoute> {
  const { fromLat, fromLng, toLat, toLng } = params;
  const mode: RouteMode = params.mode === "walking" ? "walking" : "driving";

  if (
    !Number.isFinite(fromLat) ||
    !Number.isFinite(fromLng) ||
    !Number.isFinite(toLat) ||
    !Number.isFinite(toLng) ||
    fromLat < -90 ||
    fromLat > 90 ||
    toLat < -90 ||
    toLat > 90 ||
    fromLng < -180 ||
    fromLng > 180 ||
    toLng < -180 ||
    toLng > 180
  ) {
    throw new Error("Invalid coordinates for road routing.");
  }

  const straightKm = haversineKm(fromLat, fromLng, toLat, toLng);
  if (straightKm < 0.015) {
    const fLat = Number(fromLat.toFixed(6));
    const fLng = Number(fromLng.toFixed(6));
    const tLat = Number(toLat.toFixed(6));
    const tLng = Number(toLng.toFixed(6));
    const geometry: Array<[number, number]> = [
      [fLat, fLng],
      [tLat, tLng],
    ];
    return {
      mode,
      source: "fallback",
      distanceKm: 0.01,
      durationMinutes: 1,
      geometry,
      steps: [
        {
          instruction: "Arrive at destination",
          roadName: "",
          distanceMeters: Math.max(1, Math.round(straightKm * 1000)),
          durationSeconds: 10,
          maneuverType: "arrive",
          lat: tLat,
          lng: tLng,
        },
      ],
      bbox: computeBbox(geometry),
    };
  }

  const profile = mode === "walking" ? "foot" : "driving";
  const url = `https://router.project-osrm.org/route/v1/${profile}/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson&steps=true`;
  const fetchFn = params.fetchImpl ?? fetch;
  const timeoutMs = params.timeoutMs ?? 4500;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchFn(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "Store254-Pathfinder/1.0",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return buildFallbackRoute(fromLat, fromLng, toLat, toLng, mode);
    }

    const payload = (await response.json()) as {
      code?: string;
      routes?: Array<{
        distance?: number;
        duration?: number;
        geometry?: {
          type?: string;
          coordinates?: Array<[number, number]>;
        };
        legs?: Array<{
          steps?: OsrmStep[];
        }>;
      }>;
    };

    const primary = Array.isArray(payload?.routes) ? payload.routes[0] : null;
    const rawCoords = primary?.geometry?.coordinates;
    if (!primary || !Array.isArray(rawCoords) || rawCoords.length < 2) {
      return buildFallbackRoute(fromLat, fromLng, toLat, toLng, mode);
    }

    const latLngPoints: Array<[number, number]> = [];
    for (const pair of rawCoords) {
      if (Array.isArray(pair) && pair.length >= 2) {
        const lng = Number(pair[0]);
        const lat = Number(pair[1]);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          latLngPoints.push([Number(lat.toFixed(6)), Number(lng.toFixed(6))]);
        }
      }
    }

    if (latLngPoints.length < 2) {
      return buildFallbackRoute(fromLat, fromLng, toLat, toLng, mode);
    }

    const geometry = downsampleGeometry(latLngPoints, 600);
    const rawDistMeters = Number(primary.distance || 0);
    const rawDurSeconds = Number(primary.duration || 0);
    const distanceKm = Math.max(0.05, Number((rawDistMeters / 1000).toFixed(2)));
    const durationMinutes = Math.max(1, Math.round(rawDurSeconds / 60));

    const steps: RouteStep[] = [];
    for (const leg of Array.isArray(primary.legs) ? primary.legs : []) {
      for (const s of Array.isArray(leg.steps) ? leg.steps : []) {
        const loc = s.maneuver?.location;
        const stepLng = Array.isArray(loc) && Number.isFinite(Number(loc[0])) ? Number(loc[0]) : fromLng;
        const stepLat = Array.isArray(loc) && Number.isFinite(Number(loc[1])) ? Number(loc[1]) : fromLat;
        steps.push({
          instruction: buildHumanInstruction(s, mode),
          roadName: typeof s.name === "string" ? s.name.trim() : "",
          distanceMeters: Math.max(0, Math.round(Number(s.distance || 0))),
          durationSeconds: Math.max(0, Math.round(Number(s.duration || 0))),
          maneuverType: String(s.maneuver?.type || "continue"),
          ...(s.maneuver?.modifier ? { maneuverModifier: String(s.maneuver.modifier) } : {}),
          lat: Number(stepLat.toFixed(6)),
          lng: Number(stepLng.toFixed(6)),
        });
      }
    }

    return {
      mode,
      source: "osrm",
      distanceKm,
      durationMinutes,
      geometry,
      steps:
        steps.length > 0
          ? steps
          : buildFallbackRoute(fromLat, fromLng, toLat, toLng, mode).steps,
      bbox: computeBbox(geometry),
    };
  } catch {
    return buildFallbackRoute(fromLat, fromLng, toLat, toLng, mode);
  } finally {
    clearTimeout(timer);
  }
}
