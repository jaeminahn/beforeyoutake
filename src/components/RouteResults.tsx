import { useState } from 'react';
import { AlertTriangle, Bus, Car, Clock, DollarSign, TrendingUp, Wallet, Activity, ChevronDown, ChevronUp, Footprints, Train } from 'lucide-react';
import { RouteResponse, RouteCandidate, TransitDetails } from '../types';

interface Props {
  response: RouteResponse;
}

const ROUTE_TYPE_LABELS: Record<string, string> = {
  'transit-only': '대중교통',
  'taxi-only': '택시',
  'taxi-transit': '택시 + 대중교통',
  'transit-taxi': '대중교통 + 택시',
  'walk-only': '도보',
};

const ROUTE_TYPE_COLORS: Record<string, string> = {
  'transit-only': 'bg-green-100 text-green-800 border-green-200',
  'taxi-only': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  'taxi-transit': 'bg-blue-100 text-blue-800 border-blue-200',
  'transit-taxi': 'bg-orange-100 text-orange-800 border-orange-200',
  'walk-only': 'bg-gray-100 text-gray-800 border-gray-200',
};

function formatTime(isoString?: string): string {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function RouteCard({ route, isBest = false }: { route: RouteCandidate; isBest?: boolean }) {
  const [expanded, setExpanded] = useState(isBest);

  return (
    <div className={`${isBest ? 'bg-gradient-to-r from-blue-500 to-green-500 text-white' : 'bg-white border border-gray-200'} rounded-xl shadow-lg p-6`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          {isBest && <TrendingUp className="w-6 h-6" />}
          <h3 className={`text-xl font-bold ${isBest ? 'text-white' : 'text-gray-900'}`}>
            {isBest ? '최적 경로' : ROUTE_TYPE_LABELS[route.type]}
          </h3>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${isBest ? 'bg-white bg-opacity-20' : ROUTE_TYPE_COLORS[route.type] + ' border'}`}>
          {ROUTE_TYPE_LABELS[route.type]}
        </span>
      </div>

      {route.departureTime && route.arrivalTime && (
        <div className={`mb-4 flex items-center space-x-4 text-sm ${isBest ? 'text-white opacity-90' : 'text-gray-600'}`}>
          <div className="flex items-center">
            <Clock className="w-4 h-4 mr-1" />
            출발: {formatTime(route.departureTime)}
          </div>
          <div className="flex items-center">
            <Clock className="w-4 h-4 mr-1" />
            도착: {formatTime(route.arrivalTime)}
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className={`${isBest ? 'bg-white bg-opacity-10' : 'bg-gray-50'} rounded-lg p-3`}>
          <div className="flex items-center mb-1">
            <Clock className="w-4 h-4 mr-2" />
            <span className="text-xs opacity-80">소요시간</span>
          </div>
          <p className="text-2xl font-bold">{route.totalTimeMin}분</p>
        </div>

        <div className={`${isBest ? 'bg-white bg-opacity-10' : 'bg-gray-50'} rounded-lg p-3`}>
          <div className="flex items-center mb-1">
            <Wallet className="w-4 h-4 mr-2" />
            <span className="text-xs opacity-80">요금</span>
          </div>
          <p className="text-2xl font-bold">{route.totalCostKrw.toLocaleString()}원</p>
        </div>

        <div className={`${isBest ? 'bg-white bg-opacity-10' : 'bg-gray-50'} rounded-lg p-3`}>
          <div className="flex items-center mb-1">
            <Activity className="w-4 h-4 mr-2" />
            <span className="text-xs opacity-80">도보</span>
          </div>
          <p className="text-2xl font-bold">{route.walkTimeMin}분</p>
        </div>
      </div>

      <button
        onClick={() => setExpanded(!expanded)}
        className={`w-full flex items-center justify-between ${isBest ? 'bg-white bg-opacity-10' : 'bg-gray-100'} rounded-lg p-3 mb-3 hover:opacity-80 transition`}
      >
        <span className="font-medium">경로 상세보기</span>
        {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
      </button>

      {expanded && (
        <div className="space-y-3">
          {route.legs.map((leg, idx) => (
            <div key={idx} className={`${isBest ? 'bg-white bg-opacity-10' : 'bg-gray-50'} rounded-lg p-4`}>
              <div className="flex items-start">
                <div className="mr-3 mt-1">
                  {leg.type === 'taxi' && <Car className="w-5 h-5" />}
                  {leg.type === 'transit' && <Bus className="w-5 h-5" />}
                  {leg.type === 'walk' && <Footprints className="w-5 h-5" />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-semibold">{leg.from} → {leg.to}</p>
                    <p className="text-sm opacity-80">{leg.durationMin}분</p>
                  </div>
                  {leg.arrivalTime && (
                    <p className="text-xs opacity-70 mb-2">도착: {formatTime(leg.arrivalTime)}</p>
                  )}

                  {leg.type === 'transit' && leg.details && 'steps' in leg.details && leg.details.steps && (
                    <div className="space-y-2 mt-3">
                      {leg.details.steps.map((step, stepIdx) => (
                        <div key={stepIdx} className={`${isBest ? 'bg-white bg-opacity-10' : 'bg-white'} rounded p-2 text-sm`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              {step.mode === 'SUBWAY' && <Train className="w-4 h-4" />}
                              {step.mode === 'BUS' && <Bus className="w-4 h-4" />}
                              {step.mode === 'WALK' && <Footprints className="w-4 h-4" />}
                              <span className="font-medium">
                                {step.mode === 'SUBWAY' && '지하철'}
                                {step.mode === 'BUS' && '버스'}
                                {step.mode === 'WALK' && '도보'}
                              </span>
                              {step.route && (
                                <span
                                  className="px-2 py-0.5 rounded text-xs font-bold"
                                  style={{ backgroundColor: step.routeColor || '#666', color: '#fff' }}
                                >
                                  {step.route}
                                </span>
                              )}
                            </div>
                            <span className="text-xs opacity-70">{Math.ceil(step.duration / 60)}분</span>
                          </div>
                          {step.from && step.to && (
                            <p className="text-xs opacity-70 mt-1">
                              {step.from} → {step.to}
                              {step.stationCount > 0 && ` (${step.stationCount}개 정거장)`}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {leg.type === 'taxi' && leg.details && 'taxiFare' in leg.details && (
                    <div className="text-sm opacity-80 mt-2">
                      <p>택시 요금: {leg.details.taxiFare?.toLocaleString()}원</p>
                      {typeof leg.details.tollFare === 'number' && leg.details.tollFare > 0 && (
                        <p>통행료: {leg.details.tollFare.toLocaleString()}원</p>
                      )}
                    </div>
                  )}

                  {leg.type !== 'taxi' && leg.costKrw > 0 && (
                    <p className="text-sm opacity-80 mt-2">요금: {leg.costKrw.toLocaleString()}원</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function RouteResults({ response }: Props) {
  const { routes, noFeasibleRoute, minPossibleTimeMin, minPossibleWalkMin, constraints } = response;

  if (routes.length === 0) return null;

  if (noFeasibleRoute) {
    return (
      <div className="space-y-6">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0">
              <AlertTriangle className="w-8 h-8 text-amber-500" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-amber-800 mb-2">
                조건에 맞는 경로를 찾을 수 없습니다
              </h2>
              <p className="text-amber-700 mb-4">
                요청하신 조건(최대 {constraints.maxTimeMin}분, 도보 {constraints.maxWalkMin}분 이내)을
                만족하는 경로가 없습니다.
              </p>

              <div className="bg-white rounded-lg p-4 border border-amber-200">
                <p className="text-gray-700 font-medium mb-2">예상 최소 소요 시간:</p>
                <div className="flex items-center space-x-6">
                  {minPossibleTimeMin !== null && (
                    <div className="flex items-center text-amber-800">
                      <Clock className="w-5 h-5 mr-2" />
                      <span className="text-2xl font-bold">{minPossibleTimeMin}분</span>
                      <span className="ml-2 text-sm text-gray-500">이상 소요</span>
                    </div>
                  )}
                  {minPossibleWalkMin !== null && minPossibleWalkMin > 0 && (
                    <div className="flex items-center text-amber-800">
                      <Activity className="w-5 h-5 mr-2" />
                      <span className="text-lg font-semibold">{minPossibleWalkMin}분</span>
                      <span className="ml-2 text-sm text-gray-500">도보</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {routes.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-700">참고 경로 (조건 초과)</h3>
            {routes.map((route, idx) => (
              <RouteCard key={idx} route={route} />
            ))}
          </div>
        )}
      </div>
    );
  }

  const bestRoute = routes[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">추천 경로</h2>
        <span className="text-sm text-gray-500">{routes.length}개 경로 발견</span>
      </div>

      <RouteCard route={bestRoute} isBest={true} />

      {routes.length > 1 && (
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-gray-900">대안 경로</h3>
          {routes.slice(1).map((route, idx) => (
            <RouteCard key={idx} route={route} />
          ))}
        </div>
      )}
    </div>
  );
}
