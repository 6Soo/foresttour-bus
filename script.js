const layouts = {
    japan28: {
        cols: 4,
        seats: [
            // Row 0: Guide(L), Empty, Empty, Driver(R)
            { type: 'available', label: '' }, { type: 'empty' }, { type: 'empty' }, { type: 'driver', label: '운전석' },
            // Row 1: Refrigerator(L), Empty, 2 Seats(R)
            { type: 'refrigerator', label: '냉장고' }, { type: 'empty' }, { type: 'available', label: '' }, { type: 'available', label: '' },
            // Row 2: Door(L), Empty, Seat, Seat
            { type: 'door', label: '출입문' }, { type: 'empty' }, { type: 'available', label: '' }, { type: 'available', label: '' },
            // Row 3-7: 1 seat(L), aisle jump seat, 2 seats(R) (Total 4 per row * 5 rows)
            { type: 'available', label: '' }, { type: 'jump', label: '' }, { type: 'available', label: '' }, { type: 'available', label: '' },
            { type: 'available', label: '' }, { type: 'jump', label: '' }, { type: 'available', label: '' }, { type: 'available', label: '' },
            { type: 'available', label: '' }, { type: 'jump', label: '' }, { type: 'available', label: '' }, { type: 'available', label: '' },
            { type: 'available', label: '' }, { type: 'jump', label: '' }, { type: 'available', label: '' }, { type: 'available', label: '' },
            { type: 'available', label: '' }, { type: 'jump', label: '' }, { type: 'available', label: '' }, { type: 'available', label: '' },
            // Row 8: 4 seats across
            { type: 'available', label: '' }, { type: 'available', label: '' }, { type: 'available', label: '' }, { type: 'available', label: '' }
        ]
    },
    hiace10: {
        cols: 4,
        seats: [
            // Row 0: Passenger(L), Empty, Empty, Driver(R)
            { type: 'available', label: '' }, { type: 'empty' }, { type: 'empty' }, { type: 'driver', label: '운전석' },
            // Row 1: Door(L), Empty, Seat, Seat
            { type: 'door', label: '출입문' }, { type: 'empty' }, { type: 'available', label: '' }, { type: 'available', label: '' },
            // Row 2: Empty, Empty, Seat, Seat
            { type: 'empty' }, { type: 'empty' }, { type: 'available', label: '' }, { type: 'available', label: '' },
            // Row 3: Seat, Seat, Seat, Seat
            { type: 'available', label: '' }, { type: 'available', label: '' }, { type: 'available', label: '' }, { type: 'available', label: '' }
        ]
    },
    grandcabin: {
        cols: 4,
        seats: [
            // Row 0: Passenger(L), Empty, Empty, Driver(R)
            { type: 'available', label: '' }, { type: 'empty' }, { type: 'empty' }, { type: 'driver', label: '운전석' },
            // Row 1: Door(L), Empty, Seat, Seat
            { type: 'door', label: '출입문' }, { type: 'empty' }, { type: 'available', label: '' }, { type: 'available', label: '' },
            // Row 2: Empty, Empty, Seat, Seat
            { type: 'empty' }, { type: 'empty' }, { type: 'available', label: '' }, { type: 'available', label: '' },
            // Row 3: Seat, Seat, Seat, Seat
            { type: 'available', label: '' }, { type: 'available', label: '' }, { type: 'available', label: '' }, { type: 'available', label: '' }
        ]
    },
    japan24: {
        cols: 4,
        seats: [
            // Row 0: Guide(L), Empty, Empty, Driver(R)
            { type: 'available', label: '' }, { type: 'empty' }, { type: 'empty' }, { type: 'driver', label: '운전석' },
            // Row 1: Refrigerator(L), Empty, 2 Seats(R)
            { type: 'refrigerator', label: '냉장고' }, { type: 'empty' }, { type: 'available', label: '' }, { type: 'available', label: '' },
            // Row 2: Door(L), Empty, Seat, Seat
            { type: 'door', label: '출입문' }, { type: 'empty' }, { type: 'available', label: '' }, { type: 'available', label: '' },
            // Row 3-7: 1 seat(L), aisle, 2 seats(R) (Total 3 per row * 5 rows)
            { type: 'available', label: '' }, { type: 'empty' }, { type: 'available', label: '' }, { type: 'available', label: '' },
            { type: 'available', label: '' }, { type: 'empty' }, { type: 'available', label: '' }, { type: 'available', label: '' },
            { type: 'available', label: '' }, { type: 'empty' }, { type: 'available', label: '' }, { type: 'available', label: '' },
            { type: 'available', label: '' }, { type: 'empty' }, { type: 'available', label: '' }, { type: 'available', label: '' },
            { type: 'available', label: '' }, { type: 'empty' }, { type: 'available', label: '' }, { type: 'available', label: '' },
            // Row 8: 4 seats across
            { type: 'available', label: '' }, { type: 'available', label: '' }, { type: 'available', label: '' }, { type: 'available', label: '' }
        ]
    },
    korea40: {
        cols: 5,
        seats: [
            // Row 0: Driver(L), Empty, Empty, Empty, Door(R)
            { type: 'driver', label: '운전석' }, { type: 'empty' }, { type: 'empty' }, { type: 'empty' }, { type: 'door', label: '출입문' }
        ]
    }
};

