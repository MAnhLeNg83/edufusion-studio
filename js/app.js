// app.js – Điểm khởi nhập (Entry Point) của ứng dụng EduFusion Studio
// Quản lý trạng thái, kết nối các luồng xử lý đa phương thức và lắng nghe sự kiện DOM

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

// --- Khởi tạo và tham chiếu các DOM Elements ---
const textInput = document.getElementById('text-input');
const imageUpload = document.getElementById('image-upload');
const imageCanvas = document.getElementById('image-canvas');
const btnClassify = document.getElementById('btn-classify');
const btnFormula = document.getElementById('btn-formula');
const btnMap = document.getElementById('btn-map');
const btnClearImg = document.getElementById('btn-clear-img');
const btnToggleTheme = document.getElementById('btn-toggle-theme');

const resultPlaceholder = document.getElementById('result-placeholder');
const resultContent = document.getElementById('result-content');
const warningBanner = document.getElementById('warning-banner');
const reviewBanner = document.getElementById('review-banner');

// Trạng thái (State) của ảnh hiện tại
let hasActiveImage = false;

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

  // Viền nét đứt nhẹ
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(10, 10, W - 20, H - 20);

  // Chữ hướng dẫn
  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 13px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🖼️ Click để tải ảnh lên', W / 2, H / 2 - 10);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '11px -apple-system, sans-serif';
  ctx.fillText('hoặc nhấn các nút Demo bên dưới', W / 2, H / 2 + 14);
}

// Khởi tạo placeholder ban đầu
renderCanvasPlaceholder();

/**
 * Vẽ một HTML Image lên Canvas 224x224 (tự động căn giữa và giữ nguyên tỷ lệ)
 * @param {HTMLImageElement} img
 */
function drawImageToCanvas(img) {
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
}

// --- DEMO 1: Tạo ảnh công thức toán học & đồ thị (Toán rời rạc) ---
btnFormula.addEventListener('click', () => {
  const ctx = imageCanvas.getContext('2d');
  const W = imageCanvas.width;
  const H = imageCanvas.height;

  // Nền trắng tinh
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // Tiêu đề
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 12px serif';
  ctx.textAlign = 'center';
  ctx.fillText('Ma trận kề & Đồ thị có hướng G(V,E)', W / 2, 20);

  // Vẽ lưới ma trận kề 4x4
  const startX = 18;
  const startY = 32;
  const cellSize = 25;
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1;

  const matrixData = [
    ['0', '1', '1', '0'],
    ['0', '0', '1', '0'],
    ['0', '0', '0', '1'],
    ['1', '0', '0', '0']
  ];

  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const cellX = startX + c * cellSize;
      const cellY = startY + r * cellSize;
      ctx.strokeRect(cellX, cellY, cellSize, cellSize);

      const val = matrixData[r][c];
      ctx.fillStyle = val === '1' ? '#dc2626' : '#64748b';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(val, cellX + cellSize / 2, cellY + cellSize * 0.7);
    }
  }

  // Vẽ đồ thị nhỏ 4 đỉnh có hướng
  const nodes = [
    { x: 145, y: 45, label: 'v1' },
    { x: 195, y: 45, label: 'v2' },
    { x: 195, y: 110, label: 'v3' },
    { x: 145, y: 110, label: 'v4' }
  ];

  // Các cạnh nối
  ctx.strokeStyle = '#4361ee';
  ctx.lineWidth = 1.5;
  const edges = [[0, 1], [0, 2], [1, 2], [2, 3], [3, 0]];
  edges.forEach(([from, to]) => {
    ctx.beginPath();
    ctx.moveTo(nodes[from].x, nodes[from].y);
    ctx.lineTo(nodes[to].x, nodes[to].y);
    ctx.stroke();
  });

  // Vẽ các node
  nodes.forEach(node => {
    ctx.beginPath();
    ctx.arc(node.x, node.y, 9, 0, Math.PI * 2);
    ctx.fillStyle = '#4361ee';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(node.label, node.x, node.y + 3);
  });

  // Công thức toán học phía dưới
  ctx.textAlign = 'left';
  ctx.fillStyle = '#0f172a';
  ctx.font = '12px serif';
  ctx.fillText('deg⁺(v) = Σ a[i][j]', 18, 150);
  ctx.fillText('P(A ∪ B) = P(A) + P(B) - P(AB)', 18, 172);

  ctx.fillStyle = '#4361ee';
  ctx.fillText('C(n, k) = n! / (k!(n-k)!)', 18, 194);

  ctx.fillStyle = '#64748b';
  ctx.font = 'italic 10px serif';
  ctx.fillText('Lý thuyết tổ hợp & Đồ thị rời rạc', 18, 214);

  hasActiveImage = true;
  if (btnClearImg) btnClearImg.style.display = 'inline-flex';
});

