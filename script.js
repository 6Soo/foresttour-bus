const layouts = {
    hiace: {
        cols: 3,
        seats: [
            // Row 0: Passenger(L), Console, Driver(R)
            { type: 'available', label: '' }, { type: 'empty' }, { type: 'driver', label: '운전석' },
            // Row 1: Door(L), Seat, Seat
            { type: 'door', label: '출입문' }, { type: 'available', label: '' }, { type: 'available', label: '' },
            // Row 2-4: 3 seats each
            { type: 'available', label: '' }, { type: 'available', label: '' }, { type: 'available', label: '' },
            { type: 'available', label: '' }, { type: 'available', label: '' }, { type: 'available', label: '' },
            { type: 'available', label: '' }, { type: 'available', label: '' }, { type: 'available', label: '' },
            { type: 'available', label: '' }, { type: 'empty' }, { type: 'empty' } // Adjusting to 13 passengers to fit standard
        ]
    },
    hiace10: {
        cols: 3,
        seats: [
            // Row 0: Passenger(L), Console, Driver(R)
            { type: 'available', label: '' }, { type: 'empty' }, { type: 'driver', label: '운전석' },
            // Row 1: Door(L), Seat, Seat
            { type: 'door', label: '출입문' }, { type: 'available', label: '' }, { type: 'available', label: '' },
            // Row 2: Empty, Seat, Seat
            { type: 'empty' }, { type: 'available', label: '' }, { type: 'available', label: '' },
            // Row 3: Empty, Seat, Seat
            { type: 'empty' }, { type: 'available', label: '' }, { type: 'available', label: '' },
            // Row 4: Seat, Seat, Seat
            { type: 'available', label: '' }, { type: 'available', label: '' }, { type: 'available', label: '' }
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
            // Row 3: 4 seats across the back
            { type: 'available', label: '' }, { type: 'available', label: '' }, { type: 'available', label: '' }, { type: 'available', label: '' }
        ]
    },
    japan24: {
        cols: 4,
        seats: [
            // Row 0: Door(L), Empty, Empty, Driver(R)
            { type: 'door', label: '출입문' }, { type: 'empty' }, { type: 'empty' }, { type: 'driver', label: '운전석' },
            // Row 1-7: 1 seat(L), aisle, 2 seats(R)
            { type: 'available', label: '' }, { type: 'empty' }, { type: 'available', label: '' }, { type: 'available', label: '' },
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
        
        if (seat.type === 'available') {
            seatDiv.contentEditable = true;
        }
        
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

// Share & Screenshot functionality
const shareBtn = document.getElementById('share-btn');
shareBtn.addEventListener('click', async () => {
    try {
        // Change button text to show progress
        const originalText = shareBtn.innerHTML;
        shareBtn.innerHTML = '캡처 중... ⏳';
        shareBtn.disabled = true;

        const captureArea = document.getElementById('capture-area');
        captureArea.classList.add('capturing');
        
        // Use html2canvas to capture the element
        const canvas = await html2canvas(captureArea, {
            backgroundColor: '#0f172a', // Match the dark theme background
            scale: 2, // High resolution for mobile
            logging: false,
            useCORS: true
        });
        
        captureArea.classList.remove('capturing');
        
        canvas.toBlob(async (blob) => {
            const file = new File([blob], 'bus-seating-chart.png', { type: 'image/png' });
            
            // Check if Web Share API with files is supported (mostly mobile browsers like Safari iOS, Chrome Android)
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                try {
                    await navigator.share({
                        title: '프리미엄 버스 좌석표',
                        text: '여행사 버스 좌석 배치도입니다. 확인 부탁드립니다.',
                        files: [file]
                    });
                    console.log('Shared successfully');
                } catch (error) {
                    console.error('Sharing failed or was cancelled:', error);
                    // If user cancelled, don't download it automatically to avoid annoyance
                }
            } else {
                // Fallback for Desktop or unsupported browsers: Download the image
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'bus-seating-chart.png';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                alert('이미지가 기기에 저장되었습니다. 카카오톡 PC버전이나 메신저를 통해 이미지를 전송해주세요!');
            }
            
            // Restore button state
            shareBtn.innerHTML = originalText;
            shareBtn.disabled = false;
        });
    } catch (err) {
        console.error('Error generating image:', err);
        alert('이미지 생성 중 오류가 발생했습니다.');
        shareBtn.disabled = false;
    }
});
