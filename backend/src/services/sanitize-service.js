import DOMPurify from 'dompurify';

export const sanitizeData = (value) => {
  if (typeof value === 'string') {
    return DOMPurify.sanitize(value);
  }

  if (typeof value === 'object' && value !== null) {
    const sanitizedObject = Array.isArray(value) ? [] : {};
    
    for (const [key, val] of Object.entries(value)) {
      sanitizedObject[key] = sanitizeData(val);
    }
    
    return sanitizedObject;
  }

  return value; // If the value is neither string nor object, return it as is
} 
// export const sanitizeBody = (obj) => {
//     try {
//       let sanitizedObject = {};
  
//       for (let key of Object.keys(obj)) {
//         if (obj[key] == false || obj[key]) {
//           if (obj[key] == "" || obj[key] == "null") {
//             sanitizedObject[key] = null;
//             continue;
//           } else {
//             sanitizedObject[key] = obj[key];
//           }
//         }
//       }
  
//       if (!Object.keys(sanitizedObject).length) {
//         return false;
//       }
//       return sanitizedObject;
//     } catch (error) {
//       return false;
//     }
//   };