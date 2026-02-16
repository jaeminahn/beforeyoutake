import { useState, useRef, useEffect, useCallback } from "react";
import { SearchRequest, RouteResponse, Location } from "../types";

interface Props {
  loading: boolean; // ✅ 추가: 로딩 상태를 부모에서 내려받음
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
    <div className="mb-1 text-[12px] font-medium text-gray-600">{children}</div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  // iPhone Safari에서 datetime-local이 오른쪽으로 overflow 나는 케이스 방어
  return <div className="px-4 py-3 overflow-x-hidden">{children}</div>;
}

export default function RouteSearchForm({
  loading,
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

  // ✅ 중복 요청/연타 방지용 AbortController
  const submitAbortRef = useRef<AbortController | null>(null);

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

    // ✅ 로딩 중 중복 submit 차단
    if (loading) return;

    if (!origin || !destination) {
      onError("출발지와 목적지를 모두 선택해주세요.");
      return;
    }

    // ✅ 직전 요청이 살아있으면 취소
    submitAbortRef.current?.abort();
    const controller = new AbortController();
    submitAbortRef.current = controller;

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
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
        signal: controller.signal, // ✅ AbortController 적용
      });

      const data = await response.json();

      if (data.success) onSearch(data as RouteResponse);
      else onError(data.error || "경로를 찾을 수 없습니다.");
    } catch (err) {
      // ✅ 취소(Abort)는 에러 메시지 띄우지 않음
      if (err instanceof DOMException && err.name === "AbortError") return;

      onError(
        err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다."
      );
    } finally {
      // ✅ 내가 마지막 요청일 때만 로딩 해제 (race 방지)
      if (submitAbortRef.current === controller) {
        onLoadingChange(false);
        submitAbortRef.current = null;
      }
    }
  };

  // ✅ 로딩 중에는 제출 불가
  const canSubmit = !!origin && !!destination && hasKakaoKey && !loading;

  return (
    <div className="relative overflow-x-hidden">
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
                disabled={!hasKakaoKey || loading}
                className="w-full min-w-0 text-[15px] text-gray-900 placeholder:text-gray-400 outline-none disabled:bg-transparent"
              />
            </div>

            {showOriginResults && !origin && originResults.length > 0 && (
              <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-[0_10px_24px_rgba(0,0,0,0.10)]">
                {originResults.slice(0, 8).map((r, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => selectOrigin(r)}
                    disabled={loading}
                    className="w-full border-b border-gray-100 px-4 py-3 text-left hover:bg-gray-50 last:border-b-0 disabled:opacity-60"
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
                disabled={!hasKakaoKey || loading}
                className="w-full min-w-0 text-[15px] text-gray-900 placeholder:text-gray-400 outline-none disabled:bg-transparent"
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
                      disabled={loading}
                      className="w-full border-b border-gray-100 px-4 py-3 text-left hover:bg-gray-50 last:border-b-0 disabled:opacity-60"
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
            disabled={loading}
            className="w-full min-w-0 max-w-full box-border rounded-xl border border-gray-200 bg-white px-3 py-3 text-[16px] sm:text-[14px] text-gray-900 focus:border-blue-500 outline-none disabled:opacity-60"
          />
          <div className="mt-2 text-[12px] text-gray-500">
            현재 시간이 기본값으로 설정됩니다.
          </div>
        </Row>

        <div className="h-px bg-gray-100" />

        <Row>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>희망 소요시간(분)</FieldLabel>
              <input
                type="number"
                min={10}
                max={180}
                value={maxTimeMin}
                onChange={(e) => setMaxTimeMin(Number(e.target.value))}
                disabled={loading}
                className="w-full min-w-0 rounded-xl border border-gray-200 bg-white px-3 py-3 text-[14px] text-gray-900 focus:border-blue-500 outline-none disabled:opacity-60"
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
                disabled={loading}
                className="w-full min-w-0 rounded-xl border border-gray-200 bg-white px-3 py-3 text-[14px] text-gray-900 focus:border-blue-500 outline-none disabled:opacity-60"
              />
            </div>
          </div>
        </Row>
      </form>

      <div className="absolute bottom-0 left-0 right-0 p-3">
        <button
          type="button"
          onClick={(e) => {
            if (loading) return;
            const form = e.currentTarget.closest("div")
              ?.previousSibling as HTMLFormElement | null;
            form?.requestSubmit();
          }}
          disabled={!canSubmit}
          className="w-full rounded-2xl bg-blue-600 py-4 text-[15px] font-semibold text-white shadow-[0_8px_20px_rgba(37,99,235,0.25)] disabled:bg-gray-300 disabled:shadow-none"
        >
          {loading ? "검색 중..." : "경로 검색"}
        </button>
      </div>
    </div>
  );
}
