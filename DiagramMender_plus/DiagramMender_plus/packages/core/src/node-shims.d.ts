declare module 'node:test' {
  const test: any;
  export default test;
  export = test;
}

declare module 'node:assert/strict' {
  const assert: any;
  export default assert;
  export = assert;
}

declare module 'node:path' {
  const path: any;
  export default path;
  export = path;
}

declare const __dirname: string;

declare function require(id: string): any;
