import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const TMAP_API_KEY = Deno.env.get("TMAP_API_KEY") || "";
const KAKAO_REST_API_KEY = Deno.env.get("KAKAO_REST_API_KEY") || "";

const WALK_SPEED_M_PER_MIN = 70;
const TAXI_PICKUP_BUFFER_MIN = 2;
const DROPOFF_TO_PLATFORM_BUFFER_MIN = 1;
const SUBWAY_TRANSFER_WALK_MIN = 3;
const BUS_TRANSFER_WALK_MIN = 1;
const POI_RADIUS_MIN = 800;
const POI_RADIUS_MAX = 3000;
const TAXI_ROI_WINDOW_PRIMARY = [6, 9];
const TAXI_ROI_WINDOW_EXPAND = [5, 12];
const MAX_STATION_CANDIDATES = 15;

interface RouteRequest {
  origin: { lat: number; lng: number; name: string };
  destination: { lat: number; lng: number; name: string };
  maxTimeMin: number;
  maxWalkMin: number;
  requireTaxi?: boolean;
  taxiMaxSegments?: number;
  departureTime?: string;
}

interface RouteCandidate {
  id: string;
  type: 'transit-only' | 'taxi-only' | 'taxi-transit' | 'transit-taxi' | 'walk-only';
  totalTimeMin: number;
  totalCostKrw: number;
  walkTimeMin: number;
  hasTaxi: boolean;
  legs: RouteLeg[];
  slackMin: number;
  isFeasible: boolean;
  departureTime?: string;
  arrivalTime?: string;
}

interface TransitStep {
  mode: 'WALK' | 'BUS' | 'SUBWAY';
  from: string;
  to: string;
  duration: number;
  distance?: number;
  route?: string;
  routeColor?: string;
  service?: number;
  stationCount?: number;
}

interface TransitDetails {
  totalWalkM?: number;
  busCount?: number;
  subwayCount?: number;
  pathType?: number;
  steps?: TransitStep[];
}

interface TaxiDetails {
  distance?: number;
  duration?: number;
  taxiFare?: number;
  tollFare?: number;
}

interface WalkDetails {
  distance: number;
  reason?: string;
}

interface RouteLeg {
  type: 'transit' | 'taxi' | 'walk';
  from: string;
  to: string;
  durationMin: number;
  costKrw: number;
  details?: TransitDetails | TaxiDetails | WalkDetails;
  arrivalTime?: string;
}

interface RouteResponse {
  success: boolean;
  routes: RouteCandidate[];
  count: number;
  noFeasibleRoute: boolean;
  minPossibleTimeMin: number | null;
  minPossibleWalkMin: number | null;
  constraints: {
    maxTimeMin: number;
    maxWalkMin: number;
  };
}

interface Station {
  stationID: string;
  stationName: string;
  x: number;
  y: number;
  type?: string;
}

function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c * 1000;
}

function estimateWalkTimeMin(
  totalWalkM: number,
  subwayTransfers: number = 0,
  busTransfers: number = 0
): number {
  const outdoorWalkMin = Math.ceil(totalWalkM / WALK_SPEED_M_PER_MIN);
  const subwayTransferWalkMin = subwayTransfers * SUBWAY_TRANSFER_WALK_MIN;
  const busTransferWalkMin = busTransfers * BUS_TRANSFER_WALK_MIN;
  return outdoorWalkMin + subwayTransferWalkMin + busTransferWalkMin;
}

function computePoiRadius(maxWalkMin: number): number {
  const baseRadius = maxWalkMin * WALK_SPEED_M_PER_MIN * 1.2;
  return Math.max(POI_RADIUS_MIN, Math.min(baseRadius, POI_RADIUS_MAX));
}

