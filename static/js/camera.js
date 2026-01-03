const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const context = canvas.getContext('2d');
const videoSelect = document.getElementById('videoSource');

let currentStream = null;
let capturedPhotos = [];
let currentSlot = 1;
let currentFilter = 'none'; // Hiệu ứng hiện tại
let currentFrame = 'white'; // Kiểu khung hiện tại
let currentStickerType = 'none'; // Thêm biến sticker độc lập
let totalSlots = 6; // Mặc định 6 ảnh
let currentCols = 2; // Số cột mặc định

// Khởi tạo dải ô ảnh khi trang web load
document.addEventListener('DOMContentLoaded', () => {
    getDevices();
    changeTotalSlots(6);
    changeCols(2); // Chọn 2 cột mặc định
});

function changeTotalSlots(count) {
    totalSlots = count;
    // Không gọi clearAllPhotos nữa để giữ lại ảnh cũ

    // Cập nhật UI nút chọn
    document.querySelectorAll('.slot-count-btn').forEach(btn => {
        btn.classList.remove('border-primary', 'bg-primary/5', 'text-primary');
        btn.classList.add('border-gray-100', 'dark:border-gray-800', 'text-gray-400');
    });
    const activeBtn = document.getElementById(`slot-count-${count}`);
    if (activeBtn) {
        activeBtn.classList.remove('border-gray-100', 'dark:border-gray-800', 'text-gray-400');
        activeBtn.classList.add('border-primary', 'bg-primary/5', 'text-primary');
    }
    renderSlots();
}

function changeCols(count) {
    currentCols = count;

    // UI chọn số cột
    document.querySelectorAll('.col-btn').forEach(btn => {
        btn.classList.remove('border-primary', 'bg-primary/5', 'text-primary');
        btn.classList.add('border-gray-100', 'dark:border-gray-800', 'text-gray-400');
    });
    const btn = document.getElementById(`col-count-${count}`);
    if (btn) {
        btn.classList.remove('border-gray-100', 'dark:border-gray-800', 'text-gray-400');
        btn.classList.add('border-primary', 'bg-primary/5', 'text-primary');
    }
    renderSlots();
}

function renderSlots() {
    const grid = document.getElementById('photo-grid');
    if (!grid) return; // Added check for grid

    // Hiển thị Grid theo số cột đã chọn
    grid.style.gridTemplateColumns = `repeat(${currentCols}, minmax(0, 1fr))`;
    grid.innerHTML = '';

    // Bảo toàn ảnh cũ khi thay đổi số lượng slot
    let oldPhotos = [...capturedPhotos];
    capturedPhotos = new Array(totalSlots).fill(null);
    for (let i = 0; i < Math.min(oldPhotos.length, totalSlots); i++) {
        capturedPhotos[i] = oldPhotos[i];
    }

    for (let i = 1; i <= totalSlots; i++) {
        const slot = document.createElement('div');
        slot.id = `slot-${i}`;
        slot.onclick = () => selectSlot(i);
        slot.className = `relative aspect-[4/3] rounded-xl overflow-hidden border-2 border-dashed border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-center shadow-sm transition-all duration-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800`;

        const existingPhoto = capturedPhotos[i - 1];
        slot.innerHTML = `
            <img id="photo-${i}" src="${existingPhoto || ''}" class="${existingPhoto ? '' : 'hidden'} w-full h-full object-cover">
            <div id="placeholder-${i}" class="text-center text-gray-400 ${existingPhoto ? 'hidden' : ''}">
                <span class="material-icons-round text-2xl">add_a_photo</span>
                <p class="text-[8px] font-bold mt-1">${i}</p>
            </div>
        `;
        grid.appendChild(slot);
    }

    // Cập nhật slot hiện tại nếu vượt quá giới hạn mới
    if (currentSlot > totalSlots) currentSlot = 1;

    updateActiveSlotUI();
    checkFullStrip(); // Check strip status after rendering slots
}

function clearAllPhotos() {
    capturedPhotos = new Array(totalSlots).fill(null);
    for (let i = 1; i <= totalSlots; i++) { // Clear UI for all possible slots
        const img = document.getElementById(`photo-${i}`);
        const placeholder = document.getElementById(`placeholder-${i}`);
        if (img) {
            img.src = '';
            img.classList.add('hidden');
        }
        if (placeholder) {
            placeholder.classList.remove('hidden');
        }
    }
    currentSlot = 1;
    updateActiveSlotUI();
    checkFullStrip();
}

