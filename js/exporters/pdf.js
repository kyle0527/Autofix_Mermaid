
/**
 * Export diagram as PDF
 * @param {Blob} pngBlob - PNG blob
 * @returns {Promise<Blob>} PDF blob
 */
export async function exportPDF(pngBlob) {
  const { jsPDF } = window.jspdf || {};
  if (!jsPDF) {
    throw new Error('jsPDF library not loaded');
  }

  // Convert Blob to Base64 to load into Image
  const base64data = await new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(pngBlob);
  });

  const img = new Image();
  img.src = base64data;
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
  });

  // Create PDF with same dimensions as image (in pixels)
  // jsPDF default unit is mm, but we can use 'px'
  // and set format to image dimensions.
  const pdf = new jsPDF({
    orientation: img.width > img.height ? 'l' : 'p',
    unit: 'px',
    format: [img.width, img.height],
    hotfixes: ['px_scaling'] // Improve pixel mapping
  });

  pdf.addImage(base64data, 'PNG', 0, 0, img.width, img.height);

  return pdf.output('blob');
}