interface TmapTransitResponse {
  metaData?: {
    plan?: {
      itineraries?: Array<{
        totalTime: number;
        totalWalkTime?: number;
        totalDistance?: number;
        fare?: {
          regular?: {
            totalFare: number;
          };
        };
        transferCount?: number;
        pathType?: number;
        legs?: Array<{
          mode: string;
          sectionTime: number;
          distance: number;
          start?: {
            name?: string;
            lon?: number;
            lat?: number;
          };
          end?: {
            name?: string;
            lon?: number;
            lat?: number;
          };
          route?: string;
          routeColor?: string;
          service?: number;
          passStopList?: {
            stations?: Array<{
              stationName?: string;
            }>;
          };
        }>;
      }>;
    };
  };
}

async function searchTmapRoute(
  startX: number,
  startY: number,
  endX: number,
  endY: number
): Promise<TmapTransitResponse | null> {
  try {
    const url = "https://apis.openapi.sk.com/transit/routes";

    const requestBody = {
      startX,
      startY,
      endX,
      endY,
      count: 5,
      lang: 0,
      format: "json"
    };

    console.log("TMAP API Request:", { url, body: requestBody, hasKey: !!TMAP_API_KEY });

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "accept": "application/json",
        "appKey": TMAP_API_KEY,
        "content-type": "application/json",
      },
      body: JSON.stringify(requestBody)
    });

    console.log("TMAP API Response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("TMAP API error:", { status: response.status, error: errorText });
      return null;
    }

    const data = await response.json();
    console.log("TMAP API Response data:", JSON.stringify(data).substring(0, 500));
    return data;
  } catch (error) {
    console.error("TMAP searchRoute error:", error);
    return null;
  }
}

interface TmapPoiResponse {
  searchPoiInfo?: {
    pois?: {
      poi: Array<{
        id: string;
        name: string;
        noorLat: string;
        noorLon: string;
        upperAddrName?: string;
        middleAddrName?: string;
      }>;
    };
  };
}

async function searchNearbyStations(
  x: number,
  y: number,
  radius: number
): Promise<Station[]> {
  if (!KAKAO_REST_API_KEY) {
    console.error("KAKAO_REST_API_KEY not set");
    return [];
  }

  try {
    const radiusKm = Math.min(radius, 20000);
    const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=지하철역&x=${x}&y=${y}&radius=${radiusKm}&size=15`;

    const response = await fetch(url, {
      headers: {
        "Authorization": `KakaoAK ${KAKAO_REST_API_KEY}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Kakao station search error status:", response.status, errorText);
      return [];
    }

    const data = await response.json();

    if (data?.documents && Array.isArray(data.documents)) {
      const stations = data.documents.map((doc: any) => ({
        stationID: doc.id,
        stationName: doc.place_name,
        x: parseFloat(doc.x),
        y: parseFloat(doc.y),
        type: 'station'
      }));

      console.log(`Found ${stations.length} stations near (${x}, ${y}) within ${radiusKm}m`);
      return stations;
    }
    console.log(`No stations found near (${x}, ${y}) within ${radiusKm}m`);
    return [];
  } catch (error) {
    console.error("Kakao station search error:", error);
    return [];
  }
}

interface KakaoDirectionsResponse {
  routes?: Array<{
    summary: {
      duration: number;
      distance: number;
      fare?: {
        taxi?: number;
        toll?: number;
      };
    };
  }>;
}

async function getKakaoDirectionsPrecise(
  originLng: number,
  originLat: number,
  destLng: number,
  destLat: number
): Promise<KakaoDirectionsResponse | null> {
  try {
    const url = `https://apis-navi.kakaomobility.com/v1/directions?origin=${originLng},${originLat}&destination=${destLng},${destLat}&priority=RECOMMEND&car_fuel=GASOLINE&car_hipass=false&alternatives=false&road_details=false`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `KakaoAK ${KAKAO_REST_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Kakao directions error:", error);
    return null;
  }
}

interface KakaoBatchResponse {
  routes?: Array<{
    summary?: {
      duration: number;
    };
  }>;
}

async function batchTaxiEtaToDestinations(
  originLng: number,
  originLat: number,
  destinations: Array<{ x: number; y: number }>
): Promise<KakaoBatchResponse | null> {
  try {
    if (destinations.length === 0) return null;

    const destParam = destinations.slice(0, 30).map(d => `${d.x},${d.y}`).join('|');
    const url = `https://apis-navi.kakaomobility.com/v1/destinations?origin=${originLng},${originLat}&destinations=${destParam}&priority=RECOMMEND&summary=true`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `KakaoAK ${KAKAO_REST_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Kakao batch destinations error:", error);
    return null;
  }
}

