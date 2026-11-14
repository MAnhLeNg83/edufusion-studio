// textBranch.js – Mô phỏng PhoBERT (frozen) trong pipeline EduFusionNet
// Sử dụng trích xuất từ khoá theo lexicon 7 môn học kết hợp hàm Softmax

import { LEXICON, SUBJECTS } from './lexicon.js';

/**
 * Chuẩn hoá văn bản đầu vào:
 * - Chuyển sang chữ thường (lowercase)
 * - Giữ lại chữ cái tiếng Việt, tiếng Anh, số, dấu cộng (cho C++)
 * - Bỏ các dấu câu như chấm, phẩy, chấm hỏi, ngoặc,...
 * - Rút gọn khoảng trắng thừa
 */
export function normalizeText(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[.,!?;:'"()\[\]{}<>|\\\/\-_=*&^%$#@~`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Hàm kích hoạt Softmax có tham số nhiệt độ (temperature):
 * - temperature > 1.0 giúp phân phối mềm hơn, phản ánh sự không chắc chắn
 * - Trừ max(scores) trước khi lấy exp để đảm bảo ổn định số học (numerical stability)
 */
export function softmax(scores, temperature = 1.5) {
  const scaled = scores.map(s => s / temperature);
  const maxVal = Math.max(...scaled);
  const exps = scaled.map(s => Math.exp(s - maxVal));
  const sumExps = exps.reduce((acc, val) => acc + val, 0);
  return exps.map(e => e / sumExps);
}

/**
 * Phân tích văn bản tiếng Việt mô tả học liệu:
 * @param {string} text - Chuỗi văn bản nhập từ người dùng
 * @returns {{ probs: number[], tokensUsed: string[], confidence: number, rawScores: number[] }}
 */
export function analyzeText(text) {
  // Kiểm tra độ dài văn bản tối thiểu
  if (!text || text.trim().length < 3) {
    throw new Error('Văn bản quá ngắn hoặc để trống (cần ít nhất 3 ký tự).');
  }

  const normalized = normalizeText(text);
  const tokens = normalized.split(' ').filter(Boolean);
  const tokensSet = new Set(tokens);

  const rawScores = new Array(SUBJECTS.length).fill(0);
  const matchedTokensPerSubject = {};
  const allTokensUsed = [];

  // Duyệt qua từng môn học để tính điểm dựa trên Lexicon
  SUBJECTS.forEach((subject, idx) => {
    matchedTokensPerSubject[subject] = [];
    const subjectKeywords = LEXICON[subject] || [];

    subjectKeywords.forEach(({ word, weight }) => {
      const keywordLower = word.toLowerCase();
      let isMatched = false;

      // Nếu từ khoá là cụm từ nhiều từ (n-gram)
      if (keywordLower.includes(' ')) {
        if (normalized.includes(keywordLower)) {
          isMatched = true;
        }
      } else {
        // Từ khoá đơn lẻ: kiểm tra xuất hiện chính xác theo ranh giới từ
        if (tokensSet.has(keywordLower) || normalized.split(' ').includes(keywordLower)) {
          isMatched = true;
        } else if (keywordLower === 'c++' && text.toLowerCase().includes('c++')) {
          isMatched = true;
        }
      }

      if (isMatched) {
        rawScores[idx] += weight;
        matchedTokensPerSubject[subject].push(word);
        if (!allTokensUsed.includes(word)) {
          allTokensUsed.push(word);
        }
      }
    });
  });

  // Kiểm tra nếu không khớp từ khoá nào -> trả về phân phối đều (uniform)
  const totalScore = rawScores.reduce((acc, val) => acc + val, 0);
  if (totalScore === 0) {
    const uniformProb = 1 / SUBJECTS.length;
    return {
      probs: new Array(SUBJECTS.length).fill(uniformProb),
      tokensUsed: [],
      confidence: uniformProb,
      rawScores
    };
  }

  // Áp dụng Softmax với temperature = 1.5
  const probs = softmax(rawScores, 1.5);
  const confidence = Math.max(...probs);

  return {
    probs,
    tokensUsed: allTokensUsed,
    confidence,
    rawScores
  };
}
