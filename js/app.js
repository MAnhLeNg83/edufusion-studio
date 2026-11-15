// app.js – Điểm khởi nhập (Entry Point) của ứng dụng EduFusion Studio
// Quản lý trạng thái, hỗ trợ 2 chế độ: Gemini Multimodal API & Offline Heuristic Mock
// Tích hợp sẵn bộ mẫu DEFAULT_SAMPLES (fallback an toàn) kết hợp fetch & LocalStorage

import { analyzeText } from './textBranch.js';
import { analyzeImage } from './imageBranch.js';
import { fuse } from './fusion.js';
import { SUBJECTS } from './lexicon.js';
import { DEFAULT_SAMPLES } from './defaultSamples.js';
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

// --- Tham chiếu các phần tử DOM ---
const textInput = document.getElementById('text-input');
const imageUpload = document.getElementById('image-upload');
const imageCanvas = document.getElementById('image-canvas');
const btnClassify = document.getElementById('btn-classify');
const btnFormula = document.getElementById('btn-formula');
const btnMap = document.getElementById('btn-map');
const btnClearImg = document.getElementById('btn-clear-img');
const btnUploadFile = document.getElementById('btn-upload-file');
const btnSaveAsSample = document.getElementById('btn-save-as-sample');
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
const CUSTOM_SAMPLES_KEY = 'edufusion_custom_samples';

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

  ctx.fillStyle = '#475569';
  ctx.font = 'bold 13px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🖼️ Kéo thả ảnh hoặc click để tải lên', W / 2, H / 2 - 10);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '11px -apple-system, sans-serif';
  ctx.fillText('hoặc chọn mẫu từ Dataset Demo bên trên', W / 2, H / 2 + 14);

  if (imgSourceBadge) imgSourceBadge.style.display = 'none';
}

renderCanvasPlaceholder();

/**
 * Vẽ một HTML Image lên Canvas 224x224 (tự động căn giữa và giữ nguyên tỷ lệ)
 */
