declare module 'node:fs' {
  const fs: any;
  export = fs;
}

declare module 'node:path' {
  const path: any;
  export = path;
}

declare const process: {
  argv: string[];
  cwd(): string;
  exit(code?: number): never;
};
