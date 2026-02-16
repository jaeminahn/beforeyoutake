export interface Location {
  lat: number;
  lng: number;
  name: string;
}

export interface TransitStep {
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

export interface TransitDetails {
  totalWalkM?: number;
  busCount?: number;
  subwayCount?: number;
  pathType?: number;
  steps?: TransitStep[];
}

export interface TaxiDetails {
  distance?: number;
  duration?: number;
  taxiFare?: number;
  tollFare?: number;
}

export interface WalkDetails {
  distance: number;
  reason?: string;
}

export interface RouteLeg {
  type: 'transit' | 'taxi' | 'walk';
  from: string;
  to: string;
  durationMin: number;
  costKrw: number;
  details?: TransitDetails | TaxiDetails | WalkDetails;
  arrivalTime?: string;
}

export interface RouteCandidate {
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

export interface RouteResponse {
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

export interface SearchRequest {
  origin: Location;
  destination: Location;
  maxTimeMin: number;
  maxWalkMin: number;
  requireTaxi?: boolean;
  taxiMaxSegments?: number;
  departureTime?: string;
}
