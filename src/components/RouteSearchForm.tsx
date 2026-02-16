import { useState, useRef, useEffect, useCallback } from "react";
import TimePicker from "react-time-picker";
import "react-time-picker/dist/TimePicker.css";
import "react-clock/dist/Clock.css";

import { SearchRequest, RouteResponse, Location } from "../types";

interface Props {
  onSearch: (response: RouteResponse) => void;
  onError: (error: string) => void;
  onLoadingChange: (loading: boolean) => void;
}

interface PlaceResult {
  name: string;
  address: string;
  lat: number;
  lng: number;
}

interface KakaoDocument {
  place_name: string;
  address_name: string;
  y: string;
  x: string;
}

function getCurrentTimeHHmm(): string {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function buildTodayDepartureISO(timeHHmm: string): string {
  const now = new Date();
  const [hhRaw, mmRaw] = timeHHmm.split(":");
  const hh = Number.isFinite(parseInt(hhRaw, 10))
    ? parseInt(hhRaw, 10)
    : now.getHours();
  const mm = Number.isFinite(parseInt(mmRaw, 10))
    ? parseInt(mmRaw, 10)
    : now.getMinutes();

  const d = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    hh,
    mm,
    0,
    0
  );

  return d.toISOString();
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1 text-[12px] font-medium text-gray-600">{children}</div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-3">{children}</div>;
}

