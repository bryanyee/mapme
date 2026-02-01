// Initialize map centered on the US
const map = L.map('map').setView([39.8283, -98.5795], 4);

// Add OpenStreetMap tiles
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// Store markers data: { cityName: { marker, label, names: [] } }
const markersData = {};

// DOM elements
const citySelect = document.getElementById('city-select');
const nameInput = document.getElementById('name-input');
const addBtn = document.getElementById('add-btn');
const markersList = document.getElementById('markers-list');

// Populate city dropdown
function populateCityDropdown() {
    US_CITIES.forEach(city => {
        const option = document.createElement('option');
        option.value = city.name;
        option.textContent = city.name;
        citySelect.appendChild(option);
    });
}

// Create or update marker label
function updateMarkerLabel(cityName) {
    const data = markersData[cityName];
    if (!data) return;

    const city = US_CITIES.find(c => c.name === cityName);
    if (!city) return;

    // Remove existing label if any
    if (data.label) {
        map.removeLayer(data.label);
    }

    // Create label content
    const namesText = data.names.length > 0 ? data.names.join(', ') : '';
    const labelHtml = `
        <div class="city-label">
            <div class="city-name">${cityName}</div>
            ${namesText ? `<div class="person-names">${namesText}</div>` : ''}
        </div>
    `;

    // Create custom icon for label
    const labelIcon = L.divIcon({
        className: 'label-container',
        html: labelHtml,
        iconSize: null,
        iconAnchor: [-10, 20]
    });

    // Add label marker
    data.label = L.marker([city.lat, city.lng], { icon: labelIcon }).addTo(map);
}

// Add city to map
function addCityMarker(cityName, personName) {
    const city = US_CITIES.find(c => c.name === cityName);
    if (!city) return;

    if (!markersData[cityName]) {
        // Create new marker
        const marker = L.circleMarker([city.lat, city.lng], {
            radius: 8,
            fillColor: '#3498db',
            color: '#2c3e50',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
        }).addTo(map);

        markersData[cityName] = {
            marker: marker,
            label: null,
            names: []
        };
    }

    // Add name if provided and not already in list
    if (personName && !markersData[cityName].names.includes(personName)) {
        markersData[cityName].names.push(personName);
    }

    updateMarkerLabel(cityName);
    renderMarkersList();
}

// Remove city from map
function removeCityMarker(cityName) {
    const data = markersData[cityName];
    if (data) {
        map.removeLayer(data.marker);
        if (data.label) {
            map.removeLayer(data.label);
        }
        delete markersData[cityName];
        renderMarkersList();
    }
}

// Remove name from city
function removeNameFromCity(cityName, personName) {
    const data = markersData[cityName];
    if (data) {
        data.names = data.names.filter(n => n !== personName);
        updateMarkerLabel(cityName);
        renderMarkersList();
    }
}

// Render the markers list UI
function renderMarkersList() {
    const cities = Object.keys(markersData).sort();

    if (cities.length === 0) {
        markersList.innerHTML = '<p class="empty-message">No cities marked yet. Add a city above!</p>';
        return;
    }

    markersList.innerHTML = cities.map(cityName => {
        const data = markersData[cityName];
        const namesHtml = data.names.length > 0
            ? data.names.map(name => `
                <span class="name-tag">
                    ${name}
                    <span class="remove-name" data-city="${cityName}" data-name="${name}">&times;</span>
                </span>
            `).join('')
            : '<span class="empty-message">No names added</span>';

        return `
            <div class="marker-item">
                <div class="marker-item-header">
                    <h3>${cityName}</h3>
                    <button class="remove-city-btn" data-city="${cityName}">Remove City</button>
                </div>
                <div class="names-list">${namesHtml}</div>
            </div>
        `;
    }).join('');

    // Add event listeners for remove buttons
    markersList.querySelectorAll('.remove-city-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            removeCityMarker(btn.dataset.city);
        });
    });

    markersList.querySelectorAll('.remove-name').forEach(btn => {
        btn.addEventListener('click', () => {
            removeNameFromCity(btn.dataset.city, btn.dataset.name);
        });
    });
}

// Event listeners
addBtn.addEventListener('click', () => {
    const cityName = citySelect.value;
    const personName = nameInput.value.trim();

    if (!cityName) {
        alert('Please select a city');
        return;
    }

    addCityMarker(cityName, personName);
    nameInput.value = '';
});

nameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        addBtn.click();
    }
});

// Initialize
populateCityDropdown();
renderMarkersList();
