import { IRProject, ParserPlugin, ParserParseOptions } from '@diagrammender/types';
export declare function parsePythonProject(files: Record<string, string>, options?: ParserParseOptions): IRProject;
export declare const pythonParserPlugin: ParserPlugin;
export declare const parserPlugin: ParserPlugin;
export default pythonParserPlugin;