// Generate 40 passenger seats for Korea bus
for (let i = 1; i <= 40; i += 4) {
    layouts.korea40.seats.push(
        { type: 'available', label: '' },
        { type: 'available', label: '' },
        { type: 'empty' }, // Aisle
        { type: 'available', label: '' },
        { type: 'available', label: '' }
    );
}

const busContainer = document.getElementById('bus-view');
const buttons = document.querySelectorAll('.bus-selector button');

function renderBus(busId) {
    const layout = layouts[busId];
    busContainer.innerHTML = '';
    
    // Set grid columns dynamically
    busContainer.style.gridTemplateColumns = `repeat(${layout.cols}, 1fr)`;
    
    layout.seats.forEach((seat, index) => {
        const seatDiv = document.createElement('div');
        seatDiv.className = `seat ${seat.type}`;
        
        // Add animation delay for a cool cascade effect
        seatDiv.style.animationDelay = `${index * 0.02}s`;
        
        if (seat.label) {
            seatDiv.textContent = seat.label;
        }
        
        if (seat.type === 'available' || seat.type === 'jump') {
            seatDiv.contentEditable = true;
        }
        
        // Allow adding seats by clicking empty spaces
        seatDiv.addEventListener('click', function(e) {
            if (this.classList.contains('empty')) {
                this.classList.remove('empty');
                this.classList.add('available');
                this.contentEditable = true;
                this.focus();
            }
        });

        // Allow removing seats by right-clicking or double-clicking empty seats
        const removeSeat = function(e) {
            if (this.classList.contains('available') && this.textContent.trim() === '') {
                e.preventDefault(); // Prevent context menu
                this.classList.remove('available');
                this.classList.add('empty');
                this.contentEditable = false;
                this.textContent = '';
                this.blur();
            }
        };
        seatDiv.addEventListener('contextmenu', removeSeat);
        seatDiv.addEventListener('dblclick', removeSeat);
        
        // Prevent rich text paste formatting
        seatDiv.addEventListener('paste', function(e) {
            e.preventDefault();
            const text = (e.originalEvent || e).clipboardData.getData('text/plain');
            document.execCommand('insertText', false, text);
        });
        
        busContainer.appendChild(seatDiv);
    });
}

let currentLayout = 'hiace10';

// Event Listeners
document.querySelectorAll('.bus-selector button').forEach(btn => {
    btn.addEventListener('click', (e) => {
        // Update active state
        document.querySelectorAll('.bus-selector button').forEach(b => b.classList.remove('active'));
        const targetBtn = e.target.closest('button');
        targetBtn.classList.add('active');
        
        // Update layout
        currentLayout = targetBtn.dataset.bus;
        renderBus(currentLayout);
        scheduleShareImage(500); // 차종이 바뀌면 미리보기 이미지 갱신
    });
});