async function batchTaxiEtaFromOrigins(
  origins: Array<{ x: number; y: number }>,
  destLng: number,
  destLat: number
): Promise<KakaoBatchResponse | null> {
  try {
    if (origins.length === 0) return null;

    const originsParam = origins.slice(0, 30).map(o => `${o.x},${o.y}`).join('|');
    const url = `https://apis-navi.kakaomobility.com/v1/origins?origins=${originsParam}&destination=${destLng},${destLat}&priority=RECOMMEND&summary=true`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `KakaoAK ${KAKAO_REST_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Kakao batch origins error:", error);
    return null;
  }
}

interface EtaResult {
  summary?: {
    duration: number;
  };
}

function screenStationsByEta(
  stations: Station[],
  etaResults: EtaResult[],
  window: [number, number]
): Station[] {
  const screened: Station[] = [];

  for (let i = 0; i < stations.length && i < etaResults.length; i++) {
    const eta = etaResults[i];
    if (eta?.summary?.duration) {
      const durationMin = eta.summary.duration / 60;
      if (durationMin >= window[0] && durationMin <= window[1]) {
        screened.push(stations[i]);
      }
    }
  }

  return screened;
}

function addArrivalTimes(candidate: RouteCandidate, departureTime: string): void {
  candidate.departureTime = departureTime;
  let currentTime = new Date(departureTime);

  for (const leg of candidate.legs) {
    currentTime = new Date(currentTime.getTime() + leg.durationMin * 60000);
    leg.arrivalTime = currentTime.toISOString();
  }

  candidate.arrivalTime = candidate.legs[candidate.legs.length - 1].arrivalTime;
}

async function findOptimalRoute(req: RouteRequest): Promise<RouteResponse> {
  const { origin, destination, maxTimeMin, maxWalkMin, requireTaxi = false, taxiMaxSegments = 1, departureTime: requestDepartureTime } = req;

  const departureTime = requestDepartureTime || new Date().toISOString();
  const allCandidates: RouteCandidate[] = [];
  let bestCost = Infinity;

  const debugInfo = {
    tmapCalled: false,
    tmapSuccess: false,
    tmapItineraryCount: 0,
    stationsNearOrigin: 0,
    stationsNearDest: 0,
    taxiTransitAttempts: 0,
    transitTaxiAttempts: 0,
    taxiTransitGenerated: 0,
    transitTaxiGenerated: 0,
    poiRadius: 0,
    tmapKeySet: !!TMAP_API_KEY
  };

  const distanceM = calculateDistance(origin.lat, origin.lng, destination.lat, destination.lng);

  if (distanceM < 700) {
    const walkMin = Math.ceil(distanceM / WALK_SPEED_M_PER_MIN);
    const isFeasible = walkMin <= maxWalkMin && walkMin <= maxTimeMin;

    allCandidates.push({
      id: 'walk-only',
      type: 'walk-only',
      totalTimeMin: walkMin,
      totalCostKrw: 0,
      walkTimeMin: walkMin,
      hasTaxi: false,
      legs: [{
        type: 'walk',
        from: origin.name,
        to: destination.name,
        durationMin: walkMin,
        costKrw: 0,
        details: { distance: distanceM }
      }],
      slackMin: maxTimeMin - walkMin,
      isFeasible
    });

    return buildResponse(allCandidates, maxTimeMin, maxWalkMin, requireTaxi, departureTime, debugInfo);
  }

  debugInfo.tmapCalled = true;
  const tmapData = await searchTmapRoute(origin.lng, origin.lat, destination.lng, destination.lat);

  if (tmapData?.metaData?.plan?.itineraries && tmapData.metaData.plan.itineraries.length > 0) {
    debugInfo.tmapSuccess = true;
    debugInfo.tmapItineraryCount = tmapData.metaData.plan.itineraries.length;
    for (const itinerary of tmapData.metaData.plan.itineraries.slice(0, 5)) {
      const totalTimeMin = Math.ceil(itinerary.totalTime / 60);
      const totalCostKrw = itinerary.fare?.regular?.totalFare || 0;

      let totalWalkM = 0;
      let busTransfers = 0;
      let subwayTransfers = 0;

      if (itinerary.legs) {
        for (const leg of itinerary.legs) {
          if (leg.mode === 'WALK') {
            totalWalkM += leg.distance || 0;
          }
          if (leg.mode === 'BUS') busTransfers++;
          if (leg.mode === 'SUBWAY') subwayTransfers++;
        }
      }

      const walkTimeMin = estimateWalkTimeMin(totalWalkM, subwayTransfers, busTransfers);
      const isFeasible = totalTimeMin <= maxTimeMin && walkTimeMin <= maxWalkMin;

      const transitSteps: TransitStep[] = [];
      if (itinerary.legs) {
        for (const leg of itinerary.legs) {
          const step: TransitStep = {
            mode: leg.mode as 'WALK' | 'BUS' | 'SUBWAY',
            from: leg.start?.name || '',
            to: leg.end?.name || '',
            duration: leg.sectionTime || 0,
            distance: leg.distance,
            route: leg.route,
            routeColor: leg.routeColor,
            service: leg.service,
            stationCount: leg.passStopList?.stations?.length || 0
          };
          transitSteps.push(step);
        }
      }

      const candidate: RouteCandidate = {
        id: `transit-${itinerary.pathType || allCandidates.length}`,
        type: 'transit-only',
        totalTimeMin,
        totalCostKrw,
        walkTimeMin,
        hasTaxi: false,
        legs: [{
          type: 'transit',
          from: origin.name,
          to: destination.name,
          durationMin: totalTimeMin,
          costKrw: totalCostKrw,
          details: {
            totalWalkM,
            busCount: busTransfers,
            subwayCount: subwayTransfers,
            pathType: itinerary.pathType,
            steps: transitSteps
          }
        }],
        slackMin: maxTimeMin - totalTimeMin,
        isFeasible
      };

      allCandidates.push(candidate);

      if (isFeasible) {
        bestCost = Math.min(bestCost, totalCostKrw);
      }
    }
  }

  const kakaoTaxiData = await getKakaoDirectionsPrecise(origin.lng, origin.lat, destination.lng, destination.lat);

  if (kakaoTaxiData?.routes?.[0]?.summary) {
    const summary = kakaoTaxiData.routes[0].summary;

    if (summary.duration !== undefined && summary.distance !== undefined) {
      const durationMin = Math.ceil(summary.duration / 60) + TAXI_PICKUP_BUFFER_MIN;
      const taxiFare = summary.fare?.taxi || Math.ceil(4800 + (summary.distance / 1000) * 1000);
      const tollFare = summary.fare?.toll || 0;
      const totalCost = taxiFare + tollFare;

      const isFeasible = durationMin <= maxTimeMin;

      allCandidates.push({
        id: 'taxi-only',
        type: 'taxi-only',
        totalTimeMin: durationMin,
        totalCostKrw: totalCost,
        walkTimeMin: 0,
        hasTaxi: true,
        legs: [{
          type: 'taxi',
          from: origin.name,
          to: destination.name,
          durationMin,
          costKrw: totalCost,
          details: {
            distance: summary.distance,
            duration: summary.duration,
            taxiFare,
            tollFare
          }
        }],
        slackMin: maxTimeMin - durationMin,
        isFeasible
      });

      if (isFeasible) {
        bestCost = Math.min(bestCost, totalCost);
      }
    }
  }

  if (taxiMaxSegments >= 1) {
    const poiRadius = computePoiRadius(maxWalkMin);
    debugInfo.poiRadius = poiRadius;

    const [stationsNearO, stationsNearD] = await Promise.all([
      searchNearbyStations(origin.lng, origin.lat, poiRadius),
      searchNearbyStations(destination.lng, destination.lat, poiRadius)
    ]);

    debugInfo.stationsNearOrigin = stationsNearO.length;
    debugInfo.stationsNearDest = stationsNearD.length;

    if (stationsNearO.length > 0) {
      const batchEta = await batchTaxiEtaToDestinations(
        origin.lng,
        origin.lat,
        stationsNearO.map(s => ({ x: s.x, y: s.y }))
      );

      let screenedStationsO = stationsNearO;
      if (batchEta?.routes) {
        screenedStationsO = screenStationsByEta(stationsNearO, batchEta.routes, TAXI_ROI_WINDOW_PRIMARY);

        if (screenedStationsO.length < 5) {
          screenedStationsO = screenStationsByEta(stationsNearO, batchEta.routes, TAXI_ROI_WINDOW_EXPAND);
        }
      }

      const topStationsO = screenedStationsO.slice(0, MAX_STATION_CANDIDATES);

      for (const station of topStationsO) {
        debugInfo.taxiTransitAttempts++;
        const taxiLeg = await getKakaoDirectionsPrecise(origin.lng, origin.lat, station.x, station.y);

        if (!taxiLeg?.routes?.[0]?.summary) continue;

        const taxiSummary = taxiLeg.routes[0].summary;
        const taxiDurationMin = Math.ceil(taxiSummary.duration / 60) + TAXI_PICKUP_BUFFER_MIN;
        const taxiFare = taxiSummary.fare?.taxi || Math.ceil(4800 + (taxiSummary.distance / 1000) * 1000);
        const tollFare = taxiSummary.fare?.toll || 0;
        const taxiCost = taxiFare + tollFare;

        const transitPaths = await searchTmapRoute(station.x, station.y, destination.lng, destination.lat);

        if (transitPaths?.metaData?.plan?.itineraries && transitPaths.metaData.plan.itineraries.length > 0) {
          for (const itinerary of transitPaths.metaData.plan.itineraries.slice(0, 3)) {
            const transitTimeMin = Math.ceil(itinerary.totalTime / 60);
            const transitCost = itinerary.fare?.regular?.totalFare || 0;

            let totalWalkM = 0;
            let busTransfers = 0;
            let subwayTransfers = 0;

            if (itinerary.legs) {
              for (const leg of itinerary.legs) {
                if (leg.mode === 'WALK') {
                  totalWalkM += leg.distance || 0;
                }
                if (leg.mode === 'BUS') busTransfers++;
                if (leg.mode === 'SUBWAY') subwayTransfers++;
              }
            }

            const walkTimeMin = estimateWalkTimeMin(totalWalkM, subwayTransfers, busTransfers) + DROPOFF_TO_PLATFORM_BUFFER_MIN;
            const totalTime = taxiDurationMin + transitTimeMin;
            const totalCost = taxiCost + transitCost;

            if (totalTime <= maxTimeMin && walkTimeMin <= maxWalkMin) {
              const transitSteps: TransitStep[] = [];
              if (itinerary.legs) {
                for (const leg of itinerary.legs) {
                  const step: TransitStep = {
                    mode: leg.mode as 'WALK' | 'BUS' | 'SUBWAY',
                    from: leg.start?.name || '',
                    to: leg.end?.name || '',
                    duration: leg.sectionTime || 0,
                    distance: leg.distance,
                    route: leg.route,
                    routeColor: leg.routeColor,
                    service: leg.service,
                    stationCount: leg.passStopList?.stations?.length || 0
                  };
                  transitSteps.push(step);
                }
              }

              const candidate: RouteCandidate = {
                id: `taxi-transit-${station.stationID}-${itinerary.pathType}`,
                type: 'taxi-transit',
                totalTimeMin: totalTime,
                totalCostKrw: totalCost,
                walkTimeMin,
                hasTaxi: true,
                legs: [
                  {
                    type: 'taxi',
                    from: origin.name,
                    to: station.stationName,
                    durationMin: taxiDurationMin,
                    costKrw: taxiCost,
                    details: { taxiFare, tollFare }
                  },
                  {
                    type: 'transit',
                    from: station.stationName,
                    to: destination.name,
                    durationMin: transitTimeMin,
                    costKrw: transitCost,
                    details: { totalWalkM, busCount: busTransfers, subwayCount: subwayTransfers, steps: transitSteps }
                  }
                ],
                slackMin: maxTimeMin - totalTime,
                isFeasible: true
              };

              allCandidates.push(candidate);
              debugInfo.taxiTransitGenerated++;
              bestCost = Math.min(bestCost, totalCost);
            }
          }
        }
      }
    }

    if (stationsNearD.length > 0) {
      const batchEta = await batchTaxiEtaFromOrigins(
        stationsNearD.map(s => ({ x: s.x, y: s.y })),
        destination.lng,
        destination.lat
      );

      let screenedStationsD = stationsNearD;
      if (batchEta?.routes) {
        screenedStationsD = screenStationsByEta(stationsNearD, batchEta.routes, TAXI_ROI_WINDOW_PRIMARY);

        if (screenedStationsD.length < 5) {
          screenedStationsD = screenStationsByEta(stationsNearD, batchEta.routes, TAXI_ROI_WINDOW_EXPAND);
        }
      }

      const topStationsD = screenedStationsD.slice(0, MAX_STATION_CANDIDATES);

      for (const station of topStationsD) {
        debugInfo.transitTaxiAttempts++;
        const transitPaths = await searchTmapRoute(origin.lng, origin.lat, station.x, station.y);

        if (!transitPaths?.metaData?.plan?.itineraries || transitPaths.metaData.plan.itineraries.length === 0) continue;

        const taxiLeg = await getKakaoDirectionsPrecise(station.x, station.y, destination.lng, destination.lat);

        if (!taxiLeg?.routes?.[0]?.summary) continue;

        const taxiSummary = taxiLeg.routes[0].summary;
        const taxiDurationMin = Math.ceil(taxiSummary.duration / 60) + TAXI_PICKUP_BUFFER_MIN;
        const taxiFare = taxiSummary.fare?.taxi || Math.ceil(4800 + (taxiSummary.distance / 1000) * 1000);
        const tollFare = taxiSummary.fare?.toll || 0;
        const taxiCost = taxiFare + tollFare;

        for (const itinerary of transitPaths.metaData.plan.itineraries.slice(0, 3)) {
          const transitTimeMin = Math.ceil(itinerary.totalTime / 60);
          const transitCost = itinerary.fare?.regular?.totalFare || 0;

          let totalWalkM = 0;
          let busTransfers = 0;
          let subwayTransfers = 0;

          if (itinerary.legs) {
            for (const leg of itinerary.legs) {
              if (leg.mode === 'WALK') {
                totalWalkM += leg.distance || 0;
              }
              if (leg.mode === 'BUS') busTransfers++;
              if (leg.mode === 'SUBWAY') subwayTransfers++;
            }
          }

          const walkTimeMin = estimateWalkTimeMin(totalWalkM, subwayTransfers, busTransfers) + DROPOFF_TO_PLATFORM_BUFFER_MIN;
          const totalTime = transitTimeMin + taxiDurationMin;
          const totalCost = transitCost + taxiCost;

          if (totalTime <= maxTimeMin && walkTimeMin <= maxWalkMin) {
            const transitSteps: TransitStep[] = [];
            if (itinerary.legs) {
              for (const leg of itinerary.legs) {
                const step: TransitStep = {
                  mode: leg.mode as 'WALK' | 'BUS' | 'SUBWAY',
                  from: leg.start?.name || '',
                  to: leg.end?.name || '',
                  duration: leg.sectionTime || 0,
                  distance: leg.distance,
                  route: leg.route,
                  routeColor: leg.routeColor,
                  service: leg.service,
                  stationCount: leg.passStopList?.stations?.length || 0
                };
                transitSteps.push(step);
              }
            }

            const candidate: RouteCandidate = {
              id: `transit-taxi-${station.stationID}-${itinerary.pathType}`,
              type: 'transit-taxi',
              totalTimeMin: totalTime,
              totalCostKrw: totalCost,
              walkTimeMin,
              hasTaxi: true,
              legs: [
                {
                  type: 'transit',
                  from: origin.name,
                  to: station.stationName,
                  durationMin: transitTimeMin,
                  costKrw: transitCost,
                  details: { totalWalkM, busCount: busTransfers, subwayCount: subwayTransfers, steps: transitSteps }
                },
                {
                  type: 'taxi',
                  from: station.stationName,
                  to: destination.name,
                  durationMin: taxiDurationMin,
                  costKrw: taxiCost,
                  details: { taxiFare, tollFare }
                }
              ],
              slackMin: maxTimeMin - totalTime,
              isFeasible: true
            };

            allCandidates.push(candidate);
            debugInfo.transitTaxiGenerated++;
            bestCost = Math.min(bestCost, totalCost);
          }
        }
      }
    }
  }

  return buildResponse(allCandidates, maxTimeMin, maxWalkMin, requireTaxi, departureTime, debugInfo);
}

function buildResponse(
  allCandidates: RouteCandidate[],
  maxTimeMin: number,
  maxWalkMin: number,
  requireTaxi: boolean,
  departureTime: string,
  debugInfo?: { tmapCalled?: boolean; tmapSuccess?: boolean; tmapItineraryCount?: number }
): RouteResponse {
  for (const candidate of allCandidates) {
    addArrivalTimes(candidate, departureTime);
  }

  let feasibleCandidates = allCandidates.filter(c => c.isFeasible);

  if (requireTaxi) {
    feasibleCandidates = feasibleCandidates.filter(c => c.hasTaxi);
  }

  const sortedFeasible = feasibleCandidates.sort((a, b) => {
    if (a.totalCostKrw !== b.totalCostKrw) {
      return a.totalCostKrw - b.totalCostKrw;
    }
    return a.totalTimeMin - b.totalTimeMin;
  });

  if (sortedFeasible.length > 0) {
    return {
      success: true,
      routes: sortedFeasible.slice(0, 10),
      count: sortedFeasible.length,
      noFeasibleRoute: false,
      minPossibleTimeMin: null,
      minPossibleWalkMin: null,
      constraints: { maxTimeMin, maxWalkMin },
      ...(debugInfo && { debug: debugInfo })
    } as RouteResponse;
  }

  const allSorted = allCandidates.sort((a, b) => a.totalTimeMin - b.totalTimeMin);
  const minTimeCandidate = allSorted[0];

  return {
    success: true,
    routes: allSorted.slice(0, 5),
    count: allSorted.length,
    noFeasibleRoute: true,
    minPossibleTimeMin: minTimeCandidate?.totalTimeMin ?? null,
    minPossibleWalkMin: minTimeCandidate?.walkTimeMin ?? null,
    constraints: { maxTimeMin, maxWalkMin },
    ...(debugInfo && { debug: debugInfo })
  } as RouteResponse;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const body: RouteRequest = await req.json();

    if (!body.origin || !body.destination || !body.maxTimeMin || !body.maxWalkMin) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const result = await findOptimalRoute(body);

    return new Response(
      JSON.stringify(result),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Function error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
