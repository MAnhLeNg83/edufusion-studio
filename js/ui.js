// ui.js – Kết xuất giao diện (DOM rendering), biểu đồ phân phối xác suất và Attention Map
import { SUBJECTS } from './lexicon.js';

/**
 * Hiển thị biểu đồ phân phối xác suất 7 môn học bằng CSS Flexbox
 * @param {number[]} probs - Mảng xác suất tương ứng 7 môn học
 */
export function renderProbChart(probs) {
  const chartContainer = document.getElementById('prob-chart');
  if (!chartContainer) return;
  chartContainer.innerHTML = '';

  const maxProb = Math.max(...probs);

  probs.forEach((prob, idx) => {
    const percentage = (prob * 100).toFixed(1);
    const isTopClass = prob === maxProb;

    const row = document.createElement('div');
    row.className = 'prob-row';

    row.innerHTML = `
      <span class="prob-label" title="${SUBJECTS[idx]}">${SUBJECTS[idx]}</span>
      <div class="prob-bar-container">
        <div class="prob-bar ${isTopClass ? 'top' : ''}" style="width: ${Math.max(prob * 100, 1.5)}%">
          ${prob >= 0.08 ? `<span>${percentage}%</span>` : ''}
        </div>
      </div>
      <span class="prob-value">${percentage}%</span>
    `;

    chartContainer.appendChild(row);
  });
}

/**
 * Hiển thị khối kết quả dự đoán môn học, nhãn và huy hiệu độ tin cậy
 * @param {{ probs: number[], confidence: number, mode: string, needsReview: boolean }} fusionResult
 */
export function renderPrediction(fusionResult) {
  const maxIdx = fusionResult.probs.indexOf(Math.max(...fusionResult.probs));
  const predictedSubject = SUBJECTS[maxIdx] || 'Không xác định';
  const confidence = fusionResult.confidence;

  const labelEl = document.getElementById('pred-label');
  const confEl = document.getElementById('pred-confidence');
  const modeEl = document.getElementById('pred-mode');

  if (labelEl) labelEl.textContent = predictedSubject;

  // Xác định mức độ tin cậy để gán màu sắc huy hiệu (badge)
  let badgeClass = 'conf-low';
  let badgeText = 'Độ tin cậy thấp';
  if (confidence >= 0.65) {
    badgeClass = 'conf-high';
    badgeText = 'Độ tin cậy cao';
  } else if (confidence >= 0.4) {
    badgeClass = 'conf-mid';
    badgeText = 'Độ tin cậy trung bình';
  }

  if (confEl) {
    confEl.innerHTML = `
      <span class="confidence-badge ${badgeClass}">
        Độ tin cậy: ${(confidence * 100).toFixed(1)}% (${badgeText})
      </span>
    `;
  }

  // Tên chế độ phân loại
  const modeNames = {
    'multimodal': '🔀 Đa phương thức (Văn bản + Ảnh)',
    'text-only': '📝 Đơn phương thức (Chỉ văn bản)',
    'image-only': '🖼️ Đơn phương thức (Chỉ ảnh minh hoạ)'
  };

  if (modeEl) {
    modeEl.textContent = `Chế độ: ${modeNames[fusionResult.mode] || fusionResult.mode}`;
  }
}

/**
 * Hiển thị Attention Map dạng lưới 7x7 overlay trực tiếp lên ảnh gốc
 * @param {number[][] | null} attentionMap - Ma trận 7x7 độ chú ý [0, 1]
 * @param {HTMLCanvasElement} originalCanvas - Canvas chứa ảnh gốc
 */
