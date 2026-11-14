// fusion.js – Mô phỏng Late Confidence Aggregation (LCA) + MEMD fallback
// Kết hợp kết quả từ hai nhánh Text Branch và Image Branch

/**
 * Hàm tích hợp thông tin đa phương thức (Multimodal Fusion):
 * Mô phỏng cơ chế Late Confidence Aggregation (LCA) và Missing-Modality Handling (MEMD)
 *
 * @param {{ probs: number[], tokensUsed: string[], confidence: number } | null} textResult
 * @param {{ probs: number[], features: object, attentionMap: number[][], confidence: number } | null} imageResult
 * @returns {{
 *   probs: number[],
 *   mode: 'multimodal' | 'text-only' | 'image-only',
 *   warning: string | null,
 *   confidence: number,
 *   needsReview: boolean,
 *   attentionMap: number[][] | null
 * }}
 */
export function fuse(textResult, imageResult) {
  const hasText = textResult !== null && textResult !== undefined && Array.isArray(textResult.probs);
  const hasImage = imageResult !== null && imageResult !== undefined && Array.isArray(imageResult.probs);

  // Trường hợp thiếu cả hai modality -> báo lỗi rõ ràng
  if (!hasText && !hasImage) {
    throw new Error('Cần ít nhất 1 modality (nhập văn bản mô tả hoặc upload ảnh minh hoạ).');
  }

  let finalProbs = [];
  let mode = 'multimodal';
  let warning = null;
  let attentionMap = null;

  if (hasText && hasImage) {
    // Cả 2 modality đều khả dụng -> Late Fusion với trọng số (Text: 0.65, Image: 0.35)
    // Trọng số phản ánh thực tế dữ liệu học liệu nghiêng về tính chất văn bản (text-leaning)
    mode = 'multimodal';
    warning = null;
    attentionMap = imageResult.attentionMap || null;

    finalProbs = textResult.probs.map((textProb, idx) => {
      const imgProb = imageResult.probs[idx] || 0;
      return textProb * 0.65 + imgProb * 0.35;
    });

    // Chuẩn hoá lại tổng xác suất về 1.0 (tránh sai số làm tròn số thực)
    const sumProbs = finalProbs.reduce((acc, v) => acc + v, 0);
    if (sumProbs > 0) {
      finalProbs = finalProbs.map(p => p / sumProbs);
    }
  } else if (hasText && !hasImage) {
    // Chỉ có văn bản -> Cơ chế MEMD fallback sử dụng toàn phần nhánh Text
    mode = 'text-only';
    warning = '⚠️ Chỉ dùng nhánh văn bản (MEMD fallback – không có ảnh minh hoạ)';
    finalProbs = [...textResult.probs];
    attentionMap = null;
  } else if (!hasText && hasImage) {
    // Chỉ có ảnh -> Cơ chế MEMD fallback sử dụng toàn phần nhánh Image
    mode = 'image-only';
    warning = '⚠️ Chỉ dùng nhánh ảnh (MEMD fallback – không có văn bản mô tả)';
    finalProbs = [...imageResult.probs];
    attentionMap = imageResult.attentionMap || null;
  }

  // Tính toán nhãn dự đoán và độ tin cậy (Confidence)
  const confidence = Math.max(...finalProbs);

  // Cơ chế Human-in-the-loop: Nếu confidence < 0.5 (50%), yêu cầu chuyên viên giáo dục can thiệp
  const needsReview = confidence < 0.5;

  return {
    probs: finalProbs,
    mode,
    warning,
    confidence,
    needsReview,
    attentionMap
  };
}
