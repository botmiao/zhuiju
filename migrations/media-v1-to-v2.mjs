export function migrateMediaV1ToV2(value) {
  return { ...value, schemaVersion: 2 };
}
