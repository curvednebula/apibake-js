export const capitalizeFirst = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export const endWithDot = (str: string): string => {
  return `${str}${str.endsWith('.') ? '' : '.'}`;
}

export const sanitizeDescription = (str: string): string => {
  return capitalizeFirst(endWithDot(str.replace('\n', ' ').trim()));
}
