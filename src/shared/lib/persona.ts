export type PersonaTag = {
  label: string;
  type: string;
  source?: string;
  date?: string;
  confidence?: number;
};

export type InteractionHistory = {
  summary: string;
  date: string;
  source_id: string;
};

export function mergeTags(existing: PersonaTag[], incoming: PersonaTag[]) {
  const map = new Map<string, PersonaTag>();
  for (const tag of existing) {
    // Robust key generation: handle undefined source
    const key = `${tag.label}-${tag.type}-${tag.source || ''}`;
    map.set(key, tag);
  }
  for (const tag of incoming) {
    const key = `${tag.label}-${tag.type}-${tag.source || ''}`;
    // Merge strategy: incoming overwrites existing, but preserves other fields if needed
    // Here we simply spread incoming over existing to update
    map.set(key, { ...map.get(key), ...tag });
  }
  return Array.from(map.values());
}

export function mergeHistory(
  existing: InteractionHistory[],
  incoming: InteractionHistory[]
) {
  const map = new Map<string, InteractionHistory>();
  for (const item of existing) {
    map.set(item.source_id, item);
  }
  for (const item of incoming) {
    map.set(item.source_id, item);
  }
  return Array.from(map.values());
}
