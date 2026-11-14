// imageBranch.js – Mô phỏng EfficientNet-B0 bằng xử lý ảnh trên Canvas API
// Trích xuất đặc trưng pixel, Sobel Edge, Color Entropy và sinh Attention Map 7x7

/**
 * Tính mật độ cạnh (Edge Density) bằng toán tử Sobel (Sobel Filter):
 * Áp dụng kernel tích chập 3x3 trên kênh Grayscale để tính gradient độ sáng Gx, Gy
 * @param {Uint8ClampedArray} data - Mảng pixel RGBA
 * @param {number} width - Chiều rộng canvas (224)
 * @param {number} height - Chiều cao canvas (224)
 * @returns {number} Mật độ cạnh [0, 1]
 */
export function calculateSobelEdgeDensity(data, width, height) {
  let edgeCount = 0;
  const totalInnerPixels = (width - 2) * (height - 2);

  const getGray = (px, py) => {
    const idx = (py * width + px) * 4;
    return 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
  };

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      // 9 điểm lân cận
      const tl = getGray(x - 1, y - 1);
      const tm = getGray(x, y - 1);
      const tr = getGray(x + 1, y - 1);
      const ml = getGray(x - 1, y);
      const mr = getGray(x + 1, y);
      const bl = getGray(x - 1, y + 1);
      const bm = getGray(x, y + 1);
      const br = getGray(x + 1, y + 1);

      // Gradient theo trục X và Y
      const gx = -tl - 2 * ml - bl + tr + 2 * mr + br;
      const gy = -tl - 2 * tm - tr + bl + 2 * bm + br;
      const magnitude = Math.sqrt(gx * gx + gy * gy);

      // Ngưỡng phát hiện cạnh
      if (magnitude > 32) {
        edgeCount++;
      }
    }
  }

  return edgeCount / totalInnerPixels;
}

/**
 * Tính độ hỗn loạn thông tin màu sắc (Shannon Entropy) dựa trên Histogram:
 * - Entropy cao: Ảnh có độ phong phú màu sắc cao, đa dạng chi tiết (bản đồ, ảnh chụp thực tế)
 * - Entropy thấp: Ảnh đơn sắc, bản vẽ nhị phân, công thức trắng đen
 * @param {Uint8ClampedArray} data - Mảng pixel RGBA
 * @returns {number} Entropy chuẩn hoá [0, 1]
 */
export function calculateColorEntropy(data) {
  const histogram = new Array(256).fill(0);
  const totalPixels = data.length / 4;

  for (let i = 0; i < data.length; i += 4) {
    const gray = Math.round((data[i] + data[i + 1] + data[i + 2]) / 3);
    histogram[gray]++;
  }

  let entropy = 0;
  for (let count of histogram) {
    if (count > 0) {
      const p = count / totalPixels;
      entropy -= p * Math.log2(p);
    }
  }

  // Max entropy của 256 mức xám là log2(256) = 8 bits
  return Math.min(entropy / 8, 1);
}

/**
 * Sinh Attention Map kích thước 7x7 (tương ứng kích thước feature map cuối của EfficientNet-B0)
 * Dựa trên phương sai (variance) và mật độ chi tiết trong từng khối 32x32 pixel
 * @param {Uint8ClampedArray} data - Mảng pixel RGBA
 * @param {number} width - 224
 * @param {number} height - 224
 * @returns {number[][]} Ma trận 7x7 với giá trị [0, 1]
 */
export function generateAttentionMap(data, width, height) {
  const map = [];
  const blockW = Math.floor(width / 7);
  const blockH = Math.floor(height / 7);

  let maxBlockVariance = 0;

  for (let r = 0; r < 7; r++) {
    const row = [];
    for (let c = 0; c < 7; c++) {
      let sum = 0;
      let sumSq = 0;
      let count = 0;

      const startY = r * blockH;
      const endY = Math.min((r + 1) * blockH, height);
      const startX = c * blockW;
      const endX = Math.min((c + 1) * blockW, width);

      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const idx = (y * width + x) * 4;
          const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
          sum += gray;
          sumSq += gray * gray;
          count++;
        }
      }

      const mean = sum / count;
      const variance = sumSq / count - mean * mean;
      if (variance > maxBlockVariance) {
        maxBlockVariance = variance;
      }
      row.push(variance);
    }
    map.push(row);
  }

  // Chuẩn hoá ma trận attention về khoảng [0, 1]
  const normalizedMap = map.map(row =>
    row.map(v => (maxBlockVariance > 0 ? Math.min(v / maxBlockVariance, 1) : 0.1))
  );

  return normalizedMap;
}

/**
 * Softmax hỗ trợ temperature cho nhánh ảnh
 */
function softmaxImage(scores, temperature = 1.2) {
  const scaled = scores.map(s => s / temperature);
  const maxVal = Math.max(...scaled);
  const exps = scaled.map(s => Math.exp(s - maxVal));
  const sumExps = exps.reduce((acc, val) => acc + val, 0);
  return exps.map(e => e / sumExps);
}

/**
 * Phân tích ảnh học liệu từ phần tử Canvas (224x224):
 * @param {HTMLCanvasElement} canvas
 * @returns {{ probs: number[], features: object, attentionMap: number[][], confidence: number } | null}
 */