function drawImageToCanvas(img, sourceLabel = 'Ảnh học liệu') {
  const ctx = imageCanvas.getContext('2d');
  const W = imageCanvas.width;
  const H = imageCanvas.height;

  const nw = img.naturalWidth || img.width || 224;
  const nh = img.naturalHeight || img.height || 224;

  const scale = Math.min(W / nw, H / nh);
  const targetW = nw * scale;
  const targetH = nh * scale;
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

/**
 * Nạp ảnh an toàn từ đường dẫn cục bộ lên Canvas
 */
function loadSafeImage(imgPath, label, callback) {
  const img = new Image();
  // KHÔNG dùng crossOrigin = 'anonymous' cho tài nguyên local cùng domain
  img.onload = () => {
    drawImageToCanvas(img, label);
    if (callback) callback();
  };
  img.onerror = () => {
    console.warn(`Không thể nạp ảnh: ${imgPath}. Thử đường dẫn thay thế...`);
    // Thử fallback không có prefix assets/ hoặc ngược lại
    if (!imgPath.startsWith('assets/')) {
      const fallbackImg = new Image();
      fallbackImg.onload = () => {
        drawImageToCanvas(fallbackImg, label);
        if (callback) callback();
      };
      fallbackImg.onerror = () => {
        hasActiveImage = false;
        renderCanvasPlaceholder();
      };
      fallbackImg.src = `assets/demo/image/${imgPath}`;
    } else {
      hasActiveImage = false;
      renderCanvasPlaceholder();
    }
  };
  img.src = imgPath;
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

// --- NẠP VÀ HIỂN THỊ DANH SÁCH MẪU HỌC LIỆU (DATASET) ---
function renderSampleDropdown() {
  sampleSelect.innerHTML = '<option value="">-- Chọn một mẫu học liệu thử nghiệm --</option>';

  sampleDataset.forEach((item, idx) => {
    const opt = document.createElement('option');
    opt.value = idx;
    const modeText = item.mode === 'multimodal' ? 'Đa phương thức' : (item.mode === 'image_only' ? 'Chỉ ảnh' : 'Chỉ văn bản');
    const snippet = item.text ? (item.text.length > 50 ? item.text.substring(0, 48) + '...' : item.text) : (item.image_file || 'Ảnh minh hoạ');
    opt.textContent = `[${item.subject}] ${modeText}: ${snippet}`;
    sampleSelect.appendChild(opt);
  });
}

function initDataset() {
  // 1. Nạp mẫu mặc định tích hợp sẵn
  sampleDataset = [...DEFAULT_SAMPLES];

  // 2. Nạp thêm mẫu tuỳ chỉnh người dùng đã lưu từ LocalStorage
  try {
    const savedCustom = localStorage.getItem(CUSTOM_SAMPLES_KEY);
    if (savedCustom) {
      const customList = JSON.parse(savedCustom);
      if (Array.isArray(customList)) {
        sampleDataset.push(...customList);
      }
    }
  } catch (e) {
    console.warn('Lỗi đọc custom samples:', e);
  }

  // Hiển thị ngay lập tức lên dropdown (không cần đợi fetch)
  renderSampleDropdown();

  // 3. Thử tải thêm từ file sample_inputs.json (nếu có server hỗ trợ)
  fetch('./assets/demo/sample_inputs.json')
    .then(res => (res.ok ? res.json() : null))
    .then(remoteData => {
      if (Array.isArray(remoteData) && remoteData.length > 0) {
        // Gộp mẫu từ file nếu chưa có trong danh sách
        const existingIds = new Set(sampleDataset.map(s => s.id));
        let added = false;
        remoteData.forEach(item => {
          if (!existingIds.has(item.id)) {
            sampleDataset.push(item);
            added = true;
          }
        });
        if (added) renderSampleDropdown();
      }
    })
    .catch(() => {
      // Fetch thất bại (ví dụ chạy file:///) -> Vẫn an toàn vì đã nạp DEFAULT_SAMPLES
    });
}
initDataset();

/**
 * Chọn và áp dụng một mẫu học liệu
 */
function applySample(sample, autoClassify = true) {
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

  // 3. Nạp ảnh
  const imageFileName = sample.image_file || sample.image;
  if (imageFileName) {
    let imgPath = imageFileName;
    if (!imgPath.startsWith('assets/') && !imgPath.startsWith('data:')) {
      imgPath = `assets/demo/image/${imageFileName}`;
    }

    loadSafeImage(imgPath, `Mẫu: ${imageFileName}`, () => {
      if (autoClassify) {
        setTimeout(() => triggerClassify(), 120);
      }
    });
  } else {
    hasActiveImage = false;
    if (btnClearImg) btnClearImg.style.display = 'none';
    renderCanvasPlaceholder();
    if (autoClassify && sample.text) {
      setTimeout(() => triggerClassify(), 120);
    }
  }
}

// Xử lý khi người dùng chọn mẫu từ dropdown
sampleSelect.addEventListener('change', () => {
  const selectedIdx = sampleSelect.value;
  if (selectedIdx === '') {
    sampleModeBadge.style.display = 'none';
    return;
  }

  const sample = sampleDataset[selectedIdx];
  applySample(sample, true);
});

// --- DEMO 1: Tạo ảnh đồ thị hàm số (Toán học) ---
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
  ctx.moveTo(20, 110); ctx.lineTo(W - 20, 110);
  ctx.moveTo(112, 20); ctx.lineTo(112, 200);
  ctx.stroke();

  ctx.fillStyle = '#64748b';
  ctx.font = '10px sans-serif';
  ctx.fillText('x', W - 14, 114);
  ctx.fillText('y', 112, 14);
  ctx.fillText('O', 104, 122);

  ctx.strokeStyle = '#4361ee';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  for (let px = 25; px <= W - 25; px++) {
    const x = (px - 112) / 30;
    const y = x * x * x - 3 * x;
    const py = 110 - y * 18;
    if (px === 25) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();

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

// --- Upload ảnh từ máy tính (Nút bấm & Click Canvas) ---
function handleImageFile(file) {
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
}

imageUpload.addEventListener('change', event => {
  const file = event.target.files && event.target.files[0];
  handleImageFile(file);
});

if (btnUploadFile) {
  btnUploadFile.addEventListener('click', () => {
    imageUpload.click();
  });
}

// Hỗ trợ kéo thả ảnh (Drag & Drop) vào Canvas
const canvasCard = document.querySelector('.canvas-card');
if (canvasCard) {
  canvasCard.addEventListener('dragover', e => {
    e.preventDefault();
    canvasCard.style.borderColor = 'var(--accent-primary)';
  });
  canvasCard.addEventListener('dragleave', () => {
    canvasCard.style.borderColor = '';
  });
  canvasCard.addEventListener('drop', e => {
    e.preventDefault();
    canvasCard.style.borderColor = '';
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleImageFile(file);
    }
  });
}

// Xoá ảnh
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

// --- CÁC NÚT MẪU NHANH (QUICK CHIPS) KÈM ẢNH THỰC TẾ & TỰ ĐỘNG PHÂN LOẠI ---
const QUICK_CHIP_MAP = {
  history: {
    subject: 'Lịch sử',
    mode: 'multimodal',
    image_file: 'Lich_Su_1.png',
    text: 'Lược đồ nơi diễn ra một số cuộc cách mạng tư sản từ thế kỉ XVI - XVIII tại khu vực châu Âu và Bắc Mỹ. Phong trào giải phóng và xác lập chủ nghĩa tư bản.'
  },
  math: {
    subject: 'Toán học',
    mode: 'multimodal',
    image_file: 'Toan_1.png',
    text: 'Khảo sát và vẽ đồ thị hàm số bậc ba y = f(x), tìm các điểm cực đại, cực tiểu, tính đạo hàm và thể tích khối tròn xoay.'
  },
  physics: {
    subject: 'Vật lý',
    mode: 'multimodal',
    image_file: 'Ly_1.png',
    text: 'Một con lắc lò xo dao động điều hòa với phương trình li độ x = 4cos(10πt - π/3) cm. Xác định chu kỳ dao động và động năng cực đại.'
  },
  chem: {
    subject: 'Hóa học',
    mode: 'multimodal',
    image_file: 'Hoa_1.png',
    text: 'Cho kim loại sắt tác dụng với axit sunfuric H2SO4 đặc nóng dư thu được khí SO2 duy nhất. Phản ứng oxi hóa khử và cân bằng electron.'
  },
  geo: {
    subject: 'Địa lý',
    mode: 'multimodal',
    image_file: 'Dia_1.png',
    text: 'Dựa vào Atlat Địa lý Việt Nam, phân tích sự phân hóa địa hình nhiệt đới gió mùa và mạng lưới sông ngòi đồng bằng sông Cửu Long.'
  }
};

document.querySelectorAll('.chip-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const sampleType = btn.getAttribute('data-sample');
    const sample = QUICK_CHIP_MAP[sampleType];
    if (sample) {
      applySample(sample, true);
    }
  });
});

