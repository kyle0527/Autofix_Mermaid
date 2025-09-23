import { ParserPlugin } from '@diagrammender/types';
export interface FallbackParserConfig {
    extensions?: string[];
}
export declare function createFallbackParserPlugin(lang: string, config?: FallbackParserConfig): ParserPlugin;
export default createFallbackParserPlugin;
