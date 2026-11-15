// app.js – Điểm khởi nhập (Entry Point) của ứng dụng EduFusion Studio
// Quản lý trạng thái, hỗ trợ 2 chế độ: Gemini Multimodal API & Offline Heuristic Mock
// Tự động nạp danh sách mẫu từ assets/demo/sample_inputs.json

import { analyzeText } from './textBranch.js';
import { analyzeImage } from './imageBranch.js';
import { fuse } from './fusion.js';
import {
  renderProbChart,
  renderPrediction,
  renderAttentionMap,
  renderBanners,
  toggleTheme,
  setupCanvasClick
} from './ui.js';
import {
  getStoredApiKey,
  saveApiKey,
  clearApiKey,
  classifyWithGemini
} from './geminiService.js';

// --- Khởi tạo và tham chiếu các DOM Elements ---
const textInput = document.getElementById('text-input');
const imageUpload = document.getElementById('image-upload');
const imageCanvas = document.getElementById('image-canvas');
const btnClassify = document.getElementById('btn-classify');
const btnFormula = document.getElementById('btn-formula');
const btnMap = document.getElementById('btn-map');
const btnClearImg = document.getElementById('btn-clear-img');
const btnToggleTheme = document.getElementById('btn-toggle-theme');

const selectEngine = document.getElementById('select-engine');
const geminiKeyPanel = document.getElementById('gemini-key-panel');
const geminiApiKeyInput = document.getElementById('gemini-api-key');
const btnSaveKey = document.getElementById('btn-save-key');
const btnClearKey = document.getElementById('btn-clear-key');
const activeEngineBadge = document.getElementById('active-engine-badge');

const sampleSelect = document.getElementById('sample-select');
const sampleModeBadge = document.getElementById('sample-mode-badge');
const imgSourceBadge = document.getElementById('img-source-badge');

const resultPlaceholder = document.getElementById('result-placeholder');
const resultContent = document.getElementById('result-content');
const warningBanner = document.getElementById('warning-banner');
const reviewBanner = document.getElementById('review-banner');

// Trạng thái (State)
let hasActiveImage = false;
let sampleDataset = [];

/**
 * Khởi tạo hình ảnh hiển thị mặc định (Placeholder) trên Canvas
 */
function renderCanvasPlaceholder() {
  const ctx = imageCanvas.getContext('2d');
  const W = imageCanvas.width;
  const H = imageCanvas.height;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(10, 10, W - 20, H - 20);

  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 13px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🖼️ Click để tải ảnh lên', W / 2, H / 2 - 10);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '11px -apple-system, sans-serif';
  ctx.fillText('hoặc chọn mẫu từ Dataset Demo bên trên', W / 2, H / 2 + 14);

  if (imgSourceBadge) imgSourceBadge.style.display = 'none';
}

renderCanvasPlaceholder();

/**
 * Vẽ một HTML Image lên Canvas 224x224 (tự động căn giữa và giữ nguyên tỷ lệ)
 */
function drawImageToCanvas(img, sourceLabel = 'Ảnh người dùng tải lên') {
  const ctx = imageCanvas.getContext('2d');
  const W = imageCanvas.width;
  const H = imageCanvas.height;

  const scale = Math.min(W / img.naturalWidth, H / img.naturalHeight);
  const targetW = img.naturalWidth * scale;
  const targetH = img.naturalHeight * scale;
  const offsetX = (W - targetW) / 2;
  const offsetY = (H - targetH) / 2;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  ctx.drawImage(img, offsetX, offsetY, targetW, targetH);

  hasActiveImage = true;
  if (btnClearImg) btnClearImg.style.display = 'inline-flex';

  if (imgSourceBadge) {
    imgSourceBadge.textContent = sourceLabel;
    imgSourceBadge.style.display = 'inline-block';
  }
}

// --- QUẢN LÝ ENGINE (OFFLINE MOCK VS GEMINI API) ---
function initEngineConfig() {
  const savedKey = getStoredApiKey();
  if (geminiApiKeyInput && savedKey) {
    geminiApiKeyInput.value = savedKey;
  }

  selectEngine.addEventListener('change', () => {
    const isGemini = selectEngine.value === 'gemini';
    geminiKeyPanel.style.display = isGemini ? 'block' : 'none';
    if (activeEngineBadge) {
      activeEngineBadge.textContent = isGemini ? 'Chế độ: Google Gemini API' : 'Chế độ: Offline Mock';
      activeEngineBadge.className = isGemini ? 'panel-tag engine-tag gemini' : 'panel-tag engine-tag';
    }
  });

  if (btnSaveKey) {
    btnSaveKey.addEventListener('click', () => {
      const keyVal = geminiApiKeyInput.value.trim();
      saveApiKey(keyVal);
      alert(keyVal ? '✅ Đã lưu Gemini API Key vào trình duyệt!' : 'Đã xoá API Key.');
    });
  }

  if (btnClearKey) {
    btnClearKey.addEventListener('click', () => {
      clearApiKey();
      geminiApiKeyInput.value = '';
      alert('Đã xoá API Key.');
    });
  }
}
initEngineConfig();

