export const deepOverride = (obj: any, overrideWith: any): any => {
  if (!overrideWith || typeof overrideWith !== 'object') return obj;

  for (let key in overrideWith) {
    if (overrideWith.hasOwnProperty(key)) {
      if (typeof overrideWith[key] === 'object' && !Array.isArray(overrideWith[key]) && overrideWith[key] !== null) {
        // Ensure the target value is also an object to be able to merge properties.
        if (typeof obj[key] !== 'object' || obj[key] === null) {
            obj[key] = {};
        }
        deepOverride(obj[key], overrideWith[key]);
      } else {
        obj[key] = overrideWith[key];
      }
    }
  }
  return obj;
}
