// KEEP ALL OTHER FUNCTIONS THE SAME AS THE PREVIOUS FULL VERSION
// (calculateArea, updateCalculations, event handlers, etc.)

// Helper: Draw geometry returned by Turf.js on canvas (Used by intersection drawing)
 function drawTurfGeometry(geometry, ctx) {
    if (!geometry) { console.log("drawTurfGeometry received null geometry."); return; }
    // Assumes fillStyle is set before calling
    console.log(`  -> Drawing geometry type: ${geometry.type}`); // Log type being drawn
    if (geometry.type === 'Polygon') { drawCanvasRing(geometry.coordinates, ctx); }
    else if (geometry.type === 'MultiPolygon') { geometry.coordinates.forEach(coords => drawCanvasRing(coords, ctx)); }
    else { console.log(`  -> Not drawing type ${geometry.type}`); }
}

// Helper for drawTurfGeometry
function drawCanvasRing(rings, ctx) {
     console.log("    -> drawCanvasRing called."); // Log ring drawing start
     ctx.beginPath();
     rings.forEach((ring) => { // A ring is an array of [x, y] points
          if (ring.length >= 3) {
              ctx.moveTo(ring[0][0], ring[0][1]);
              for (let i = 1; i < ring.length; i++) { ctx.lineTo(ring[i][0], ring[i][1]); }
              ctx.closePath();
          } else {
              console.warn("    -> Invalid ring with < 3 points found:", ring);
          }
     });
     ctx.fill('evenodd'); // Handles holes correctly
     console.log("    -> drawCanvasRing finished fill."); // Log ring drawing end
}


// REVISED drawIntersections Function with MORE Logging
function drawIntersections() {
    console.log("--- drawIntersections START ---");
    let intersectionAreaTotalPixels = 0;
    let foundAnyDrawableIntersection = false; // Specifically track if we tried to draw
    intersectionDisplay.textContent = `Total Intersection Area: N/A`;

    // Ensure Turf is available globally
    if (typeof turf === 'undefined') {
         console.error("!!! Turf library is not loaded !!! Cannot calculate intersections.");
         intersectionDisplay.textContent = `Intersection Area: Error (Turf missing)`;
         console.log("--- drawIntersections END (Turf not loaded) ---");
         return; // EXIT EARLY
    }

    let closedPolygons = polygons.filter(p => p.isClosed && p.vertices.length >= 3);
    console.log(`Found ${closedPolygons.length} closed polygons for intersection check.`);

    if (closedPolygons.length < 2) {
        intersectionDisplay.textContent = `Total Intersection Area: 0.00 sq. units`;
        console.log("--- drawIntersections END (Not enough polygons) ---");
        return; // EXIT EARLY
    }


    ctx.fillStyle = INTERSECTION_COLOR;
    console.log(`Set fillStyle to: ${INTERSECTION_COLOR}`);

    for (let i = 0; i < closedPolygons.length; i++) {
        for (let j = i + 1; j < closedPolygons.length; j++) {
            const polyIndex1 = polygons.findIndex(p => p === closedPolygons[i]);
            const polyIndex2 = polygons.findIndex(p => p === closedPolygons[j]);
            console.log(`Checking intersection between Figure ${polyIndex1 + 1} and Figure ${polyIndex2 + 1}`);

            const turfPoly1 = toTurfPolygonFormat(closedPolygons[i].vertices);
            const turfPoly2 = toTurfPolygonFormat(closedPolygons[j].vertices);
            console.log(`  Format valid? Poly1: ${!!turfPoly1}, Poly2: ${!!turfPoly2}`);

            if (!turfPoly1 || !turfPoly2) {
                console.log("  Skipping pair due to invalid format.");
                continue;
            }

            try {
                console.log("  Calling turf.intersect...");
                const intersection = turf.intersect(turfPoly1, turfPoly2); // Returns Feature or null

                // Check if intersection exists and has valid geometry
                 if (intersection && intersection.geometry && intersection.geometry.coordinates && (intersection.geometry.type === 'Polygon' || intersection.geometry.type === 'MultiPolygon')) {
                    console.log("  Intersection Feature found. Type:", intersection.geometry.type);
                    console.log("  Attempting to draw intersection...");
                    drawTurfGeometry(intersection.geometry, ctx); // Draw the overlap shape
                    foundAnyDrawableIntersection = true;

                    const areaPixels = turf.area(intersection);
                    console.log(`  Calculated intersection area (px^2): ${areaPixels}`);
                    if (!isNaN(areaPixels)) {
                         intersectionAreaTotalPixels += areaPixels;
                    } else {
                        console.warn("  NaN area returned by turf.area for intersection.");
                    }
                 } else if (intersection) {
                     console.log(`  Intersection found but not drawable geometry. Type: ${intersection.geometry ? intersection.geometry.type : 'Unknown'}`);
                 } else {
                     console.log("  No intersection returned by turf.intersect.");
                 }
            } catch (e) {
                console.error(`  Error during turf.intersect or turf.area for Figures ${polyIndex1 + 1}/${polyIndex2 + 1}:`, e.message);
            }
        } // End inner loop (j)
    } // End outer loop (i)

    // Update display - ensure it defaults to 0.00 if no drawable intersections were found
    const intersectionAreaUnits = intersectionAreaTotalPixels / (GRID_SPACING * GRID_SPACING);
    if (isNaN(intersectionAreaUnits)) {
         console.error("!!! Final intersection area units is NaN!");
         intersectionDisplay.textContent = `Total Intersection Area: Error`;
    } else {
         intersectionDisplay.textContent = `Total Intersection Area: ${intersectionAreaUnits.toFixed(2)} sq. units`;
    }
    console.log(`--- drawIntersections END (Final Area Units: ${intersectionAreaUnits.toFixed(2)}) ---`);
}