async function getDevices() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(track => track.stop());

        const devices = await navigator.mediaDevices.enumerateDevices();
        videoSelect.innerHTML = '';

        let obsId = null;
        const videoDevices = devices.filter(d => d.kind === 'videoinput');

        videoDevices.forEach((d) => {
            const opt = document.createElement('option');
            opt.value = d.deviceId;
            opt.text = d.label || `Camera ${videoSelect.length}`;
            if (opt.text.toLowerCase().includes('obs')) {
                obsId = d.deviceId;
                opt.text = "🎯 " + opt.text;
            }
            videoSelect.appendChild(opt);
        });

        if (obsId) {
            videoSelect.value = obsId;
            initCamera(obsId);
        } else if (videoDevices.length > 0) {
            initCamera(videoDevices[0].deviceId);
        }
        updateActiveSlotUI();
    } catch (err) {
        console.error("Lỗi danh sách:", err);
    }
}


function setEffect(filterStr) {
    currentFilter = filterStr;
    // Áp dụng filter lên khung xem trước
    video.style.filter = filterStr;

    // Cập nhật UI nút
    document.querySelectorAll('.effect-btn').forEach(btn => {
        btn.classList.remove('border-primary', 'text-primary');
        btn.classList.add('border-gray-200', 'dark:border-gray-700', 'text-gray-500', 'dark:text-gray-400');
    });

    // Tìm nút vừa nhấn (dùng event.target trong thực tế nhưng ở đây gọi trực tiếp)
    const activeBtn = Array.from(document.querySelectorAll('.effect-btn')).find(btn => btn.getAttribute('onclick').includes(filterStr));
    if (activeBtn) {
        activeBtn.classList.remove('border-gray-200', 'dark:border-gray-700', 'text-gray-500', 'dark:text-gray-400');
        activeBtn.classList.add('border-primary', 'text-primary');
    }
}

function setSticker(type) {
    currentStickerType = type;
    document.querySelectorAll('.sticker-btn').forEach(btn => {
        btn.classList.remove('border-primary', 'text-primary');
        btn.classList.add('border-gray-200', 'dark:border-gray-700', 'text-gray-500');
    });
    const activeBtn = document.getElementById(`sticker-${type}`);
    if (activeBtn) {
        activeBtn.classList.remove('border-gray-200', 'dark:border-gray-700', 'text-gray-500');
        activeBtn.classList.add('border-primary', 'text-primary');
    }
}

function setFrame(frameType) {
    currentFrame = frameType;
    document.querySelectorAll('.frame-btn').forEach(btn => {
        btn.classList.remove('border-primary', 'text-primary', 'bg-primary/5');
        btn.classList.add('border-gray-200', 'dark:border-gray-700', 'text-gray-500');
    });
    const activeBtn = document.getElementById(`frame-${frameType}`);
    if (activeBtn) {
        activeBtn.classList.remove('border-gray-200', 'dark:border-gray-700', 'text-gray-500');
        activeBtn.classList.add('border-primary', 'text-primary', 'bg-primary/5');
    }
    console.log("🖼 Đã chọn khung:", frameType);
}

// 3. Khởi tạo camera
async function initCamera(deviceId) {
    if (!deviceId) return;
    if (currentStream) currentStream.getTracks().forEach(t => t.stop());

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { ideal: deviceId } }
        });
        currentStream = stream;
        video.srcObject = stream;
        video.onloadedmetadata = () => video.play();

        document.getElementById('stopBtn').classList.remove('hidden');
        document.getElementById('startBtn').classList.add('hidden');
    } catch (err) {
        console.error("❌ Lỗi kết nối:", err);
    }
}

function selectSlot(slotNum) {
    currentSlot = slotNum;
    updateActiveSlotUI();
}