// --- NẠP DỮ LIỆU TỪ assets/demo/sample_inputs.json ---
async function loadSampleDataset() {
  try {
    const res = await fetch('./assets/demo/sample_inputs.json');
    if (!res.ok) throw new Error('Không thể tải sample_inputs.json');
    sampleDataset = await res.json();

    sampleSelect.innerHTML = '<option value="">-- Chọn một mẫu học liệu thử nghiệm --</option>';

    sampleDataset.forEach((item, idx) => {
      const opt = document.createElement('option');
      opt.value = idx;
      const modeText = item.mode === 'multimodal' ? 'Đa phương thức' : (item.mode === 'image_only' ? 'Chỉ ảnh' : 'Chỉ văn bản');
      const snippet = item.text ? (item.text.length > 55 ? item.text.substring(0, 52) + '...' : item.text) : (item.image_file || 'Ảnh minh hoạ');
      opt.textContent = `[${item.subject}] ${modeText}: ${snippet}`;
      sampleSelect.appendChild(opt);
    });

  } catch (err) {
    console.warn('Không tải được sample_inputs.json:', err);
  }
}
loadSampleDataset();

// Xử lý khi người dùng chọn mẫu từ dropdown
sampleSelect.addEventListener('change', () => {
  const selectedIdx = sampleSelect.value;
  if (selectedIdx === '') {
    sampleModeBadge.style.display = 'none';
    return;
  }

  const sample = sampleDataset[selectedIdx];
  if (!sample) return;

  // 1. Điền text
  textInput.value = sample.text || '';

  // 2. Cập nhật Badge mode
  const modeNames = {
    'multimodal': '🔀 Đa phương thức (Ảnh + Text)',
    'image_only': '🖼️ Đơn phương thức (Chỉ ảnh)',
    'text_only': '📝 Đơn phương thức (Chỉ văn bản)'
  };
  sampleModeBadge.textContent = `${modeNames[sample.mode] || sample.mode} • Môn chuẩn: ${sample.subject}`;
  sampleModeBadge.style.display = 'inline-block';

  // 3. Nạp ảnh (nếu có)
  const imageFileName = sample.image_file || sample.image;
  if (imageFileName) {
    let imgPath = imageFileName;
    if (!imgPath.startsWith('assets/')) {
      imgPath = `assets/demo/image/${imageFileName}`;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      drawImageToCanvas(img, `Mẫu: ${imageFileName}`);
    };
    img.onerror = () => {
      console.warn(`Không thể nạp ảnh từ: ${imgPath}`);
      renderCanvasPlaceholder();
      hasActiveImage = false;
    };
    img.src = imgPath;
  } else {
    // Không có ảnh
    hasActiveImage = false;
    if (btnClearImg) btnClearImg.style.display = 'none';
    renderCanvasPlaceholder();
  }
});

