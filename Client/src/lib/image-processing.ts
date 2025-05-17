// Types for enhancement settings
export type QualityLevel = "standard" | "high" | "ultra";
export type EnhancementValues = {
  sharpness: number;
  brightness: number;
  contrast: number;
};

// Calculate enhancement values based on quality settings
export const getEnhancementValues = (quality: QualityLevel, sharpness: number, enhancementLevel: number): EnhancementValues => {
  const values: EnhancementValues = {
    sharpness: 1,
    brightness: 1,
    contrast: 1
  };

  if (quality !== "standard") {
    // Sharpening effect using contrast
    values.sharpness = 1 + (sharpness * 0.1);
    
    if (quality === "ultra") {
      // Color enhancement
      values.brightness = 1 + (enhancementLevel * 0.05);
      values.contrast = 1 + (enhancementLevel * 0.1);
    }
  }

  return values;
};

// Process image with all enhancements
export const processImage = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  quality: QualityLevel,
  sharpness: number,
  enhancementLevel: number,
  zoomLevel: number = 1,
  position: { x: number; y: number } = { x: 0, y: 0 }
) => {
  // Safety checks
  if (!ctx || !width || !height || width <= 0 || height <= 0) {
    console.warn('Invalid canvas dimensions or context:', { width, height });
    return;
  }

  if (quality === "standard" && zoomLevel === 1) return;

  try {
    const values = getEnhancementValues(quality, sharpness, enhancementLevel);
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    // Apply zoom and position adjustments
    if (zoomLevel > 1) {
      const zoomedWidth = width / zoomLevel;
      const zoomedHeight = height / zoomLevel;
      const sourceX = (width - zoomedWidth) / 2 - position.x;
      const sourceY = (height - zoomedHeight) / 2 - position.y;

      // Create a temporary canvas for zoom
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = width;
      tempCanvas.height = height;
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) return;

      // Draw the zoomed portion
      tempCtx.drawImage(
        ctx.canvas,
        sourceX, sourceY, zoomedWidth, zoomedHeight,
        0, 0, width, height
      );

      // Get the zoomed image data
      const zoomedData = tempCtx.getImageData(0, 0, width, height).data;
      for (let i = 0; i < data.length; i++) {
        data[i] = zoomedData[i];
      }
    }

    // Apply enhancements
    for (let i = 0; i < data.length; i += 4) {
      if (quality !== "standard") {
        // Apply sharpness (contrast)
        data[i] = Math.max(0, Math.min(255, (data[i] - 128) * values.sharpness + 128));
        data[i+1] = Math.max(0, Math.min(255, (data[i+1] - 128) * values.sharpness + 128));
        data[i+2] = Math.max(0, Math.min(255, (data[i+2] - 128) * values.sharpness + 128));
        
        if (quality === "ultra") {
          // Apply brightness
          data[i] = Math.max(0, Math.min(255, data[i] * values.brightness));
          data[i+1] = Math.max(0, Math.min(255, data[i+1] * values.brightness));
          data[i+2] = Math.max(0, Math.min(255, data[i+2] * values.brightness));
          
          // Apply contrast
          data[i] = Math.max(0, Math.min(255, (data[i] - 128) * values.contrast + 128));
          data[i+1] = Math.max(0, Math.min(255, (data[i+1] - 128) * values.contrast + 128));
          data[i+2] = Math.max(0, Math.min(255, (data[i+2] - 128) * values.contrast + 128));
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);
  } catch (error) {
    console.error('Error processing image:', error);
  }
};

// Get CSS filter string for preview
export const getFilterStyle = (quality: QualityLevel, sharpness: number, enhancementLevel: number): string => {
  const values = getEnhancementValues(quality, sharpness, enhancementLevel);
  let filter = '';
  
  if (quality !== "standard") {
    // Apply filters in the same order
    filter += `contrast(${values.sharpness}) `;
    
    if (quality === "ultra") {
      filter += `brightness(${values.brightness}) contrast(${values.contrast}) `;
    }
  }
  
  return filter || 'none';
}; 