export default function RouteSearchForm({
  onSearch,
  onError,
  onLoadingChange,
}: Props) {
  const [origin, setOrigin] = useState<Location | null>(null);
  const [destination, setDestination] = useState<Location | null>(null);

  const [originQuery, setOriginQuery] = useState("");
  const [destinationQuery, setDestinationQuery] = useState("");

  const [originResults, setOriginResults] = useState<PlaceResult[]>([]);
  const [destinationResults, setDestinationResults] = useState<PlaceResult[]>(
    []
  );

  const [showOriginResults, setShowOriginResults] = useState(false);
  const [showDestinationResults, setShowDestinationResults] = useState(false);

  const [maxTimeMinInput, setMaxTimeMinInput] = useState("60");
  const [maxWalkMinInput, setMaxWalkMinInput] = useState("15");

  const [departureTimeHHmm, setDepartureTimeHHmm] = useState(
    getCurrentTimeHHmm()
  );

  const hasKakaoKey = !!import.meta.env.VITE_KAKAO_REST_API_KEY;

  const originWrapRef = useRef<HTMLDivElement>(null);
  const destinationWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const t = e.target as Node;
      if (originWrapRef.current && !originWrapRef.current.contains(t))
        setShowOriginResults(false);
      if (destinationWrapRef.current && !destinationWrapRef.current.contains(t))
        setShowDestinationResults(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const searchPlaces = useCallback(
    async (query: string, isOrigin: boolean) => {
      if (!hasKakaoKey) return;

      const q = query.trim();
      if (q.length < 2) {
        if (isOrigin) setOriginResults([]);
        else setDestinationResults([]);
        return;
      }

      try {
        const response = await fetch(
          `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(
            q
          )}`,
          {
            headers: {
              Authorization: `KakaoAK ${
                import.meta.env.VITE_KAKAO_REST_API_KEY
              }`,
            },
          }
        );

        if (!response.ok) throw new Error(`API Error: ${response.status}`);

        const data = await response.json();
        const results: PlaceResult[] = (data.documents || []).map(
          (doc: KakaoDocument) => ({
            name: doc.place_name,
            address: doc.address_name,
            lat: parseFloat(doc.y),
            lng: parseFloat(doc.x),
          })
        );

        if (isOrigin) {
          setOriginResults(results);
          if (!origin) setShowOriginResults(true);
        } else {
          setDestinationResults(results);
          if (!destination) setShowDestinationResults(true);
        }
      } catch (err) {
        console.error("Kakao place search failed:", err);
        onError("장소 검색에 실패했습니다. 잠시 후 다시 시도해주세요.");
        if (isOrigin) setOriginResults([]);
        else setDestinationResults([]);
      }
    },
    [hasKakaoKey, onError, origin, destination]
  );

  useEffect(() => {
    if (origin) return;
    const t = setTimeout(() => searchPlaces(originQuery, true), 250);
    return () => clearTimeout(t);
  }, [originQuery, origin, searchPlaces]);

  useEffect(() => {
    if (destination) return;
    const t = setTimeout(() => searchPlaces(destinationQuery, false), 250);
    return () => clearTimeout(t);
  }, [destinationQuery, destination, searchPlaces]);

  const selectOrigin = (place: PlaceResult) => {
    setOrigin({ name: place.name, lat: place.lat, lng: place.lng });
    setOriginQuery(place.name);
    setOriginResults([]);
    setShowOriginResults(false);
  };

  const selectDestination = (place: PlaceResult) => {
    setDestination({ name: place.name, lat: place.lat, lng: place.lng });
    setDestinationQuery(place.name);
    setDestinationResults([]);
    setShowDestinationResults(false);
  };

  const resetOriginForReinput = () => {
    setOrigin(null);
    setOriginQuery("");
    setOriginResults([]);
    setShowOriginResults(true);
  };

  const resetDestinationForReinput = () => {
    setDestination(null);
    setDestinationQuery("");
    setDestinationResults([]);
    setShowDestinationResults(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!origin || !destination) {
      onError("출발지와 목적지를 모두 선택해주세요.");
      return;
    }

    onLoadingChange(true);

    try {
      const departureISO = buildTodayDepartureISO(departureTimeHHmm);

      const maxTimeMin = Number.isFinite(parseInt(maxTimeMinInput, 10))
        ? parseInt(maxTimeMinInput, 10)
        : 60;

      const maxWalkMin = Number.isFinite(parseInt(maxWalkMinInput, 10))
        ? parseInt(maxWalkMinInput, 10)
        : 15;

      const request: SearchRequest = {
        origin,
        destination,
        maxTimeMin,
        maxWalkMin,
        requireTaxi: false,
        taxiMaxSegments: 1,
        departureTime: departureISO,
      };

      const apiUrl = `${
        import.meta.env.VITE_SUPABASE_URL
      }/functions/v1/find-optimal-route`;

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });

      const data = await response.json();

      if (data.success) onSearch(data as RouteResponse);
      else onError(data.error || "경로를 찾을 수 없습니다.");
    } catch (err) {
      onError(
        err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다."
      );
    } finally {
      onLoadingChange(false);
    }
  };

  const canSubmit = !!origin && !!destination;

  return (
    <div className="relative">
      <style>
        {`
          .rtp.react-time-picker { width: 100%; }
          .rtp .react-time-picker__wrapper {
            border: 0 !important;
            background: transparent !important;
            padding: 0 !important;
            min-height: 0 !important;
            box-shadow: none !important;
          }
          .rtp .react-time-picker__inputGroup {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 0 !important;
            background: transparent !important;
          }

          .rtp .react-time-picker__inputGroup__input {
            border: 0 !important;
            background: transparent !important;
            box-shadow: none !important;
            outline: none !important;
            color: #111827;
            font-size: 16px !important;
            line-height: 20px;
            padding: 0 !important;
            min-width: 2ch;
          }

          .rtp .react-time-picker__inputGroup__divider {
            color: #9ca3af;
            font-size: 16px !important;
            line-height: 20px;
          }

          .rtp .react-time-picker__inputGroup__amPm {
            border: 0 !important;
            background: transparent !important;
            color: #6b7280;
            padding-left: 6px;
            font-size: 16px !important;
            line-height: 20px;
          }

          .rtp .react-time-picker__button {
            border: 0 !important;
            background: transparent !important;
            padding: 0 !important;
          }

          .rtp .react-time-picker__button svg { stroke: #9ca3af; }

          .rtp input { -webkit-appearance: none; appearance: none; }
        `}
      </style>

      <form onSubmit={handleSubmit} className="pb-16">
        <Row>
          <FieldLabel>출발지</FieldLabel>
          <div ref={originWrapRef} className="relative">
            <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-3 focus-within:border-blue-500">
              <input
                value={originQuery}
                onChange={(e) => setOriginQuery(e.target.value)}
                onFocus={() => {
                  if (origin) resetOriginForReinput();
                  else if (originResults.length > 0) setShowOriginResults(true);
                }}
                onMouseDown={() => {
                  if (origin) resetOriginForReinput();
                }}
                placeholder="출발지를 검색하세요"
                disabled={!hasKakaoKey}
                className="w-full text-[16px] leading-[20px] text-gray-900 placeholder:text-gray-400 outline-none disabled:bg-transparent [-webkit-text-size-adjust:100%]"
              />
            </div>

            {showOriginResults && !origin && originResults.length > 0 && (
              <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-[0_10px_24px_rgba(0,0,0,0.10)]">
                {originResults.slice(0, 8).map((r, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => selectOrigin(r)}
                    className="w-full border-b border-gray-100 px-4 py-3 text-left hover:bg-gray-50 last:border-b-0"
                  >
                    <div className="text-[14px] font-medium text-gray-900">
                      {r.name}
                    </div>
                    <div className="mt-0.5 text-[12px] text-gray-500">
                      {r.address}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </Row>

        <div className="h-px bg-gray-100" />

        <Row>
          <FieldLabel>목적지</FieldLabel>
          <div ref={destinationWrapRef} className="relative">
            <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-3 focus-within:border-blue-500">
              <input
                value={destinationQuery}
                onChange={(e) => setDestinationQuery(e.target.value)}
                onFocus={() => {
                  if (destination) resetDestinationForReinput();
                  else if (destinationResults.length > 0)
                    setShowDestinationResults(true);
                }}
                onMouseDown={() => {
                  if (destination) resetDestinationForReinput();
                }}
                placeholder="목적지를 검색하세요"
                disabled={!hasKakaoKey}
                className="w-full text-[16px] leading-[20px] text-gray-900 placeholder:text-gray-400 outline-none disabled:bg-transparent [-webkit-text-size-adjust:100%]"
              />
            </div>

            {showDestinationResults &&
              !destination &&
              destinationResults.length > 0 && (
                <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-[0_10px_24px_rgba(0,0,0,0.10)]">
                  {destinationResults.slice(0, 8).map((r, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => selectDestination(r)}
                      className="w-full border-b border-gray-100 px-4 py-3 text-left hover:bg-gray-50 last:border-b-0"
                    >
                      <div className="text-[14px] font-medium text-gray-900">
                        {r.name}
                      </div>
                      <div className="mt-0.5 text-[12px] text-gray-500">
                        {r.address}
                      </div>
                    </button>
                  ))}
                </div>
              )}
          </div>
        </Row>

        <div className="h-px bg-gray-100" />

        <Row>
          <FieldLabel>출발 시간</FieldLabel>
          <div className="w-full rounded-xl border border-gray-200 bg-white px-3 py-3 focus-within:border-blue-500">
            <TimePicker
              value={departureTimeHHmm}
              onChange={(v) => {
                if (typeof v === "string") setDepartureTimeHHmm(v);
              }}
              disableClock
              clearIcon={null}
              format="h:mm a"
              className="rtp w-full"
            />
          </div>
          <div className="mt-2 text-[12px] text-gray-500">
            날짜는 <span className="font-medium">오늘</span>만 조회 가능해요.
          </div>
        </Row>

        <div className="h-px bg-gray-100" />

        <Row>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>희망 소요시간(분)</FieldLabel>
              <input
                type="number"
                inputMode="numeric"
                min={10}
                max={180}
                value={maxTimeMinInput}
                onChange={(e) => {
                  const v = e.target.value;
                  if (/^\d*$/.test(v)) setMaxTimeMinInput(v);
                }}
                className="h-12 w-full box-border rounded-xl border border-gray-200 bg-white px-3 py-3 text-[16px] leading-[20px] text-gray-900 outline-none focus:border-blue-500 [-webkit-appearance:none] [appearance:textfield]"
              />
            </div>
            <div>
              <FieldLabel>최대 도보(분)</FieldLabel>
              <input
                type="number"
                inputMode="numeric"
                min={5}
                max={60}
                value={maxWalkMinInput}
                onChange={(e) => {
                  const v = e.target.value;
                  if (/^\d*$/.test(v)) setMaxWalkMinInput(v);
                }}
                className="h-12 w-full box-border rounded-xl border border-gray-200 bg-white px-3 py-3 text-[16px] leading-[20px] text-gray-900 outline-none focus:border-blue-500 [-webkit-appearance:none] [appearance:textfield]"
              />
            </div>
          </div>
        </Row>
      </form>

      <div className="absolute bottom-0 left-0 right-0 p-3">
        <button
          type="button"
          onClick={(e) => {
            const form = e.currentTarget.closest("div")
              ?.previousSibling as HTMLFormElement | null;
            form?.requestSubmit();
          }}
          disabled={!canSubmit || !hasKakaoKey}
          className="w-full rounded-2xl bg-blue-600 py-4 text-[15px] font-semibold text-white shadow-[0_8px_20px_rgba(37,99,235,0.25)] disabled:bg-gray-300 disabled:shadow-none"
        >
          경로 검색
        </button>
      </div>
    </div>
  );
}
