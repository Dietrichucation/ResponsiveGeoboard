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

    function calculateArea(verts) {
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

    // Helper: Convert our vertex format to Turf/GeoJSON polygon format
    function toTurfPolygonFormat(verts) {
        if (!verts || verts.length < 3) return null;
        // Turf expects coordinates as [x, y] arrays
        // The first and last point of the ring MUST be the same
        const coordinates = verts.map(v => [v.x, v.y]);
        coordinates.push([verts[0].x, verts[0].y]); // Close the ring
        // Turf requires polygons to be nested in an extra array (representing rings)
        // Use try-catch as Turf might throw errors for invalid geometries (e.g., self-intersections)
        try {
            return turf.polygon([coordinates]); // Create a Turf polygon feature
        } catch (e) {
            console.warn("Failed to create Turf polygon (likely invalid geometry):", e.message, coordinates);
            return null;
        }
    }


    // --- Drawing Functions ---

    function drawGrid() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#2c3e50';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#445566';
        ctx.lineWidth = 0.5;
         // Draw grid lines and pegs more accurately
         for (let x = 0; x <= canvas.width; x += GRID_SPACING) {
             ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
             // Draw pegs along this vertical line (excluding y=0, handled by horizontal pass)
             for (let y = GRID_SPACING; y <= canvas.height; y += GRID_SPACING) { drawPeg(x, y); }
         }
         for (let y = 0; y <= canvas.height; y += GRID_SPACING) {
             ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
             // Draw pegs along this horizontal line (including x=0)
             for (let x = 0; x <= canvas.width; x += GRID_SPACING) { drawPeg(x, y); }
         }
        // Draw Axis numbers
        ctx.fillStyle = '#ccc'; ctx.font = '10px sans-serif';
        for (let i = 1; i * GRID_SPACING <= canvas.width; i++) ctx.fillText(i, i * GRID_SPACING - 3, 12);
        for (let i = 1; i * GRID_SPACING <= canvas.height; i++) ctx.fillText(i, 5, i * GRID_SPACING + 4);
    }

    function drawPeg(x, y) {
        ctx.beginPath();
        ctx.arc(x, y, PEG_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = PEG_COLOR;
        ctx.fill();
    }

    function drawSinglePolygon(polygon, index) {
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

    // Helper: Draw geometry returned by Turf.js on canvas
     function drawTurfGeometry(geometry, ctx) {
        if (!geometry) return;
        // Assumes fillStyle is set before calling

        if (geometry.type === 'Polygon') {
            drawCanvasRing(geometry.coordinates, ctx);
        } else if (geometry.type === 'MultiPolygon') {
            geometry.coordinates.forEach(polygonCoords => {
                 drawCanvasRing(polygonCoords, ctx);
            });
        }
         // Note: turf.intersect can sometimes return Points or LineStrings
         // if polygons touch at a point or edge. We are not drawing those here.
    }

    // Helper for drawTurfGeometry to draw rings on canvas
    function drawCanvasRing(rings, ctx) {
         ctx.beginPath();
         rings.forEach((ring) => { // A ring is an array of [x, y] points
              if (ring.length >= 3) { // Need at least 3 points for a valid ring segment
                  ctx.moveTo(ring[0][0], ring[0][1]);
                  for (let i = 1; i < ring.length; i++) {
                       ctx.lineTo(ring[i][0], ring[i][1]);
                  }
                  ctx.closePath(); // Close the individual ring
              }
         });
         // Fill using even-odd rule to handle potential holes correctly
         ctx.fill('evenodd');
    }


    // Revised drawIntersections Function using Turf.js
    function drawIntersections() {
        let intersectionAreaTotalPixels = 0;
        intersectionDisplay.textContent = `Intersection Area: N/A`; // Default

        let closedPolygons = polygons.filter(p => p.isClosed && p.vertices.length >= 3);
        if (closedPolygons.length < 2) {
            intersectionDisplay.textContent = `Intersection Area: 0.00 sq. units`;
            return;
        }

        ctx.fillStyle = INTERSECTION_COLOR; // Set fill for intersection areas

        for (let i = 0; i < closedPolygons.length; i++) {
            for (let j = i + 1; j < closedPolygons.length; j++) {
                const turfPoly1 = toTurfPolygonFormat(closedPolygons[i].vertices);
                const turfPoly2 = toTurfPolygonFormat(closedPolygons[j].vertices);

                if (!turfPoly1 || !turfPoly2) continue; // Skip if polygon format is invalid

                try {
                    const intersection = turf.intersect(turfPoly1, turfPoly2);

                    if (intersection) {
                        // Draw the actual intersection shape(s)
                        drawTurfGeometry(intersection.geometry, ctx);

                        // Calculate the area using Turf.js (in square pixels)
                        const areaPixels = turf.area(intersection);
                        intersectionAreaTotalPixels += areaPixels;
                    }
                } catch (e) {
                    console.error("Turf.js intersection error:", e.message);
                     // Avoid crashing if Turf encounters an issue
                }
            }
        }

        // Convert total area to square grid units and update display
        const intersectionAreaUnits = intersectionAreaTotalPixels / (GRID_SPACING * GRID_SPACING);
        intersectionDisplay.textContent = `Intersection Area: ${intersectionAreaUnits.toFixed(2)} sq. units`;
    }


    function redrawCanvas() {
        drawGrid();

        // Draw all base polygons first
        polygons.forEach((poly, index) => {
            drawSinglePolygon(poly, index);
        });

        // Draw intersections on top
        drawIntersections();
    }


    // --- UI Update Functions ---
    function updateCalculations() {
        let totalPerimeter = 0;
        let totalArea = 0; // Sum of individual areas

        polygons.forEach(poly => {
            totalPerimeter += calculatePerimeter(poly.vertices, poly.isClosed);
            if (poly.isClosed && poly.vertices.length >=3) { // Ensure valid polygon for area calc
                 try {
                    // Use turf area for consistency IF polygon is valid turf format
                     const turfPoly = toTurfPolygonFormat(poly.vertices);
                     if (turfPoly) {
                        totalArea += turf.area(turfPoly);
                     } else {
                         // Fallback to shoelace if turf format failed
                         totalArea += calculateArea(poly.vertices);
                     }
                 } catch (e) {
                      // Fallback if turf.area fails
                      totalArea += calculateArea(poly.vertices);
                 }
            }
        });

        const perimeterUnits = totalPerimeter / GRID_SPACING;
        const areaUnits = totalArea / (GRID_SPACING * GRID_SPACING); // Convert summed area

        perimeterDisplay.textContent = `Total Perimeter: ${perimeterUnits.toFixed(2)} units`;
        areaDisplay.textContent = `Total Area (Sum): ${areaUnits.toFixed(2)} sq. units`;
        // Intersection display is updated within drawIntersections
    }


    // --- Event Handlers ---

    function getMousePos(event) {
         const rect = canvas.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    }

    function snapToGrid(mouseX, mouseY) {
        const gridX = Math.round(mouseX / GRID_SPACING); const gridY = Math.round(mouseY / GRID_SPACING);
        const snappedX = gridX * GRID_SPACING; const snappedY = gridY * GRID_SPACING;
        // Ensure snapped points are within canvas bounds or on edge pegs
        const clampedX = Math.max(0, Math.min(snappedX, canvas.width));
        const clampedY = Math.max(0, Math.min(snappedY, canvas.height));
         // Optional stricter check for clicks far outside
         // if (mouseX < -GRID_SPACING/2 || mouseX > canvas.width + GRID_SPACING/2 || mouseY < -GRID_SPACING/2 || mouseY > canvas.height + GRID_SPACING/2) return null;
        return { x: clampedX, y: clampedY };
    }

    function findVertexNear(pos) {
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

    function handleMouseDown(event) {
        justDragged = false; // Reset flag
        const mousePos = getMousePos(event);
        const clickedVertexInfo = findVertexNear(mousePos);

        if (clickedVertexInfo) {
            isDragging = true;
            draggedPolygonIndex = clickedVertexInfo.polygonIndex;
            draggedVertexIndex = clickedVertexInfo.vertexIndex;
            canvas.style.cursor = 'grabbing';
            redrawCanvas();
        } else {
            isDragging = false;
            draggedPolygonIndex = -1;
            draggedVertexIndex = -1;
        }
    }

    function handleMouseMove(event) {
        const mousePos = getMousePos(event); // Get mouse pos for hover check
        if (!isDragging || draggedPolygonIndex === -1) {
            canvas.style.cursor = findVertexNear(mousePos) ? 'grab' : 'crosshair'; // Hover effect
            return;
        }

        canvas.style.cursor = 'grabbing';
        const snappedPoint = snapToGrid(mousePos.x, mousePos.y); // Use raw mouse for snap calc

        if (snappedPoint && polygons[draggedPolygonIndex]) {
            const currentVertex = polygons[draggedPolygonIndex].vertices[draggedVertexIndex];
             if (snappedPoint.x !== currentVertex.x || snappedPoint.y !== currentVertex.y) {
                polygons[draggedPolygonIndex].vertices[draggedVertexIndex] = snappedPoint;
                redrawCanvas();
                updateCalculations();
            }
        }
    }

     function handleMouseUp(event) {
        if (isDragging) {
            isDragging = false;
             justDragged = true; // Mark that a drag just finished
            canvas.style.cursor = 'crosshair';
            redrawCanvas(); // Final draw after drag
            updateCalculations(); // Final calculation
        }
    }

    function handleMouseLeave(event) {
         if (isDragging) handleMouseUp(event); // Treat leaving canvas like mouse up
         canvas.style.cursor = 'crosshair'; // Reset cursor
    }

    function handleCanvasClick(event) {
        if (justDragged) {
            justDragged = false; // Consume click event after drag
            draggedPolygonIndex = -1; // Reset indices fully now
            draggedVertexIndex = -1;
            return;
        }

        // Ensure indices are reset if no drag preceded this click
         if (!isDragging) {
            draggedPolygonIndex = -1;
            draggedVertexIndex = -1;
        }

        const mousePos = getMousePos(event);
        if (findVertexNear(mousePos)) { // Clicked on existing vertex, do nothing
            return;
        }

        const snappedPoint = snapToGrid(mousePos.x, mousePos.y);
        if (!snappedPoint) return; // Clicked outside grid

        // --- Logic for Adding Points ---
        if (currentPolygonIndex === -1) { // Start a new polygon
            polygons.push({ vertices: [snappedPoint], color: selectedColor, isClosed: false });
            currentPolygonIndex = polygons.length - 1;
        } else { // Add point to the currently active polygon
            const currentPoly = polygons[currentPolygonIndex];
            const verts = currentPoly.vertices;

            if (verts.length >= 2) { // Check if closing the shape
                 const distToStart = calculateDistance(snappedPoint, verts[0]);
                 if (distToStart < SNAP_THRESHOLD) {
                     const lastPoint = verts[verts.length - 1];
                      if (snappedPoint.x !== lastPoint.x || snappedPoint.y !== lastPoint.y) {
                           currentPoly.isClosed = true;
                           currentPolygonIndex = -1; // Finish drawing this one
                      } // else ignore click on last point when trying to close
                 } else { // Add point if not closing and not same as last
                     if (!(snappedPoint.x === verts[verts.length - 1].x && snappedPoint.y === verts[verts.length - 1].y)) {
                         verts.push(snappedPoint);
                     } // else ignore click on last point
                 }
            } else { // Add the second point
                 if (verts.length === 0 || !(snappedPoint.x === verts[verts.length - 1].x && snappedPoint.y === verts[verts.length - 1].y)) {
                      verts.push(snappedPoint);
                 } // else ignore click on last point
            }
        }

        redrawCanvas();
        updateCalculations();
    }

    function handleClear() {
        polygons = [];
        currentPolygonIndex = -1;
        isDragging = false;
        draggedPolygonIndex = -1;
        draggedVertexIndex = -1;
        justDragged = false;
        redrawCanvas();
        updateCalculations();
        intersectionDisplay.textContent = `Intersection Area: N/A`;
        console.log("Board cleared");
    }

    function handleColorSelect(event) {
         selectedColor = event.target.dataset.color;
         colorButtons.forEach(btn => btn.classList.remove('selected'));
         event.target.classList.add('selected');
    }


    // --- Initialization ---
    clearButton.addEventListener('click', handleClear);
    canvas.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove); // Use document for move/up
    document.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseLeave);
    canvas.addEventListener('click', handleCanvasClick);

    colorButtons.forEach(button => {
        button.addEventListener('click', handleColorSelect);
        if (button.dataset.color === DEFAULT_COLOR) {
             button.classList.add('selected');
        }
    });

    redrawCanvas(); // Initial draw
    updateCalculations(); // Initial calculation display

});
