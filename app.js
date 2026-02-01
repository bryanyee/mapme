// Initialize map centered on the US
const map = L.map('map').setView([39.8283, -98.5795], 4);

// Add OpenStreetMap tiles
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// Store markers data: { cityName: { marker, label, names: [], offset: {x, y} } }
const markersData = {};

// Collision detection settings
const LABEL_PADDING = 5; // Pixels of padding between labels

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

// Estimate label dimensions based on content
function estimateLabelSize(cityName, names) {
    const cityTextWidth = cityName.length * 7 + 16; // Approximate character width + padding
    const namesText = names.join(', ');
    const namesTextWidth = namesText.length * 6 + 16;
    const width = Math.max(cityTextWidth, namesTextWidth, 80);
    const height = names.length > 0 ? 42 : 26; // Height depends on whether names exist
    return { width, height };
}

// Get label bounding box in pixel coordinates
function getLabelBounds(cityName) {
    const data = markersData[cityName];
    if (!data) return null;

    const city = US_CITIES.find(c => c.name === cityName);
    if (!city) return null;

    const point = map.latLngToContainerPoint([city.lat, city.lng]);
    const size = estimateLabelSize(cityName, data.names);
    const offset = data.offset || { x: 10, y: -20 };

    return {
        cityName,
        left: point.x + offset.x,
        top: point.y + offset.y,
        right: point.x + offset.x + size.width,
        bottom: point.y + offset.y + size.height,
        width: size.width,
        height: size.height,
        anchorX: point.x,
        anchorY: point.y
    };
}

// Check if two rectangles overlap
function rectsOverlap(a, b) {
    return !(a.right + LABEL_PADDING < b.left ||
             b.right + LABEL_PADDING < a.left ||
             a.bottom + LABEL_PADDING < b.top ||
             b.bottom + LABEL_PADDING < a.top);
}

// Resolve overlaps by adjusting label offsets
function resolveOverlaps() {
    const cities = Object.keys(markersData);
    if (cities.length < 2) return;

    // Reset offsets
    cities.forEach(cityName => {
        markersData[cityName].offset = { x: 10, y: -20 };
    });

    // Possible offset positions (clockwise from right)
    const offsetPositions = [
        { x: 10, y: -20 },    // Right-top (default)
        { x: 10, y: 5 },      // Right-bottom
        { x: -100, y: -20 },  // Left-top
        { x: -100, y: 5 },    // Left-bottom
        { x: -45, y: -50 },   // Top-center
        { x: -45, y: 25 },    // Bottom-center
        { x: 15, y: -45 },    // Upper right
        { x: 15, y: 20 },     // Lower right
    ];

    // Iteratively resolve overlaps
    const maxIterations = 10;
    for (let iter = 0; iter < maxIterations; iter++) {
        let hasOverlap = false;

        for (let i = 0; i < cities.length; i++) {
            const boundsA = getLabelBounds(cities[i]);
            if (!boundsA) continue;

            for (let j = i + 1; j < cities.length; j++) {
                const boundsB = getLabelBounds(cities[j]);
                if (!boundsB) continue;

                if (rectsOverlap(boundsA, boundsB)) {
                    hasOverlap = true;

                    // Try different offset positions for the second label
                    let resolved = false;
                    for (const newOffset of offsetPositions) {
                        markersData[cities[j]].offset = { ...newOffset };
                        const newBoundsB = getLabelBounds(cities[j]);

                        // Check if new position overlaps with any existing label
                        let overlapsOther = false;
                        for (let k = 0; k < cities.length; k++) {
                            if (k === j) continue;
                            const boundsK = getLabelBounds(cities[k]);
                            if (boundsK && rectsOverlap(newBoundsB, boundsK)) {
                                overlapsOther = true;
                                break;
                            }
                        }

                        if (!overlapsOther) {
                            resolved = true;
                            break;
                        }
                    }

                    // If no position works, add progressive offset
                    if (!resolved) {
                        const currentOffset = markersData[cities[j]].offset;
                        markersData[cities[j]].offset = {
                            x: currentOffset.x,
                            y: currentOffset.y + (iter + 1) * 30
                        };
                    }
                }
            }
        }

        if (!hasOverlap) break;
    }
}

// Update all labels with collision detection
function updateAllLabels() {
    resolveOverlaps();

    Object.keys(markersData).forEach(cityName => {
        updateMarkerLabel(cityName, false);
    });
}

// Create or update marker label
function updateMarkerLabel(cityName, resolveCollisions = true) {
    const data = markersData[cityName];
    if (!data) return;

    const city = US_CITIES.find(c => c.name === cityName);
    if (!city) return;

    // Remove existing label and leader line if any
    if (data.label) {
        map.removeLayer(data.label);
    }
    if (data.leaderLine) {
        map.removeLayer(data.leaderLine);
    }

    // Get offset (default or calculated)
    const offset = data.offset || { x: 10, y: -20 };

    // Create label content
    const namesText = data.names.length > 0 ? data.names.join(', ') : '';
    const labelHtml = `
        <div class="city-label">
            <div class="city-name">${cityName}</div>
            ${namesText ? `<div class="person-names">${namesText}</div>` : ''}
        </div>
    `;

    // Create custom icon for label with dynamic offset
    const labelIcon = L.divIcon({
        className: 'label-container',
        html: labelHtml,
        iconSize: null,
        iconAnchor: [-offset.x, -offset.y]
    });

    // Add label marker
    data.label = L.marker([city.lat, city.lng], { icon: labelIcon, interactive: false }).addTo(map);

    // Draw leader line if label is significantly offset
    const offsetDistance = Math.sqrt(offset.x * offset.x + offset.y * offset.y);
    if (offsetDistance > 30) {
        const point = map.latLngToContainerPoint([city.lat, city.lng]);
        const labelPoint = L.point(point.x + offset.x, point.y + offset.y + 10);
        const labelLatLng = map.containerPointToLatLng(labelPoint);

        data.leaderLine = L.polyline([[city.lat, city.lng], labelLatLng], {
            color: '#999',
            weight: 1,
            dashArray: '3, 3',
            interactive: false
        }).addTo(map);
    }

    // Resolve collisions after updating (unless called from updateAllLabels)
    if (resolveCollisions && Object.keys(markersData).length > 1) {
        updateAllLabels();
    }
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
            leaderLine: null,
            names: [],
            offset: { x: 10, y: -20 }
        };
    }

    // Add name if provided and not already in list
    if (personName && !markersData[cityName].names.includes(personName)) {
        markersData[cityName].names.push(personName);
    }

    updateAllLabels();
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
        if (data.leaderLine) {
            map.removeLayer(data.leaderLine);
        }
        delete markersData[cityName];
        updateAllLabels();
        renderMarkersList();
    }
}

// Remove name from city
function removeNameFromCity(cityName, personName) {
    const data = markersData[cityName];
    if (data) {
        data.names = data.names.filter(n => n !== personName);
        updateAllLabels();
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

// Recalculate label positions when map zooms or moves
map.on('zoomend moveend', () => {
    if (Object.keys(markersData).length > 0) {
        updateAllLabels();
    }
});

// Initialize
populateCityDropdown();
renderMarkersList();