// Initial render
renderBus('hiace10');

// ---------- 좌석표 이미지 캡처 & 카카오톡 공유 ----------
// 모바일에서 공유 버튼을 누른 순간 바로 공유창이 떠야 한다.
// html2canvas 캡처는 폰에서 1~3초 걸리는데, 그 사이에 사용자 터치 제스처(공유 권한)가
// 만료되어 navigator.share가 실패 → 다운로드로 새던 문제가 있었다.
// 해결: 이미지를 미리 만들어 두고(좌석이 바뀔 때마다 백그라운드 갱신),
//       버튼을 누르면 캡처 없이 준비된 이미지로 즉시 공유 → 제스처 유지.
function canvasToBlob(canvas) {
    return new Promise((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('캡처 실패'))), 'image/png');
    });
}

async function captureBusChart() {
    // 실제 화면은 건드리지 않고 html2canvas 복제본에만 .capturing 스타일 적용
    // → 백그라운드 갱신이 타이핑 중에 돌아도 화면 깜빡임/포커스 뺏김 없음
    const canvas = await html2canvas(document.getElementById('capture-area'), {
        backgroundColor: '#ffffff', // 라이트 테마 흰색 카드
        scale: 2,
        logging: false,
        useCORS: true,
        onclone: (doc) => {
            const el = doc.getElementById('capture-area');
            if (el) el.classList.add('capturing');
        },
    });
    return await canvasToBlob(canvas);
}

// 항상 최신 좌석표 이미지를 미리 만들어 둔다 (좌석 변경/차종 변경 시 갱신)
let shareBlob = null;
let regenTimer = null;
let regenRunning = false;
let regenQueued = false;

async function regenerateShareImage() {
    if (regenRunning) { regenQueued = true; return; }
    regenRunning = true;
    try {
        shareBlob = await captureBusChart();
    } catch (e) {
        // 실패 시 직전 이미지를 유지 — 다음 변경 때 다시 시도
    } finally {
        regenRunning = false;
        if (regenQueued) { regenQueued = false; regenerateShareImage(); }
    }
}

function scheduleShareImage(delay = 250) {
    clearTimeout(regenTimer);
    regenTimer = setTimeout(regenerateShareImage, delay);
}

// 좌석 이름 입력·차종 변경 시 미리보기 이미지 갱신 (#bus-view는 재생성돼도 유지되는 컨테이너)
busContainer.addEventListener('input', () => scheduleShareImage());
busContainer.addEventListener('focusout', () => scheduleShareImage(60));

const shareBtn = document.getElementById('share-btn');
shareBtn.addEventListener('click', async () => {
    // 1) 미리 만들어 둔 이미지가 있으면 캡처 없이 즉시 공유 (제스처 유지 → 공유창 바로 뜸)
    let blob = shareBlob;

    // 2) 준비 전이면(첫 진입 직후 등) 지금 만든다 — 드문 경우
    if (!blob) {
        const originalText = shareBtn.innerHTML;
        shareBtn.innerHTML = '이미지 만드는 중... ⏳';
        shareBtn.disabled = true;
        try { blob = await captureBusChart(); shareBlob = blob; }
        catch (e) { /* noop */ }
        shareBtn.innerHTML = originalText;
        shareBtn.disabled = false;
        if (!blob) return;
    }

    const file = new File([blob], '버스_좌석표.png', { type: 'image/png' });

    // 3) 기기 공유 시트에 이미지 첨부 (카카오톡 선택 가능) — 메시지 없이 바로 공유창
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
            await navigator.share({ files: [file] });
        } catch (e) {
            // 취소/실패 — 메시지 없이 조용히 종료
        }
        return;
    }

    // 4) 파일 공유 미지원(주로 PC): 메시지 없이 조용히 이미지 저장
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '버스_좌석표.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
});

// 첫 진입 시 미리보기 이미지 준비 (좌석 등장 애니메이션 이후)
scheduleShareImage(700);
