export const require = (specifier) => {
  const message = typeof specifier === 'string'
    ? `Dynamic require of "${specifier}" is not supported in the browser build.`
    : 'Dynamic require is not supported in the browser build.';
  throw new Error(message);
};
