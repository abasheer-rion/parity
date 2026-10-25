// A small checker for the JSON Schema subset our MCP tools use (DEC-0049): object, string,
// number, integer, boolean and array, with required, enum, min and max, lengths and item
// counts. Arguments from an AI app are checked against the tool's own inputSchema before the
// tool runs, so a tool never sees a value of the wrong type.

export interface Schema {
  type?: "object" | "string" | "number" | "integer" | "boolean" | "array";
  description?: string;
  properties?: Record<string, Schema>;
  required?: string[];
  additionalProperties?: boolean;
  enum?: readonly (string | number)[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  items?: Schema;
  minItems?: number;
  maxItems?: number;
  default?: unknown;
}

/** The first problem with value against schema, in plain words, or null when it fits. */
export function check(value: unknown, schema: Schema, path = "arguments"): string | null {
  if (value === undefined) return null;
  switch (schema.type) {
    case "object": {
      if (!value || typeof value !== "object" || Array.isArray(value)) return `${path} must be an object`;
      const obj = value as Record<string, unknown>;
      for (const key of schema.required ?? []) {
        if (obj[key] === undefined || obj[key] === null) return `${path}.${key} is required`;
      }
      for (const [key, v] of Object.entries(obj)) {
        const sub = schema.properties?.[key];
        if (!sub) {
          if (schema.additionalProperties === false) return `${path}.${key} is not a known field`;
          continue;
        }
        if (v === null) continue; // an optional field sent as null counts as left out
        const why = check(v, sub, `${path}.${key}`);
        if (why) return why;
      }
      return null;
    }
    case "string":
      if (typeof value !== "string") return `${path} must be text`;
      if (schema.minLength != null && value.length < schema.minLength) return `${path} is too short`;
      if (schema.maxLength != null && value.length > schema.maxLength) return `${path} is too long (at most ${schema.maxLength} characters)`;
      if (schema.pattern && !new RegExp(schema.pattern).test(value)) return `${path} is not in the expected format`;
      if (schema.enum && !schema.enum.includes(value)) return `${path} must be one of: ${schema.enum.join(", ")}`;
      return null;
    case "number":
    case "integer":
      if (typeof value !== "number" || !Number.isFinite(value)) return `${path} must be a number`;
      if (schema.type === "integer" && !Number.isInteger(value)) return `${path} must be a whole number`;
      if (schema.minimum != null && value < schema.minimum) return `${path} must be at least ${schema.minimum}`;
      if (schema.maximum != null && value > schema.maximum) return `${path} must be at most ${schema.maximum}`;
      if (schema.enum && !schema.enum.includes(value)) return `${path} must be one of: ${schema.enum.join(", ")}`;
      return null;
    case "boolean":
      return typeof value === "boolean" ? null : `${path} must be true or false`;
    case "array": {
      if (!Array.isArray(value)) return `${path} must be a list`;
      if (schema.minItems != null && value.length < schema.minItems) return `${path} needs at least ${schema.minItems} items`;
      if (schema.maxItems != null && value.length > schema.maxItems) return `${path} has too many items (at most ${schema.maxItems})`;
      if (schema.items) {
        for (let i = 0; i < value.length; i++) {
          const why = check(value[i], schema.items, `${path}[${i}]`);
          if (why) return why;
        }
      }
      return null;
    }
    default:
      return null;
  }
}
