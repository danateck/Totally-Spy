
/**
 * @typedef {[number, number, number, number, number]} CordsPoint
 * @typedef {Array<Array<number>>} Image
 */

/**
 * Finds the largest phone bounding box based on area.
 * @param {CordsPoint[]} cordPoints
 * @returns {CordsPoint[]}
 */
function findLargestPhoneFromCords(cordPoints) {
  if (cordPoints.length === 0) return [];
  return [
    cordPoints.reduce((largest, current) => {
      const areaCurrent = (current[2] - current[0]) * (current[3] - current[1]);
      const areaLargest = (largest[2] - largest[0]) * (largest[3] - largest[1]);
      return areaCurrent > areaLargest ? current : largest;
    })
  ];
}

/**
 * Sorts bounding boxes by confidence.
 * @param {CordsPoint[]} cordPoints
 * @returns {CordsPoint[]}
 */
function sortByConfidence(cordPoints) {
  return [...cordPoints].sort((a, b) => a[4] - b[4]);
}

/**
 * Crops detected phones from image based on bounding boxes.
 * @param {Image} image - 2D or 3D array representing the image
 * @param {CordsPoint[]} cordPoints
 * @returns {Image[]}
 */
function getPhonesFromCords(image, cordPoints) {
  const croppedImages = [];

  for (const [x1, y1, x2, y2] of cordPoints) {
    const cropped = cropImage(image, x1, y1, x2, y2);
    if (cropped.length > 0 && cropped[0].length > 0) {
      croppedImages.push(cropped);
    }
  }

  return croppedImages;
}

/**
 * Simulates image cropping logic.
 * This function would depend on how you represent image matrices in your project.
 */
function cropImage(image, x1, y1, x2, y2) {
  const cropped = [];
  for (let y = y1; y < y2; y++) {
    if (image[y]) {
      cropped.push(image[y].slice(x1, x2));
    }
  }
  return cropped;
}

// --- Detector class stub ---
class DetectPhone {
  constructor(modelPath = "best.pt") {
    this.MIN_CONFIDENCE = 0.3;
    this.modelPath = modelPath;
    // TODO: Load your model (ONNX.js, TensorFlow.js, etc.)
  }

  /**
   * Simulated function. Replace with actual model inference logic.
   * @param {Image} image
   * @returns {Promise<CordsPoint[]>}
   */
  async findCordForPhones(image) {
    // Example stub. Replace with actual detection logic using your model.
    const mockResults = [
      [30, 40, 130, 200, 0.85],
      [60, 90, 110, 170, 0.60],
    ];
    return mockResults.filter(([,,, , conf]) => conf > this.MIN_CONFIDENCE);
  }
}