// --- IMPORTANT: Ensure redrawCanvas calls drawIntersections LAST ---
function redrawCanvas() {
    drawGrid(); // Base layer
    polygons.forEach((poly, index) => { drawSinglePolygon(poly, index); }); // Draw all polygons
    drawIntersections(); // Draw intersections on top
}

// Add this check RIGHT AT THE START of the main event listener
document.addEventListener('DOMContentLoaded', () => {
    // Add this line right at the start
    console.log(`Initial Check: Turf library loaded? Type: ${typeof turf}`);
    // ... rest of your existing initialization code ...

    const canvas = document.getElementById('geoboard-canvas');
    // ... other const declarations ...
    const figuresListDiv = document.getElementById('figures-list');

    // Make sure ALL other functions (calculateDistance, calculateArea, drawGrid, etc.)
    // are defined correctly before they are called by event handlers or redrawCanvas.

    // --- FULL definition of updateCalculations using Shoelace (from previous correct version) ---
    function updateCalculations() {
        let totalPerimeter = 0; let totalArea = 0;
        figuresListDiv.innerHTML = '';
        polygons.forEach((poly, index) => {
            let figureLabel = `Figure ${index + 1}`;
            const singlePerimeterPixels = calculatePerimeter(poly.vertices, poly.isClosed);
            totalPerimeter += singlePerimeterPixels;
            const singlePerimeterUnits = singlePerimeterPixels / GRID_SPACING;
            let singleAreaPixels = 0;
            if (poly.isClosed && poly.vertices.length >= 3) {
                 // console.log(`Calculating area for ${figureLabel} using Shoelace. Vertices:`, JSON.stringify(poly.vertices)); // Less logging
                 singleAreaPixels = calculateArea(poly.vertices);
                 singleAreaPixels = Math.abs(singleAreaPixels);
                 if (isNaN(singleAreaPixels)) {
                    console.error(`!!! NaN detected for singleAreaPixels for ${figureLabel}.`); singleAreaPixels = 0;
                 }
                 totalArea += singleAreaPixels;
            }
            const singleAreaUnits = singleAreaPixels / (GRID_SPACING * GRID_SPACING);
            const figureDiv = document.createElement('div');
            figureDiv.classList.add('figure-details');
            figureDiv.innerHTML = `<strong>${figureLabel}:</strong> Perimeter: ${singlePerimeterUnits.toFixed(2)} units, Area: ${singleAreaUnits.toFixed(2)} sq. units`;
            figuresListDiv.appendChild(figureDiv);
        });
        const totalPerimeterUnits = totalPerimeter / GRID_SPACING;
        // console.log(`Final check before scaling: totalArea (px^2) = ${totalArea}, GRID_SPACING = ${GRID_SPACING}`); // Less logging
        const gridSpacingSq = GRID_SPACING * GRID_SPACING;
        let totalAreaSumUnits = 0;
        if (gridSpacingSq !== 0 && !isNaN(totalArea)) { totalAreaSumUnits = totalArea / gridSpacingSq; }
        else { console.error(`!!! Error scaling total area. totalArea=${totalArea}, gridSpacingSq=${gridSpacingSq}`); }
        // console.log(`Final scaled area: totalAreaSumUnits = ${totalAreaSumUnits}`); // Less logging
        perimeterDisplay.textContent = `Total Perimeter (Sum): ${totalPerimeterUnits.toFixed(2)} units`;
        areaDisplay.textContent = `Total Area (Sum): ${totalAreaSumUnits.toFixed(2)} sq. units`;
    }


    // --- FULL definition of ALL other necessary functions ---
    // (calculateDistance, calculatePerimeter, calculateArea, hexToRgba, toTurfPolygonFormat,
    //  drawGrid, drawPeg, drawSinglePolygon, getMousePos, snapToGrid, findVertexNear,
    //  handleMouseDown, handleMouseMove, handleMouseUp, handleMouseLeave, handleCanvasClick,
    //  handleClear, handleColorSelect)
    // --- These should be the versions from the PREVIOUS 'full JS file' response ---
    // --- Make sure they are all present here ---

     // --- Geometry Functions (Example - ensure these are present) ---
    function calculateDistance(p1, p2) { if (!p1 || !p2 || typeof p1.x === 'undefined' || typeof p1.y === 'undefined' || typeof p2.x === 'undefined' || typeof p2.y === 'undefined') return Infinity; return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2)); }
    function calculatePerimeter(verts, closed) { let perimeter = 0; if (!verts || verts.length < 2) return 0; for (let i = 0; i < verts.length - 1; i++) { perimeter += calculateDistance(verts[i], verts[i + 1]); } if (closed && verts.length > 1) { perimeter += calculateDistance(verts[verts.length - 1], verts[0]); } return perimeter; }
    function calculateArea(verts) { let area = 0; if (!verts) return 0; const n = verts.length; if (n < 3) return 0; for (let i = 0; i < n; i++) { const p1 = verts[i]; const p2 = verts[(i + 1) % n]; if (!p1 || !p2 || typeof p1.x === 'undefined' || typeof p1.y === 'undefined' || typeof p2.x === 'undefined' || typeof p2.y === 'undefined') { console.error("Shoelace: Invalid vertex data found at index", i, p1, p2); return NaN; } area += (p1.x * p2.y - p2.x * p1.y); } const finalArea = Math.abs(area) / 2.0; return finalArea; }
    function hexToRgba(hex, alpha = 1) { if (!hex || typeof hex !== 'string') return `rgba(200, 200, 200, ${alpha})`; let r=0,g=0,b=0; if(hex.length === 4){r=parseInt(hex[1]+hex[1],16);g=parseInt(hex[2]+hex[2],16);b=parseInt(hex[3]+hex[3],16);} else if(hex.length === 7){r=parseInt(hex[1]+hex[2],16);g=parseInt(hex[3]+hex[4],16);b=parseInt(hex[5]+hex[6],16);} else { return `rgba(200, 200, 200, ${alpha})`;} return `rgba(${r},${g},${b},${alpha})`;}
    function toTurfPolygonFormat(verts) { if (!verts || verts.length < 3) return null; const coordinates = verts.map(v => [v.x, v.y]); coordinates.push([verts[0].x, verts[0].y]); try { if(typeof turf === 'undefined'){ console.error("Turf not loaded in toTurfPolygonFormat."); return null; } const tempPoly = turf.polygon([coordinates]); if (!turf.booleanValid(tempPoly)) { /*console.warn("Invalid Turf Polygon");*/ return null; } return tempPoly; } catch (e) { /*console.warn("Turf format error:", e.message);*/ return null; } }

     // --- Event Handlers (Example - ensure these are present) ---
    function getMousePos(event) { const rect = canvas.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top }; }
    function snapToGrid(mouseX, mouseY) { const gridX = Math.round(mouseX / GRID_SPACING); const gridY = Math.round(mouseY / GRID_SPACING); const snappedX = gridX * GRID_SPACING; const snappedY = gridY * GRID_SPACING; const clampedX = Math.max(0, Math.min(snappedX, canvas.width)); const clampedY = Math.max(0, Math.min(snappedY, canvas.height)); return { x: clampedX, y: clampedY }; }
    function findVertexNear(pos) { for (let i = 0; i < polygons.length; i++) { for (let j = 0; j < polygons[i].vertices.length; j++) { if (calculateDistance(pos, polygons[i].vertices[j]) < DRAG_THRESHOLD) { return { polygonIndex: i, vertexIndex: j }; } } } return null; }
    function handleMouseDown(event) { justDragged = false; const mousePos = getMousePos(event); const clickedVertexInfo = findVertexNear(mousePos); if (clickedVertexInfo) { isDragging = true; draggedPolygonIndex = clickedVertexInfo.polygonIndex; draggedVertexIndex = clickedVertexInfo.vertexIndex; canvas.style.cursor = 'grabbing'; redrawCanvas(); } else { isDragging = false; draggedPolygonIndex = -1; draggedVertexIndex = -1; } }
    function handleMouseMove(event) { const mousePos = getMousePos(event); if (!isDragging || draggedPolygonIndex === -1) { canvas.style.cursor = findVertexNear(mousePos) ? 'grab' : 'crosshair'; return; } canvas.style.cursor = 'grabbing'; const snappedPoint = snapToGrid(mousePos.x, mousePos.y); if (snappedPoint && polygons[draggedPolygonIndex]) { const currentVertex = polygons[draggedPolygonIndex].vertices[draggedVertexIndex]; if (snappedPoint.x !== currentVertex.x || snappedPoint.y !== currentVertex.y) { polygons[draggedPolygonIndex].vertices[draggedVertexIndex] = snappedPoint; redrawCanvas(); updateCalculations(); } } }
    function handleMouseUp(event) { if (isDragging) { isDragging = false; justDragged = true; canvas.style.cursor = 'crosshair'; redrawCanvas(); updateCalculations(); } }
    function handleMouseLeave(event) { if (isDragging) handleMouseUp(event); canvas.style.cursor = 'crosshair'; }
    function handleCanvasClick(event) { if (justDragged) { justDragged = false; draggedPolygonIndex = -1; draggedVertexIndex = -1; return; } if (!isDragging) { draggedPolygonIndex = -1; draggedVertexIndex = -1; } const mousePos = getMousePos(event); if (findVertexNear(mousePos)) return; const snappedPoint = snapToGrid(mousePos.x, mousePos.y); if (!snappedPoint) return; if (currentPolygonIndex === -1) { polygons.push({ vertices: [snappedPoint], color: selectedColor, isClosed: false }); currentPolygonIndex = polygons.length - 1; } else { const currentPoly = polygons[currentPolygonIndex]; const verts = currentPoly.vertices; if (verts.length >= 2) { const distToStart = calculateDistance(snappedPoint, verts[0]); if (distToStart < SNAP_THRESHOLD) { const lastPoint = verts[verts.length - 1]; if (snappedPoint.x !== lastPoint.x || snappedPoint.y !== lastPoint.y) { currentPoly.isClosed = true; currentPolygonIndex = -1; } } else { if (!(snappedPoint.x === verts[verts.length - 1].x && snappedPoint.y === verts[verts.length - 1].y)) { verts.push(snappedPoint); } } } else { if (verts.length === 0 || !(snappedPoint.x === verts[verts.length - 1].x && snappedPoint.y === verts[verts.length - 1].y)) { verts.push(snappedPoint); } } } redrawCanvas(); updateCalculations(); }
    function handleClear() { polygons = []; currentPolygonIndex = -1; isDragging = false; draggedPolygonIndex = -1; draggedVertexIndex = -1; justDragged = false; if(figuresListDiv) figuresListDiv.innerHTML = ''; redrawCanvas(); updateCalculations(); intersectionDisplay.textContent = `Total Intersection Area: N/A`; console.log("Board cleared"); }
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
