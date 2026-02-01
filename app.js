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

    // Reset offsets only for labels that weren't manually positioned
    cities.forEach(cityName => {
        if (!markersData[cityName].manuallyPositioned) {
            markersData[cityName].offset = { x: 10, y: -20 };
        }
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

                    // Skip if the overlapping label was manually positioned
                    if (markersData[cities[j]].manuallyPositioned) {
                        // Try to move the first label instead if it's not manually positioned
                        if (!markersData[cities[i]].manuallyPositioned) {
                            let resolved = false;
                            for (const newOffset of offsetPositions) {
                                markersData[cities[i]].offset = { ...newOffset };
                                const newBoundsA = getLabelBounds(cities[i]);

                                let overlapsOther = false;
                                for (let k = 0; k < cities.length; k++) {
                                    if (k === i) continue;
                                    const boundsK = getLabelBounds(cities[k]);
                                    if (boundsK && rectsOverlap(newBoundsA, boundsK)) {
                                        overlapsOther = true;
                                        break;
                                    }
                                }

                                if (!overlapsOther) {
                                    resolved = true;
                                    break;
                                }
                            }

                            if (!resolved) {
                                const currentOffset = markersData[cities[i]].offset;
                                markersData[cities[i]].offset = {
                                    x: currentOffset.x,
                                    y: currentOffset.y + (iter + 1) * 30
                                };
                            }
                        }
                        continue;
                    }

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

// Update leader line for a city
function updateLeaderLine(cityName) {
    const data = markersData[cityName];
    if (!data) return;

    const city = US_CITIES.find(c => c.name === cityName);
    if (!city) return;

    // Remove existing leader line
    if (data.leaderLine) {
        map.removeLayer(data.leaderLine);
        data.leaderLine = null;
    }

    const offset = data.offset || { x: 10, y: -20 };
    const offsetDistance = Math.sqrt(offset.x * offset.x + offset.y * offset.y);

    // Draw leader line if label is significantly offset
    if (offsetDistance > 30) {
        const markerPoint = map.latLngToContainerPoint([city.lat, city.lng]);
        const labelSize = estimateLabelSize(cityName, data.names);

        // Calculate label box bounds
        const labelLeft = markerPoint.x + offset.x;
        const labelRight = labelLeft + labelSize.width;
        const labelTop = markerPoint.y + offset.y;
        const labelBottom = labelTop + labelSize.height;
        const labelCenterX = labelLeft + labelSize.width / 2;
        const labelCenterY = labelTop + labelSize.height / 2;

        // Find the closest point on the label box edge to the marker
        let connectionPoint;

        // Determine which edge is closest based on marker position relative to label
        const markerX = markerPoint.x;
        const markerY = markerPoint.y;

        // Calculate distances to each edge's center
        const distToLeft = Math.abs(markerX - labelLeft);
        const distToRight = Math.abs(markerX - labelRight);
        const distToTop = Math.abs(markerY - labelTop);
        const distToBottom = Math.abs(markerY - labelBottom);

        // Determine if marker is more to the side or above/below
        const horizontalDist = Math.min(distToLeft, distToRight);
        const verticalDist = Math.min(distToTop, distToBottom);

        if (markerX < labelLeft) {
            // Marker is to the left of the label
            if (markerY < labelTop) {
                // Top-left: connect to top-left corner area
                connectionPoint = L.point(labelLeft, labelTop);
            } else if (markerY > labelBottom) {
                // Bottom-left: connect to bottom-left corner area
                connectionPoint = L.point(labelLeft, labelBottom);
            } else {
                // Directly left: connect to left edge at marker's Y level
                connectionPoint = L.point(labelLeft, Math.max(labelTop, Math.min(labelBottom, markerY)));
            }
        } else if (markerX > labelRight) {
            // Marker is to the right of the label
            if (markerY < labelTop) {
                // Top-right: connect to top-right corner area
                connectionPoint = L.point(labelRight, labelTop);
            } else if (markerY > labelBottom) {
                // Bottom-right: connect to bottom-right corner area
                connectionPoint = L.point(labelRight, labelBottom);
            } else {
                // Directly right: connect to right edge at marker's Y level
                connectionPoint = L.point(labelRight, Math.max(labelTop, Math.min(labelBottom, markerY)));
            }
        } else {
            // Marker is horizontally within the label bounds
            if (markerY < labelTop) {
                // Above: connect to top edge
                connectionPoint = L.point(Math.max(labelLeft, Math.min(labelRight, markerX)), labelTop);
            } else if (markerY > labelBottom) {
                // Below: connect to bottom edge
                connectionPoint = L.point(Math.max(labelLeft, Math.min(labelRight, markerX)), labelBottom);
            } else {
                // Marker is inside label bounds - connect to center
                connectionPoint = L.point(labelCenterX, labelCenterY);
            }
        }

        const connectionLatLng = map.containerPointToLatLng(connectionPoint);

        data.leaderLine = L.polyline([[city.lat, city.lng], connectionLatLng], {
            color: '#999',
            weight: 1,
            dashArray: '3, 3',
            interactive: false
        }).addTo(map);
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

    // Add label marker (draggable)
    data.label = L.marker([city.lat, city.lng], {
        icon: labelIcon,
        draggable: true,
        autoPan: false
    }).addTo(map);

    // Handle drag events
    data.label.on('drag', function(e) {
        const markerPoint = map.latLngToContainerPoint([city.lat, city.lng]);
        const labelPoint = map.latLngToContainerPoint(e.latlng);

        // Calculate new offset
        data.offset = {
            x: labelPoint.x - markerPoint.x,
            y: labelPoint.y - markerPoint.y
        };

        // Update leader line during drag
        updateLeaderLine(cityName);
    });

    data.label.on('dragend', function(e) {
        const markerPoint = map.latLngToContainerPoint([city.lat, city.lng]);
        const labelPoint = map.latLngToContainerPoint(e.target.getLatLng());

        // Store final offset
        data.offset = {
            x: labelPoint.x - markerPoint.x,
            y: labelPoint.y - markerPoint.y
        };
        data.manuallyPositioned = true; // Mark as manually positioned

        updateLeaderLine(cityName);
    });

    // Draw leader line
    updateLeaderLine(cityName);

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