function updateActiveSlotUI() {
    for (let i = 1; i <= totalSlots; i++) { // Changed to totalSlots
        const container = document.getElementById(`slot-${i}`);
        if (!container) continue;
        container.classList.remove('ring-4', 'ring-primary', 'border-solid', 'border-primary', 'scale-[1.02]', 'z-10');
        container.classList.add('border-dashed');
        if (i === currentSlot) {
            container.classList.add('ring-4', 'ring-primary', 'border-solid', 'border-primary', 'scale-[1.02]', 'z-10');
            container.classList.remove('border-dashed');
        }
    }
}

// 4. Chụp ảnh (áp dụng luôn filter)
async function takePhoto() {
    if (!video.videoWidth || !currentStream) return alert("Vui lòng mở camera trước!");

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.filter = currentFilter; // Áp dụng filter vào canvas khi chụp
    context.drawImage(video, 0, 0);
    const data = canvas.toDataURL('image/png');

    capturedPhotos[currentSlot - 1] = data;

    const currentImg = document.getElementById(`photo-${currentSlot}`);
    const currentPlaceholder = document.getElementById(`placeholder-${currentSlot}`);
    const currentContainer = document.getElementById(`slot-${currentSlot}`);

    if (currentImg && currentPlaceholder) {
        currentImg.src = data;
        currentImg.classList.remove('hidden');
        currentPlaceholder.classList.add('hidden');

        currentContainer.style.filter = 'brightness(2)';
        setTimeout(() => {
            currentContainer.style.filter = 'brightness(1)';
            if (currentSlot < totalSlots) currentSlot++; else currentSlot = 1; // Changed to totalSlots
            updateActiveSlotUI();
            checkFullStrip();
        }, 150);
    }
}

function checkFullStrip() {
    const isFull = capturedPhotos.every(p => p !== null);
    const mergeBtn = document.getElementById('mergeBtn');
    const previewBtn = document.getElementById('previewBtn');
    if (isFull) {
        if (mergeBtn) { // Added check for mergeBtn
            mergeBtn.classList.remove('hidden');
            mergeBtn.classList.add('flex');
        }
        if (previewBtn) { // Added check for previewBtn
            previewBtn.classList.remove('hidden');
            previewBtn.classList.add('flex', 'animate-pulse');
        }
    } else {
        if (mergeBtn) { // Added check for mergeBtn
            mergeBtn.classList.add('hidden');
            mergeBtn.classList.remove('flex'); // Ensure flex is removed
        }
        if (previewBtn) { // Added check for previewBtn
            previewBtn.classList.add('hidden');
            previewBtn.classList.remove('flex', 'animate-pulse'); // Ensure flex and animate-pulse are removed
        }
    }
}

