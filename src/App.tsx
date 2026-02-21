import { useState } from "react";
import RouteSearchForm from "./components/RouteSearchForm";
import RouteResults from "./components/RouteResults";
import { RouteResponse } from "./types";
import { AlertTriangle } from "lucide-react";

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white border border-gray-200/70 shadow-[0_8px_24px_rgba(17,24,39,0.06)]">
      {children}
    </div>
  );
}

function App() {
  const [routeResponse, setRouteResponse] = useState<RouteResponse | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = (response: RouteResponse) => {
    setRouteResponse(response);
    setError(null);
  };

  const handleError = (errorMessage: string) => {
    setError(errorMessage);
    setRouteResponse(null);
  };

  const handleLoadingChange = (isLoading: boolean) => {
    setLoading(isLoading);
    if (isLoading) setError(null);
  };

  return (
    <div className="min-h-screen bg-[#F5F6F7] font-sans">
      <div className="mx-auto max-w-[680px] px-4 py-6">
        {/* Header */}
        <header className="mb-5">
          <h1 className="text-[22px] font-semibold text-gray-900 tracking-[-0.2px]">
            타기전에
          </h1>
          <p className="mt-1 text-[13px] text-gray-500">택시비 줄이는 길찾기</p>
        </header>

        {/* Search Form */}
        <Card>
          <RouteSearchForm
            onSearch={handleSearch}
            onError={handleError}
            onLoadingChange={handleLoadingChange}
          />
        </Card>

        {/* Error */}
        {error && (
          <div className="mt-4">
            <Card>
              <div className="px-4 py-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl bg-red-50 border border-red-100 text-red-700">
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-[14px] font-semibold text-gray-900">
                      문제가 발생했습니다
                    </div>
                    <div className="mt-1 text-[13px] text-gray-600 whitespace-pre-line">
                      {error}
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="mt-4">
            <Card>
              <div className="px-4 py-4">
                <div className="flex items-center gap-3">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-200 border-t-blue-600" />
                  <div>
                    <div className="text-[14px] font-semibold text-gray-900">
                      경로를 찾는 중
                    </div>
                    <div className="mt-0.5 text-[12px] text-gray-500">
                      후보를 계산하고 있어요.
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Results */}
        {!loading && routeResponse && routeResponse.routes.length > 0 && (
          <div className="mt-4">
            <RouteResults response={routeResponse} />
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
