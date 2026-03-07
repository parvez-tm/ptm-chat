/**
 * Server-side input sanitizer.
 * Strips HTML tags and trims strings recursively.
 */

const stripHtml = (str) => {
  return str.replace(/<[^>]*>/g, '').trim();
};

export const sanitizeData = (value) => {
  if (typeof value === 'string') {
    return stripHtml(value);
  }

  if (typeof value === 'object' && value !== null) {
    const sanitizedObject = Array.isArray(value) ? [] : {};
    
    for (const [key, val] of Object.entries(value)) {
      sanitizedObject[key] = sanitizeData(val);
    }
    
    return sanitizedObject;
  }

  return value;
};