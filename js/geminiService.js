// geminiService.js – Tích hợp Gemini API (Multimodal) phân loại học liệu số 9 môn GDPT 2018
import { SUBJECTS } from './lexicon.js';

const STORAGE_KEY = 'edufusion_gemini_api_key';

/**
 * Lấy API Key đã lưu trong LocalStorage
 */
export function getStoredApiKey() {
  return localStorage.getItem(STORAGE_KEY) || '';
}

/**
 * Lưu API Key vào LocalStorage
 */
export function saveApiKey(key) {
  if (key) {
    localStorage.setItem(STORAGE_KEY, key.trim());
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

/**
 * Xoá API Key khỏi LocalStorage
 */
export function clearApiKey() {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Chuyển đổi Canvas sang chuỗi base64 (không bao gồm tiền tố data:image/png;base64,)
 */
function canvasToBase64(canvas) {
  const dataUrl = canvas.toDataURL('image/png');
  return dataUrl.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');
}

/**
 * Gọi Gemini Multimodal API phân loại học liệu số
 * @param {string} apiKey - Google Gemini API Key
 * @param {string|null} text - Văn bản mô tả học liệu
 * @param {HTMLCanvasElement|null} canvas - Canvas chứa ảnh minh hoạ
 * @returns {Promise<{
 *   probs: number[],
 *   predicted_subject: string,
 *   confidence: number,
 *   explanation: string,
 *   mode: string
 * }>}
 */
export async function classifyWithGemini(apiKey, text, canvas) {
  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error('Chưa cung cấp Gemini API Key. Vui lòng nhập API Key hoặc chọn chế độ Offline Mock.');
  }

  const hasText = text && text.trim().length > 0;
  const hasImage = canvas !== null && canvas !== undefined;

  if (!hasText && !hasImage) {
    throw new Error('Cần ít nhất 1 modality (văn bản hoặc hình ảnh) để gửi tới Gemini.');
  }

  let mode = 'multimodal';
  if (hasText && !hasImage) mode = 'text-only';
  if (!hasText && hasImage) mode = 'image-only';

  // Xây dựng parts cho nội dung request
  const contentsParts = [];

  // System prompt hướng dẫn phân loại
  const systemInstruction = `Bạn là hệ thống AI phân loại học liệu số tiếng Việt "EduFusionNet" theo 9 môn học bắt buộc Chương trình Giáo dục Phổ thông (GDPT) 2018 của Việt Nam:
1. Toán học
2. Vật lý
3. Hóa học
4. Sinh học
5. Tin học
6. Lịch sử
7. Địa lý
8. Ngữ văn
9. Tiếng Anh

Nhiệm vụ: Phân tích học liệu (kết hợp hình ảnh và/hoặc nội dung văn bản được cung cấp) và phân loại chính xác vào 1 trong 9 môn trên.
BẮT BUỘC trả về kết quả dưới dạng JSON thuần túy (không bọc trong markdown code block \`\`\`json) với cấu trúc:
{
  "predicted_subject": "Tên môn học chính xác trong danh sách 9 môn",
  "confidence": 0.95,
  "explanation": "Giải thích ngắn gọn 1-2 câu lý do phân loại vào môn này",
  "probabilities": {
    "Toán học": 0.01,
    "Vật lý": 0.01,
    "Hóa học": 0.01,
    "Sinh học": 0.01,
    "Tin học": 0.01,
    "Lịch sử": 0.90,
    "Địa lý": 0.03,
    "Ngữ văn": 0.01,
    "Tiếng Anh": 0.01
  }
}`;

  contentsParts.push({ text: systemInstruction });

  if (hasText) {
    contentsParts.push({
      text: `[NỘI DUNG VĂN BẢN HỌC LIỆU]:\n${text.trim()}`
    });
  }

  if (hasImage) {
    const base64Data = canvasToBase64(canvas);
    contentsParts.push({
      inline_data: {
        mime_type: 'image/png',
        data: base64Data
      }
    });
  }

  // Danh sách các model endpoint ưu tiên (thử gemini-2.0-flash trước, fallback gemini-1.5-flash)
  const models = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.7-flash'];
  const errors = [];
  let lastError = null;

  for (const modelName of models) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              parts: contentsParts
            }
          ],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json'
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `Lỗi HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!candidateText) {
        throw new Error('Gemini API không trả về nội dung dự đoán.');
      }

      // Xử lý chuỗi JSON
      const cleanedJson = candidateText
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim();

      const parsed = JSON.parse(cleanedJson);

      // Chuyển đổi probabilities object sang mảng 9 môn học theo thứ tự chuẩn
      const rawProbsMap = parsed.probabilities || {};
      const probs = SUBJECTS.map(subj => {
        const val = parseFloat(rawProbsMap[subj]);
        return isNaN(val) ? 0.01 : Math.max(val, 0);
      });

      // Chuẩn hoá mảng xác suất
      const sum = probs.reduce((a, b) => a + b, 0);
      const normalizedProbs = sum > 0 ? probs.map(p => p / sum) : probs;

      const confidence = parsed.confidence || Math.max(...normalizedProbs);

      return {
        probs: normalizedProbs,
        predicted_subject: parsed.predicted_subject || SUBJECTS[normalizedProbs.indexOf(Math.max(...normalizedProbs))],
        confidence,
        explanation: parsed.explanation || 'Phân loại đa phương thức hoàn tất bởi Gemini Multimodal.',
        mode
      };

    } catch (err) {
  lastError = err;
  errors.push(`${modelName}: ${err.message}`);
  console.warn(`Thử model ${modelName} thất bại, đang thử tiếp:`, err);
  }
  }

  throw new Error(errors.join(' | ') || 'Không thể kết nối tới Google Gemini API.');
}
