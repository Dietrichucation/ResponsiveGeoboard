document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('geoboard-canvas');
    const ctx = canvas.getContext('2d');
    const perimeterDisplay = document.getElementById('perimeter-display');
    const areaDisplay = document.getElementById('area-display');
    const intersectionDisplay = document.getElementById('intersection-display');
    const clearButton = document.getElementById('clear-button');
    const colorButtons = document.querySelectorAll('.color-button');

    // --- Configuration ---
    const GRID_SPACING = 40;
    const PEG_RADIUS = 3;
    const PEG_COLOR = 'white';
    const LINE_WIDTH = 3;
    const SNAP_THRESHOLD = 15;
    const DRAG_THRESHOLD = 10;
    const FILL_ALPHA = 0.3;
    const INTERSECTION_COLOR = 'rgba(142, 68, 173, 0.6)';
    const DEFAULT_COLOR = '#f1c40f';

    // --- State Variables ---
    let polygons = [];
    let selectedColor = DEFAULT_COLOR;
    let currentPolygonIndex = -1; // -1 means no polygon is actively being drawn

    // --- Drag State ---
    let isDragging = false;
    let draggedPolygonIndex = -1;
    let draggedVertexIndex = -1;
    // *** NEW: Flag to track if the last action was a drag ***
    let justDragged = false;

    // --- Geometry Functions --- (Unchanged from previous version)
    function calculateDistance(p1, p2) { if (!p1 || !p2 || typeof p1.x === 'undefined' || typeof p1.y === 'undefined' || typeof p2.x === 'undefined' || typeof p2.y === 'undefined') return Infinity; return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2)); }
    function calculatePerimeter(verts, closed) { let perimeter = 0; if (!verts || verts.length < 2) return 0; for (let i = 0; i < verts.length - 1; i++) { perimeter += calculateDistance(verts[i], verts[i + 1]); } if (closed && verts.length > 1) { perimeter += calculateDistance(verts[verts.length - 1], verts[0]); } return perimeter; }
    function calculateArea(verts) { let area = 0; if (!verts) return 0; const n = verts.length; if (n < 3) return 0; for (let i = 0; i < n; i++) { const p1 = verts[i]; const p2 = verts[(i + 1) % n]; if (!p1 || !p2) return 0; area += (p1.x * p2.y - p2.x * p1.y); } return Math.abs(area) / 2.0; }
    function hexToRgba(hex, alpha = 1) { /* ... Unchanged ... */ if (!hex || typeof hex !== 'string') return `rgba(200, 200, 200, ${alpha})`; let r = 0, g = 0, b = 0; if (hex.length === 4) { r = parseInt(hex[1] + hex[1], 16); g = parseInt(hex[2] + hex[2], 16); b = parseInt(hex[3] + hex[3], 16); } else if (hex.length === 7) { r = parseInt(hex[1] + hex[2], 16); g = parseInt(hex[3] + hex[4], 16); b = parseInt(hex[5] + hex[6], 16); } else { return `rgba(200, 200, 200, ${alpha})`; } return `rgba(${r}, ${g}, ${b}, ${alpha})`; }
    function getBoundingBox(verts) { /* ... Unchanged ... */ if (!verts || verts.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 }; let minX = verts[0].x, minY = verts[0].y, maxX = verts[0].x, maxY = verts[0].y; for (let i = 1; i < verts.length; i++) { minX = Math.min(minX, verts[i].x); minY = Math.min(minY, verts[i].y); maxX = Math.max(maxX, verts[i].x); maxY = Math.max(maxY, verts[i].y); } return { minX, minY, maxX, maxY }; }
    function boundingBoxesOverlap(bb1, bb2) { /* ... Unchanged ... */ return bb1.minX < bb2.maxX && bb1.maxX > bb2.minX && bb1.minY < bb2.maxY && bb1.maxY > bb2.minY; }

    // --- Drawing Functions --- (Unchanged from previous version)
    function drawGrid() { /* ... Unchanged ... */ ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = '#2c3e50'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.strokeStyle = '#445566'; ctx.lineWidth = 0.5; for (let x = 0; x <= canvas.width; x += GRID_SPACING) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); if (x >= GRID_SPACING && x < canvas.width) drawPeg(x, 0); } for (let y = 0; y <= canvas.height; y += GRID_SPACING) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); if (y >= GRID_SPACING && y < canvas.height) drawPeg(0, y); for (let x = GRID_SPACING; x < canvas.width; x += GRID_SPACING) { if (y >= GRID_SPACING && y < canvas.height) drawPeg(x, y); } } drawPeg(0, 0); ctx.fillStyle = '#ccc'; ctx.font = '10px sans-serif'; for (let i = 1; i * GRID_SPACING < canvas.width; i++) ctx.fillText(i, i * GRID_SPACING - 3, 12); for (let i = 1; i * GRID_SPACING < canvas.height; i++) ctx.fillText(i, 5, i * GRID_SPACING + 4); }
    function drawPeg(x, y) { /* ... Unchanged ... */ ctx.beginPath(); ctx.arc(x, y, PEG_RADIUS, 0, Math.PI * 2); ctx.fillStyle = PEG_COLOR; ctx.fill(); }
    function drawSinglePolygon(polygon, index) { /* ... Unchanged ... */ const verts = polygon.vertices; if (verts.length < 1) return; ctx.strokeStyle = polygon.color; ctx.lineWidth = LINE_WIDTH; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(verts[0].x, verts[0].y); for (let i = 1; i < verts.length; i++) { ctx.lineTo(verts[i].x, verts[i].y); } if (polygon.isClosed && verts.length > 1) { ctx.closePath(); } ctx.stroke(); if (polygon.isClosed && verts.length >= 3) { let rgbaColor = hexToRgba(polygon.color, FILL_ALPHA); ctx.fillStyle = rgbaColor; ctx.beginPath(); ctx.moveTo(verts[0].x, verts[0].y); for (let i = 1; i < verts.length; i++) { ctx.lineTo(verts[i].x, verts[i].y); } ctx.closePath(); ctx.fill(); } verts.forEach((v, vertexIdx) => { const isDragged = (isDragging && index === draggedPolygonIndex && vertexIdx === draggedVertexIndex); ctx.beginPath(); ctx.arc(v.x, v.y, PEG_RADIUS + (isDragged ? 3 : 1), 0, Math.PI * 2); ctx.fillStyle = isDragged ? 'red' : polygon.color; ctx.fill(); }); }
    function drawIntersections() { /* ... Unchanged Placeholder ... */ let intersectionAreaTotal = 0; intersectionDisplay.textContent = `Intersection Area: N/A`; let closedPolygons = polygons.filter(p => p.isClosed && p.vertices.length >= 3); if (closedPolygons.length < 2) return; ctx.fillStyle = INTERSECTION_COLOR; for (let i = 0; i < closedPolygons.length; i++) { for (let j = i + 1; j < closedPolygons.length; j++) { let poly1 = closedPolygons[i]; let poly2 = closedPolygons[j]; let bb1 = getBoundingBox(poly1.vertices); let bb2 = getBoundingBox(poly2.vertices); if (boundingBoxesOverlap(bb1, bb2)) { let overlapX = Math.max(bb1.minX, bb2.minX); let overlapY = Math.max(bb1.minY, bb2.minY); let overlapMaxX = Math.min(bb1.maxX, bb2.maxX); let overlapMaxY = Math.min(bb1.maxY, bb2.maxY); let overlapW = overlapMaxX - overlapX; let overlapH = overlapMaxY - overlapY; if (overlapW > 0 && overlapH > 0) { ctx.beginPath(); ctx.rect(overlapX, overlapY, overlapW, overlapH); ctx.fill(); let approxIntersectionArea = (overlapW * overlapH) / (GRID_SPACING * GRID_SPACING); intersectionAreaTotal += approxIntersectionArea; } } } } if (intersectionAreaTotal > 0) { intersectionDisplay.textContent = `Intersection Area: ${intersectionAreaTotal.toFixed(2)} sq. units (Approx)`; } else { intersectionDisplay.textContent = `Intersection Area: 0.00 sq. units`; } }
    function redrawCanvas() { /* ... Unchanged ... */ drawGrid(); polygons.forEach((poly, index) => { if (index !== currentPolygonIndex) { drawSinglePolygon(poly, index); } }); if (currentPolygonIndex !== -1 && polygons[currentPolygonIndex]) { drawSinglePolygon(polygons[currentPolygonIndex], currentPolygonIndex); } drawIntersections(); }

    // --- UI Update Functions --- (Unchanged from previous version)
    function updateCalculations() { /* ... Unchanged ... */ let totalPerimeter = 0; let totalArea = 0; polygons.forEach(poly => { totalPerimeter += calculatePerimeter(poly.vertices, poly.isClosed); if (poly.isClosed) { totalArea += calculateArea(poly.vertices); } }); const perimeterUnits = totalPerimeter / GRID_SPACING; const areaUnits = totalArea / (GRID_SPACING * GRID_SPACING); perimeterDisplay.textContent = `Total Perimeter: ${perimeterUnits.toFixed(2)} units`; areaDisplay.textContent = `Total Area (Sum): ${areaUnits.toFixed(2)} sq. units`; }

    // --- Event Handlers ---

    function getMousePos(event) { /* Unchanged */ const rect = canvas.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top }; }
    function snapToGrid(mouseX, mouseY) { /* Unchanged */ const gridX = Math.round(mouseX / GRID_SPACING); const gridY = Math.round(mouseY / GRID_SPACING); const snappedX = gridX * GRID_SPACING; const snappedY = gridY * GRID_SPACING; const canvasWidth = canvas.width; const canvasHeight = canvas.height; const clampedX = Math.max(0, Math.min(snappedX, canvasWidth - (canvasWidth % GRID_SPACING === 0 ? 0 : GRID_SPACING))); const clampedY = Math.max(0, Math.min(snappedY, canvasHeight - (canvasHeight % GRID_SPACING === 0 ? 0 : GRID_SPACING))); if (mouseX < -GRID_SPACING/2 || mouseX > canvas.width + GRID_SPACING/2 || mouseY < -GRID_SPACING/2 || mouseY > canvas.height + GRID_SPACING/2) return null; return { x: clampedX, y: clampedY }; }

    function findVertexNear(pos) { // Unchanged
        for (let i = 0; i < polygons.length; i++) {
            const verts = polygons[i].vertices;
            for (let j = 0; j < verts.length; j++) {
                if (calculateDistance(pos, verts[j]) < DRAG_THRESHOLD) {
                    return { polygonIndex: i, vertexIndex: j };
                }
            }
        }
        return null;
    }

    function handleMouseDown(event) { // Minor Change: Reset justDragged flag
        justDragged = false; // Reset flag on new mousedown
        const mousePos = getMousePos(event);
        const clickedVertexInfo = findVertexNear(mousePos);

        if (clickedVertexInfo) {
            isDragging = true;
            draggedPolygonIndex = clickedVertexInfo.polygonIndex;
            draggedVertexIndex = clickedVertexInfo.vertexIndex;
            canvas.style.cursor = 'grabbing';
            redrawCanvas();
        } else {
            isDragging = false; // Ensure isDragging is false if not clicking a vertex
            // Ensure drag indices are reset if not starting a drag
            draggedPolygonIndex = -1;
            draggedVertexIndex = -1;
        }
    }

    function handleMouseMove(event) { // Unchanged
        const mousePos = getMousePos(event);
        if (!isDragging || draggedPolygonIndex === -1) {
            canvas.style.cursor = findVertexNear(mousePos) ? 'grab' : 'crosshair';
            return;
        }

        canvas.style.cursor = 'grabbing';
        const snappedPoint = snapToGrid(mousePos.x, mousePos.y);

        if (snappedPoint && polygons[draggedPolygonIndex]) {
            const currentVertex = polygons[draggedPolygonIndex].vertices[draggedVertexIndex];
             if (snappedPoint.x !== currentVertex.x || snappedPoint.y !== currentVertex.y) {
                polygons[draggedPolygonIndex].vertices[draggedVertexIndex] = snappedPoint;
                redrawCanvas();
                updateCalculations();
            }
        }
    }

     function handleMouseUp(event) { // Minor Change: Set justDragged flag
        if (isDragging) {
            isDragging = false;
             justDragged = true; // *** Mark that a drag just ended ***
            // Keep dragged indices for potential immediate click check, reset later
            canvas.style.cursor = 'crosshair';
            redrawCanvas();
            updateCalculations();
        }
         // Resetting indices here might be too soon if click follows instantly
         // draggedPolygonIndex = -1;
         // draggedVertexIndex = -1;
    }

    function handleMouseLeave(event) { // Unchanged
         if (isDragging) handleMouseUp(event);
         canvas.style.cursor = 'crosshair';
    }

    function handleCanvasClick(event) { // UPDATED LOGIC
        // *** If the last action was a drag ending, consume this click event and reset ***
        if (justDragged) {
            justDragged = false; // Reset the flag
            // Reset drag indices now that the click after drag is consumed
            draggedPolygonIndex = -1;
            draggedVertexIndex = -1;
            console.log("Click consumed after drag.");
            return;
        }

        // *** Reset drag indices if click happens without a preceding drag ***
        // This ensures that if a user clicks without dragging first, the old drag indices don't interfere
         if (!isDragging) {
            draggedPolygonIndex = -1;
            draggedVertexIndex = -1;
        }


        const mousePos = getMousePos(event);
        // If click is on an existing vertex, do nothing (mousedown handles drag start)
        if (findVertexNear(mousePos)) {
            console.log("Click near vertex, ignoring for add point.");
            return;
        }

        const snappedPoint = snapToGrid(mousePos.x, mousePos.y);
        if (!snappedPoint) {
            console.log("Click outside grid.");
             // If clicking outside while drawing, potentially cancel drawing? (Optional feature)
             // if(currentPolygonIndex !== -1 && !polygons[currentPolygonIndex].isClosed) {
             //    polygons.pop(); // Remove incomplete polygon
             //    currentPolygonIndex = -1;
             //    redrawCanvas();
             //    updateCalculations();
             // }
            return;
        }

        console.log(`Click at (${snappedPoint.x}, ${snappedPoint.y}). Current Index: ${currentPolygonIndex}, Selected Color: ${selectedColor}`);

        // --- Logic for Adding Points ---
        if (currentPolygonIndex === -1) {
            // Start a new polygon
            const newPolygon = {
                vertices: [snappedPoint],
                color: selectedColor,
                isClosed: false
            };
            polygons.push(newPolygon);
            currentPolygonIndex = polygons.length - 1;
            console.log(`Started polygon ${currentPolygonIndex}`);

        } else {
            // Add point to the currently active polygon
            const currentPoly = polygons[currentPolygonIndex];
            const verts = currentPoly.vertices;

            // Check if closing the shape
            if (verts.length >= 2) {
                 const distToStart = calculateDistance(snappedPoint, verts[0]);
                 if (distToStart < SNAP_THRESHOLD) {
                     const lastPoint = verts[verts.length - 1];
                      if (snappedPoint.x !== lastPoint.x || snappedPoint.y !== lastPoint.y) {
                           currentPoly.isClosed = true;
                           console.log(`Closed polygon ${currentPolygonIndex}`);
                           currentPolygonIndex = -1; // Finish drawing this polygon
                      } else {
                           console.log("Clicked exactly on last point while trying to close - ignored.");
                      }
                 } else {
                      // Add the new point if not identical to the last
                     if (!(snappedPoint.x === verts[verts.length - 1].x && snappedPoint.y === verts[verts.length - 1].y)) {
                         verts.push(snappedPoint);
                         console.log(`Added point to polygon ${currentPolygonIndex}`);
                     } else {
                          console.log("Clicked exactly on last point - ignored.");
                     }
                 }
            } else {
                 // Add the second point (or first if somehow started empty)
                 if (verts.length === 0 || !(snappedPoint.x === verts[verts.length - 1].x && snappedPoint.y === verts[verts.length - 1].y)) {
                      verts.push(snappedPoint);
                      console.log(`Added point to polygon ${currentPolygonIndex}`);
                 } else {
                      console.log("Clicked exactly on last point - ignored.");
                 }
            }
        }

        redrawCanvas();
        updateCalculations();
    }

    function handleClear() { // Minor update to reset new flag
        polygons = [];
        currentPolygonIndex = -1;
        isDragging = false;
        draggedPolygonIndex = -1;
        draggedVertexIndex = -1;
        justDragged = false; // Reset flag
        redrawCanvas();
        updateCalculations();
        intersectionDisplay.textContent = `Intersection Area: N/A`;
        console.log("Board cleared");
    }

    function handleColorSelect(event) { // Unchanged
         selectedColor = event.target.dataset.color;
         console.log("Selected color:", selectedColor);
         colorButtons.forEach(btn => btn.classList.remove('selected'));
         event.target.classList.add('selected');
    }


    // --- Initialization --- (Unchanged)
    clearButton.addEventListener('click', handleClear);
    canvas.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseLeave);
    canvas.addEventListener('click', handleCanvasClick); // This listener remains crucial

    colorButtons.forEach(button => {
        button.addEventListener('click', handleColorSelect);
        if (button.dataset.color === DEFAULT_COLOR) {
             button.classList.add('selected');
        }
    });

    redrawCanvas();
    updateCalculations();

});
