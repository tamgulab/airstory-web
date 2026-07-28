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

/** Copy measured box sizes from the live tree onto the export clone (flex/Recharts safe). */
function mirrorMeasuredLayout(fromNode, toNode) {
  if (!fromNode || !toNode || fromNode.nodeType !== 1 || toNode.nodeType !== 1) return;

  if (fromNode.hasAttribute('data-chart-plot') || fromNode.getAttribute('data-chart-frame') === 'true') {
    const width = fromNode.offsetWidth;
    const height = fromNode.offsetHeight;
    if (height > 0) {
      toNode.style.setProperty('flex', 'none', 'important');
      toNode.style.setProperty('height', `${height}px`, 'important');
      toNode.style.setProperty('min-height', `${height}px`, 'important');
    }
    if (width > 0) {
      toNode.style.setProperty('width', `${width}px`, 'important');
    }
  }

  if (fromNode.hasAttribute('data-chart-xlabel') || fromNode.hasAttribute('data-chart-ylabel')) {
    toNode.style.setProperty('position', 'relative', 'important');
    toNode.style.setProperty('transform', 'none', 'important');
    toNode.style.setProperty('inset', 'auto', 'important');
  }

  const fromChildren = fromNode.children;
  const toChildren = toNode.children;
  const n = Math.min(fromChildren.length, toChildren.length);
  for (let i = 0; i < n; i += 1) {
    mirrorMeasuredLayout(fromChildren[i], toChildren[i]);
  }
}

/** Strip selection chrome so exports don't look "broken"/selected. */
function stripSelectionChrome(root) {
  root.classList?.remove?.('ring-2', 'ring-blue-200');
  root.querySelectorAll('.ring-2, .ring-blue-200').forEach((node) => {
    node.classList.remove('ring-2', 'ring-blue-200', 'ring-offset-1', 'ring-slate-500');
  });
  root.querySelectorAll('article').forEach((article) => {
    article.classList.remove('border-blue-500', 'ring-2', 'ring-blue-200');
    if (!article.hasAttribute('data-export-note')) {
      article.style.setProperty('border-color', '#e2e8f0', 'important');
      article.style.setProperty('box-shadow', '0 1px 2px rgba(15, 23, 42, 0.06)', 'important');
    }
  });
}

