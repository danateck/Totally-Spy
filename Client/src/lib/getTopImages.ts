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

// Getting the N images with the highest score
export function getTopImages(imageElements: HTMLImageElement[], topN: number = 3): HTMLImageElement[] {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return [];
    
    const scored: { img: HTMLImageElement; score: number }[] = [];

    for (const img of imageElements) {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0, img.width, img.height);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        const score = scoreImage(imageData, img.width, img.height);
        scored.push({ img, score });
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topN).map(s => s.img);
}
