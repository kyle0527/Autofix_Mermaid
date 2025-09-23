import { IRProject, ParserPlugin, ParserParseOptions } from '@diagrammender/types';
export declare function parseTypeScriptProject(files: Record<string, string>, options?: ParserParseOptions): Promise<IRProject>;
export declare const typescriptParserPlugin: ParserPlugin;
export declare const parserPlugin: ParserPlugin;
export default typescriptParserPlugin;
