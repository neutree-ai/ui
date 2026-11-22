/**
 * Convert a singular English word to its plural form.
 * Handles common English pluralization rules.
 *
 * @param name - The singular word to pluralize
 * @returns The plural form of the word
 *
 * @example
 * getResourcePlural("Registry") // "Registries"
 * getResourcePlural("Cluster") // "Clusters"
 * getResourcePlural("Box") // "Boxes"
 * getResourcePlural("Status") // "Statuses"
 */
export const getResourcePlural = (name: string): string => {
  if (!name || name.length === 0) {
    return name;
  }

  const lowerName = name.toLowerCase();

  // Words ending in 's', 'ss', 'sh', 'ch', 'x', 'z' -> add 'es'
  // e.g., box -> boxes, status -> statuses
  if (
    lowerName.endsWith("s") ||
    lowerName.endsWith("ss") ||
    lowerName.endsWith("sh") ||
    lowerName.endsWith("ch") ||
    lowerName.endsWith("x") ||
    lowerName.endsWith("z")
  ) {
    // Preserve original casing
    return `${name}es`;
  }

  // Words ending in consonant + 'y' -> replace 'y' with 'ies'
  // e.g., registry -> registries, category -> categories
  if (lowerName.endsWith("y") && lowerName.length > 1) {
    const beforeY = lowerName[lowerName.length - 2];
    // Check if the letter before 'y' is a consonant (not a vowel)
    if (!/[aeiou]/.test(beforeY)) {
      return `${name.slice(0, -1)}ies`;
    }
  }

  // Words ending in 'f' or 'fe' -> replace with 'ves'
  // e.g., leaf -> leaves, knife -> knives
  if (lowerName.endsWith("f")) {
    return `${name.slice(0, -1)}ves`;
  }
  if (lowerName.endsWith("fe")) {
    return `${name.slice(0, -2)}ves`;
  }

  // Words ending in consonant + 'o' -> add 'es'
  // e.g., hero -> heroes, potato -> potatoes
  if (lowerName.endsWith("o") && lowerName.length > 1) {
    const beforeO = lowerName[lowerName.length - 2];
    if (!/[aeiou]/.test(beforeO)) {
      return `${name}es`;
    }
  }

  // Default: just add 's'
  // e.g., cluster -> clusters, endpoint -> endpoints
  return `${name}s`;
};
