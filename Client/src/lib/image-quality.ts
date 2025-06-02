// TypeScript version of the top images selection functionality

// Calculating sharpness using a Laplacian
function calculateSharpnessLaplacian(imageData: ImageData, width: number, height: number): number {
  const data = imageData.data;
  let total = 0;

  const getGray = (x: number, y: number): number => {
    const i = (y * width + x) * 4;
    return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  };

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const laplacian =
        -1 * getGray(x - 1, y - 1) + -1 * getGray(x, y - 1) + -1 * getGray(x + 1, y - 1) +
        -1 * getGray(x - 1, y)     +  8 * getGray(x, y)     + -1 * getGray(x + 1, y) +
        -1 * getGray(x - 1, y + 1) + -1 * getGray(x, y + 1) + -1 * getGray(x + 1, y + 1);

      total += laplacian * laplacian;
    }
  }

  return total / (width * height);
}

// Calculating contrast using standard deviation of grayscale
function calculateContrast(imageData: ImageData): number {
  const data = imageData.data;
  let sum = 0, sumSq = 0, n = data.length / 4;

  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    sum += gray;
    sumSq += gray * gray;
  }

  const mean = sum / n;
  const variance = sumSq / n - mean * mean;
  return Math.sqrt(variance);
}

// Calculating colorfulness using the difference between channels
function calculateColorfulness(imageData: ImageData): number {
  const data = imageData.data;
  let rgSum = 0, ybSum = 0;
  let rgMean = 0, ybMean = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const rg = Math.abs(r - g);
    const yb = Math.abs(0.5 * (r + g) - b);

    rgSum += rg * rg;
    ybSum += yb * yb;
    rgMean += rg;
    ybMean += yb;
  }

  const n = data.length / 4;
  return Math.sqrt(rgSum / n + ybSum / n) + 0.3 * Math.sqrt((rgMean / n) ** 2 + (ybMean / n) ** 2);
}

// Combining sharpness, contrast, and colorfulness for a single score
function scoreImage(imageData: ImageData, width: number, height: number): number {
  const sharpness = calculateSharpnessLaplacian(imageData, width, height);
  const contrast = calculateContrast(imageData);
  const colorfulness = calculateColorfulness(imageData);

  return sharpness * 0.5 + contrast * 0.3 + colorfulness * 0.2;
}

// Interface for frame data
export interface FrameData {
  canvas: HTMLCanvasElement;
  base64: string;
  score: number;
}

// Getting the top N frames from canvas elements
export function getTopFrames(canvasElements: HTMLCanvasElement[], topN: number = 3): FrameData[] {
  const scored: FrameData[] = [];

  for (const canvas of canvasElements) {
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const score = scoreImage(imageData, canvas.width, canvas.height);
    const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
    
    scored.push({ 
      canvas, 
      base64,
      score 
    });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topN);
}

// Alternative function that works with base64 data directly
export function getTopFramesFromBase64(frameDataArray: string[], topN: number = 3): Promise<{ base64: string; score: number }[]> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      resolve([]);
      return;
    }

    const scored: { base64: string; score: number }[] = [];
    let processed = 0;

    frameDataArray.forEach((base64Data, index) => {
      const img = new Image();
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const score = scoreImage(imageData, canvas.width, canvas.height);
        
        scored.push({ base64: base64Data, score });
        processed++;
        
        if (processed === frameDataArray.length) {
          scored.sort((a, b) => b.score - a.score);
          resolve(scored.slice(0, topN));
        }
      };
      img.src = `data:image/jpeg;base64,${base64Data}`;
    });
  });
} 