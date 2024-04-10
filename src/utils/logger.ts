export const debugLog = (str: string) => {
  console.debug(str);
}

export const errorLog = (e: any, str?: string) => {
  console.error(`ERROR: ${e}`);
  if (str) {
    console.error(str);
  }
}

export const log = (str: string) => {
  console.log(str);
}

