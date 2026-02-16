import { useState } from 'react';
import RouteSearchForm from './components/RouteSearchForm';
import RouteResults from './components/RouteResults';
import { RouteResponse } from './types';

function App() {
  const [routeResponse, setRouteResponse] = useState<RouteResponse | null>(null);
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
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <header className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 mb-3">
            늦지마
          </h1>
          <p className="text-lg text-gray-600">
            시간 내에 목적지까지, 최적의 경로를 찾아드립니다
          </p>
        </header>

        <div className="mb-8">
          <RouteSearchForm
            onSearch={handleSearch}
            onError={handleError}
            onLoadingChange={handleLoadingChange}
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-6 py-4 rounded-lg mb-6">
            <p className="font-medium">오류가 발생했습니다</p>
            <p className="text-sm mt-1 whitespace-pre-line">{error}</p>
          </div>
        )}

        {loading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">최적 경로를 찾고 있습니다...</p>
          </div>
        )}

        {!loading && routeResponse && routeResponse.routes.length > 0 && (
          <RouteResults response={routeResponse} />
        )}
      </div>
    </div>
  );
}

export default App;
