import { defineConfig, loadEnv } from 'vite';
import { googlePlacesPlugin } from './server/google-places.js';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'GOOGLE_MAPS_API_KEY');
  return { plugins: [googlePlacesPlugin(process.env.GOOGLE_MAPS_API_KEY || env.GOOGLE_MAPS_API_KEY)] };
});
