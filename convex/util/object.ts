export function parseMap<Id, Serialized, Parsed>(
  records: Serialized[],
  constructor: new (r: Serialized) => Parsed,
  getId: (r: Parsed) => Id,
): Map<Id, Parsed> {
  const out = new Map<Id, Parsed>();
  for (const record of records) {
    const parsed = new constructor(record);
    const id = getId(parsed);
    if (out.has(id)) {
      console.warn(`Duplicate ID found: ${id}. Skipping this record.`);
      continue;  
    }
    out.set(id, parsed);
  }
  return out;
}


export function serializeMap<Serialized, T extends { serialize(): Serialized }>(
  map: Map<string, T>,
): Serialized[] {
  return [...map.values()].map((v) => v.serialize());
}
