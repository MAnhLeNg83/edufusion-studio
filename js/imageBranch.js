// imageBranch.js – Mô phỏng nhánh phân tích ảnh (EfficientNet-B0) cho 9 môn học GDPT 2018
// Trích xuất đặc trưng Canvas API: Sobel Edge, Color Entropy, RGB Distribution và Attention Map 7x7

/**
 * Tính mật độ cạnh (Edge Density) bằng toán tử Sobel Filter 3x3:
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
      const tl = getGray(x - 1, y - 1);
      const tm = getGray(x, y - 1);
      const tr = getGray(x + 1, y - 1);
      const ml = getGray(x - 1, y);
      const mr = getGray(x + 1, y);
      const bl = getGray(x - 1, y + 1);
      const bm = getGray(x, y + 1);
      const br = getGray(x + 1, y + 1);

      const gx = -tl - 2 * ml - bl + tr + 2 * mr + br;
      const gy = -tl - 2 * tm - tr + bl + 2 * bm + br;
      const magnitude = Math.sqrt(gx * gx + gy * gy);

      if (magnitude > 30) {
        edgeCount++;
      }
    }
  }

  return edgeCount / totalInnerPixels;
}

/**
 * Tính Shannon Entropy của lược đồ mức xám (đo lường độ phong phú màu sắc/chi tiết):
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

  return Math.min(entropy / 8, 1);
}

/**
 * Sinh Attention Map 7x7 từ phương sai (variance) từng khối 32x32 pixel:
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

  const normalizedMap = map.map(row =>
    row.map(v => (maxBlockVariance > 0 ? Math.min(v / maxBlockVariance, 1) : 0.1))
  );

  return normalizedMap;
}

/**
 * Softmax hỗ trợ temperature:
 */
function softmaxImage(scores, temperature = 1.2) {
  const scaled = scores.map(s => s / temperature);
  const maxVal = Math.max(...scaled);
  const exps = scaled.map(s => Math.exp(s - maxVal));
  const sumExps = exps.reduce((acc, val) => acc + val, 0);
  return exps.map(e => e / sumExps);
}

/**
 * Phân tích ảnh học liệu Canvas theo 9 môn học Chương trình GDPT 2018:
 * Thứ tự 9 môn:
 * 0: Toán học, 1: Vật lý, 2: Hóa học, 3: Sinh học, 4: Tin học,
 * 5: Lịch sử, 6: Địa lý, 7: Ngữ văn, 8: Tiếng Anh
 */
export function analyzeImage(canvas) {
  if (!canvas) return null;

  const ctx = canvas.getContext('2d');
  const width = canvas.width || 224;
  const height = canvas.height || 224;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  // Kiểm tra canvas có nội dung hay hoàn toàn đơn sắc (trống)
  let diffPixels = 0;
  const firstR = data[0], firstG = data[1], firstB = data[2];
  for (let i = 4; i < data.length; i += 4) {
    if (
      Math.abs(data[i] - firstR) > 15 ||
      Math.abs(data[i + 1] - firstG) > 15 ||
      Math.abs(data[i + 2] - firstB) > 15
    ) {
      diffPixels++;
      if (diffPixels >= 60) break;
    }
  }

  // Nếu có dưới 60 pixel khác với màu nền -> canvas xem như chưa có ảnh
  if (diffPixels < 60) {
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

  let varSum = 0;
  const globalMean = (meanR + meanG + meanB) / 3;
  for (let i = 0; i < data.length; i += 4) {
    const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
    varSum += (gray - globalMean) * (gray - globalMean);
  }
  const stdDev = Math.sqrt(varSum / totalPixels);

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

  // --- HEURISTIC MAPPING TRÊN 9 MÔN HỌC GDPT 2018 ---
  const rawScores = [0, 0, 0, 0, 0, 0, 0, 0, 0];

  // 0. Toán học: Nhiều đường nét (đồ thị, hình học không gian, công thức), ít màu, nền sáng
  rawScores[0] = edgeDensity * 4.2 + (1 - entropy) * 2.8 + brightRatio * 2.0 - meanSaturation * 2.2;

  // 1. Vật lý: Mật độ cạnh cao (vectơ lực, mạch điện, sóng), cân bằng sáng tối
  rawScores[1] = edgeDensity * 3.5 + (meanB > meanR ? 1.5 : 0.8) + (stdDev > 45 ? 1.2 : 0);

  // 2. Hóa học: Mô hình phân tử, ống nghiệm, màu sắc hoá chất đa dạng
  rawScores[2] = entropy * 2.5 + meanSaturation * 2.0 + (meanR > 130 && meanG > 100 ? 1.4 : 0);

  // 3. Sinh học: Tế bào, tiêu bản vi kính, ADN, sắc xanh lục nổi trội
  rawScores[3] = (meanG > meanR && meanG > meanB ? 3.0 : 0.5) + entropy * 2.0 + edgeDensity * 1.5;

  // 4. Tin học: Nền tối (giao diện IDE code), sơ đồ khối flowchart
  rawScores[4] = (darkRatio > 0.35 ? 3.5 : 0.2) + (meanB > meanR ? 1.8 : 0) + edgeDensity * 1.2;

  // 5. Lịch sử: Lược đồ chiến dịch, bản đồ cổ ố vàng (R > B), ranh giới mũi tên tấn công
  const isVintagePaper = (meanR > meanB + 15) && (meanG > meanB + 10);
  rawScores[5] = edgeDensity * 3.0 + (isVintagePaper ? 3.2 : 0.5) + (entropy > 0.45 ? 1.8 : 0.5);

  // 6. Địa lý: Bản đồ nhiều màu (độ cao địa hình, sông ngòi xanh dương), entropy rất cao
  rawScores[6] = entropy * 3.5 + meanSaturation * 2.5 + (meanB > 120 ? 1.6 : 0);

  // 7. Ngữ văn: Văn bản dòng chữ nhiều, phân bố đều, nền sáng trắng, ít màu
  rawScores[7] = (brightRatio > 0.6 ? 2.5 : 0) + (edgeDensity > 0.1 && edgeDensity < 0.35 ? 2.2 : 0) - meanSaturation * 2.0;

  // 8. Tiếng Anh: Minh hoạ hội thoại, infographic tươi sáng
  rawScores[8] = entropy * 2.0 + meanSaturation * 1.8 + brightRatio * 1.0;

  const baseline = Math.min(...rawScores);
  const positiveScores = rawScores.map(s => Math.max(s - baseline + 0.3, 0.1));

  const probs = softmaxImage(positiveScores, 1.2);
  const confidence = Math.max(...probs);
  const attentionMap = generateAttentionMap(data, width, height);

  return {
    probs,
    features,
    attentionMap,
    confidence
  };
}
