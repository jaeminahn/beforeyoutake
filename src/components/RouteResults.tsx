import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Bus,
  Car,
  Clock,
  TrendingUp,
  Wallet,
  Activity,
  ChevronDown,
  ChevronUp,
  Footprints,
  Train,
} from "lucide-react";
import { RouteResponse, RouteCandidate } from "../types";

interface Props {
  response: RouteResponse;
}

const ROUTE_TYPE_LABELS: Record<string, string> = {
  "taxi-only": "택시만",
  "taxi-transit": "택시+대중교통",
  "transit-taxi": "대중교통+택시",
};

function formatTime(isoString?: string): string {
  if (!isoString) return "";
  const date = new Date(isoString);
  return date.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function normalizeHex(color: string | undefined): string | null {
  if (!color) return null;
  const c = color.trim();
  if (!c) return null;

  if (c.startsWith("#")) {
    const hex = c.slice(1);
    if (/^[0-9a-fA-F]{6}$/.test(hex)) return `#${hex.toUpperCase()}`;
    if (/^[0-9a-fA-F]{3}$/.test(hex)) {
      const r = hex[0];
      const g = hex[1];
      const b = hex[2];
      return `#${(r + r + g + g + b + b).toUpperCase()}`;
    }
    return null;
  }
  return null;
}

function pickTextColorFromHex(bgHex: string | undefined): string {
  const normalized = normalizeHex(bgHex);
  if (!normalized) return "#111827";

  const hex = normalized.replace("#", "");
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.62 ? "#111827" : "#FFFFFF";
}

function isMeaninglessWalkStep(step: any): boolean {
  if (!step) return true;
  if (step.mode !== "WALK") return false;

  const durMin = Math.ceil((step.duration ?? 0) / 60);
  const dist = step.distance ?? 0;
  const from = (step.from ?? "").trim();
  const to = (step.to ?? "").trim();

  if (from && to && from === to) return true;
  if (durMin <= 0) return true;
  if (dist <= 0 && durMin <= 1) return true;
  return false;
}

function StatBox({
  icon,
  label,
  value,
  isBest,
  className = "",
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  isBest: boolean;
  className?: string;
}) {
  return (
    <div
      className={`${
        isBest ? "bg-white/10" : "bg-gray-50"
      } rounded-xl p-3 ${className}`}
    >
      <div className="flex items-center mb-1">
        <span className="mr-2">{icon}</span>
        <span className="text-[11px] sm:text-xs opacity-80 whitespace-nowrap">
          {label}
        </span>
      </div>
      <p className="text-[18px] sm:text-2xl font-bold leading-tight">{value}</p>
    </div>
  );
}

function RouteCard({
  route,
  title,
  isBest = false,
  defaultExpanded,
}: {
  route: RouteCandidate;
  title: string;
  isBest?: boolean;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded ?? isBest);

  const timeLine = useMemo(() => {
    const dep = formatTime(route.departureTime);
    const arr = formatTime(route.arrivalTime);
    if (!dep || !arr) return "";
    return `${dep} → ${arr}`;
  }, [route.departureTime, route.arrivalTime]);

  const slackLabel = useMemo(() => {
    if (typeof route.slackMin !== "number") return null;
    if (route.slackMin <= 0) return null;
    return `여유 ${route.slackMin}분`;
  }, [route.slackMin]);

  const typeLabel = ROUTE_TYPE_LABELS[route.type] ?? route.type;

  return (
    <div
      className={`rounded-2xl p-5 sm:p-6 ${
        isBest
          ? "bg-gradient-to-r from-blue-600 to-green-600 text-white shadow-lg"
          : "bg-white border border-gray-200 shadow-[0_8px_24px_rgba(17,24,39,0.06)]"
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-3 sm:mb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            {isBest && (
              <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
            )}
            <h3
              className={`font-bold min-w-0 ${
                isBest ? "text-white" : "text-gray-900"
              } text-[16px] sm:text-xl`}
            >
              {title}
            </h3>

            <span
              className={`shrink-0 px-2.5 py-1 rounded-full text-[12px] font-semibold ${
                isBest ? "bg-white/20 text-white" : "bg-gray-100 text-gray-700"
              }`}
            >
              {typeLabel}
            </span>
          </div>

          {(timeLine || slackLabel) && (
            <div
              className={`mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 ${
                isBest ? "text-white/90" : "text-gray-600"
              } text-[12px] sm:text-sm`}
            >
              {timeLine && (
                <div className="flex items-center min-w-0">
                  <Clock className="w-4 h-4 mr-1 shrink-0" />
                  <span className="truncate">{timeLine}</span>
                </div>
              )}
              {slackLabel && (
                <div className="flex items-center shrink-0">
                  <Activity className="w-4 h-4 mr-1" />
                  {slackLabel}
                </div>
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          aria-label={expanded ? "접기" : "열기"}
          className={`shrink-0 rounded-xl p-2 transition ${
            isBest
              ? "bg-white/15 hover:bg-white/20"
              : "bg-gray-100 hover:bg-gray-200"
          }`}
        >
          {expanded ? (
            <ChevronUp className="w-5 h-5" />
          ) : (
            <ChevronDown className="w-5 h-5" />
          )}
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-3 sm:mb-4">
        <StatBox
          isBest={isBest}
          icon={<Clock className="w-4 h-4" />}
          label="소요"
          value={`${route.totalTimeMin}분`}
        />
        <StatBox
          isBest={isBest}
          icon={<Activity className="w-4 h-4" />}
          label="도보"
          value={`${route.walkTimeMin}분`}
        />
        <StatBox
          isBest={isBest}
          className="col-span-2 sm:col-span-1"
          icon={<Wallet className="w-4 h-4" />}
          label="총 요금"
          value={`${route.totalCostKrw.toLocaleString()}원`}
        />
      </div>

      {expanded && (
        <div className="space-y-3">
          {route.legs.map((leg, idx) => {
            const isTaxi = leg.type === "taxi";
            const isTransit = leg.type === "transit";
            const isWalk = leg.type === "walk";

            return (
              <div
                key={idx}
                className={`rounded-xl p-4 ${
                  isBest ? "bg-white/10" : "bg-gray-50"
                }`}
              >
                <div className="flex items-start">
                  <div className="mr-3 mt-1 shrink-0">
                    {isTaxi && <Car className="w-5 h-5" />}
                    {isTransit && <Bus className="w-5 h-5" />}
                    {isWalk && <Footprints className="w-5 h-5" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <p
                        className={`font-semibold min-w-0 truncate ${
                          isBest ? "text-white" : "text-gray-900"
                        } text-[14px] sm:text-[15px]`}
                        title={`${leg.from} → ${leg.to}`}
                      >
                        {leg.from} → {leg.to}
                      </p>
                      <p
                        className={`text-[12px] sm:text-sm shrink-0 ${
                          isBest ? "text-white/80" : "text-gray-600"
                        }`}
                      >
                        {leg.durationMin}분
                      </p>
                    </div>

                    {leg.arrivalTime && (
                      <p
                        className={`text-[12px] mb-2 ${
                          isBest ? "text-white/70" : "text-gray-500"
                        }`}
                      >
                        도착 {formatTime(leg.arrivalTime)}
                      </p>
                    )}

                    {isTaxi && leg.details && "taxiFare" in leg.details && (
                      <div
                        className={`text-[13px] sm:text-sm mt-2 space-y-1 ${
                          isBest ? "text-white/85" : "text-gray-700"
                        }`}
                      >
                        {typeof leg.details.taxiFare === "number" && (
                          <p>
                            택시 요금 {leg.details.taxiFare.toLocaleString()}원
                          </p>
                        )}
                        {typeof leg.details.tollFare === "number" &&
                          leg.details.tollFare > 0 && (
                            <p>
                              통행료 {leg.details.tollFare.toLocaleString()}원
                            </p>
                          )}
                      </div>
                    )}

                    {isTransit &&
                      leg.details &&
                      "steps" in leg.details &&
                      leg.details.steps && (
                        <>
                          <div
                            className={`mt-2 text-[13px] sm:text-sm ${
                              isBest ? "text-white/85" : "text-gray-700"
                            }`}
                          >
                            {"totalWalkM" in leg.details &&
                              typeof leg.details.totalWalkM === "number" && (
                                <span className="mr-3 whitespace-nowrap">
                                  도보{" "}
                                  {Math.ceil(
                                    (leg.details.totalWalkM ?? 0) / 70
                                  )}
                                  분
                                </span>
                              )}
                            {"busCount" in leg.details &&
                              typeof leg.details.busCount === "number" && (
                                <span className="mr-3 whitespace-nowrap">
                                  버스 {leg.details.busCount}회
                                </span>
                              )}
                            {"subwayCount" in leg.details &&
                              typeof leg.details.subwayCount === "number" && (
                                <span className="whitespace-nowrap">
                                  지하철 {leg.details.subwayCount}회
                                </span>
                              )}
                          </div>

                          <div className="space-y-2 mt-3">
                            {leg.details.steps
                              .filter((s) => !isMeaninglessWalkStep(s))
                              .map((step, stepIdx) => {
                                const durMin = Math.max(
                                  1,
                                  Math.ceil((step.duration ?? 0) / 60)
                                );

                                const bg =
                                  normalizeHex(step.routeColor) ?? "#2563EB";
                                const fg = pickTextColorFromHex(bg);

                                return (
                                  <div
                                    key={stepIdx}
                                    className={`rounded-lg p-3 ${
                                      isBest
                                        ? "bg-white/10"
                                        : "bg-white border border-gray-100"
                                    }`}
                                  >
                                    <div className="flex items-center justify-between gap-3">
                                      <div className="flex items-center gap-2 min-w-0">
                                        {step.mode === "SUBWAY" && (
                                          <Train className="w-4 h-4 shrink-0" />
                                        )}
                                        {step.mode === "BUS" && (
                                          <Bus className="w-4 h-4 shrink-0" />
                                        )}
                                        {step.mode === "WALK" && (
                                          <Footprints className="w-4 h-4 shrink-0" />
                                        )}

                                        <span
                                          className={`font-medium shrink-0 text-[13px] sm:text-sm ${
                                            isBest
                                              ? "text-white"
                                              : "text-gray-900"
                                          }`}
                                        >
                                          {step.mode === "SUBWAY"
                                            ? "지하철"
                                            : step.mode === "BUS"
                                            ? "버스"
                                            : "도보"}
                                        </span>

                                        {step.route && (
                                          <span
                                            className="px-2 py-0.5 rounded text-[11px] sm:text-xs font-bold shrink-0"
                                            style={{
                                              backgroundColor: bg,
                                              color: fg,
                                            }}
                                          >
                                            {step.route}
                                          </span>
                                        )}
                                      </div>

                                      <span
                                        className={`text-[11px] sm:text-xs shrink-0 ${
                                          isBest
                                            ? "text-white/70"
                                            : "text-gray-500"
                                        }`}
                                      >
                                        {durMin}분
                                      </span>
                                    </div>

                                    {step.from && step.to && (
                                      <p
                                        className={`text-[11px] sm:text-xs mt-1 ${
                                          isBest
                                            ? "text-white/70"
                                            : "text-gray-500"
                                        } truncate`}
                                        title={`${step.from} → ${step.to}`}
                                      >
                                        {step.from} → {step.to}
                                        {typeof step.stationCount ===
                                          "number" &&
                                          step.stationCount > 0 &&
                                          ` (${step.stationCount}개 정거장)`}
                                      </p>
                                    )}
                                  </div>
                                );
                              })}
                          </div>
                        </>
                      )}

                    {!isTaxi && leg.costKrw > 0 && (
                      <p
                        className={`text-[13px] sm:text-sm mt-2 ${
                          isBest ? "text-white/85" : "text-gray-700"
                        }`}
                      >
                        요금 {leg.costKrw.toLocaleString()}원
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function RouteResults({ response }: Props) {
  const {
    routes,
    noFeasibleRoute,
    minPossibleTimeMin,
    minPossibleWalkMin,
    constraints,
  } = response;

  if (!routes || routes.length === 0) return null;

  const taxiOnly =
    (response as any).taxiOnly ?? routes.find((r) => r.type === "taxi-only");
  const mixedRoutes = routes.filter(
    (r) => r.type === "taxi-transit" || r.type === "transit-taxi"
  );

  const bestMixed = mixedRoutes[0] ?? null;

  const savingsKrw =
    taxiOnly && bestMixed
      ? Math.max(0, taxiOnly.totalCostKrw - bestMixed.totalCostKrw)
      : null;

  const savingsTimeMin =
    taxiOnly && bestMixed
      ? taxiOnly.totalTimeMin - bestMixed.totalTimeMin
      : null;

  if (noFeasibleRoute) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 sm:p-6">
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="flex-shrink-0">
              <AlertTriangle className="w-7 h-7 sm:w-8 sm:h-8 text-amber-500" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-[16px] sm:text-xl font-bold text-amber-800 mb-2">
                조건에 맞는 경로가 없습니다
              </h2>
              <p className="text-[13px] sm:text-sm text-amber-700 mb-4">
                최대 {constraints.maxTimeMin}분 / 도보 {constraints.maxWalkMin}
                분 이내 조건을 만족하는 경로를 찾지 못했습니다.
              </p>

              <div className="bg-white rounded-xl p-4 border border-amber-200">
                <p className="text-gray-700 font-medium mb-2 text-[13px] sm:text-sm">
                  예상 최소 기준
                </p>
                <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                  {minPossibleTimeMin !== null && (
                    <div className="flex items-center text-amber-800">
                      <Clock className="w-5 h-5 mr-2" />
                      <span className="text-[18px] sm:text-2xl font-bold">
                        {minPossibleTimeMin}분
                      </span>
                      <span className="ml-2 text-[12px] text-gray-500">
                        이상
                      </span>
                    </div>
                  )}
                  {minPossibleWalkMin !== null && minPossibleWalkMin > 0 && (
                    <div className="flex items-center text-amber-800">
                      <Activity className="w-5 h-5 mr-2" />
                      <span className="text-[16px] sm:text-lg font-semibold">
                        {minPossibleWalkMin}분
                      </span>
                      <span className="ml-2 text-[12px] text-gray-500">
                        도보
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {taxiOnly && (
          <div className="space-y-3 sm:space-y-4">
            <h3 className="text-[15px] sm:text-lg font-semibold text-gray-700">
              택시만 탔을 때
            </h3>
            <RouteCard route={taxiOnly} title="택시만" />
          </div>
        )}

        {mixedRoutes.length > 0 && (
          <div className="space-y-3 sm:space-y-4">
            <h3 className="text-[15px] sm:text-lg font-semibold text-gray-700">
              참고(믹스)
            </h3>
            {mixedRoutes.map((r, idx) => (
              <RouteCard key={r.id ?? idx} route={r} title="참고" />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-[18px] sm:text-2xl font-bold text-gray-900">
          추천 택시 절약 루트
        </h2>
        <span className="text-[12px] sm:text-sm text-gray-500">
          믹스 {mixedRoutes.length}개
        </span>
      </div>

      {taxiOnly && bestMixed && savingsKrw !== null && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="shrink-0 mt-0.5">
              <TrendingUp className="w-6 h-6 text-emerald-600" />
            </div>
            <div className="min-w-0">
              <p className="text-[14px] sm:text-base font-semibold text-emerald-900">
                {savingsKrw.toLocaleString()}원을 아꼈어요!
              </p>
              <p className="mt-1 text-[12px] sm:text-sm text-emerald-800">
                택시만 탔을 때({taxiOnly.totalCostKrw.toLocaleString()}원) 대비{" "}
                추천 루트({bestMixed.totalCostKrw.toLocaleString()}원)
              </p>
              {typeof savingsTimeMin === "number" && savingsTimeMin !== 0 && (
                <p className="mt-1 text-[12px] sm:text-sm text-emerald-800">
                  시간은{" "}
                  {savingsTimeMin > 0
                    ? `${savingsTimeMin}분 더 빨라요`
                    : `${Math.abs(savingsTimeMin)}분 더 걸려요`}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {bestMixed ? (
        <RouteCard
          route={bestMixed}
          title="추천"
          isBest={true}
          defaultExpanded
        />
      ) : (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
          <p className="text-gray-700 text-[14px] sm:text-base">
            현재 조건에서 추천할 믹스 경로를 찾지 못했습니다.
          </p>
        </div>
      )}

      {taxiOnly && (
        <div className="space-y-3 sm:space-y-4">
          <h3 className="text-[16px] sm:text-xl font-bold text-gray-900">
            택시만 탔을 때
          </h3>
          <RouteCard route={taxiOnly} title="택시만" />
        </div>
      )}

      {mixedRoutes.length > 1 && (
        <div className="space-y-3 sm:space-y-4">
          <h3 className="text-[16px] sm:text-xl font-bold text-gray-900">
            대안(믹스)
          </h3>
          {mixedRoutes.slice(1).map((r, idx) => (
            <RouteCard key={r.id ?? idx} route={r} title="대안" />
          ))}
        </div>
      )}
    </div>
  );
}
