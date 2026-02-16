/*
  # Create route search tables for 늦지마 service

  1. New Tables
    - `searches`
      - `id` (uuid, primary key)
      - `origin_name` (text) - 출발지 이름
      - `origin_lat` (numeric) - 출발지 위도
      - `origin_lng` (numeric) - 출발지 경도
      - `destination_name` (text) - 목적지 이름
      - `destination_lat` (numeric) - 목적지 위도
      - `destination_lng` (numeric) - 목적지 경도
      - `max_time_min` (integer) - 최대 소요시간 (분)
      - `max_walk_min` (integer) - 최대 도보시간 (분)
      - `result_routes` (jsonb) - 검색된 경로 결과
      - `searched_at` (timestamptz) - 검색 시각
    
    - `favorite_routes`
      - `id` (uuid, primary key)
      - `route_name` (text) - 경로 별칭
      - `origin_name` (text)
      - `origin_lat` (numeric)
      - `origin_lng` (numeric)
      - `destination_name` (text)
      - `destination_lat` (numeric)
      - `destination_lng` (numeric)
      - `max_time_min` (integer)
      - `max_walk_min` (integer)
      - `created_at` (timestamptz)
    
    - `api_cache`
      - `id` (uuid, primary key)
      - `cache_key` (text, unique) - API 요청 캐시 키
      - `cache_value` (jsonb) - API 응답
      - `expires_at` (timestamptz) - 만료 시각
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Public read access for searches and favorites (no auth required for this demo)
*/

CREATE TABLE IF NOT EXISTS searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  origin_name text NOT NULL,
  origin_lat numeric NOT NULL,
  origin_lng numeric NOT NULL,
  destination_name text NOT NULL,
  destination_lat numeric NOT NULL,
  destination_lng numeric NOT NULL,
  max_time_min integer NOT NULL,
  max_walk_min integer NOT NULL,
  result_routes jsonb DEFAULT '[]'::jsonb,
  searched_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS favorite_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_name text NOT NULL,
  origin_name text NOT NULL,
  origin_lat numeric NOT NULL,
  origin_lng numeric NOT NULL,
  destination_name text NOT NULL,
  destination_lat numeric NOT NULL,
  destination_lng numeric NOT NULL,
  max_time_min integer NOT NULL,
  max_walk_min integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS api_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key text UNIQUE NOT NULL,
  cache_value jsonb NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorite_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert searches"
  ON searches FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anyone can view searches"
  ON searches FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anyone can insert favorites"
  ON favorite_routes FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anyone can view favorites"
  ON favorite_routes FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anyone can delete favorites"
  ON favorite_routes FOR DELETE
  TO anon
  USING (true);

CREATE POLICY "Anyone can read cache"
  ON api_cache FOR SELECT
  TO anon
  USING (expires_at > now());

CREATE POLICY "Anyone can insert cache"
  ON api_cache FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_searches_searched_at ON searches(searched_at DESC);
CREATE INDEX IF NOT EXISTS idx_favorites_created_at ON favorite_routes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cache_key ON api_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_cache_expires ON api_cache(expires_at);