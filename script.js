// Add this check RIGHT AT THE START of the main event listener
document.addEventListener('DOMContentLoaded', () => {
    // Turf check is no longer needed, can be removed or commented out.
    // console.log(`Initial Check: Turf library loaded? Type: ${typeof turf}`);

    const canvas = document.getElementById('geoboard-canvas');
    const ctx = canvas.getContext('2d');
    const perimeterDisplay = document.getElementById('perimeter-display');
    const areaDisplay = document.getElementById('area-display');
    // const intersectionDisplay = document.getElementById('intersection-display'); // REMOVED
    const clearButton = document.getElementById('clear-button');
    const colorButtons = document.querySelectorAll('.color-button');
    const figuresListDiv = document.getElementById('figures-list');

    // --- Configuration ---
    const GRID_SPACING = 40;
    const PEG_RADIUS = 3;
    const PEG_COLOR = 'white';
    const LINE_WIDTH = 3;
    const SNAP_THRESHOLD = 15;
    const DRAG_THRESHOLD = 10;
    const FILL_ALPHA = 0.3;
    const DEFAULT_COLOR = '#f1c40f';

    // --- State Variables ---
    let polygons = [];
    let selectedColor = DEFAULT_COLOR;
    let currentPolygonIndex = -1;

    // --- Drag State ---
    let isDragging = false;
    let draggedPolygonIndex = -1;
    let draggedVertexIndex = -1;
    let justDragged = false;


    // --- Geometry Functions ---
    function calculateDistance(p1, p2) {
        if (!p1 || !p2 || typeof p1.x === 'undefined' || typeof p1.y === 'undefined' || typeof p2.x === 'undefined' || typeof p2.y === 'undefined') return Infinity;
        return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
    }

    function calculatePerimeter(verts, closed) {
        let perimeter = 0;
        if (!verts || verts.length < 2) return 0;
        for (let i = 0; i < verts.length - 1; i++) {
            perimeter += calculateDistance(verts[i], verts[i + 1]);
        }
        if (closed && verts.length > 1) {
            perimeter += calculateDistance(verts[verts.length - 1], verts[0]);
        }
        return perimeter;
    }

    // Shoelace Formula for Polygon Area
    function calculateArea(verts) {
        let area = 0;
        if (!verts) return 0;
        const n = verts.length;
        if (n < 3) return 0;
        for (let i = 0; i < n; i++) {
            const p1 = verts[i];
            const p2 = verts[(i + 1) % n];
            if (!p1 || !p2 || typeof p1.x === 'undefined' || typeof p1.y === 'undefined' || typeof p2.x === 'undefined' || typeof p2.y === 'undefined') {
                 console.error("Shoelace: Invalid vertex data found at index", i, p1, p2);
                 return NaN; // Return NaN if data is bad
            }
            area += (p1.x * p2.y - p2.x * p1.y);
        }
        const finalArea = Math.abs(area) / 2.0;
        return finalArea; // Return potential NaN
    }


    // Helper to convert hex color to rgba
    function hexToRgba(hex, alpha = 1) {
        if (!hex || typeof hex !== 'string') return `rgba(200, 200, 200, ${alpha})`;
        let r=0,g=0,b=0; if(hex.length === 4){r=parseInt(hex[1]+hex[1],16);g=parseInt(hex[2]+hex[2],16);b=parseInt(hex[3]+hex[3],16);} else if(hex.length === 7){r=parseInt(hex[1]+hex[2],16);g=parseInt(hex[3]+hex[4],16);b=parseInt(hex[5]+hex[6],16);} else { return `rgba(200, 200, 200, ${alpha})`;} return `rgba(${r},${g},${b},${alpha})`;}

    // --- REMOVED Turf Helper Functions ---
    // toTurfPolygonFormat
    // drawTurfGeometry
    // drawCanvasRing


    // --- Drawing Functions ---

    function drawGrid() { /* ... (no changes needed from previous correct version) ... */ ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = '#2c3e50'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.strokeStyle = '#445566'; ctx.lineWidth = 0.5; for (let x = 0; x <= canvas.width; x += GRID_SPACING) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); for (let y = GRID_SPACING; y <= canvas.height; y += GRID_SPACING) { if(x >= 0 && x <= canvas.width && y >= 0 && y <= canvas.height) drawPeg(x, y); } } for (let y = 0; y <= canvas.height; y += GRID_SPACING) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); for (let x = 0; x <= canvas.width; x += GRID_SPACING) { if(x >= 0 && x <= canvas.width && y >= 0 && y <= canvas.height && y > 0) drawPeg(x, y); } if(y === 0) { for (let x = 0; x <= canvas.width; x += GRID_SPACING) { if(x >= 0 && x <= canvas.width && y >= 0 && y <= canvas.height) drawPeg(x, y); }} } ctx.fillStyle = '#ccc'; ctx.font = '10px sans-serif'; for (let i = 1; i * GRID_SPACING <= canvas.width; i++) ctx.fillText(i, i * GRID_SPACING - 3, 12); for (let i = 1; i * GRID_SPACING <= canvas.height; i++) ctx.fillText(i, 5, i * GRID_SPACING + 4); }
    function drawPeg(x, y) { /* ... (no changes needed from previous correct version) ... */ ctx.beginPath(); ctx.arc(x, y, PEG_RADIUS, 0, Math.PI * 2); ctx.fillStyle = PEG_COLOR; ctx.fill(); }
    function drawSinglePolygon(polygon, index) { /* ... (no changes needed from previous correct version) ... */ const verts = polygon.vertices; if (verts.length < 1) return; ctx.strokeStyle = polygon.color; ctx.lineWidth = LINE_WIDTH; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(verts[0].x, verts[0].y); for (let i = 1; i < verts.length; i++) { ctx.lineTo(verts[i].x, verts[i].y); } if (polygon.isClosed && verts.length > 1) { ctx.closePath(); } ctx.stroke(); if (polygon.isClosed && verts.length >= 3) { let rgbaColor = hexToRgba(polygon.color, FILL_ALPHA); ctx.fillStyle = rgbaColor; ctx.beginPath(); ctx.moveTo(verts[0].x, verts[0].y); for (let i = 1; i < verts.length; i++) { ctx.lineTo(verts[i].x, verts[i].y); } ctx.closePath(); ctx.fill(); } verts.forEach((v, vertexIdx) => { const isDragged = (isDragging && index === draggedPolygonIndex && vertexIdx === draggedVertexIndex); ctx.beginPath(); ctx.arc(v.x, v.y, PEG_RADIUS + (isDragged ? 3 : 1), 0, Math.PI * 2); ctx.fillStyle = isDragged ? 'red' : polygon.color; ctx.fill(); }); }

    // --- REMOVED drawIntersections function ---


    // Modified redrawCanvas to REMOVE call to drawIntersections
    function redrawCanvas() {
        drawGrid(); // Base layer
        polygons.forEach((poly, index) => { drawSinglePolygon(poly, index); }); // Draw all polygons
        // No call to drawIntersections here anymore
    }


    // --- UI Update Functions ---
    // Version using only Shoelace for main Area calculations + NaN checks
    function updateCalculations() {
        let totalPerimeter = 0; // Sum of perimeters in PIXELS
        let totalArea = 0;      // Sum of areas in SQ PIXELS

        figuresListDiv.innerHTML = ''; // Clear previous individual figures display

        polygons.forEach((poly, index) => {
            let figureLabel = `Figure ${index + 1}`;

            // --- Perimeter ---
            const singlePerimeterPixels = calculatePerimeter(poly.vertices, poly.isClosed);
            totalPerimeter += singlePerimeterPixels;
            const singlePerimeterUnits = singlePerimeterPixels / GRID_SPACING;

            // --- Area (USING SHOELACE ONLY with NaN check) ---
            let singleAreaPixels = 0;
            if (poly.isClosed && poly.vertices.length >= 3) {
                 // console.log(`Calculating area for ${figureLabel} using Shoelace...`); // Optional logging
                 singleAreaPixels = calculateArea(poly.vertices);
                 singleAreaPixels = Math.abs(singleAreaPixels);
                 if (isNaN(singleAreaPixels)) {
                    console.error(`!!! NaN detected for singleAreaPixels for ${figureLabel}.`); singleAreaPixels = 0;
                 }
                 totalArea += singleAreaPixels;
            }

            const singleAreaUnits = singleAreaPixels / (GRID_SPACING * GRID_SPACING);

            // --- Display Individual Figure ---
            const figureDiv = document.createElement('div');
            figureDiv.classList.add('figure-details');
            figureDiv.innerHTML = `
                <strong>${figureLabel}:</strong>
                Perimeter: ${singlePerimeterUnits.toFixed(2)} units,
                Area: ${singleAreaUnits.toFixed(2)} sq. units
            `;
            figuresListDiv.appendChild(figureDiv);
        });

        // --- Display Totals ---
        const totalPerimeterUnits = totalPerimeter / GRID_SPACING;

        const gridSpacingSq = GRID_SPACING * GRID_SPACING;
        let totalAreaSumUnits = 0;
        if (gridSpacingSq !== 0 && !isNaN(totalArea)) {
            totalAreaSumUnits = totalArea / gridSpacingSq;
        } else {
             console.error(`!!! Error scaling total area...`);
        }

        perimeterDisplay.textContent = `Total Perimeter (Sum): ${totalPerimeterUnits.toFixed(2)} units`;
        areaDisplay.textContent = `Total Area (Sum): ${totalAreaSumUnits.toFixed(2)} sq. units`;

        // No intersection display to update
    }


    // --- Event Handlers ---
    // (No changes needed in these from the previous correct version)
    function getMousePos(event) { const rect = canvas.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top }; }
    function snapToGrid(mouseX, mouseY) { const gridX = Math.round(mouseX / GRID_SPACING); const gridY = Math.round(mouseY / GRID_SPACING); const snappedX = gridX * GRID_SPACING; const snappedY = gridY * GRID_SPACING; const clampedX = Math.max(0, Math.min(snappedX, canvas.width)); const clampedY = Math.max(0, Math.min(snappedY, canvas.height)); return { x: clampedX, y: clampedY }; }
    function findVertexNear(pos) { for (let i = 0; i < polygons.length; i++) { for (let j = 0; j < polygons[i].vertices.length; j++) { if (calculateDistance(pos, polygons[i].vertices[j]) < DRAG_THRESHOLD) { return { polygonIndex: i, vertexIndex: j }; } } } return null; }
    function handleMouseDown(event) { justDragged = false; const mousePos = getMousePos(event); const clickedVertexInfo = findVertexNear(mousePos); if (clickedVertexInfo) { isDragging = true; draggedPolygonIndex = clickedVertexInfo.polygonIndex; draggedVertexIndex = clickedVertexInfo.vertexIndex; canvas.style.cursor = 'grabbing'; redrawCanvas(); } else { isDragging = false; draggedPolygonIndex = -1; draggedVertexIndex = -1; } }
    function handleMouseMove(event) { const mousePos = getMousePos(event); if (!isDragging || draggedPolygonIndex === -1) { canvas.style.cursor = findVertexNear(mousePos) ? 'grab' : 'crosshair'; return; } canvas.style.cursor = 'grabbing'; const snappedPoint = snapToGrid(mousePos.x, mousePos.y); if (snappedPoint && polygons[draggedPolygonIndex]) { const currentVertex = polygons[draggedPolygonIndex].vertices[draggedVertexIndex]; if (snappedPoint.x !== currentVertex.x || snappedPoint.y !== currentVertex.y) { polygons[draggedPolygonIndex].vertices[draggedVertexIndex] = snappedPoint; redrawCanvas(); updateCalculations(); } } }
    function handleMouseUp(event) { if (isDragging) { isDragging = false; justDragged = true; canvas.style.cursor = 'crosshair'; redrawCanvas(); updateCalculations(); } }
    function handleMouseLeave(event) { if (isDragging) handleMouseUp(event); canvas.style.cursor = 'crosshair'; }
    function handleCanvasClick(event) { if (justDragged) { justDragged = false; draggedPolygonIndex = -1; draggedVertexIndex = -1; return; } if (!isDragging) { draggedPolygonIndex = -1; draggedVertexIndex = -1; } const mousePos = getMousePos(event); if (findVertexNear(mousePos)) return; const snappedPoint = snapToGrid(mousePos.x, mousePos.y); if (!snappedPoint) return; if (currentPolygonIndex === -1) { polygons.push({ vertices: [snappedPoint], color: selectedColor, isClosed: false }); currentPolygonIndex = polygons.length - 1; } else { const currentPoly = polygons[currentPolygonIndex]; const verts = currentPoly.vertices; if (verts.length >= 2) { const distToStart = calculateDistance(snappedPoint, verts[0]); if (distToStart < SNAP_THRESHOLD) { const lastPoint = verts[verts.length - 1]; if (snappedPoint.x !== lastPoint.x || snappedPoint.y !== lastPoint.y) { currentPoly.isClosed = true; currentPolygonIndex = -1; } } else { if (!(snappedPoint.x === verts[verts.length - 1].x && snappedPoint.y === verts[verts.length - 1].y)) { verts.push(snappedPoint); } } } else { if (verts.length === 0 || !(snappedPoint.x === verts[verts.length - 1].x && snappedPoint.y === verts[verts.length - 1].y)) { verts.push(snappedPoint); } } } redrawCanvas(); updateCalculations(); }
    function handleClear() { polygons = []; currentPolygonIndex = -1; isDragging = false; draggedPolygonIndex = -1; draggedVertexIndex = -1; justDragged = false; if(figuresListDiv) figuresListDiv.innerHTML = ''; redrawCanvas(); updateCalculations(); /* intersectionDisplay.textContent = `Total Intersection Area: N/A`; */ console.log("Board cleared"); } // Removed intersection display reset
    function handleColorSelect(event) { selectedColor = event.target.dataset.color; colorButtons.forEach(btn => btn.classList.remove('selected')); event.target.classList.add('selected'); }

    // --- Initialization ---
    clearButton.addEventListener('click', handleClear);
    canvas.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseLeave);
    canvas.addEventListener('click', handleCanvasClick);

    colorButtons.forEach(button => {
        button.addEventListener('click', handleColorSelect);
        if (button.dataset.color === DEFAULT_COLOR) { button.classList.add('selected'); }
    });

    redrawCanvas();
    updateCalculations();

}); // End of DOMContentLoaded listener
