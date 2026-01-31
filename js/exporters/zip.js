
/**
 * Export project files as ZIP
 * @param {Object} data - content to zip
 * @returns {Promise<Blob>} ZIP blob
 */
export async function exportZIP(data) {
  const JSZip = window.JSZip;
  if (!JSZip) {
    throw new Error('JSZip library not loaded');
  }

  const zip = new JSZip();

  if (data.code) zip.file('diagram.mmd', data.code);
  if (data.svg) zip.file('diagram.svg', data.svg);
  if (data.pngBlob) zip.file('diagram.png', data.pngBlob);

  const errors = Array.isArray(data.errors) ? data.errors : [];
  if (errors.length) {
    zip.file('errors.json', JSON.stringify(errors, null, 2));
  }

  const fixlog = Array.isArray(data.log) ? data.log : [];
  if (fixlog.length) {
    zip.file('fixlog.json', JSON.stringify(fixlog, null, 2));
  }

  zip.file('README.txt', `Exported from AutoFix Mermaid on ${new Date().toLocaleString()}\n`);

  return await zip.generateAsync({ type: 'blob' });
}
