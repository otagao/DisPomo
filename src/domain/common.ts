/**
 * Values crossing the Electron IPC boundary must remain JSON serializable.
 * Dates are therefore represented as ISO-8601 strings instead of `Date`.
 */
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = { readonly [key: string]: JsonValue };

/** A globally unique identifier (UUID in production). */
export type UUID = string;

/** An ISO-8601 timestamp, for example `2026-07-23T10:30:00.000Z`. */
export type IsoDateTime = string;

export const CURRENT_SCHEMA_VERSION = 1;

/**
 * Metadata shared by all persisted domain records.
 *
 * `ownerId`, `deviceId`, and `syncVersion` are local-first fields reserved for
 * a future sync implementation. They do not imply that sync exists in the MVP.
 */
export type EntityMetadata = {
  id: UUID;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  deletedAt: IsoDateTime | null;
  schemaVersion: number;
  ownerId: UUID | null;
  deviceId: UUID | null;
  syncVersion: number;
};

export type NewEntityMetadata = Pick<EntityMetadata, "id" | "createdAt"> &
  Partial<
    Pick<
      EntityMetadata,
      | "updatedAt"
      | "deletedAt"
      | "schemaVersion"
      | "ownerId"
      | "deviceId"
      | "syncVersion"
    >
  >;

/** Builds normalized metadata without depending on a UUID or clock library. */
export function createEntityMetadata(input: NewEntityMetadata): EntityMetadata {
  return {
    id: input.id,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt ?? input.createdAt,
    deletedAt: input.deletedAt ?? null,
    schemaVersion: input.schemaVersion ?? CURRENT_SCHEMA_VERSION,
    ownerId: input.ownerId ?? null,
    deviceId: input.deviceId ?? null,
    syncVersion: input.syncVersion ?? 0,
  };
}

export function isDeleted(entity: Pick<EntityMetadata, "deletedAt">): boolean {
  return entity.deletedAt !== null;
}
