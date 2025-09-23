import { IRProject, ParserPlugin, ParserParseOptions } from '@diagrammender/types';
export declare function parseJavaScriptProject(files: Record<string, string>, options?: ParserParseOptions): IRProject;
export declare const javascriptParserPlugin: ParserPlugin;
export declare const parserPlugin: ParserPlugin;
export default javascriptParserPlugin;