export function analyzeImage(canvas) {
  if (!canvas) return null;

  const ctx = canvas.getContext('2d');
  const width = canvas.width || 224;
  const height = canvas.height || 224;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  // Kiểm tra canvas trống hoặc chỉ có màu đơn sắc mặc định
  let nonWhiteOrBlack = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    // Không phải trắng hoàn toàn (>245) và không phải đen hoàn toàn (<10)
    if ((r <= 245 || g <= 245 || b <= 245) && (r >= 10 || g >= 10 || b >= 10)) {
      nonWhiteOrBlack++;
    }
  }

  // Nếu canvas có ít hơn 150 pixel có nội dung -> xem như không có ảnh
  if (nonWhiteOrBlack < 150) {
    return null;
  }

  const totalPixels = width * height;
  let sumR = 0, sumG = 0, sumB = 0;
  let darkPixels = 0, brightPixels = 0;
  let satSum = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    sumR += r;
    sumG += g;
    sumB += b;

    const brightness = (r + g + b) / 3;
    if (brightness < 80) darkPixels++;
    if (brightness > 180) brightPixels++;

    // Tính độ bão hoà màu (Saturation)
    const rn = r / 255, gn = g / 255, bn = b / 255;
    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    const sat = max === 0 ? 0 : (max - min) / max;
    satSum += sat;
  }

  const meanR = sumR / totalPixels;
  const meanG = sumG / totalPixels;
  const meanB = sumB / totalPixels;
  const darkRatio = darkPixels / totalPixels;
  const brightRatio = brightPixels / totalPixels;
  const meanSaturation = satSum / totalPixels;

  // Tính độ lệch chuẩn tổng thể (Standard Deviation)
  let varSum = 0;
  const globalMean = (meanR + meanG + meanB) / 3;
  for (let i = 0; i < data.length; i += 4) {
    const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
    varSum += (gray - globalMean) * (gray - globalMean);
  }
  const stdDev = Math.sqrt(varSum / totalPixels);

  // Mật độ cạnh Sobel và Color Entropy
  const edgeDensity = calculateSobelEdgeDensity(data, width, height);
  const entropy = calculateColorEntropy(data);

  const features = {
    meanR: Math.round(meanR),
    meanG: Math.round(meanG),
    meanB: Math.round(meanB),
    stdDev: Math.round(stdDev * 10) / 10,
    darkRatio: Math.round(darkRatio * 1000) / 1000,
    brightRatio: Math.round(brightRatio * 1000) / 1000,
    edgeDensity: Math.round(edgeDensity * 1000) / 1000,
    entropy: Math.round(entropy * 1000) / 1000,
    meanSaturation: Math.round(meanSaturation * 1000) / 1000
  };

  // --- BẢNG TRỌNG SỐ HEURISTIC ÁNH XẠ ĐẶC TRƯNG → 7 MÔN ---
  // Thứ tự index:
  // 0: Tiếng Anh, 1: Tiếng Nhật, 2: Toán rời rạc, 3: Mạng máy tính,
  // 4: Cơ sở dữ liệu, 5: Kỹ thuật lập trình, 6: Thị giác máy tính
  const rawScores = [0, 0, 0, 0, 0, 0, 0];

  // 0. Tiếng Anh: Màu sắc tươi sáng, entropy vừa-cao, độ bão hoà màu khá
  rawScores[0] = entropy * 2.2 + meanSaturation * 2.0 - edgeDensity * 0.8;

  // 1. Tiếng Nhật: Entropy cao (bản đồ địa lý, ảnh minh hoạ văn hoá), màu sắc đa dạng hoặc sắc đỏ/hồng/xanh lá
  rawScores[1] = entropy * 2.4 + (meanR > 140 ? 1.5 : 0) + (meanG > 140 ? 1.2 : 0) + meanSaturation * 1.5;

  // 2. Toán rời rạc: Rất nhiều đường nét / cạnh (đồ thị, ma trận, công thức), ít màu, nền sáng trắng
  rawScores[2] = edgeDensity * 4.5 + (1 - entropy) * 2.5 + brightRatio * 2.0 - meanSaturation * 2.0;

  // 3. Mạng máy tính: Nhiều đường nối mạng topo, mật độ cạnh cao, màu sắc lạnh hoặc trắng xám
  rawScores[3] = edgeDensity * 3.2 + (1 - meanSaturation) * 1.8 + (meanB > meanR ? 1.2 : 0);

  // 4. Cơ sở dữ liệu: Cạnh dạng bảng biểu/lưới, độ sáng trung bình, cấu trúc phân khối
  rawScores[4] = edgeDensity * 2.0 + (entropy > 0.35 && entropy < 0.75 ? 2.2 : 0) + darkRatio * 1.2;

  // 5. Kỹ thuật lập trình: Nền tối (code editor dark theme) hoặc kênh xanh dương nổi trội
  rawScores[5] = (darkRatio > 0.25 ? 2.8 : 0) + (meanB > meanR && meanB > meanG ? 2.0 : 0) + edgeDensity * 1.2;

  // 6. Thị giác máy tính: Cạnh đa dạng, kênh xanh lá (bounding box / segmentation mask) hoặc ảnh chụp vật thể
  rawScores[6] = edgeDensity * 2.8 + (meanG > meanR ? 1.8 : 0) + entropy * 1.8 + (stdDev > 40 ? 1.5 : 0);

  // Đảm bảo các score không bị âm
  const baseline = Math.min(...rawScores);
  const positiveScores = rawScores.map(s => Math.max(s - baseline + 0.3, 0.1));

  // Softmax
  const probs = softmaxImage(positiveScores, 1.2);
  const confidence = Math.max(...probs);

  // Attention Map 7x7
  const attentionMap = generateAttentionMap(data, width, height);

  return {
    probs,
    features,
    attentionMap,
    confidence
  };
}
