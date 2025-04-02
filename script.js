document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('geoboard-canvas');
    const ctx = canvas.getContext('2d');
    const perimeterDisplay = document.getElementById('perimeter-display');
    const areaDisplay = document.getElementById('area-display');
    const intersectionDisplay = document.getElementById('intersection-display'); // Added
    const clearButton = document.getElementById('clear-button');
    const colorButtons = document.querySelectorAll('.color-button'); // Added

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

    // --- Geometry Functions (Mostly unchanged, but may operate on specific polygon data) ---
    function calculateDistance(p1, p2) {
        if (!p1 || !p2 || typeof p1.x === 'undefined' || typeof p1.y === 'undefined' || typeof p2.x === 'undefined' || typeof p2.y === 'undefined') return Infinity;
        return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
    }

    function calculatePerimeter(verts, closed) { // Calculates for a single polygon's vertices
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

    function calculateArea(verts) { // Calculates for a single polygon's vertices
        let area = 0;
        if (!verts) return 0;
        const n = verts.length;
        if (n < 3) return 0;
        for (let i = 0; i < n; i++) {
            const p1 = verts[i];
            const p2 = verts[(i + 1) % n];
            if (!p1 || !p2) return 0;
            area += (p1.x * p2.y - p2.x * p1.y);
        }
        return Math.abs(area) / 2.0;
    }

    // --- Drawing Functions ---

    function drawGrid() {
        // Same grid drawing logic as before
        // ... (keep the existing drawGrid function) ...
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#2c3e50';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#445566';
        ctx.lineWidth = 0.5;
         for (let x = 0; x <= canvas.width; x += GRID_SPACING) {
             ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
             if (x > 0 && x < canvas.width) drawPeg(x, 0);
         }
         for (let y = 0; y <= canvas.height; y += GRID_SPACING) {
             ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
             if (y > 0 && y < canvas.height) drawPeg(0, y);
             for (let x = GRID_SPACING; x < canvas.width; x += GRID_SPACING) {
                  if (y > 0 && y < canvas.height) drawPeg(x, y);
             }
         }
         drawPeg(0,0);
        ctx.fillStyle = '#ccc'; ctx.font = '10px sans-serif';
        for (let i = 1; i * GRID_SPACING < canvas.width; i++) ctx.fillText(i, i * GRID_SPACING - 3, 12);
        for (let i = 1; i * GRID_SPACING < canvas.height; i++) ctx.fillText(i, 5, i * GRID_SPACING + 4);
    }

    function drawPeg(x, y) {
        // Same peg drawing logic as before
        // ... (keep the existing drawPeg function) ...
        ctx.beginPath(); ctx.arc(x, y, PEG_RADIUS, 0, Math.PI * 2); ctx.fillStyle = PEG_COLOR; ctx.fill();
    }

    function drawSinglePolygon(polygon, index) { // NEW: Draws one polygon object
        const verts = polygon.vertices;
        if (verts.length < 1) return;

        // Set color and line style from polygon object
        ctx.strokeStyle = polygon.color;
        ctx.lineWidth = LINE_WIDTH;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        // Draw the outline
        ctx.beginPath();
        ctx.moveTo(verts[0].x, verts[0].y);
        for (let i = 1; i < verts.length; i++) {
            ctx.lineTo(verts[i].x, verts[i].y);
        }
        if (polygon.isClosed && verts.length > 1) {
            ctx.closePath(); // Connect last point to first for closed shapes
        }
        ctx.stroke(); // Draw the outline

        // Fill the polygon if closed and has area
        if (polygon.isClosed && verts.length >= 3) {
            // Convert hex color to rgba for transparency
            let rgbaColor = hexToRgba(polygon.color, FILL_ALPHA);
            ctx.fillStyle = rgbaColor;
            // Need to redo the path for filling
            ctx.beginPath();
            ctx.moveTo(verts[0].x, verts[0].y);
            for (let i = 1; i < verts.length; i++) {
                ctx.lineTo(verts[i].x, verts[i].y);
            }
            ctx.closePath();
            ctx.fill();
        }

        // Highlight vertices (especially the one being dragged)
        verts.forEach((v, vertexIdx) => {
            const isDragged = (isDragging && index === draggedPolygonIndex && vertexIdx === draggedVertexIndex);
            ctx.beginPath();
            ctx.arc(v.x, v.y, PEG_RADIUS + (isDragged ? 3 : 1), 0, Math.PI * 2);
            ctx.fillStyle = isDragged ? 'red' : polygon.color; // Highlight dragged vertex
            ctx.fill();
        });
    }

    // Helper to convert hex color to rgba
    function hexToRgba(hex, alpha = 1) {
        if (!hex || typeof hex !== 'string') return `rgba(200, 200, 200, ${alpha})`; // Default gray if invalid
        let r = 0, g = 0, b = 0;
        if (hex.length === 4) { // shorthand like #abc
            r = parseInt(hex[1] + hex[1], 16);
            g = parseInt(hex[2] + hex[2], 16);
            b = parseInt(hex[3] + hex[3], 16);
        } else if (hex.length === 7) { // standard like #abcdef
            r = parseInt(hex[1] + hex[2], 16);
            g = parseInt(hex[3] + hex[4], 16);
            b = parseInt(hex[5] + hex[6], 16);
        } else {
             return `rgba(200, 200, 200, ${alpha})`; // Default gray if invalid format
        }
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }


    // *** PLACEHOLDER for Intersection Drawing ***
    function drawIntersections() {
        // --- IMPORTANT ---
        // This requires a real geometry library (like Turf.js or Clipper)
        // to calculate the actual intersection polygons.
        // This is just a visual placeholder demonstrating the idea.

        let intersectionAreaTotal = 0; // In square units
        intersectionDisplay.textContent = `Intersection Area: N/A`; // Reset display

        // Find pairs of closed polygons
        let closedPolygons = polygons.filter(p => p.isClosed && p.vertices.length >= 3);

        if (closedPolygons.length < 2) return; // Need at least two shapes to intersect

        ctx.fillStyle = INTERSECTION_COLOR;

        for (let i = 0; i < closedPolygons.length; i++) {
            for (let j = i + 1; j < closedPolygons.length; j++) {
                // *** SIMULATION / PLACEHOLDER LOGIC START ***
                // Use Bounding Box check as a *very rough* proxy for intersection
                let poly1 = closedPolygons[i];
                let poly2 = closedPolygons[j];
                let bb1 = getBoundingBox(poly1.vertices);
                let bb2 = getBoundingBox(poly2.vertices);

                if (boundingBoxesOverlap(bb1, bb2)) {
                    // If bounding boxes overlap, *pretend* we found an intersection
                    // and draw a small rectangle where they might overlap.
                    // A real implementation would calculate the actual intersection polygon(s).
                    let overlapX = Math.max(bb1.minX, bb2.minX);
                    let overlapY = Math.max(bb1.minY, bb2.minY);
                    let overlapMaxX = Math.min(bb1.maxX, bb2.maxX);
                    let overlapMaxY = Math.min(bb1.maxY, bb2.maxY);
                    let overlapW = overlapMaxX - overlapX;
                    let overlapH = overlapMaxY - overlapY;

                    if (overlapW > 0 && overlapH > 0) {
                        ctx.beginPath();
                        ctx.rect(overlapX, overlapY, overlapW, overlapH);
                        ctx.fill(); // Fill the *simulated* intersection area

                        // Update simulated intersection area display (very inaccurate)
                        let approxIntersectionArea = (overlapW * overlapH) / (GRID_SPACING * GRID_SPACING);
                        intersectionAreaTotal += approxIntersectionArea;

                    }
                }
                // *** SIMULATION / PLACEHOLDER LOGIC END ***

                 /* // --- Example using Turf.js (if included) ---
                 try {
                     let turfPoly1 = turf.polygon([poly1.vertices.map(v => [v.x, v.y]).concat([poly1.vertices[0]].map(v => [v.x, v.y]))]); // Must close ring
                     let turfPoly2 = turf.polygon([poly2.vertices.map(v => [v.x, v.y]).concat([poly2.vertices[0]].map(v => [v.x, v.y]))]);
                     let intersection = turf.intersect(turfPoly1, turfPoly2);

                     if (intersection) {
                         // Turf returns a Feature<Polygon> or Feature<MultiPolygon>
                         let coords = intersection.geometry.coordinates;
                         let intersectionAreaPixels = turf.area(intersection); // Turf calculates area in sq meters by default! Needs scaling
                         intersectionAreaTotal += intersectionAreaPixels / (GRID_SPACING * GRID_SPACING); // Adjust based on scale

                         ctx.beginPath();
                         // Need to handle both Polygon and MultiPolygon coordinates structure
                         if (intersection.geometry.type === 'Polygon') {
                              drawTurfPolygon(coords);
                         } else if (intersection.geometry.type === 'MultiPolygon') {
                              coords.forEach(polyCoords => drawTurfPolygon(polyCoords));
                         }
                         ctx.fill();
                     }
                 } catch (e) {
                      console.error("Error calculating intersection:", e);
                 }
                 // --- End Turf.js Example --- */
            }
        }
        if (intersectionAreaTotal > 0) {
             intersectionDisplay.textContent = `Intersection Area: ${intersectionAreaTotal.toFixed(2)} sq. units (Approx)`;
        } else {
             intersectionDisplay.textContent = `Intersection Area: 0.00 sq. units`;
        }
    }

    // Helper for simulated intersection (bounding box)
    function getBoundingBox(verts) {
        if (!verts || verts.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
        let minX = verts[0].x, minY = verts[0].y, maxX = verts[0].x, maxY = verts[0].y;
        for (let i = 1; i < verts.length; i++) {
            minX = Math.min(minX, verts[i].x);
            minY = Math.min(minY, verts[i].y);
            maxX = Math.max(maxX, verts[i].x);
            maxY = Math.max(maxY, verts[i].y);
        }
        return { minX, minY, maxX, maxY };
    }
    function boundingBoxesOverlap(bb1, bb2) {
        return bb1.minX < bb2.maxX && bb1.maxX > bb2.minX &&
               bb1.minY < bb2.maxY && bb1.maxY > bb2.minY;
    }

     // Helper for drawing Turf.js polygons (if used)
     /* function drawTurfPolygon(coordinates) {
         // coordinates is an array of rings, first is outer, others are holes
         coordinates.forEach((ring, index) => {
              if (ring.length > 0) {
                  ctx.moveTo(ring[0][0], ring[0][1]);
                  for (let i = 1; i < ring.length; i++) {
                       ctx.lineTo(ring[i][0], ring[i][1]);
                  }
                  // Close the ring path - important for correct filling/winding rules
                  ctx.closePath();
             }
         });
         // Use fill with even-odd rule to handle holes correctly
         // ctx.fill("evenodd"); // Already set fillStyle before calling
     } */


    function redrawCanvas() {
        drawGrid(); // Draw the base grid and pegs

        // Draw all completed polygons first
        polygons.forEach((poly, index) => {
            if (index !== currentPolygonIndex) { // Don't draw the active one yet if partially drawn
                drawSinglePolygon(poly, index);
            }
        });

        // Draw the currently active polygon (might be incomplete) on top
        if (currentPolygonIndex !== -1 && polygons[currentPolygonIndex]) {
            drawSinglePolygon(polygons[currentPolygonIndex], currentPolygonIndex);
        }

        // Draw intersections on top of everything
        drawIntersections();
    }

    // --- UI Update Functions ---

    function updateCalculations() {
        let totalPerimeter = 0;
        let totalArea = 0;

        polygons.forEach(poly => {
            totalPerimeter += calculatePerimeter(poly.vertices, poly.isClosed);
            if (poly.isClosed) {
                totalArea += calculateArea(poly.vertices);
            }
        });

        // Convert pixels to grid units
        const perimeterUnits = totalPerimeter / GRID_SPACING;
        // Area sum is not geometrically accurate for overlaps, but we display the sum
        const areaUnits = totalArea / (GRID_SPACING * GRID_SPACING);

        perimeterDisplay.textContent = `Total Perimeter: ${perimeterUnits.toFixed(2)} units`;
        areaDisplay.textContent = `Total Area (Sum): ${areaUnits.toFixed(2)} sq. units`;

        // Intersection calculation is handled within drawIntersections and updates its own display
    }

    // --- Event Handlers ---

    function getMousePos(event) { /* Unchanged */
         const rect = canvas.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    }

    function snapToGrid(mouseX, mouseY) { /* Unchanged */
        const gridX = Math.round(mouseX / GRID_SPACING); const gridY = Math.round(mouseY / GRID_SPACING);
        const snappedX = gridX * GRID_SPACING; const snappedY = gridY * GRID_SPACING;
        const canvasWidth = canvas.width; const canvasHeight = canvas.height;
        const clampedX = Math.max(0, Math.min(snappedX, canvasWidth - (canvasWidth % GRID_SPACING === 0 ? 0 : GRID_SPACING)));
        const clampedY = Math.max(0, Math.min(snappedY, canvasHeight - (canvasHeight % GRID_SPACING === 0 ? 0 : GRID_SPACING)));
         if (mouseX < -GRID_SPACING/2 || mouseX > canvas.width + GRID_SPACING/2 || mouseY < -GRID_SPACING/2 || mouseY > canvas.height + GRID_SPACING/2) return null;
        return { x: clampedX, y: clampedY };
    }

    function findVertexNear(pos) { // UPDATED for multiple polygons
        for (let i = 0; i < polygons.length; i++) {
            const verts = polygons[i].vertices;
            for (let j = 0; j < verts.length; j++) {
                if (calculateDistance(pos, verts[j]) < DRAG_THRESHOLD) {
                    return { polygonIndex: i, vertexIndex: j }; // Return indices
                }
            }
        }
        return null; // Return null if no vertex is found
    }

    function handleMouseDown(event) { // UPDATED
        const mousePos = getMousePos(event);
        const clickedVertexInfo = findVertexNear(mousePos);

        if (clickedVertexInfo) {
            isDragging = true;
            draggedPolygonIndex = clickedVertexInfo.polygonIndex;
            draggedVertexIndex = clickedVertexInfo.vertexIndex;
            // Bring the dragged polygon to the end of the array to draw it on top (optional visual aid)
            // const draggedPoly = polygons.splice(draggedPolygonIndex, 1)[0];
            // polygons.push(draggedPoly);
            // draggedPolygonIndex = polygons.length - 1; // Update index after moving
            // currentPolygonIndex = -1; // Stop drawing any new shape

            canvas.style.cursor = 'grabbing';
            redrawCanvas();
        } else {
            isDragging = false;
            draggedPolygonIndex = -1;
            draggedVertexIndex = -1;
        }
    }

    function handleMouseMove(event) { // UPDATED
        const mousePos = getMousePos(event);
        if (!isDragging || draggedPolygonIndex === -1) {
            // Optional hover effect
            canvas.style.cursor = findVertexNear(mousePos) ? 'grab' : 'crosshair';
            return;
        }

        canvas.style.cursor = 'grabbing';
        const snappedPoint = snapToGrid(mousePos.x, mousePos.y);

        if (snappedPoint && polygons[draggedPolygonIndex]) {
            const currentVertex = polygons[draggedPolygonIndex].vertices[draggedVertexIndex];
             if (snappedPoint.x !== currentVertex.x || snappedPoint.y !== currentVertex.y) {
                // Optional: Check if new position overlaps another vertex *in the same polygon*
                let occupied = false;
                // for(let i=0; i<polygons[draggedPolygonIndex].vertices.length; i++) {
                //     if (i !== draggedVertexIndex && polygons[draggedPolygonIndex].vertices[i].x === snappedPoint.x && polygons[draggedPolygonIndex].vertices[i].y === snappedPoint.y) {
                //         occupied = true; break;
                //     }
                // }

                //if (!occupied) { // Allow stacking points for now
                    polygons[draggedPolygonIndex].vertices[draggedVertexIndex] = snappedPoint;
                    // Ensure shape remains closed if it was closed (might be redundant if vertices update correctly)
                    // if (polygons[draggedPolygonIndex].isClosed) { ... }
                    redrawCanvas();
                    updateCalculations();
               // }
            }
        }
    }

     function handleMouseUp(event) { // UPDATED
        if (isDragging) {
            isDragging = false;
            // Don't reset indices immediately, might be needed if click follows fast
            // draggedPolygonIndex = -1;
            // draggedVertexIndex = -1;
            canvas.style.cursor = 'crosshair'; // Reset cursor
            redrawCanvas(); // Redraw in final state
            updateCalculations(); // Final update
        }
    }

    function handleMouseLeave(event) { // Unchanged
         if (isDragging) handleMouseUp(event);
         canvas.style.cursor = 'crosshair';
    }

    function handleCanvasClick(event) { // MAJOR UPDATES
        // Prevent click action if a drag just ended
        if (isDragging || draggedVertexIndex !== -1) {
            // Reset drag indices fully after click check is done
             draggedPolygonIndex = -1;
             draggedVertexIndex = -1;
            return;
        }

        const mousePos = getMousePos(event);
        // If click is on an existing vertex, do nothing (drag handles it)
        if (findVertexNear(mousePos)) {
             // If we want clicking a vertex to select the polygon, add logic here
            return;
        }

        const snappedPoint = snapToGrid(mousePos.x, mousePos.y);
        if (!snappedPoint) return; // Ignore clicks outside grid

        // --- Logic for Adding Points ---
        if (currentPolygonIndex === -1) {
            // Start a new polygon
            const newPolygon = {
                vertices: [snappedPoint],
                color: selectedColor,
                isClosed: false
            };
            polygons.push(newPolygon);
            currentPolygonIndex = polygons.length - 1; // Set this as the active polygon
            console.log(`Started polygon ${currentPolygonIndex} with color ${selectedColor}`);

        } else {
            // Add point to the currently active polygon
            const currentPoly = polygons[currentPolygonIndex];
            const verts = currentPoly.vertices;

            // Check if closing the shape
            if (verts.length >= 2) { // Need at least 2 points to close
                 const distToStart = calculateDistance(snappedPoint, verts[0]);
                 if (distToStart < SNAP_THRESHOLD) {
                     // Close the shape if not clicking the last point again
                     const lastPoint = verts[verts.length - 1];
                      if (snappedPoint.x !== lastPoint.x || snappedPoint.y !== lastPoint.y) {
                           currentPoly.isClosed = true;
                           console.log(`Closed polygon ${currentPolygonIndex}`);
                           currentPolygonIndex = -1; // Finish drawing this polygon
                      }
                 } else {
                      // Add the new point if it's not identical to the last point
                     if (!(snappedPoint.x === verts[verts.length - 1].x && snappedPoint.y === verts[verts.length - 1].y)) {
                         verts.push(snappedPoint);
                     }
                 }
            } else {
                 // Add the second point (or first if somehow started empty)
                 if (verts.length === 0 || !(snappedPoint.x === verts[verts.length - 1].x && snappedPoint.y === verts[verts.length - 1].y)) {
                      verts.push(snappedPoint);
                 }
            }
        }

        redrawCanvas();
        updateCalculations();
    }

    function handleClear() { // UPDATED
        polygons = [];
        currentPolygonIndex = -1;
        isDragging = false;
        draggedPolygonIndex = -1;
        draggedVertexIndex = -1;
        redrawCanvas();
        updateCalculations();
        intersectionDisplay.textContent = `Intersection Area: N/A`; // Reset
        console.log("Board cleared");
    }

    // Handle color selection
    function handleColorSelect(event) {
         selectedColor = event.target.dataset.color;
         console.log("Selected color:", selectedColor);
         // Update visual selection
         colorButtons.forEach(btn => btn.classList.remove('selected'));
         event.target.classList.add('selected');

         // If currently drawing, maybe update the current polygon's color? Optional.
         // if (currentPolygonIndex !== -1 && polygons[currentPolygonIndex] && !polygons[currentPolygonIndex].isClosed) {
         //    polygons[currentPolygonIndex].color = selectedColor;
         //    redrawCanvas();
         //}
    }


    // --- Initialization ---
    clearButton.addEventListener('click', handleClear);
    canvas.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove); // Use document for move/up
    document.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseLeave);
    canvas.addEventListener('click', handleCanvasClick);

    // Add listeners to color buttons
    colorButtons.forEach(button => {
        button.addEventListener('click', handleColorSelect);
        // Set initial selection visual
        if (button.dataset.color === DEFAULT_COLOR) {
             button.classList.add('selected');
        }
    });


    redrawCanvas(); // Initial draw
    updateCalculations(); // Initial calculation display

});
