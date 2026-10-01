import { z } from "zod";

// Shared building blocks for validation schemas used by both apps.

export const uuidSchema = z.uuid();

/** An ISO 8601 timestamp that carries an explicit offset (e.g. "Z"), matching timestamptz. */
export const timestamptzSchema = z.iso.datetime({ offset: true });