function cropCanvas(source, crop, scale = 1) {
  const x = Math.max(0, Math.floor(crop.x * scale));
  const y = Math.max(0, Math.floor(crop.y * scale));
  const width = Math.max(1, Math.ceil(crop.width * scale));
  const height = Math.max(1, Math.ceil(crop.height * scale));
  const out = document.createElement('canvas');
  out.width = Math.min(width, source.width - x);
  out.height = Math.min(height, source.height - y);
  const ctx = out.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(source, x, y, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

/**
 * Capture a DOM node as PNG without react-rnd transforms / page chrome bleeding through.
 * html2canvas mis-samples elements inside `transform: translate(...)` (Workspace cards),
 * which clipped titles and stamped "Workspace" behind exports.
 *
 * @param {object} [options]
 * @param {{ x: number, y: number, width: number, height: number }} [options.crop]
 *        Crop box in CSS pixels relative to `element` (used for full-workspace exports).
 */
export async function downloadElementAsPng(element, filename, options = {}) {
  if (!element) return;
  const { crop, ...html2canvasOptions } = options;

  const host = document.createElement('div');
  host.setAttribute('data-airstory-export-host', 'true');
  host.style.cssText = [
    'position:fixed',
    'left:-10000px',
    'top:0',
    'z-index:-1',
    'margin:0',
    'padding:16px',
    'background:#ffffff',
    'pointer-events:none',
  ].join(';');

  const clone = element.cloneNode(true);
  clone.style.transform = 'none';
  clone.style.position = 'relative';
  clone.style.left = 'auto';
  clone.style.top = 'auto';
  clone.style.margin = '0';
  clone.style.width = `${Math.max(element.offsetWidth, 280)}px`;
  // Keep the live pixel height — `height:auto` collapses flex chart plots and
  // makes axis captions (Date / Day) paint on top of the Recharts SVG in exports.
  clone.style.height = `${Math.max(element.offsetHeight, 1)}px`;
  clone.style.minHeight = `${Math.max(element.offsetHeight, 1)}px`;
  clone.style.overflow = crop ? 'hidden' : 'visible';
  clone.style.boxShadow = 'none';

  clone.querySelectorAll('[data-export-hide]').forEach((node) => {
    node.style.display = 'none';
  });
  stripSelectionChrome(clone);

  // Charts export on plain white; notes keep post-it color (no data-export-white on notes).
  clone.querySelectorAll('[data-export-white]').forEach((node) => {
    node.style.setProperty('background', '#ffffff', 'important');
    node.style.setProperty('background-color', '#ffffff', 'important');
    node.style.setProperty('border-color', '#e2e8f0', 'important');
    node.style.setProperty('color', '#0f172a', 'important');
  });

  // Bake note theme + attach label as plain inline styles (html2canvas often drops Lucide/SVG + truncated flex text).
  const noteRoots = [
    ...(clone.hasAttribute?.('data-export-note') ? [clone] : []),
    ...clone.querySelectorAll('[data-export-note="true"]'),
  ];
  noteRoots.forEach((noteRoot) => {
    const bg = noteRoot.getAttribute('data-export-note-bg') || '#FFFBEB';
    const border = noteRoot.getAttribute('data-export-note-border') || '#FDE68A';
    const text = noteRoot.getAttribute('data-export-note-text') || '#451A03';
    const header = noteRoot.getAttribute('data-export-note-header') || '#FEF3C7';
    noteRoot.style.setProperty('background', bg, 'important');
    noteRoot.style.setProperty('background-color', bg, 'important');
    noteRoot.style.setProperty('border-color', border, 'important');
    noteRoot.style.setProperty('color', text, 'important');
    noteRoot.querySelectorAll('[data-export-note-header="true"]').forEach((node) => {
      node.style.setProperty('background', header, 'important');
      node.style.setProperty('background-color', header, 'important');
      node.style.setProperty('border-color', border, 'important');
      node.style.setProperty('color', text, 'important');
    });
    noteRoot.querySelectorAll('[data-export-note-body="true"]').forEach((node) => {
      node.style.setProperty('background', bg, 'important');
      node.style.setProperty('background-color', bg, 'important');
      node.style.setProperty('border-color', border, 'important');
      node.style.setProperty('color', text, 'important');
    });
    noteRoot.querySelectorAll('[data-export-attach]').forEach((node) => {
      const label = node.getAttribute('data-export-attach-label') || node.textContent || '';
      node.replaceChildren(document.createTextNode(label));
      node.style.setProperty('display', 'inline-block', 'important');
      node.style.setProperty('max-width', '100%', 'important');
      node.style.setProperty('white-space', 'normal', 'important');
      node.style.setProperty('overflow', 'visible', 'important');
      node.style.setProperty('background', '#E0F2FE', 'important');
      node.style.setProperty('background-color', '#E0F2FE', 'important');
      node.style.setProperty('border', '1px solid #BAE6FD', 'important');
      node.style.setProperty('color', '#075985', 'important');
      node.style.setProperty('padding', '2px 8px', 'important');
      node.style.setProperty('border-radius', '9999px', 'important');
      node.style.setProperty('font-size', '10px', 'important');
      node.style.setProperty('font-weight', '600', 'important');
    });
  });

  mirrorMeasuredLayout(element, clone);

  host.appendChild(clone);
  document.body.appendChild(host);

  // Let the clone finish layout (Recharts / flex) before rasterizing.
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  const scale = 2;
  try {
    let canvas = await html2canvas(clone, {
      backgroundColor: '#ffffff',
      scale,
      logging: false,
      useCORS: true,
      scrollX: 0,
      scrollY: 0,
      ...html2canvasOptions,
    });
    if (crop && crop.width > 0 && crop.height > 0) {
      canvas = cropCanvas(canvas, crop, scale);
    }
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
  } finally {
    host.remove();
  }
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
      data-export-hide="true"
      className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-all disabled:opacity-50 ${className}`}
    >
      <Download className="w-3.5 h-3.5" />
      {isCapturing ? 'Saving…' : 'Save image'}
    </button>
  );
};

export default SaveChartButton;
