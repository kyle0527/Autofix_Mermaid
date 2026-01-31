/**
 * PlantUML Renderer Module
 * Uses plantuml-encoder to generate URLs for the public PlantUML server
 */

/**
 * Render PlantUML code to SVG
 * @param {string} code - PlantUML code
 * @returns {Promise<Object>} { svg: string, url: string }
 */
export async function renderPlantUML(code) {
  if (!window.plantumlEncoder) {
    throw new Error('PlantUML encoder library not loaded');
  }

  const encoded = window.plantumlEncoder.encode(code);
  const url = `https://www.plantuml.com/plantuml/svg/${encoded}`;

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
