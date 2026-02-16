import { useState, useRef, useEffect, useCallback } from "react";
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

function getCurrentDateTimeLocal(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1 text-[12px] font-medium text-gray-600 whitespace-nowrap">
      {children}
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-3">{children}</div>;
}

const INPUT_BASE =
  "w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-[16px] text-gray-900 placeholder:text-gray-400 outline-none focus:border-blue-500 disabled:bg-transparent";

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

  const [maxTimeMin, setMaxTimeMin] = useState(60);
  const [maxWalkMin, setMaxWalkMin] = useState(15);
  const [departureTime, setDepartureTime] = useState(getCurrentDateTimeLocal());

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
      const departureISO = departureTime
        ? new Date(departureTime).toISOString()
        : new Date().toISOString();

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
      {/* sticky footer 높이만큼 아래 공간 확보 */}
      <form onSubmit={handleSubmit} className="pb-12">
        <Row>
          <FieldLabel>출발지</FieldLabel>
          <div ref={originWrapRef} className="relative">
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
              className={INPUT_BASE}
            />

            {showOriginResults && !origin && originResults.length > 0 && (
              <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-[0_10px_24px_rgba(0,0,0,0.10)]">
                {originResults.slice(0, 8).map((r, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => selectOrigin(r)}
                    className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
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
              className={INPUT_BASE}
            />

            {showDestinationResults &&
              !destination &&
              destinationResults.length > 0 && (
                <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-[0_10px_24px_rgba(0,0,0,0.10)]">
                  {destinationResults.slice(0, 8).map((r, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => selectDestination(r)}
                      className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
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
          <input
            type="datetime-local"
            value={departureTime}
            onChange={(e) => setDepartureTime(e.target.value)}
            className={INPUT_BASE}
          />
          <div className="mt-2 text-[12px] text-gray-500">
            현재 시간이 기본값으로 설정됩니다.
          </div>
        </Row>

        <div className="h-px bg-gray-100" />

        <Row>
          {/* 모바일에서는 1열, sm부터 2열 */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel>희망 소요시간(분)</FieldLabel>
              <input
                type="number"
                min={10}
                max={180}
                value={maxTimeMin}
                onChange={(e) => setMaxTimeMin(Number(e.target.value))}
                className={INPUT_BASE}
              />
            </div>
            <div>
              <FieldLabel>최대 도보(분)</FieldLabel>
              <input
                type="number"
                min={5}
                max={60}
                value={maxWalkMin}
                onChange={(e) => setMaxWalkMin(Number(e.target.value))}
                className={INPUT_BASE}
              />
            </div>
          </div>
        </Row>
      </form>

      {/* ✅ absolute -> sticky: iOS picker/키보드 레이아웃 안정 */}
      <div className="sticky bottom-0 left-0 right-0 border-t border-gray-100 bg-white/90 backdrop-blur">
        <div className="p-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
          <button
            type="button"
            onClick={(e) => {
              const form = e.currentTarget.closest("div")
                ?.previousSibling as HTMLFormElement | null;
              form?.requestSubmit();
            }}
            disabled={!canSubmit || !hasKakaoKey}
            className="w-full rounded-2xl bg-blue-600 py-4 text-[16px] font-semibold text-white shadow-[0_8px_20px_rgba(37,99,235,0.25)] disabled:bg-gray-300 disabled:shadow-none"
          >
            경로 검색
          </button>
        </div>
      </div>
    </div>
  );
}
