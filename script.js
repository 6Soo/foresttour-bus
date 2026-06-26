const layouts = {
    hiace: {
        cols: 3,
        seats: [
            // Row 0: Passenger(L), Console, Driver(R)
            { type: 'available', label: '1' }, { type: 'empty' }, { type: 'driver', label: 'D' },
            // Row 1: Door(L), Seat, Seat
            { type: 'door', label: 'Door' }, { type: 'available', label: '2' }, { type: 'available', label: '3' },
            // Row 2-4: 3 seats each
            { type: 'available', label: '4' }, { type: 'available', label: '5' }, { type: 'available', label: '6' },
            { type: 'available', label: '7' }, { type: 'available', label: '8' }, { type: 'available', label: '9' },
            { type: 'available', label: '10' }, { type: 'available', label: '11' }, { type: 'available', label: '12' },
            { type: 'available', label: '13' }, { type: 'empty' }, { type: 'empty' } // Adjusting to 13 passengers to fit standard
        ]
    },
    grandcabin: {
        cols: 4,
        seats: [
            // Row 0: Passenger(L), Empty, Empty, Driver(R)
            { type: 'available', label: '1' }, { type: 'empty' }, { type: 'empty' }, { type: 'driver', label: 'D' },
            // Row 1: Door(L), Empty, Seat, Seat
            { type: 'door', label: 'Door' }, { type: 'empty' }, { type: 'available', label: '2' }, { type: 'available', label: '3' },
            // Row 2: Empty, Empty, Seat, Seat
            { type: 'empty' }, { type: 'empty' }, { type: 'available', label: '4' }, { type: 'available', label: '5' },
            // Row 3: 4 seats across the back
            { type: 'available', label: '6' }, { type: 'available', label: '7' }, { type: 'available', label: '8' }, { type: 'available', label: '9' }
        ]
    },
    japan24: {
        cols: 4,
        seats: [
            // Row 0: Guide/Door(L), Empty, Empty, Driver(R)
            { type: 'guide', label: 'G' }, { type: 'empty' }, { type: 'empty' }, { type: 'driver', label: 'D' },
            // Row 1-7: 1 seat(L), aisle, 2 seats(R)
            { type: 'available', label: '1' }, { type: 'empty' }, { type: 'available', label: '2' }, { type: 'available', label: '3' },
            { type: 'available', label: '4' }, { type: 'empty' }, { type: 'available', label: '5' }, { type: 'available', label: '6' },
            { type: 'available', label: '7' }, { type: 'empty' }, { type: 'available', label: '8' }, { type: 'available', label: '9' },
            { type: 'available', label: '10' }, { type: 'empty' }, { type: 'available', label: '11' }, { type: 'available', label: '12' },
            { type: 'available', label: '13' }, { type: 'empty' }, { type: 'available', label: '14' }, { type: 'available', label: '15' },
            { type: 'available', label: '16' }, { type: 'empty' }, { type: 'available', label: '17' }, { type: 'available', label: '18' },
            // Row 8: 4 seats across
            { type: 'available', label: '19' }, { type: 'available', label: '20' }, { type: 'available', label: '21' }, { type: 'available', label: '22' }
        ]
    },
    korea40: {
        cols: 5,
        seats: [
            // Row 0: Driver(L), Empty, Empty, Empty, Door(R)
            { type: 'driver', label: 'D' }, { type: 'empty' }, { type: 'empty' }, { type: 'empty' }, { type: 'door', label: 'Door' }
        ]
    }
};

// Generate 40 passenger seats for Korea bus
for (let i = 1; i <= 40; i += 4) {
    layouts.korea40.seats.push(
        { type: 'available', label: i },
        { type: 'available', label: i + 1 },
        { type: 'empty' }, // Aisle
        { type: 'available', label: i + 2 },
        { type: 'available', label: i + 3 }
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
        
        busContainer.appendChild(seatDiv);
    });
}

// Event Listeners for buttons
buttons.forEach(button => {
    button.addEventListener('click', (e) => {
        // Remove active class from all
        buttons.forEach(btn => btn.classList.remove('active'));
        // Add to clicked
        const targetBtn = e.currentTarget;
        targetBtn.classList.add('active');
        
        // Render corresponding bus
        renderBus(targetBtn.dataset.bus);
    });
});

// Initial render
renderBus('hiace');
