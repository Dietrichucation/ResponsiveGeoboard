// Add this check RIGHT AT THE START of the main event listener
document.addEventListener('DOMContentLoaded', () => {
    // Add this line right at the start
    console.log(`Initial Check: Turf library loaded? Type: ${typeof turf}`);

    const canvas = document.getElementById('geoboard-canvas');
    const ctx = canvas.getContext('2d');
    const perimeterDisplay = document.getElementById('perimeter-display');
    const areaDisplay = document.getElementById('area-display');
    const intersectionDisplay = document.getElementById('intersection-display');
    const clearButton = document.getElementById('clear-button');
    const colorButtons = document.querySelectorAll('.color-button');
    const figuresListDiv = document.getElementById('figures-list'); // Get div for individual figures

    // --- Configuration ---
    const GRID_SPACING = 40;
    const PEG_RADIUS = 3;
    const PEG_COLOR = 'white';
    const LINE_WIDTH = 3;
    const SNAP_THRESHOLD = 15;
    const DRAG_THRESHOLD = 10;
    const FILL_ALPHA = 0.3; // Transparency for polygon fill
    const INTERSECTION_COLOR = 'rgba(142, 68, 173, 0.6)'; // Purple semi-transparent fill
    const DEFAULT_COLOR = '#f1c40f'; // Initial color

    // --- State Variables ---
    let polygons = []; // Array of polygon objects: { vertices: [], color: '', isClosed: false }
    let selectedColor = DEFAULT_COLOR;
    let currentPolygonIndex = -1; // Index of the polygon being actively drawn, -1 if none

    // --- Drag State ---
    let isDragging = false;
    let draggedPolygonIndex = -1;
    let draggedVertexIndex = -1;
    let justDragged = false; // Flag to track if the last action was a drag


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

    // Shoelace Formula for Polygon Area (Used for individual/sum area AND intersection area)
    function calculateArea(verts) {
        let area = 0;
        if (!verts) return 0;
        const n = verts.length;
        if (n < 3) return 0;

        // console.log(`  -> Shoelace input: ${JSON.stringify(verts)}`); // Keep logging minimal

        for (let i = 0; i < n; i++) {
            const p1 = verts[i];
            const p2 = verts[(i + 1) % n];
            if (!p1 || !p2 || typeof p1.x === 'undefined' || typeof p1.y === 'undefined' || typeof p2.x === 'undefined' || typeof p2.y === 'undefined') { // Added type checks
                 console.error("Shoelace: Invalid vertex data found at index", i, p1, p2);
                 return NaN; // Return NaN if data is bad
            }
            area += (p1.x * p2.y - p2.x * p1.y);
        }
        const finalArea = Math.abs(area) / 2.0;
        // console.log(`  -> Shoelace calculated area (px^2): ${finalArea}`);
        return finalArea; // Return potential NaN
    }


    // Helper to convert hex color to rgba
    function hexToRgba(hex, alpha = 1) {
        if (!hex || typeof hex !== 'string') return `rgba(200, 200, 200, ${alpha})`;
        let r=0,g=0,b=0; if(hex.length === 4){r=parseInt(hex[1]+hex[1],16);g=parseInt(hex[2]+hex[2],16);b=parseInt(hex[3]+hex[3],16);} else if(hex.length === 7){r=parseInt(hex[1]+hex[2],16);g=parseInt(hex[3]+hex[4],16);b=parseInt(hex[5]+hex[6],16);} else { return `rgba(200, 200, 200, ${alpha})`;} return `rgba(${r},${g},${b},${alpha})`;}

    // Helper: Convert our vertex format to Turf/GeoJSON polygon format (Still needed for intersection)
    function toTurfPolygonFormat(verts) {
        if (!verts || verts.length < 3) return null;
        const coordinates = verts.map(v => [v.x, v.y]);
        coordinates.push([verts[0].x, verts[0].y]); // Close the ring
        try {
            if(typeof turf === 'undefined'){ console.error("Turf not loaded in toTurfPolygonFormat."); return null; }
            const tempPoly = turf.polygon([coordinates]);
            // Removed booleanValid check
            return tempPoly;
        } catch (e) {
            // console.warn("Failed to create Turf polygon:", e.message, coordinates); // Less verbose
            return null;
        }
    }

    // *** NEW HELPER FUNCTION ***
    // Converts the outer ring of Turf coordinates [[x,y], [x,y]...]
    // back to our vertex format [{x,y}, {x,y}...] for Shoelace.
    // Ignores holes for simplicity in this version.
    function turfCoordsToVertices(rings) {
        if (!rings || rings.length === 0 || !Array.isArray(rings[0])) {
            console.warn("Invalid input for turfCoordsToVertices:", rings);
            return []; // Return empty array if input is bad
        }
        const outerRing = rings[0]; // Get the first ring (outer boundary)
        if (rings.length > 1) {
            console.warn("turfCoordsToVertices: Detected holes in intersection polygon, area calculation will only use outer boundary.");
        }
        // Map [x, y] pairs to {x: x, y: y} objects.
        // Exclude the last point because Turf repeats the first point.
        const vertices = outerRing.slice(0, outerRing.length - 1).map(coord => {
            if (Array.isArray(coord) && coord.length === 2) {
                return { x: coord[0], y: coord[1] };
            } else {
                 console.error("Invalid coordinate pair found in ring:", coord);
                 return null; // Mark invalid pairs
            }
        });
        // Filter out any nulls caused by invalid pairs
        const validVertices = vertices.filter(v => v !== null);
        if (validVertices.length < 3) {
             console.warn("turfCoordsToVertices: Resulting vertex list has < 3 points, invalid for area calculation.", validVertices);
             return []; // Return empty if not enough valid points
        }
        return validVertices;
    }


    // --- Drawing Functions ---

    function drawGrid() { /* ... (no changes needed from previous correct version) ... */ ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = '#2c3e50'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.strokeStyle = '#445566'; ctx.lineWidth = 0.5; for (let x = 0; x <= canvas.width; x += GRID_SPACING) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); for (let y = GRID_SPACING; y <= canvas.height; y += GRID_SPACING) { if(x >= 0 && x <= canvas.width && y >= 0 && y <= canvas.height) drawPeg(x, y); } } for (let y = 0; y <= canvas.height; y += GRID_SPACING) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); for (let x = 0; x <= canvas.width; x += GRID_SPACING) { if(x >= 0 && x <= canvas.width && y >= 0 && y <= canvas.height && y > 0) drawPeg(x, y); } if(y === 0) { for (let x = 0; x <= canvas.width; x += GRID_SPACING) { if(x >= 0 && x <= canvas.width && y >= 0 && y <= canvas.height) drawPeg(x, y); }} } ctx.fillStyle = '#ccc'; ctx.font = '10px sans-serif'; for (let i = 1; i * GRID_SPACING <= canvas.width; i++) ctx.fillText(i, i * GRID_SPACING - 3, 12); for (let i = 1; i * GRID_SPACING <= canvas.height; i++) ctx.fillText(i, 5, i * GRID_SPACING + 4); }
    function drawPeg(x, y) { /* ... (no changes needed from previous correct version) ... */ ctx.beginPath(); ctx.arc(x, y, PEG_RADIUS, 0, Math.PI * 2); ctx.fillStyle = PEG_COLOR; ctx.fill(); }
    function drawSinglePolygon(polygon, index) { /* ... (no changes needed from previous correct version) ... */ const verts = polygon.vertices; if (verts.length < 1) return; ctx.strokeStyle = polygon.color; ctx.lineWidth = LINE_WIDTH; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(verts[0].x, verts[0].y); for (let i = 1; i < verts.length; i++) { ctx.lineTo(verts[i].x, verts[i].y); } if (polygon.isClosed && verts.length > 1) { ctx.closePath(); } ctx.stroke(); if (polygon.isClosed && verts.length >= 3) { let rgbaColor = hexToRgba(polygon.color, FILL_ALPHA); ctx.fillStyle = rgbaColor; ctx.beginPath(); ctx.moveTo(verts[0].x, verts[0].y); for (let i = 1; i < verts.length; i++) { ctx.lineTo(verts[i].x, verts[i].y); } ctx.closePath(); ctx.fill(); } verts.forEach((v, vertexIdx) => { const isDragged = (isDragging && index === draggedPolygonIndex && vertexIdx === draggedVertexIndex); ctx.beginPath(); ctx.arc(v.x, v.y, PEG_RADIUS + (isDragged ? 3 : 1), 0, Math.PI * 2); ctx.fillStyle = isDragged ? 'red' : polygon.color; ctx.fill(); }); }
    function drawTurfGeometry(geometry, ctx) { /* ... (no changes needed from previous correct version) ... */ if (!geometry) { console.log("drawTurfGeometry received null geometry."); return; } console.log(`  -> Drawing geometry type: ${geometry.type}`); if (geometry.type === 'Polygon') { drawCanvasRing(geometry.coordinates, ctx); } else if (geometry.type === 'MultiPolygon') { geometry.coordinates.forEach(coords => drawCanvasRing(coords, ctx)); } else { console.log(`  -> Not drawing type ${geometry.type}`); } }
    function drawCanvasRing(rings, ctx) { /* ... (no changes needed from previous correct version) ... */ console.log("    -> drawCanvasRing called."); ctx.beginPath(); rings.forEach((ring) => { if (ring.length >= 3) { ctx.moveTo(ring[0][0], ring[0][1]); for (let i = 1; i < ring.length; i++) { ctx.lineTo(ring[i][0], ring[i][1]); } ctx.closePath(); } else { console.warn("    -> Invalid ring with < 3 points found:", ring); } }); ctx.fill('evenodd'); console.log("    -> drawCanvasRing finished fill."); }

    // ** REVISED drawIntersections Function using Shoelace for Area **
    function drawIntersections() {
        // console.log("--- drawIntersections START ---"); // Reduce logging noise now
        let intersectionAreaTotalPixels = 0;
        let foundAnyDrawableIntersection = false;
        intersectionDisplay.textContent = `Total Intersection Area: N/A`;

        if (typeof turf === 'undefined') { /* Keep Turf check */ console.error("!!! Turf library is not loaded..."); /* ... */ return; }

        let closedPolygons = polygons.filter(p => p.isClosed && p.vertices.length >= 3);
        // console.log(`Found ${closedPolygons.length} closed polygons...`); // Reduce logging noise

        if (closedPolygons.length < 2) { /* Keep check */ intersectionDisplay.textContent = `Total Intersection Area: 0.00 sq. units`; /* ... */ return; }

        ctx.fillStyle = INTERSECTION_COLOR;
        // console.log(`Set fillStyle to: ${INTERSECTION_COLOR}`); // Reduce logging noise

        for (let i = 0; i < closedPolygons.length; i++) {
            for (let j = i + 1; j < closedPolygons.length; j++) {
                const polyIndex1 = polygons.findIndex(p => p === closedPolygons[i]);
                const polyIndex2 = polygons.findIndex(p => p === closedPolygons[j]);
                // console.log(`Checking Figure ${polyIndex1 + 1} and Figure ${polyIndex2 + 1}`); // Reduce logging noise

                const turfPoly1 = toTurfPolygonFormat(closedPolygons[i].vertices);
                const turfPoly2 = toTurfPolygonFormat(closedPolygons[j].vertices);
                // console.log(`  Format valid? Poly1: ${!!turfPoly1}, Poly2: ${!!turfPoly2}`); // Reduce logging noise

                if (!turfPoly1 || !turfPoly2) { continue; }

                try {
                    // console.log("  Calling turf.intersect..."); // Reduce logging noise
                    const intersection = turf.intersect(turfPoly1, turfPoly2); // Feature or null

                    let intersectionGeometry = null;
                    if (intersection && intersection.geometry && intersection.geometry.coordinates) {
                        intersectionGeometry = intersection.geometry;
                    }

                    // console.log("  turf.intersect result:", intersection ? intersection.geometry.type : null); // Reduce logging noise

                    // Only process Polygon and MultiPolygon types for area/drawing
                    if (intersectionGeometry && (intersectionGeometry.type === 'Polygon' || intersectionGeometry.type === 'MultiPolygon')) {
                         console.log("  Intersection Geometry found. Type:", intersectionGeometry.type);

                         // --- Calculate Area using Shoelace ---
                         let areaPixels = 0;
                         if (intersectionGeometry.type === 'Polygon') {
                             // Convert coordinates to our vertex format
                             const intersectionVertices = turfCoordsToVertices(intersectionGeometry.coordinates);
                             if (intersectionVertices.length >= 3) {
                                 areaPixels = calculateArea(intersectionVertices); // Use Shoelace
                                 console.log(`  Calculated intersection area (Shoelace, px^2): ${areaPixels}`);
                                 if (!isNaN(areaPixels)) {
                                     intersectionAreaTotalPixels += Math.abs(areaPixels); // Add positive area
                                 } else {
                                     console.warn("  NaN area returned by calculateArea for intersection.");
                                 }
                             }
                         } else { // MultiPolygon
                            console.warn("MultiPolygon intersection detected. Calculating area for each part.");
                            // Iterate through each polygon within the MultiPolygon
                            intersectionGeometry.coordinates.forEach((polyCoords, polyIndex) => {
                                const intersectionVertices = turfCoordsToVertices(polyCoords); // Convert this polygon part
                                if (intersectionVertices.length >= 3) {
                                     let partAreaPixels = calculateArea(intersectionVertices);
                                     console.log(`  Calculated MultiPolygon part ${polyIndex} area (Shoelace, px^2): ${partAreaPixels}`);
                                     if (!isNaN(partAreaPixels)) {
                                         intersectionAreaTotalPixels += Math.abs(partAreaPixels);
                                     } else {
                                         console.warn(`  NaN area for MultiPolygon part ${polyIndex}.`);
                                     }
                                }
                            });
                         }
                         // --- End Area Calculation ---

                         // --- Draw the Intersection ---
                         // Only draw if area > 0 ensures we don't just draw lines/points from Turf's perspective
                         if (areaPixels > 0 || intersectionGeometry.type === 'MultiPolygon') {
                             console.log("  Attempting to draw intersection...");
                             drawTurfGeometry(intersectionGeometry, ctx); // Draw the overlap shape(s)
                             foundAnyDrawableIntersection = true;
                             console.log("  Finished drawing intersection.");
                         } else {
                             console.log("  Intersection area calculated as zero or NaN, not drawing.");
                         }

                    } else if (intersection) {
                         // console.log(`  Intersection found but not drawable geometry...`); // Reduce logging noise
                    } else {
                         // console.log("  No intersection returned by turf.intersect."); // Reduce logging noise
                    }
                } catch (e) {
                    console.error(`  Error during intersection processing for Figures ${polyIndex1 + 1}/${polyIndex2 + 1}:`, e.message);
                }
            } // End inner loop (j)
        } // End outer loop (i)

        // Update display
        const intersectionAreaUnits = intersectionAreaTotalPixels / (GRID_SPACING * GRID_SPACING);
        if (isNaN(intersectionAreaUnits)) {
             console.error("!!! Final intersection area units is NaN!");
             intersectionDisplay.textContent = `Total Intersection Area: Error`;
        } else {
             intersectionDisplay.textContent = `Total Intersection Area: ${intersectionAreaUnits.toFixed(2)} sq. units`;
        }
        // console.log(`--- drawIntersections END (Final Area Units: ${intersectionAreaUnits.toFixed(2)}) ---`); // Reduce logging noise
    }


    function redrawCanvas() { /* ... (no changes needed from previous correct version) ... */ drawGrid(); polygons.forEach((poly, index) => { drawSinglePolygon(poly, index); }); drawIntersections(); }

    // --- UI Update Functions ---
    function updateCalculations() { /* ... (no changes needed from previous correct version) ... */ let totalPerimeter = 0; let totalArea = 0; figuresListDiv.innerHTML = ''; polygons.forEach((poly, index) => { let figureLabel = `Figure ${index + 1}`; const singlePerimeterPixels = calculatePerimeter(poly.vertices, poly.isClosed); totalPerimeter += singlePerimeterPixels; const singlePerimeterUnits = singlePerimeterPixels / GRID_SPACING; let singleAreaPixels = 0; if (poly.isClosed && poly.vertices.length >= 3) { /* console.log(`Calculating area for ${figureLabel} using Shoelace...`);*/ singleAreaPixels = calculateArea(poly.vertices); singleAreaPixels = Math.abs(singleAreaPixels); if (isNaN(singleAreaPixels)) { console.error(`!!! NaN detected for singleAreaPixels for ${figureLabel}.`); singleAreaPixels = 0; } totalArea += singleAreaPixels; } const singleAreaUnits = singleAreaPixels / (GRID_SPACING * GRID_SPACING); const figureDiv = document.createElement('div'); figureDiv.classList.add('figure-details'); figureDiv.innerHTML = `<strong>${figureLabel}:</strong> Perimeter: ${singlePerimeterUnits.toFixed(2)} units, Area: ${singleAreaUnits.toFixed(2)} sq. units`; figuresListDiv.appendChild(figureDiv); }); const totalPerimeterUnits = totalPerimeter / GRID_SPACING; /* console.log(`Final check before scaling: totalArea (px^2) = ${totalArea}...`); */ const gridSpacingSq = GRID_SPACING * GRID_SPACING; let totalAreaSumUnits = 0; if (gridSpacingSq !== 0 && !isNaN(totalArea)) { totalAreaSumUnits = totalArea / gridSpacingSq; } else { console.error(`!!! Error scaling total area...`); } /* console.log(`Final scaled area: totalAreaSumUnits = ${totalAreaSumUnits}`); */ perimeterDisplay.textContent = `Total Perimeter (Sum): ${totalPerimeterUnits.toFixed(2)} units`; areaDisplay.textContent = `Total Area (Sum): ${totalAreaSumUnits.toFixed(2)} sq. units`; }

    // --- Event Handlers ---
    function getMousePos(event) { /* ... (no changes needed from previous correct version) ... */ const rect = canvas.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top }; }
    function snapToGrid(mouseX, mouseY) { /* ... (no changes needed from previous correct version) ... */ const gridX = Math.round(mouseX / GRID_SPACING); const gridY = Math.round(mouseY / GRID_SPACING); const snappedX = gridX * GRID_SPACING; const snappedY = gridY * GRID_SPACING; const clampedX = Math.max(0, Math.min(snappedX, canvas.width)); const clampedY = Math.max(0, Math.min(snappedY, canvas.height)); return { x: clampedX, y: clampedY }; }
    function findVertexNear(pos) { /* ... (no changes needed from previous correct version) ... */ for (let i = 0; i < polygons.length; i++) { for (let j = 0; j < polygons[i].vertices.length; j++) { if (calculateDistance(pos, polygons[i].vertices[j]) < DRAG_THRESHOLD) { return { polygonIndex: i, vertexIndex: j }; } } } return null; }
    function handleMouseDown(event) { /* ... (no changes needed from previous correct version) ... */ justDragged = false; const mousePos = getMousePos(event); const clickedVertexInfo = findVertexNear(mousePos); if (clickedVertexInfo) { isDragging = true; draggedPolygonIndex = clickedVertexInfo.polygonIndex; draggedVertexIndex = clickedVertexInfo.vertexIndex; canvas.style.cursor = 'grabbing'; redrawCanvas(); } else { isDragging = false; draggedPolygonIndex = -1; draggedVertexIndex = -1; } }
    function handleMouseMove(event) { /* ... (no changes needed from previous correct version) ... */ const mousePos = getMousePos(event); if (!isDragging || draggedPolygonIndex === -1) { canvas.style.cursor = findVertexNear(mousePos) ? 'grab' : 'crosshair'; return; } canvas.style.cursor = 'grabbing'; const snappedPoint = snapToGrid(mousePos.x, mousePos.y); if (snappedPoint && polygons[draggedPolygonIndex]) { const currentVertex = polygons[draggedPolygonIndex].vertices[draggedVertexIndex]; if (snappedPoint.x !== currentVertex.x || snappedPoint.y !== currentVertex.y) { polygons[draggedPolygonIndex].vertices[draggedVertexIndex] = snappedPoint; redrawCanvas(); updateCalculations(); } } }
    function handleMouseUp(event) { /* ... (no changes needed from previous correct version) ... */ if (isDragging) { isDragging = false; justDragged = true; canvas.style.cursor = 'crosshair'; redrawCanvas(); updateCalculations(); } }
    function handleMouseLeave(event) { /* ... (no changes needed from previous correct version) ... */ if (isDragging) handleMouseUp(event); canvas.style.cursor = 'crosshair'; }
    function handleCanvasClick(event) { /* ... (no changes needed from previous correct version) ... */ if (justDragged) { justDragged = false; draggedPolygonIndex = -1; draggedVertexIndex = -1; return; } if (!isDragging) { draggedPolygonIndex = -1; draggedVertexIndex = -1; } const mousePos = getMousePos(event); if (findVertexNear(mousePos)) return; const snappedPoint = snapToGrid(mousePos.x, mousePos.y); if (!snappedPoint) return; if (currentPolygonIndex === -1) { polygons.push({ vertices: [snappedPoint], color: selectedColor, isClosed: false }); currentPolygonIndex = polygons.length - 1; } else { const currentPoly = polygons[currentPolygonIndex]; const verts = currentPoly.vertices; if (verts.length >= 2) { const distToStart = calculateDistance(snappedPoint, verts[0]); if (distToStart < SNAP_THRESHOLD) { const lastPoint = verts[verts.length - 1]; if (snappedPoint.x !== lastPoint.x || snappedPoint.y !== lastPoint.y) { currentPoly.isClosed = true; currentPolygonIndex = -1; } } else { if (!(snappedPoint.x === verts[verts.length - 1].x && snappedPoint.y === verts[verts.length - 1].y)) { verts.push(snappedPoint); } } } else { if (verts.length === 0 || !(snappedPoint.x === verts[verts.length - 1].x && snappedPoint.y === verts[verts.length - 1].y)) { verts.push(snappedPoint); } } } redrawCanvas(); updateCalculations(); }
    function handleClear() { /* ... (no changes needed from previous correct version) ... */ polygons = []; currentPolygonIndex = -1; isDragging = false; draggedPolygonIndex = -1; draggedVertexIndex = -1; justDragged = false; if(figuresListDiv) figuresListDiv.innerHTML = ''; redrawCanvas(); updateCalculations(); intersectionDisplay.textContent = `Total Intersection Area: N/A`; console.log("Board cleared"); }
    function handleColorSelect(event) { /* ... (no changes needed from previous correct version) ... */ selectedColor = event.target.dataset.color; colorButtons.forEach(btn => btn.classList.remove('selected')); event.target.classList.add('selected'); }

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
