import { defineConfig, loadEnv } from 'vite';
import { musicbrainzPlugin } from './server/musicbrainz-plugin.js';
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return { base: './', plugins: [musicbrainzPlugin(env.MUSICBRAINZ_CONTACT || env.VITE_SUPABASE_URL)], build: { target: 'es2022' } };
});
