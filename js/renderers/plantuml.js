/**
 * PlantUML Renderer Module
 * Uses plantuml-encoder to generate URLs for the public PlantUML server
 */

/**
 * Render PlantUML code to SVG
 * @param {string} code - PlantUML code
 * @param {string} serverUrl - PlantUML server URL (optional, default: https://www.plantuml.com/plantuml)
 * @returns {Promise<Object>} { svg: string, url: string }
 */
export async function renderPlantUML(code, serverUrl = 'https://www.plantuml.com/plantuml') {
  if (!window.plantumlEncoder) {
    throw new Error('PlantUML encoder library not loaded');
  }

  const encoded = window.plantumlEncoder.encode(code);
  // Ensure serverUrl doesn't end with slash to avoid double slashes
  const baseUrl = serverUrl.replace(/\/$/, '');
  const url = `${baseUrl}/svg/${encoded}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`PlantUML server error: ${response.status}`);
    }
    const svg = await response.text();
    return { svg, url };
  } catch (error) {
    console.error('PlantUML rendering failed:', error);
    throw new Error(`Failed to render PlantUML: ${error.message}`);
  }
}

/**
 * Check if code is likely PlantUML
 * @param {string} code
 * @returns {boolean}
 */
export function isLikelyPlantUML(code) {
  return /@startuml/i.test(code) || /@startmindmap/i.test(code) || /@startwbs/i.test(code) || /@startgantt/i.test(code);
}
