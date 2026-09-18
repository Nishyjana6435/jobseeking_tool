let current = (...a) => console.log(...a);
export const log = (...a) => current(...a);
export const setLogger = (fn) => { current = fn || ((...a) => console.log(...a)); };
