export function migrateSubscriptionV1ToV2(value) {
  return { ...value, schemaVersion: 2 };
}