// Hàm cốt lõi để tạo ảnh Photostrip
async function generatePhotostrip() {
    if (capturedPhotos.some(p => p === null)) return null;

    const stripCanvas = document.createElement('canvas');
    const ctx = stripCanvas.getContext('2d');
    const imgWidth = 800;
    const imgHeight = 600;
    const padding = 50;
    const footerHeight = 120;

    // Tính toán số hàng tự động dựa trên Số cột người dùng chọn
    const cols = currentCols;
    const rows = Math.ceil(totalSlots / cols);

    stripCanvas.width = (imgWidth * cols) + (padding * (cols + 1));
    stripCanvas.height = (imgHeight * rows) + (padding * (rows + 1)) + footerHeight;

    // --- 1. VẼ NỀN KHUNG --- (Dựa trên kích thước canvas mới)
    ctx.fillStyle = '#FFFFFF';
    if (currentFrame === 'dark') ctx.fillStyle = '#1A1A1B';
    if (currentFrame === 'cute') ctx.fillStyle = '#FF9EAA';
    if (currentFrame === 'kstyle') {
        let grad = ctx.createLinearGradient(0, 0, 0, stripCanvas.height);
        grad.addColorStop(0, '#E1CEFF'); grad.addColorStop(1, '#FFDAE9');
        ctx.fillStyle = grad;
    }
    ctx.fillRect(0, 0, stripCanvas.width, stripCanvas.height);

    // Pattern Cartoon
    if (currentFrame === 'cartoon') {
        ctx.fillStyle = '#FFD93D';
        ctx.fillRect(0, 0, stripCanvas.width, stripCanvas.height);
        ctx.fillStyle = '#FF8400';
        for (let x = 0; x < stripCanvas.width; x += 60) {
            for (let y = 0; y < stripCanvas.height; y += 60) {
                ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
            }
        }
    } else if (currentFrame === 'retro') {
        ctx.fillStyle = '#2C2C2C';
        ctx.fillRect(0, 0, stripCanvas.width, stripCanvas.height);
        ctx.fillStyle = '#1A1A1A';
        for (let y = 30; y < stripCanvas.height; y += 100) {
            ctx.fillRect(10, y, 20, 40);
            ctx.fillRect(stripCanvas.width - 30, y, 20, 40);
        }
    } else if (currentFrame === 'party') {
        ctx.fillStyle = '#00D7FF';
        ctx.fillRect(0, 0, stripCanvas.width, stripCanvas.height);
    } else if (currentFrame === 'hearty') {
        ctx.fillStyle = '#FFF0F5';
        ctx.fillRect(0, 0, stripCanvas.width, stripCanvas.height);
    } else if (currentFrame === 'sticker') {
        // Sticker Style: Nền trắng kem
        ctx.fillStyle = '#FDFCF0';
        ctx.fillRect(0, 0, stripCanvas.width, stripCanvas.height);
    }

    // --- 2. VẼ ẢNH TRONG LƯỚI ---
    for (let i = 0; i < totalSlots; i++) {
        const img = new Image();
        img.src = capturedPhotos[i];
        await new Promise(resolve => img.onload = resolve);
        const row = Math.floor(i / cols);
        const col = i % cols;
        const x = padding + (col * (imgWidth + padding));
        const y = padding + (row * (imgHeight + padding));

        ctx.drawImage(img, x, y, imgWidth, imgHeight);

        ctx.lineWidth = (currentFrame === 'kstyle' || currentFrame === 'cartoon') ? 10 : 4;
        ctx.strokeStyle = (currentFrame === 'dark' || currentFrame === 'retro') ? '#444444' : '#FFFFFF';
        ctx.strokeRect(x, y, imgWidth, imgHeight);

        // --- 3. STICKERS ---
        if (currentStickerType === 'animals') {
            const animalStickers = ['🐥', '🐸', '🐰', '🌈', '🍭', '⭐'];
            ctx.font = '60px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(animalStickers[i % animalStickers.length], x + imgWidth - 30, y + imgHeight - 20);
        } else if (currentStickerType === 'sparkles') {
            ctx.font = '40px Arial';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText('✨', x + 20, y + 40);
            ctx.textAlign = 'right';
            ctx.fillText('⭐', x + imgWidth - 40, y + 40);
        } else if (currentStickerType === 'food') {
            const foodStickers = ['🍦', '🍕', '🍰', '🍩', '🍔', '🍓'];
            ctx.font = '50px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(foodStickers[i % foodStickers.length], x + 40, y + imgHeight - 20);
        }
    }

    // --- 4. HIỆU ỨNG TOÀN KHUNG ---
    if (currentStickerType === 'hearts') {
        const hearts = ['❤️', '💖', '💕', '💗'];
        for (let i = 0; i < 30; i++) {
            ctx.font = `${20 + Math.random() * 30}px Arial`;
            ctx.globalAlpha = 0.5;
            ctx.fillText(hearts[Math.floor(Math.random() * hearts.length)], Math.random() * stripCanvas.width, Math.random() * stripCanvas.height);
            ctx.globalAlpha = 1.0;
        }
    } else if (currentStickerType === 'weather') {
        const weatherIcons = ['☀️', '☁️', '🌙', '🌈', '⚡'];
        for (let i = 0; i < 20; i++) {
            ctx.font = `${30 + Math.random() * 20}px Arial`;
            ctx.globalAlpha = 0.4;
            ctx.fillText(weatherIcons[Math.floor(Math.random() * weatherIcons.length)], Math.random() * stripCanvas.width, Math.random() * stripCanvas.height);
            ctx.globalAlpha = 1.0;
        }
    } else if (currentStickerType === 'party') {
        ctx.fillStyle = '#FFFFFF';
        for (let i = 0; i < 20; i++) {
            ctx.font = '30px Arial';
            ctx.fillText('✨', Math.random() * stripCanvas.width, Math.random() * stripCanvas.height);
            ctx.fillText('🎈', Math.random() * stripCanvas.width, Math.random() * stripCanvas.height);
        }
    }

    // --- 5. FOOTER --- (Dựa trên chiều cao canvas động)
    let footerTextColor = (currentFrame === 'dark' || currentFrame === 'retro') ? '#FF7E5F' : '#333333';
    if (['cute', 'kstyle', 'cartoon'].includes(currentFrame)) footerTextColor = '#FFFFFF';
    if (currentFrame === 'hearty') footerTextColor = '#FF1493'; // Màu hồng đậm cho text khung trái tim
    if (currentFrame === 'sticker') footerTextColor = '#FFB200'; // Màu vàng cam cho Sticker style
    if (currentFrame === 'party') footerTextColor = '#FFFFFF';

    ctx.fillStyle = footerTextColor;
    ctx.font = 'bold 50px Inter, sans-serif';
    ctx.textAlign = 'center';

    // Lấy chữ tùy chỉnh từ Input
    const footerInput = document.getElementById('customFooterText');
    const customText = footerInput ? footerInput.value.trim() : '';
    let footerText = customText || 'PHOTOBOOK STUDIO';

    // Nếu không có chữ tùy chỉnh, hiển thị text mặc định theo khung (logic cũ)
    if (!customText) {
        if (currentFrame === 'cartoon') footerText = 'BOOM! CARTOON';
        if (currentFrame === 'cute') footerText = 'SWEET MOMENTS ❤️';
        if (currentFrame === 'kstyle') footerText = 'SOFT MEMORIES ✨';
        if (currentFrame === 'retro') footerText = 'VINTAGE FILM 🎞️';
        if (currentFrame === 'party') footerText = 'LETS PARTY! 🥳';
        if (currentFrame === 'hearty') footerText = 'LOVELY DAY 💕';
    }

    ctx.fillText(footerText, stripCanvas.width / 2, stripCanvas.height - 70);
    ctx.font = '30px Inter, sans-serif';
    const dateStr = new Date().toLocaleDateString('vi-VN');
    ctx.fillText(dateStr, stripCanvas.width / 2, stripCanvas.height - 25);

    return stripCanvas.toDataURL('image/png');
}

