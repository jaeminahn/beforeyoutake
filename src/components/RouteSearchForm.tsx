import { useState, useRef, useEffect, useCallback } from 'react';
import { Clock, MapPin, Timer, TrendingUp, Search, X } from 'lucide-react';
import { SearchRequest, RouteResponse, Location } from '../types';

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
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export default function RouteSearchForm({ onSearch, onError, onLoadingChange }: Props) {
  const [origin, setOrigin] = useState<Location | null>(null);
  const [destination, setDestination] = useState<Location | null>(null);
  const [originQuery, setOriginQuery] = useState('');
  const [destinationQuery, setDestinationQuery] = useState('');
  const [originResults, setOriginResults] = useState<PlaceResult[]>([]);
  const [destinationResults, setDestinationResults] = useState<PlaceResult[]>([]);
  const [showOriginResults, setShowOriginResults] = useState(false);
  const [showDestinationResults, setShowDestinationResults] = useState(false);
  const [maxTimeMin, setMaxTimeMin] = useState(60);
  const [maxWalkMin, setMaxWalkMin] = useState(15);
  const [departureTime, setDepartureTime] = useState(getCurrentDateTimeLocal());
  const hasKakaoKey = !!import.meta.env.VITE_KAKAO_REST_API_KEY;

  const originInputRef = useRef<HTMLInputElement>(null);
  const destinationInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (originInputRef.current && !originInputRef.current.contains(e.target as Node)) {
        setShowOriginResults(false);
      }
      if (destinationInputRef.current && !destinationInputRef.current.contains(e.target as Node)) {
        setShowDestinationResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchPlaces = useCallback(async (query: string, isOrigin: boolean) => {
    if (query.length < 1) {
      if (isOrigin) setOriginResults([]);
      else setDestinationResults([]);
      return;
    }

    if (!hasKakaoKey) {
      return;
    }

    if (query.length < 2) return;

    try {
      const response = await fetch(
        `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}`,
        {
          headers: {
            Authorization: `KakaoAK ${import.meta.env.VITE_KAKAO_REST_API_KEY}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();
      const results: PlaceResult[] = data.documents.map((doc: KakaoDocument) => ({
        name: doc.place_name,
        address: doc.address_name,
        lat: parseFloat(doc.y),
        lng: parseFloat(doc.x),
      }));

      if (isOrigin) {
        setOriginResults(results);
        setShowOriginResults(true);
      } else {
        setDestinationResults(results);
        setShowDestinationResults(true);
      }
    } catch (err) {
      console.error('Error searching places:', err);
      if (err instanceof Error && err.message.includes('403')) {
        onError('Kakao API 키가 유효하지 않습니다. Kakao Developers에서 다음을 확인하세요:\n1. REST API 키가 정확한지\n2. 앱이 활성화되어 있는지\n3. 웹 플랫폼이 등록되어 있는지 (localhost:5173)');
      }
      if (isOrigin) {
        setOriginResults([]);
      } else {
        setDestinationResults([]);
      }
    }
  }, [hasKakaoKey, onError]);

  useEffect(() => {
    const timer = setTimeout(() => {
      searchPlaces(originQuery, true);
    }, 300);
    return () => clearTimeout(timer);
  }, [originQuery, searchPlaces]);

  useEffect(() => {
    const timer = setTimeout(() => {
      searchPlaces(destinationQuery, false);
    }, 300);
    return () => clearTimeout(timer);
  }, [destinationQuery, searchPlaces]);

  const selectOrigin = (place: PlaceResult) => {
    setOrigin({ name: place.name, lat: place.lat, lng: place.lng });
    setOriginQuery(place.name);
    setShowOriginResults(false);
  };

  const selectDestination = (place: PlaceResult) => {
    setDestination({ name: place.name, lat: place.lat, lng: place.lng });
    setDestinationQuery(place.name);
    setShowDestinationResults(false);
  };

  const clearOrigin = () => {
    setOrigin(null);
    setOriginQuery('');
    setOriginResults([]);
  };

  const clearDestination = () => {
    setDestination(null);
    setDestinationQuery('');
    setDestinationResults([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!origin || !destination) {
      onError('출발지와 목적지를 모두 선택해주세요');
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

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/find-optimal-route`;
      const headers = {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
      });

      const data = await response.json();

      if (data.success) {
        onSearch(data as RouteResponse);
      } else {
        onError(data.error || '경로를 찾을 수 없습니다');
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다');
    } finally {
      onLoadingChange(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">경로 검색</h2>
      {!hasKakaoKey && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-4 text-sm">
          <p className="font-medium">API 키 미설정</p>
          <p>.env 파일에 VITE_KAKAO_REST_API_KEY를 설정해주세요.</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="relative" ref={originInputRef}>
          <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
            <MapPin className="w-4 h-4 mr-2 text-blue-600" />
            출발지
          </label>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={originQuery}
              onChange={(e) => setOriginQuery(e.target.value)}
              onFocus={() => originResults.length > 0 && setShowOriginResults(true)}
              placeholder={hasKakaoKey ? "출발지를 검색하세요" : "API 키를 설정해주세요"}
              disabled={!hasKakaoKey}
              className="w-full pl-12 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            {origin && (
              <button
                type="button"
                onClick={clearOrigin}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
          {showOriginResults && originResults.length > 0 && (
            <div className="absolute z-10 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
              {originResults.map((result, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => selectOrigin(result)}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 transition border-b border-gray-100 last:border-b-0"
                >
                  <p className="font-medium text-gray-900">{result.name}</p>
                  <p className="text-sm text-gray-500">{result.address}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative" ref={destinationInputRef}>
          <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
            <TrendingUp className="w-4 h-4 mr-2 text-green-600" />
            목적지
          </label>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={destinationQuery}
              onChange={(e) => setDestinationQuery(e.target.value)}
              onFocus={() => destinationResults.length > 0 && setShowDestinationResults(true)}
              placeholder={hasKakaoKey ? "목적지를 검색하세요" : "API 키를 설정해주세요"}
              disabled={!hasKakaoKey}
              className="w-full pl-12 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            {destination && (
              <button
                type="button"
                onClick={clearDestination}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
          {showDestinationResults && destinationResults.length > 0 && (
            <div className="absolute z-10 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
              {destinationResults.map((result, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => selectDestination(result)}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 transition border-b border-gray-100 last:border-b-0"
                >
                  <p className="font-medium text-gray-900">{result.name}</p>
                  <p className="text-sm text-gray-500">{result.address}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
            <Clock className="w-4 h-4 mr-2 text-purple-600" />
            출발 시간
          </label>
          <input
            type="datetime-local"
            value={departureTime}
            onChange={(e) => setDepartureTime(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
          />
          <p className="text-xs text-gray-500 mt-1">현재 시간이 기본값으로 설정되어 있습니다</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
              <Clock className="w-4 h-4 mr-2 text-orange-600" />
              최대 소요시간
            </label>
            <div className="relative">
              <input
                type="number"
                min="10"
                max="180"
                value={maxTimeMin}
                onChange={(e) => setMaxTimeMin(Number(e.target.value))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm">분</span>
            </div>
          </div>

          <div>
            <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
              <Timer className="w-4 h-4 mr-2 text-gray-600" />
              최대 도보시간
            </label>
            <div className="relative">
              <input
                type="number"
                min="5"
                max="60"
                value={maxWalkMin}
                onChange={(e) => setMaxWalkMin(Number(e.target.value))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent transition"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm">분</span>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={!origin || !destination}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-6 rounded-lg transition shadow-md hover:shadow-lg disabled:bg-gray-300 disabled:cursor-not-allowed disabled:shadow-none"
        >
          최적 경로 찾기
        </button>
      </form>
    </div>
  );
}