// --- DEMO 2: Tạo ảnh bản đồ nhiều màu sắc (Địa lý / Tiếng Anh / Tiếng Nhật) ---
btnMap.addEventListener('click', () => {
  const ctx = imageCanvas.getContext('2d');
  const W = imageCanvas.width;
  const H = imageCanvas.height;

  // Nền xanh biển nhạt
  ctx.fillStyle = '#e0f2fe';
  ctx.fillRect(0, 0, W, H);

  // Vẽ các mảng đất liền (màu xanh lá tươi, viền xanh đậm)
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

  // Dòng sông / tuyến đường xanh dương
  ctx.strokeStyle = '#0284c7';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 145);
  ctx.bezierCurveTo(55, 130, 120, 165, W, 140);
  ctx.stroke();

  // Địa điểm chấm đỏ (Hà Nội, Đà Nẵng, TP.HCM,...)
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

  // La bàn định hướng (Compass)
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
});

// --- Upload ảnh từ máy tính ---
imageUpload.addEventListener('change', event => {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = ev => {
    const img = new Image();
    img.onload = () => {
      drawImageToCanvas(img);
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

// --- Thiết lập click vào canvas để mở hộp thoại chọn file ---
setupCanvasClick('image-canvas', 'image-upload');

// --- Lắng nghe sự kiện Theme Toggle ---
btnToggleTheme.addEventListener('click', toggleTheme);

// --- NÚT PHÂN LOẠI CHÍNH (CLASSIFY PIPELINE) ---
btnClassify.addEventListener('click', async () => {
  const textValue = textInput.value ? textInput.value.trim() : '';
  const hasTextModality = textValue.length >= 3;
  const hasImageModality = hasActiveImage;

  // Trường hợp cả hai modality đều trống -> Báo lỗi thân thiện, không crash
  if (!hasTextModality && !hasImageModality) {
    resultPlaceholder.style.display = 'none';
    resultContent.style.display = 'block';

    if (warningBanner) {
      warningBanner.textContent = '❌ Lỗi nhập liệu: Cần ít nhất 1 modality (nhập mô tả văn bản hoặc tải ảnh minh hoạ).';
      warningBanner.className = 'banner banner-error';
      warningBanner.style.display = 'block';
    }
    if (reviewBanner) reviewBanner.style.display = 'none';

    document.getElementById('pred-label').textContent = 'Chưa thể phân loại';
    document.getElementById('pred-confidence').innerHTML = '<span class="confidence-badge conf-low">Thiếu dữ liệu</span>';
    document.getElementById('pred-mode').textContent = 'Không có modality';
    document.getElementById('prob-chart').innerHTML = '';
    renderAttentionMap(null, null);
    return;
  }

  // Trạng thái xử lý (loading)
  btnClassify.disabled = true;
  const originalText = btnClassify.querySelector('.btn-text').textContent;
  btnClassify.querySelector('.btn-text').textContent = 'Đang phân loại học liệu...';

  try {
    // 1. Nhánh Văn bản (Text Branch)
    let textResult = null;
    if (hasTextModality) {
      textResult = analyzeText(textValue);
    }

    // 2. Nhánh Ảnh (Image Branch)
    let imageResult = null;
    if (hasImageModality) {
      imageResult = analyzeImage(imageCanvas);
    }

    // 3. Tích hợp đa phương thức (Fusion LCA + MEMD Fallback)
    const fusionResult = fuse(textResult, imageResult);

    // 4. Cập nhật DOM giao diện
    resultPlaceholder.style.display = 'none';
    resultContent.style.display = 'block';

    renderBanners(fusionResult);
    renderPrediction(fusionResult);
    renderProbChart(fusionResult.probs);
    renderAttentionMap(fusionResult.attentionMap, hasImageModality ? imageCanvas : null);

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
