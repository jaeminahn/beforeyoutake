/*
  # Remove favorite routes table

  1. Changes
    - Drop `favorite_routes` table and related policies
  
  2. Notes
    - Favorites feature is being removed from the application
*/

DROP TABLE IF EXISTS favorite_routes CASCADE;