// --- DEMO 1: Tạo ảnh công thức toán học (Toán học) ---
btnFormula.addEventListener('click', () => {
  const ctx = imageCanvas.getContext('2d');
  const W = imageCanvas.width;
  const H = imageCanvas.height;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 12px serif';
  ctx.textAlign = 'center';
  ctx.fillText('Khảo sát hàm số: y = x³ - 3x² + 2', W / 2, 20);

  // Vẽ hệ trục toạ độ Oxy
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(20, 110); ctx.lineTo(W - 20, 110); // Ox
  ctx.moveTo(112, 20); ctx.lineTo(112, 200);   // Oy
  ctx.stroke();

  // Mũi tên Ox, Oy
  ctx.fillStyle = '#64748b';
  ctx.font = '10px sans-serif';
  ctx.fillText('x', W - 14, 114);
  ctx.fillText('y', 112, 14);
  ctx.fillText('O', 104, 122);

  // Vẽ đồ thị hàm bậc ba dạng sóng
  ctx.strokeStyle = '#4361ee';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  for (let px = 25; px <= W - 25; px++) {
    const x = (px - 112) / 30;
    const y = x * x * x - 3 * x; // Hàm bậc 3
    const py = 110 - y * 18;
    if (px === 25) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();

  // Công thức tích phân và đạo hàm
  ctx.textAlign = 'left';
  ctx.fillStyle = '#0f172a';
  ctx.font = '12px serif';
  ctx.fillText('y\' = 3x² - 6x = 0  => x = 0; x = 2', 15, 175);

  ctx.fillStyle = '#7209b7';
  ctx.font = 'bold 12px serif';
  ctx.fillText('S = ∫ |f(x) - g(x)| dx', 15, 198);

  ctx.fillStyle = '#64748b';
  ctx.font = 'italic 10px serif';
  ctx.fillText('Toán học 12 – Giải tích GDPT 2018', 15, 216);

  hasActiveImage = true;
  if (btnClearImg) btnClearImg.style.display = 'inline-flex';
  if (imgSourceBadge) {
    imgSourceBadge.textContent = 'Demo Đồ thị Toán';
    imgSourceBadge.style.display = 'inline-block';
  }
});

// --- DEMO 2: Tạo ảnh bản đồ (Địa lý) ---
btnMap.addEventListener('click', () => {
  const ctx = imageCanvas.getContext('2d');
  const W = imageCanvas.width;
  const H = imageCanvas.height;

  ctx.fillStyle = '#e0f2fe';
  ctx.fillRect(0, 0, W, H);

  const landPatches = [
    { x: 15, y: 20, w: 75, h: 60, fill: '#86efac' },
    { x: 105, y: 15, w: 100, h: 70, fill: '#4ade80' },
    { x: 10, y: 90, w: 60, h: 75, fill: '#bbf7d0' },
    { x: 80, y: 95, w: 85, h: 65, fill: '#86efac' },
    { x: 155, y: 90, w: 58, h: 80, fill: '#4ade80' },
    { x: 25, y: 170, w: 170, h: 45, fill: '#bbf7d0' }
  ];

  landPatches.forEach(patch => {
    ctx.fillStyle = patch.fill;
    ctx.fillRect(patch.x, patch.y, patch.w, patch.h);
    ctx.strokeStyle = '#16a34a';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(patch.x, patch.y, patch.w, patch.h);
  });

  ctx.strokeStyle = '#0284c7';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 145);
  ctx.bezierCurveTo(55, 130, 120, 165, W, 140);
  ctx.stroke();

  const cities = [
    { x: 50, y: 48, name: 'HÀ NỘI' },
    { x: 145, y: 42, name: 'HẢI PHÒNG' },
    { x: 85, y: 122, name: 'HUẾ' },
    { x: 180, y: 130, name: 'ĐÀ NẴNG' },
    { x: 105, y: 188, name: 'TP. HCM' }
  ];

  cities.forEach(city => {
    ctx.beginPath();
    ctx.arc(city.x, city.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#ef4444';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(city.x, city.y, 2, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(city.name, city.x, city.y - 7);
  });

  ctx.beginPath();
  ctx.arc(200, 28, 12, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#dc2626';
  ctx.font = 'bold 8px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('▲ N', 200, 26);
  ctx.fillStyle = '#64748b';
  ctx.font = '7px sans-serif';
  ctx.fillText('S', 200, 36);

  hasActiveImage = true;
  if (btnClearImg) btnClearImg.style.display = 'inline-flex';
  if (imgSourceBadge) {
    imgSourceBadge.textContent = 'Demo Bản đồ Địa lý';
    imgSourceBadge.style.display = 'inline-block';
  }
});

// --- Upload ảnh từ máy tính ---
imageUpload.addEventListener('change', event => {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = ev => {
    const img = new Image();
    img.onload = () => {
      drawImageToCanvas(img, file.name);
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
});

// --- Xoá ảnh ---
btnClearImg.addEventListener('click', () => {
  hasActiveImage = false;
  imageUpload.value = '';
  btnClearImg.style.display = 'none';
  renderCanvasPlaceholder();
});

// Setup click canvas để mở hộp chọn file
setupCanvasClick('image-canvas', 'image-upload');

// Theme toggle
btnToggleTheme.addEventListener('click', toggleTheme);

// Quick sample chips
document.querySelectorAll('.chip-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const sampleType = btn.getAttribute('data-sample');
    if (sampleType === 'history') {
      textInput.value = 'Lược đồ nơi diễn ra một số cuộc cách mạng tư sản từ thế kỉ XVI - XVIII tại khu vực châu Âu và Bắc Mỹ';
    } else if (sampleType === 'math') {
      textInput.value = 'Khảo sát và vẽ đồ thị hàm số bậc ba, tính đạo hàm, tìm cực đại cực tiểu và thể tích khối tròn xoay';
    } else if (sampleType === 'physics') {
      textInput.value = 'Một con lắc lò xo dao động điều hòa với phương trình x = 4cos(10πt - π/3) cm. Tính chu kỳ dao động và động năng cực đại.';
    } else if (sampleType === 'chem') {
      textInput.value = 'Cho kim loại sắt tác dụng với axit clohiđric HCl sinh ra khí hiđro H2 và dung dịch muối sắt II clorua FeCl2. Phản ứng oxi hóa khử.';
    } else if (sampleType === 'geo') {
      textInput.value = 'Dựa vào Atlat Địa lý Việt Nam, hãy phân tích sự phân hóa khí hậu nhiệt đới gió mùa và mạng lưới sông ngòi đồng bằng sông Cửu Long.';
    }
    textInput.focus();
  });
});

// --- NÚT PHÂN LOẠI CHÍNH (CLASSIFY PIPELINE) ---
btnClassify.addEventListener('click', async () => {
  const textValue = textInput.value ? textInput.value.trim() : '';
  const hasTextModality = textValue.length >= 3;
  const hasImageModality = hasActiveImage;

  if (!hasTextModality && !hasImageModality) {
    resultPlaceholder.style.display = 'none';
    resultContent.style.display = 'block';

    if (warningBanner) {
      warningBanner.textContent = '❌ Lỗi nhập liệu: Cần ít nhất 1 modality (nhập mô tả văn bản hoặc chọn ảnh minh hoạ).';
      warningBanner.className = 'banner banner-error';
      warningBanner.style.display = 'block';
    }
    if (reviewBanner) reviewBanner.style.display = 'none';

    document.getElementById('pred-label').textContent = 'Chưa thể phân loại';
    document.getElementById('pred-confidence').innerHTML = '<span class="confidence-badge conf-low">Thiếu dữ liệu</span>';
    document.getElementById('pred-mode').textContent = 'Không có modality';
    document.getElementById('prob-chart').innerHTML = '';
    const expEl = document.getElementById('pred-explanation');
    if (expEl) expEl.style.display = 'none';
    renderAttentionMap(null, null);
    return;
  }

  // Loading state
  btnClassify.disabled = true;
  const originalText = btnClassify.querySelector('.btn-text').textContent;
  btnClassify.querySelector('.btn-text').textContent = 'Đang phân loại học liệu...';

  try {
    const isGeminiMode = selectEngine.value === 'gemini';

    if (isGeminiMode) {
      // === CHẾ ĐỘ GOOGLE GEMINI MULTIMODAL API ===
      const apiKey = geminiApiKeyInput.value.trim() || getStoredApiKey();
      if (!apiKey) {
        throw new Error('Chưa có Gemini API Key! Hãy nhập API Key ở thanh phía trên hoặc chuyển sang chế độ "Giả lập Offline".');
      }

      const geminiResult = await classifyWithGemini(
        apiKey,
        hasTextModality ? textValue : null,
        hasImageModality ? imageCanvas : null
      );

      resultPlaceholder.style.display = 'none';
      resultContent.style.display = 'block';

      // Fallback warnings
      let warning = null;
      if (hasTextModality && !hasImageModality) {
        warning = '⚠️ Chỉ dùng nhánh văn bản (Gemini Text-only – không có ảnh minh hoạ)';
      } else if (!hasTextModality && hasImageModality) {
        warning = '⚠️ Chỉ dùng nhánh ảnh (Gemini Vision-only – không có văn bản mô tả)';
      }

      renderBanners({
        warning,
        confidence: geminiResult.confidence,
        needsReview: geminiResult.confidence < 0.5
      });

      renderPrediction(geminiResult);
      renderProbChart(geminiResult.probs);

      // Sinh Attention map mô phỏng nếu có ảnh
      if (hasImageModality) {
        const imageResult = analyzeImage(imageCanvas);
        renderAttentionMap(imageResult ? imageResult.attentionMap : null, imageCanvas);
      } else {
        renderAttentionMap(null, null);
      }

    } else {
      // === CHẾ ĐỘ OFFLINE HEURISTIC MOCK (PHOBERT + EFFICIENTNET) ===
      let textResult = null;
      if (hasTextModality) {
        textResult = analyzeText(textValue);
      }

      let imageResult = null;
      if (hasImageModality) {
        imageResult = analyzeImage(imageCanvas);
      }

      const fusionResult = fuse(textResult, imageResult);

      resultPlaceholder.style.display = 'none';
      resultContent.style.display = 'block';

      renderBanners(fusionResult);
      renderPrediction(fusionResult);
      renderProbChart(fusionResult.probs);
      renderAttentionMap(fusionResult.attentionMap, hasImageModality ? imageCanvas : null);
    }

  } catch (error) {
    resultPlaceholder.style.display = 'none';
    resultContent.style.display = 'block';

    if (warningBanner) {
      warningBanner.textContent = `❌ Lỗi thực thi pipeline: ${error.message}`;
      warningBanner.className = 'banner banner-error';
      warningBanner.style.display = 'block';
    }
    if (reviewBanner) reviewBanner.style.display = 'none';
  } finally {
    btnClassify.disabled = false;
    btnClassify.querySelector('.btn-text').textContent = originalText;
  }
});
