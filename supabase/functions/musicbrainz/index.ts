import { createMusicBrainzHandler } from './api.js';
Deno.serve(createMusicBrainzHandler({ contact: Deno.env.get('MUSICBRAINZ_CONTACT') || Deno.env.get('SUPABASE_URL') || '' }));
