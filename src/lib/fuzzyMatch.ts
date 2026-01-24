/**
 * Fuzzy matching utilities for advanced search filters
 *
 * Uses a scoring algorithm based on Levenshtein distance with optimizations
 * for filename matching, prioritizing prefix matches and exact substrings.
 */

/**
 * Calculate Levenshtein distance between two strings
 * @param a First string
 * @param b Second string
 * @returns Edit distance (number of operations to transform a into b)
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  // Initialize matrix
  for (let i = 0; i <= a.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= b.length; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[a.length][b.length];
}

/**
 * Check if query is a substring of target
 * @param query Search query
 * @param target Target string to search in
 * @returns Position if found, -1 otherwise
 */
function substringPosition(query: string, target: string): number {
  return target.indexOf(query);
}

/**
 * Calculate fuzzy match score between query and target
 * Returns a score between 0 (no match) and 1 (perfect match)
 *
 * Scoring factors:
 * - Exact match: 1.0
 * - Prefix match: bonus applied
 * - Substring match: bonus applied based on position
 * - Levenshtein-based: for partial matches
 *
 * @param query The search query
 * @param target The target string to match against (usually filename)
 * @param options Optional configuration
 * @returns Score between 0 and 1
 */
export function fuzzyScore(query: string, target: string): number {
  // Handle empty strings
  if (!query || !target) {
    return 0;
  }

  // Normalize to lowercase for case-insensitive matching
  const normalizedQuery = query.toLowerCase();
  const normalizedTarget = target.toLowerCase();

  // Exact match
  if (normalizedQuery === normalizedTarget) {
    return 1;
  }

  // Get the filename part (after last / or \)
  const lastSlash = Math.max(normalizedTarget.lastIndexOf('/'), normalizedTarget.lastIndexOf('\\'));
  const filename = lastSlash >= 0 ? normalizedTarget.substring(lastSlash + 1) : normalizedTarget;

  // Get the name without extension for better matching
  const dotIndex = filename.lastIndexOf('.');
  const nameWithoutExt = dotIndex > 0 ? filename.substring(0, dotIndex) : filename;

  // Check for exact match on filename without extension
  if (normalizedQuery === nameWithoutExt) {
    return 0.95;
  }

  // Prefix match on filename (highest priority after exact)
  if (filename.startsWith(normalizedQuery)) {
    // Score based on how much of the filename the query covers
    return 0.9 * (normalizedQuery.length / filename.length) + 0.1;
  }

  // Prefix match on name without extension
  if (nameWithoutExt.startsWith(normalizedQuery)) {
    return 0.85 * (normalizedQuery.length / nameWithoutExt.length) + 0.1;
  }

  // Substring match in filename
  const substringPos = substringPosition(normalizedQuery, filename);
  if (substringPos >= 0) {
    // Score based on position (earlier is better) and coverage
    const positionPenalty = substringPos / filename.length;
    const coverage = normalizedQuery.length / filename.length;
    return Math.max(0.4, 0.8 * coverage * (1 - positionPenalty * 0.5));
  }

  // Substring match in full path
  const pathSubstringPos = substringPosition(normalizedQuery, normalizedTarget);
  if (pathSubstringPos >= 0) {
    const coverage = normalizedQuery.length / normalizedTarget.length;
    return Math.max(0.3, 0.5 * coverage);
  }

  // Fall back to Levenshtein distance for fuzzy matching
  // Compare against filename for better results
  const distance = levenshteinDistance(normalizedQuery, filename);
  const maxLen = Math.max(normalizedQuery.length, filename.length);

  if (maxLen === 0) {
    return 0;
  }

  const score = 1 - (distance / maxLen);

  // Apply a penalty for low-quality fuzzy matches
  return Math.max(0, score * 0.8);
}

/**
 * Check if a query fuzzy-matches a target with a minimum threshold
 *
 * @param query The search query
 * @param target The target string to match against
 * @param threshold Minimum score to consider a match (default: 0.3)
 * @returns True if the match score exceeds the threshold
 */
export function fuzzyMatch(query: string, target: string, threshold: number = 0.3): boolean {
  const score = fuzzyScore(query, target);
  return score > threshold;
}
