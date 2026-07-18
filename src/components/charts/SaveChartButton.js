import React, { useState } from 'react';
import { Download } from 'lucide-react';
import html2canvas from 'html2canvas';

export function sanitizeFilename(value) {
  return String(value || 'chart')
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase();
}

export async function downloadElementAsPng(element, filename, options = {}) {
  if (!element) return;
  const canvas = await html2canvas(element, {
    backgroundColor: '#ffffff',
    scale: 2,
    logging: false,
    useCORS: true,
    ...options,
  });
  await new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${sanitizeFilename(filename)}-${new Date().toISOString().split('T')[0]}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
      resolve();
    }, 'image/png');
  });
}

/**
 * Small icon button that captures the DOM node behind `targetRef` and downloads it as a PNG.
 * Used on every Analysis chart/visual so students can save individual graphs for reports.
 */
const SaveChartButton = ({ targetRef, filename = 'chart', className = '' }) => {
  const [isCapturing, setIsCapturing] = useState(false);

  const handleSave = async () => {
    if (!targetRef?.current || isCapturing) return;
    setIsCapturing(true);
    try {
      await downloadElementAsPng(targetRef.current, filename);
    } catch (error) {
      console.error('Error saving chart image:', error);
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleSave}
      disabled={isCapturing}
      title="Save this chart as an image"
      className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-all disabled:opacity-50 ${className}`}
    >
      <Download className="w-3.5 h-3.5" />
      {isCapturing ? 'Saving…' : 'Save image'}
    </button>
  );
};

export default SaveChartButton;