// Hàm cập nhật Preview thời gian thực khi gõ chữ
async function updatePreviewIfOpen() {
    const modal = document.getElementById('previewModal');
    if (modal && !modal.classList.contains('hidden')) {
        const dataUrl = await generatePhotostrip();
        if (dataUrl) {
            document.getElementById('previewImage').src = dataUrl;
        }
    }
}

// Hàm hiển thị Preview
async function showPreview() {
    const dataUrl = await generatePhotostrip();
    if (!dataUrl) {
        const remaining = capturedPhotos.filter(p => p === null).length;
        return alert(`Bạn cần chụp thêm ${remaining} tấm ảnh nữa để có thể xem trước dải phim!`);
    }

    const modal = document.getElementById('previewModal');
    const modalContent = document.getElementById('modalContent');
    const previewImg = document.getElementById('previewImage');

    previewImg.src = dataUrl;
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    setTimeout(() => {
        modalContent.classList.remove('scale-95', 'opacity-0');
        modalContent.classList.add('scale-100', 'opacity-100');
    }, 10);
}

function closePreview() {
    const modal = document.getElementById('previewModal');
    const modalContent = document.getElementById('modalContent');

    modalContent.classList.remove('scale-100', 'opacity-100');
    modalContent.classList.add('scale-95', 'opacity-0');

    setTimeout(() => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }, 300);
}

// Hàm lưu ảnh chính thức
async function mergeAndSave() {
    const fullStripData = await generatePhotostrip();
    if (!fullStripData) return alert("Vui lòng chụp đủ 6 tấm ảnh!");

    try {
        const response = await fetch('/save_photo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: fullStripData, is_strip: true })
        });
        const result = await response.json();
        if (result.status === 'success') {
            const link = document.createElement('a');
            link.download = `photostrip_${Date.now()}.png`;
            link.href = fullStripData;
            link.click();
            closePreview();
        }
    } catch (err) { console.error(err); }
}

videoSelect.onchange = () => initCamera(videoSelect.value);
