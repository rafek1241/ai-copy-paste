/**
 * Search filter parsing and matching utilities for advanced search
 *
 * Supports:
 * - file:<name> - fuzzy filename matching
 * - dir:<name> - directory filtering
 * - Regex patterns (auto-detected by special characters)
 * - Plain text substring matching (default)
 * - Combined filters with AND logic
 */

import { fuzzyMatch, fuzzyScore } from './fuzzyMatch';

/**
 * Parsed search filters structure
 */
export interface SearchFilters {
  /** Fuzzy filename search string */
  fileName?: string;
  /** Directory name to filter by */
  directoryName?: string;
  /** Compiled regex pattern for matching */
  regex?: RegExp;
  /** Plain text substring to match */
  plainText?: string;
}

/**
 * Characters that indicate a regex pattern
 */
const REGEX_SPECIAL_CHARS = /[.*?[\]()|^${}+\\]/;

/**
 * Pattern for file: prefix (case-insensitive)
 */
const FILE_PATTERN = /^file:(\S+)$/i;

/**
 * Pattern for dir: prefix (case-insensitive)
 */
const DIR_PATTERN = /^dir:(\S+)$/i;

/**
 * Check if a string looks like a regex pattern
 */
function looksLikeRegex(str: string): boolean {
  return REGEX_SPECIAL_CHARS.test(str);
}

/**
 * Try to compile a string as a regex
 * @returns RegExp if valid, undefined if invalid
 */
function tryCompileRegex(str: string): RegExp | undefined {
  try {
    return new RegExp(str, 'i'); // Case-insensitive
  } catch {
    return undefined;
  }
}

/**
 * Parse a search query into structured filters
 *
 * @param query The raw search query string
 * @returns Parsed SearchFilters object
 *
 * @example
 * parseSearchQuery('file:App dir:src')
 * // { fileName: 'App', directoryName: 'src' }
 *
 * @example
 * parseSearchQuery('\\.test\\.ts$')
 * // { regex: /\.test\.ts$/i }
 *
 * @example
 * parseSearchQuery('test')
 * // { plainText: 'test' }
 */
export function parseSearchQuery(query: string): SearchFilters {
  const filters: SearchFilters = {
    fileName: undefined,
    directoryName: undefined,
    regex: undefined,
    plainText: undefined,
  };

  // Trim and check for empty query
  const trimmed = query.trim();
  if (!trimmed) {
    return filters;
  }

  // Split by whitespace (handling multiple spaces)
  const parts = trimmed.split(/\s+/);
  const remainingParts: string[] = [];

  for (const part of parts) {
    // Check for file: pattern
    const fileMatch = part.match(FILE_PATTERN);
    if (fileMatch) {
      filters.fileName = fileMatch[1];
      continue;
    }

    // Check for dir: pattern
    const dirMatch = part.match(DIR_PATTERN);
    if (dirMatch) {
      filters.directoryName = dirMatch[1];
      continue;
    }

    // Collect remaining parts
    remainingParts.push(part);
  }

  // Process remaining parts
  if (remainingParts.length > 0) {
    const remaining = remainingParts.join(' ');

    // Check if it looks like a regex
    if (looksLikeRegex(remaining)) {
      const compiled = tryCompileRegex(remaining);
      if (compiled) {
        filters.regex = compiled;
      } else {
        // Invalid regex, treat as plain text
        filters.plainText = remaining;
      }
    } else {
      // Plain text search
      filters.plainText = remaining;
    }
  }

  return filters;
}

/**
 * Node interface for matching (minimal required fields)
 */
interface MatchableNode {
  name: string;
  path: string;
  is_dir: boolean;
}

/**
 * Check if a node matches all the provided search filters (AND logic)
 *
 * @param node The tree node to check
 * @param filters The parsed search filters
 * @returns True if the node matches all filters
 */
export function matchesSearchFilters(node: MatchableNode, filters: SearchFilters): boolean {
  const { fileName, directoryName, regex, plainText } = filters;

  // If no filters provided, match everything
  if (!fileName && !directoryName && !regex && !plainText) {
    return true;
  }

  // Check fileName filter (fuzzy match)
  if (fileName) {
    if (!fuzzyMatch(fileName, node.name)) {
      return false;
    }
  }

  // Check directoryName filter
  if (directoryName) {
    const dirNameLower = directoryName.toLowerCase();
    const pathLower = node.path.toLowerCase();

    // Check if directory name appears in path
    // For directories, check if the name matches
    if (node.is_dir) {
      if (!node.name.toLowerCase().includes(dirNameLower) &&
          !pathLower.includes(`/${dirNameLower}/`) &&
          !pathLower.includes(`\\${dirNameLower}\\`) &&
          !pathLower.endsWith(`/${dirNameLower}`) &&
          !pathLower.endsWith(`\\${dirNameLower}`)) {
        return false;
      }
    } else {
      // For files, check if the path contains the directory
      if (!pathLower.includes(`/${dirNameLower}/`) &&
          !pathLower.includes(`\\${dirNameLower}\\`) &&
          !pathLower.includes(`/${dirNameLower}`) &&
          !pathLower.includes(`\\${dirNameLower}`)) {
        return false;
      }
    }
  }

  // Check regex filter
  if (regex) {
    // Test both filename and full path
    if (!regex.test(node.name) && !regex.test(node.path)) {
      return false;
    }
  }

  // Check plainText filter (substring match)
  if (plainText) {
    const textLower = plainText.toLowerCase();
    const nameLower = node.name.toLowerCase();
    const pathLower = node.path.toLowerCase();

    if (!nameLower.includes(textLower) && !pathLower.includes(textLower)) {
      return false;
    }
  }

  return true;
}

/**
 * Get the fuzzy match score for a node against the filters
 * Used for sorting results by relevance
 *
 * @param node The tree node to score
 * @param filters The parsed search filters
 * @returns Score between 0 and 1 (higher is better match)
 */
export function getMatchScore(node: MatchableNode, filters: SearchFilters): number {
  let score = 1;

  if (filters.fileName) {
    score *= fuzzyScore(filters.fileName, node.name);
  }

  if (filters.plainText) {
    const nameLower = node.name.toLowerCase();
    const textLower = filters.plainText.toLowerCase();

    if (nameLower === textLower) {
      // Exact match
      score *= 1;
    } else if (nameLower.startsWith(textLower)) {
      // Prefix match
      score *= 0.9;
    } else if (nameLower.includes(textLower)) {
      // Substring match in name
      score *= 0.7;
    } else {
      // Substring match in path only
      score *= 0.4;
    }
  }

  return score;
}
