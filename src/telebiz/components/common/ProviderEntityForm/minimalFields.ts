import { ProviderEntityType } from '../../../services/types';

/**
 * Minimal field sets for quick creation flows.
 *
 * These fields represent the essential data needed to create
 * an entity quickly from chat context. Users can expand to
 * see all fields if needed.
 *
 * Rationale for selections:
 * - Contact: Name (required), email/phone (primary contact methods)
 * - Company: Name (required), website (verification), industry (categorization)
 * - Deal: Title (required), pipeline/stage (required workflow context)
 * - Task: Subject (what), date (when), type (how)
 * - Meeting: Title (what), startDate (when), duration (how long)
 * - Page: Empty (Notion pages are schema-dependent, show all)
 *
 * Note: Field names MUST match provider field definitions in:
 * - fieldConfig.ts (PROVIDER_FIELDS)
 * - forms.ts (static form definitions)
 */
export const MINIMAL_FIELDS: Record<ProviderEntityType, string[]> = {
  [ProviderEntityType.Contact]: [
    'name',
    'email',
    'phone',
  ],

  [ProviderEntityType.Company]: [
    'name',
    'website',
    'industry',
  ],

  [ProviderEntityType.Deal]: [
    'title',
    'pipeline',
    'stage',
  ],

  [ProviderEntityType.Task]: [
    'subject',
    'date',
    'taskType',
  ],

  [ProviderEntityType.Meeting]: [
    'title',
    'startDate',
    'duration',
  ],

  [ProviderEntityType.Page]: [
    // Empty: Notion pages are database-specific
    // Show all fields to avoid confusion
  ],

  // Entity types without minimal fields (show all)
  [ProviderEntityType.Note]: [],
  [ProviderEntityType.Organization]: [],
};

/**
 * Get minimal field names for an entity type.
 *
 * Returns the subset of fields that should be displayed in quick creation
 * flows. These are the 3 most essential fields for each entity type,
 * allowing users to create entities rapidly without being overwhelmed.
 *
 * @param entityType - The provider entity type
 * @returns Array of field names for minimal view, or empty array if none defined
 *
 * @example
 * ```ts
 * const fields = getMinimalFieldsForEntity(ProviderEntityType.Contact);
 * // Returns: ['name', 'email', 'phone']
 * ```
 *
 * @example
 * ```ts
 * const fields = getMinimalFieldsForEntity(ProviderEntityType.Page);
 * // Returns: [] (show all fields for Notion pages)
 * ```
 */
export function getMinimalFieldsForEntity(
  entityType: ProviderEntityType,
): string[] {
  return MINIMAL_FIELDS[entityType] || [];
}

/**
 * Check if an entity type has a minimal field set defined.
 *
 * Useful for determining whether to show "Show more fields" toggle
 * in the UI. If false, all fields should be displayed by default.
 *
 * @param entityType - The provider entity type
 * @returns True if minimal fields are defined and non-empty
 *
 * @example
 * ```ts
 * if (hasMinimalFields(entityType)) {
 *   // Show "Show more fields" toggle
 * } else {
 *   // Show all fields by default
 * }
 * ```
 */
export function hasMinimalFields(entityType: ProviderEntityType): boolean {
  const fields = MINIMAL_FIELDS[entityType];
  return Array.isArray(fields) && fields.length > 0;
}
