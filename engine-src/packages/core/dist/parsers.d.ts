import { ParserPlugin, ParserDetectionResult } from '@diagrammender/types';
export declare function registerParserPlugin(plugin: ParserPlugin): ParserPlugin;
export declare function clearParserPlugins(): void;
export declare function listParserPlugins(): ParserPlugin[];
export declare function getRegisteredParserPlugin(lang: string): ParserPlugin | undefined;
export declare function loadParserPlugin(lang: string): Promise<ParserPlugin>;
export interface ResolveParserOptions {
    /** Explicit language identifier. Use 'auto' to trigger detection. */
    lang?: string;
    /** Files to inspect for detection / heuristics. Required when lang is omitted or 'auto'. */
    files?: Record<string, string>;
    /** Additional candidate languages to consider. */
    candidates?: string[];
    /** Whether to execute plugin detection hooks. Defaults to true. */
    detect?: boolean;
    /** Whether to use filename heuristics. Defaults to true. */
    allowHeuristics?: boolean;
}
export interface ParserResolution {
    plugin: ParserPlugin;
    detection?: ParserDetectionResult;
}
export declare function resolveParserPlugin(options: ResolveParserOptions): Promise<ParserResolution>;
