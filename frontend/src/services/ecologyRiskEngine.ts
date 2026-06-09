import { supabase } from '../lib/supabaseClient';

export interface TrackedAnimal {
  animal_id: string;
  species: string;
  zone_id: string;
  confirmed_at: string;
  camera_trap_id: string | null;
}

export interface ZoneThreatCorrelation {
  zone_id: string;
  species: string;
  incident_count_near_sighting: number;
  total_sightings: number;
  correlation_pct: number;
}

export interface EcologyTriggerResult {
  created_alert: boolean;
  alert?: any;
  reason?: string;
}

// ─── Fetch most recent sighting per animal ────────────────────────────────────
export async function fetchTrackedAnimals(): Promise<TrackedAnimal[]> {
  const { data, error } = await supabase
    .from('tracked_animals')
    .select('animal_id, species, zone_id, confirmed_at, camera_trap_id')
    .order('confirmed_at', { ascending: false });

  if (error) {
    console.warn('[ecologyRiskEngine] Failed to fetch animals:', error.message);
    return [];
  }

  // Deduplicate — keep most recent sighting per animal_id
  const seen = new Set<string>();
  return (data ?? []).filter((a) => {
    if (seen.has(a.animal_id)) return false;
    seen.add(a.animal_id);
    return true;
  });
}

// ─── Fetch correlation for a given zone + species ─────────────────────────────
export async function fetchCorrelation(
  zoneId: string,
  species: string
): Promise<ZoneThreatCorrelation | null> {
  const { data, error } = await supabase
    .from('zone_threat_correlations')
    .select('*')
    .eq('zone_id', zoneId)
    .eq('species', species)
    .single();

  if (error) return null;
  return data;
}

// ─── Trigger a new animal sighting via Supabase Edge Function ─────────────────
export async function triggerAnimalSighting(
  animalId: string,
  species: string,
  zoneId: string,
  cameraTrapId: string
): Promise<EcologyTriggerResult> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;

  const response = await fetch(`${supabaseUrl}/functions/v1/ecology-trigger`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token ?? ''}`,
    },
    body: JSON.stringify({
      animal_id: animalId,
      species,
      zone_id: zoneId,
      camera_trap_id: cameraTrapId,
    }),
  });

  if (!response.ok) {
    throw new Error(`Edge function failed: ${response.status}`);
  }

  return response.json();
}