// --- TÍNH NĂNG: LƯU NỘI DUNG HIỆN TẠI THÀNH MẪU MỚI (LƯU VÀO LOCALSTORAGE) ---
if (btnSaveAsSample) {
  btnSaveAsSample.addEventListener('click', () => {
    const textVal = textInput.value.trim();
    if (!textVal && !hasActiveImage) {
      alert('⚠️ Hãy nhập văn bản hoặc tải ảnh lên trước khi lưu thành mẫu mới!');
      return;
    }

    const subjectChoice = prompt(
      `Chọn môn học cho mẫu này (nhập tên môn hoặc số 1-9):\n1. Toán học\n2. Vật lý\n3. Hóa học\n4. Sinh học\n5. Tin học\n6. Lịch sử\n7. Địa lý\n8. Ngữ văn\n9. Tiếng Anh`,
      'Lịch sử'
    );

    if (!subjectChoice) return;

    let targetSubject = subjectChoice.trim();
    const num = parseInt(targetSubject, 10);
    if (!isNaN(num) && num >= 1 && num <= 9) {
      targetSubject = SUBJECTS[num - 1];
    } else if (!SUBJECTS.includes(targetSubject)) {
      targetSubject = SUBJECTS.find(s => s.toLowerCase() === targetSubject.toLowerCase()) || 'Toán học';
    }

    let mode = 'multimodal';
    if (textVal && !hasActiveImage) mode = 'text_only';
    if (!textVal && hasActiveImage) mode = 'image_only';

    let savedImageData = null;
    if (hasActiveImage) {
      savedImageData = imageCanvas.toDataURL('image/png');
    }

    const newSample = {
      id: `custom_${Date.now()}`,
      subject: targetSubject,
      mode,
      image_file: savedImageData,
      text: textVal || null
    };

    // Lưu vào LocalStorage
    try {
      const existing = JSON.parse(localStorage.getItem(CUSTOM_SAMPLES_KEY) || '[]');
      existing.unshift(newSample);
      localStorage.setItem(CUSTOM_SAMPLES_KEY, JSON.stringify(existing));
    } catch (e) {
      console.warn('Lỗi lưu LocalStorage:', e);
    }

    // Thêm vào dataset và cập nhật dropdown
    sampleDataset.unshift(newSample);
    renderSampleDropdown();
    sampleSelect.value = 0;
    applySample(newSample, false);

    alert(`✅ Đã lưu mẫu mới thành công vào môn [${targetSubject}]! Lần sau bạn có thể chọn lại từ menu.`);
  });
}

// --- HÀM THỰC THI PHÂN LOẠI (TRIGGER CLASSIFY) ---
function triggerClassify() {
  btnClassify.click();
}

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
  const btnTextEl = btnClassify.querySelector('.btn-text');
  const originalText = btnTextEl ? btnTextEl.textContent : 'Phân loại học liệu';
  if (btnTextEl) btnTextEl.textContent = 'Đang phân loại học liệu...';

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
    if (btnTextEl) btnTextEl.textContent = originalText;
  }
});
