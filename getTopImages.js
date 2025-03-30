
// Calculate sharpness by summing gradient changes (edge detection)
function calculateSharpness(imageData, width, height) {
    let total = 0;
    const data = imageData.data;
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const i = (y * width + x) * 4;
            const gx = data[i - 4] - data[i + 4];  // Horizontal gradient
            const gy = data[i - width * 4] - data[i + width * 4];  // Vertical gradient
            const grad = gx * gx + gy * gy;
            total += grad;
        }
    }
    return total / (width * height);  // Return average gradient
}

// Calculate contrast using standard deviation of grayscale values
function calculateContrast(imageData) {
    const data = imageData.data;
    let sum = 0, sumSq = 0, n = data.length / 4;

    for (let i = 0; i < data.length; i += 4) {
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]; // grayscale conversion
        sum += gray;
        sumSq += gray * gray;
    }

    const mean = sum / n;
    const variance = sumSq / n - mean * mean;
    return Math.sqrt(variance);  // Standard deviation as contrast
}

// Calculate colorfulness using color channel differences
function calculateColorfulness(imageData) {
    const data = imageData.data;
    let rgSum = 0, ybSum = 0;
    let rgMean = 0, ybMean = 0;

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i + 0];
        const g = data[i + 1];
        const b = data[i + 2];

        const rg = Math.abs(r - g);  // red-green difference
        const yb = Math.abs(0.5 * (r + g) - b);  // yellow-blue difference

        rgSum += rg * rg;
        ybSum += yb * yb;
        rgMean += rg;
        ybMean += yb;
    }

    const n = data.length / 4;
    return Math.sqrt(rgSum / n + ybSum / n) + 0.3 * Math.sqrt((rgMean / n) ** 2 + (ybMean / n) ** 2);
}

// Combine sharpness, contrast, and colorfulness into a single score
function scoreImage(imageData, width, height) {
    const sharp = calculateSharpness(imageData, width, height);
    const contrast = calculateContrast(imageData);
    const color = calculateColorfulness(imageData);
    return sharp * 0.5 + contrast * 0.3 + color * 0.2;
}

// Main function: returns the top N highest-scoring images
function getTopImages(imageElements, topN = 3) {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    const scored = [];

    for (const img of imageElements) {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0, img.width, img.height);  // Draw image to canvas
        const imageData = ctx.getImageData(0, 0, img.width, img.height);  // Get pixel data
        const score = scoreImage(imageData, img.width, img.height);  // Score the image
        scored.push({ img, score });  // Store image and its score
    }

    scored.sort((a, b) => b.score - a.score);  // Sort by score descending
    return scored.slice(0, topN).map(s => s.img);  // Return top N images
}
