/* Calculating sharpness using a Laplacian
 using a grading system we rate screenshots by sharpness, contrass and colorfulness
 this will help us find the best picture to extract the text from
*/
function calculateSharpnessLaplacian(imageData, width, height) {
    const data = imageData.data;
    const gray = new Float32Array(width * height);
    let total = 0;

    // Precompute grayscale values
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            gray[y * width + x] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        }
    }

    // Apply 3x3 Laplacian filter
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const i = y * width + x;
            const laplacian =
                -1 * gray[i - width - 1] + -1 * gray[i - width] + -1 * gray[i - width + 1] +
                -1 * gray[i - 1]         +  8 * gray[i]         + -1 * gray[i + 1] +
                -1 * gray[i + width - 1] + -1 * gray[i + width] + -1 * gray[i + width + 1];

            total += laplacian * laplacian;
        }
    }
    //only calculate valif pixels (no edges)
    const validPixelCount = (width - 2) * (height - 2);
    return total / validPixelCount;
}


// Calculating contrast using standard deviation of grayscale
function calculateContrast(imageData) {
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
function calculateColorfulness(imageData) {
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
function scoreImage(imageData, width, height) {
    const sharpness = calculateSharpnessLaplacian(imageData, width, height);
    const contrast = calculateContrast(imageData);
    const colorfulness = calculateColorfulness(imageData);

    return sharpness * 0.5 + contrast * 0.3 + colorfulness * 0.2;
}

// Getting the N images with the highest score
function getTopImages(imageElements, topN = 3) {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const scored = [];

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