export function renderAttentionMap(attentionMap, originalCanvas) {
  const attCanvas = document.getElementById('attention-canvas');
  const attNote = document.getElementById('attention-note');
  if (!attCanvas || !attNote) return;

  const ctx = attCanvas.getContext('2d');
  const W = attCanvas.width || 224;
  const H = attCanvas.height || 224;

  ctx.clearRect(0, 0, W, H);

  // Trường hợp không có modality ảnh
  if (!attentionMap || !originalCanvas) {
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Không có ảnh minh hoạ', W / 2, H / 2 - 10);
    ctx.fillText('→ Không có attention map', W / 2, H / 2 + 14);

    attNote.textContent = 'ℹ️ Không có ảnh đầu vào → Hệ thống không tạo Attention Map.';
    attNote.className = 'attention-note muted';
    return;
  }

  // Bước 1: Sao chép ảnh gốc lên attention canvas
  ctx.drawImage(originalCanvas, 0, 0, W, H);

  // Bước 2: Phủ các ô lưới 7x7 với màu cam ấm áp và độ trong suốt tỷ lệ theo attention
  const cellW = W / 7;
  const cellH = H / 7;

  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 7; c++) {
      const weight = attentionMap[r] ? attentionMap[r][c] || 0 : 0;
      // Trọng số càng cao, màu cam càng đậm (opacity max 0.75)
      const alpha = Math.min(weight * 0.75, 0.75);

      ctx.fillStyle = `rgba(249, 115, 22, ${alpha})`;
      ctx.fillRect(c * cellW, r * cellH, cellW, cellH);
    }
  }

  // Bước 3: Vẽ các đường viền lưới (gridlines)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 7; i++) {
    ctx.beginPath();
    ctx.moveTo(i * cellW, 0);
    ctx.lineTo(i * cellW, H);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, i * cellH);
    ctx.lineTo(W, i * cellH);
    ctx.stroke();
  }

  attNote.textContent = '🔥 Vùng màu cam đậm biểu thị sự tập trung chú ý (attention weight) cao nhất của mô hình.';
  attNote.className = 'attention-note active';
}

/**
 * Hiển thị các banner cảnh báo (Fallback warning và Human-in-the-loop review)
 * @param {{ warning: string | null, needsReview: boolean, confidence: number }} fusionResult
 */
export function renderBanners(fusionResult) {
  const warningBanner = document.getElementById('warning-banner');
  const reviewBanner = document.getElementById('review-banner');

  if (warningBanner) {
    if (fusionResult.warning) {
      warningBanner.textContent = fusionResult.warning;
      warningBanner.className = 'banner banner-warning';
      warningBanner.style.display = 'block';
    } else {
      warningBanner.style.display = 'none';
    }
  }

  if (reviewBanner) {
    if (fusionResult.needsReview) {
      reviewBanner.innerHTML = `
        <strong>⚠️ Cần người review (Human-in-the-loop):</strong>
        Độ tin cậy của mô hình là ${(fusionResult.confidence * 100).toFixed(1)}% (&lt; 50%).
        Học liệu này cần chuyên viên giáo dục kiểm duyệt trước khi phân loại chính thức.
      `;
      reviewBanner.style.display = 'block';
    } else {
      reviewBanner.style.display = 'none';
    }
  }
}

/**
 * Chuyển đổi giao diện Sáng / Tối (Dark mode / Light mode)
 */
export function toggleTheme() {
  const html = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  const newTheme = isDark ? 'light' : 'dark';

  html.setAttribute('data-theme', newTheme);
  const themeBtn = document.getElementById('btn-toggle-theme');
  if (themeBtn) {
    themeBtn.textContent = newTheme === 'dark' ? '☀️ Sáng' : '🌙 Tối';
    themeBtn.setAttribute('title', newTheme === 'dark' ? 'Chuyển sang nền sáng' : 'Chuyển sang nền tối');
  }
}

/**
 * Gắn sự kiện click vào canvas để kích hoạt cửa sổ chọn file
 */
export function setupCanvasClick(canvasId, uploadInputId) {
  const canvas = document.getElementById(canvasId);
  const uploadInput = document.getElementById(uploadInputId);
  if (canvas && uploadInput) {
    canvas.addEventListener('click', () => {
      uploadInput.click();
    });
  }
}
