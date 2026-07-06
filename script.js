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
    });
});

// Initial render
renderBus('hiace10');

// ---------- 좌석표 이미지 캡처 & 카카오톡 공유 ----------
// (일정 페이지와 동일한 흐름: await로 이어진 캡처→공유로 모바일 공유 권한 유지.
//  toBlob 콜백 안에서 share를 부르면 사용자 제스처가 끊겨 공유가 안 되고 다운로드로 새던 버그 수정)
function canvasToBlob(canvas) {
    return new Promise((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('캡처 실패'))), 'image/png');
    });
}

async function captureBusChart() {
    const captureArea = document.getElementById('capture-area');
    captureArea.classList.add('capturing');
    // 편집 중이던 좌석의 포커스(파란 테두리)가 이미지에 남지 않도록 해제
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    try {
        const canvas = await html2canvas(captureArea, {
            backgroundColor: '#ffffff', // 라이트 테마 흰색 카드
            scale: 2,
            logging: false,
            useCORS: true,
        });
        return await canvasToBlob(canvas);
    } finally {
        captureArea.classList.remove('capturing');
    }
}

const shareBtn = document.getElementById('share-btn');
shareBtn.addEventListener('click', async () => {
    const originalText = shareBtn.innerHTML;
    shareBtn.innerHTML = '이미지 만드는 중... ⏳';
    shareBtn.disabled = true;
    try {
        const blob = await captureBusChart();
        const file = new File([blob], '버스_좌석표.png', { type: 'image/png' });

        // 1) 기기 공유 시트에 이미지 첨부 (카카오톡 선택 가능)
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            try {
                await navigator.share({ files: [file], title: '버스 좌석표' });
                return; // 공유 성공(또는 사용자가 시트를 닫음)
            } catch (error) {
                if (error.name === 'AbortError') return; // 사용자가 취소
                // 공유 실패 시에만 아래 저장 폴백으로 진행
            }
        }

        // 2) 폴백(PC·미지원 브라우저): 이미지 파일로 저장
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = '버스_좌석표.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 10000);
        alert('좌석표 이미지를 저장했어요. 카카오톡에서 사진으로 보내주세요 📷');
    } catch (err) {
        console.error('Error generating image:', err);
        alert('이미지 생성 중 오류가 발생했습니다.');
    } finally {
        shareBtn.innerHTML = originalText;
        shareBtn.disabled = false;
    }
});
