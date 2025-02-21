// src/utils/exportUtils.js
export const exportToSVG = (elementRef, filename) => {
    try {
      const svg = elementRef.current;
      if (!svg) {
        throw new Error('SVG element not found');
      }
      
      // Clone the SVG to modify it for export
      const clonedSvg = svg.cloneNode(true);
      
      // Add white background
      clonedSvg.style.backgroundColor = 'white';
      
      const data = new XMLSerializer().serializeToString(clonedSvg);
      const svgBlob = new Blob([data], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      
      const link = document.createElement('a');
      link.download = `${filename}.svg`;
      link.href = url;
      link.click();
      
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };
  
  export const exportToPNG = (elementRef, filename, scale = 3) => {
    try {
      const svg = elementRef.current;
      if (!svg) {
        throw new Error('SVG element not found');
      }
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Get the SVG dimensions
      const bbox = svg.getBoundingClientRect();
      canvas.width = bbox.width * scale;
      canvas.height = bbox.height * scale;
      
      // Set white background
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Scale for higher resolution
      ctx.scale(scale, scale);
      
      const data = new XMLSerializer().serializeToString(svg);
      const svgBlob = new Blob([data], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
        
        const pngUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `${filename}.png`;
        link.href = pngUrl;
        link.click();
        
        URL.revokeObjectURL(url);
      };
      img.src = url;
    } catch (error) {
      console.error('Export failed:', error);
    }
  };