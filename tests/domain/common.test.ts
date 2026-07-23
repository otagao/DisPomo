import { describe, expect, it } from "vitest";

import {
  CURRENT_SCHEMA_VERSION,
  createEntityMetadata,
  isDeleted,
} from "../../src/domain";

describe("entity metadata", () => {
  it("creates local-first metadata with deterministic defaults", () => {
    const metadata = createEntityMetadata({
      id: "01234567-89ab-cdef-0123-456789abcdef",
      createdAt: "2026-07-23T00:00:00.000Z",
    });

    expect(metadata).toEqual({
      id: "01234567-89ab-cdef-0123-456789abcdef",
      createdAt: "2026-07-23T00:00:00.000Z",
      updatedAt: "2026-07-23T00:00:00.000Z",
      deletedAt: null,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      ownerId: null,
      deviceId: null,
      syncVersion: 0,
    });
    expect(isDeleted(metadata)).toBe(false);
  });

  it("recognizes a logical deletion", () => {
    expect(isDeleted({ deletedAt: "2026-07-23T01:00:00.000Z" })).toBe(
      true,
    );
  });
});
