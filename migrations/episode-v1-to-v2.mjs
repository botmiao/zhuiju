export function migrateEpisodeV1ToV2(value) {
  return { ...value, schemaVersion: 2 };
}
