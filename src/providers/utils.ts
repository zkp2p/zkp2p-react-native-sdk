import { JSONPath } from 'jsonpath-plus';
import type { ProviderSettings, ExtractedMetadataList } from '../types';

/**
 * JSON stringify helper that omits functions which are not serializable.
 */
export const safeStringify = (v: unknown): string =>
  JSON.stringify(v, (_, val) => (typeof val === 'function' ? undefined : val));

/**
 * Extracts a list of transaction items from a provider response JSON.
 * Returns an empty array on errors.
 */
export const extractMetadata = (
  json: any,
  cfg: ProviderSettings
): ExtractedMetadataList[] => {
  const txCfg = cfg.metadata.transactionsExtraction;
  if (!txCfg) return [];
  try {
    const list = JSONPath({
      path: txCfg.transactionJsonPathListSelector,
      json,
    });
    if (!Array.isArray(list[0])) return [];
    return list[0].map((t: any, i: number) => {
      const row: Record<string, unknown> = {};
      for (const [k, p] of Object.entries(txCfg.transactionJsonPathSelectors)) {
        row[k] = (
          JSONPath({ path: p, json: t, resultType: 'value' }) as any[]
        )[0];
      }
      return {
        ...row,
        hidden: Object.values(row).some((v) => v == null),
        originalIndex: i,
      } as ExtractedMetadataList;
    });
  } catch {
    return [];
  }
};
