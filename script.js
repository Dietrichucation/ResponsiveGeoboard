document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('geoboard-canvas');
    const ctx = canvas.getContext('2d');
    const perimeterDisplay = document.getElementById('perimeter-display');
    const areaDisplay = document.getElementById('area-display');
    const clearButton = document.getElementById('clear-button');

    // --- Configuration ---
    const GRID_SPACING = 40; // Pixels between grid points
    const PEG_RADIUS = 3;    // Radius of the dots
    const PEG_COLOR = 'white';
    const LINE_COLOR = '#f1c40f'; // Yellow line
    const LINE_WIDTH = 3;
    const SNAP_THRESHOLD = 15; // How close to click to a peg to add/close
    const DRAG_THRESHOLD = 10; // How close to click a vertex to start dragging (radius around vertex)

    let vertices = []; // Stores {x, y} coordinates of polygon vertices
    let isClosed = false; // Track if the polygon is closed by clicking near start

    // --- Drag State ---
    let isDragging = false;
    let draggedVertexIndex = -1; // Index of the vertex being dragged

    // --- Geometry Functions ---

    function calculateDistance(p1, p2) {
        // Ensure p1 and p2 are valid objects with x, y properties
        if (!p1 || !p2 || typeof p1.x === 'undefined' || typeof p1.y === 'undefined' || typeof p2.x === 'undefined' || typeof p2.y === 'undefined') {
            console.error("Invalid points for distance calculation:", p1, p2);
            return Infinity; // Return a large number to avoid issues
        }
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
        if (n < 3) return 0; // Need at least 3 vertices for area

        for (let i = 0; i < n; i++) {
             // Ensure vertices are valid before accessing properties
            const p1 = verts[i];
            const p2 = verts[(i + 1) % n]; // Wrap around for the last vertex
            if (!p1 || !p2) {
                console.error("Invalid vertex found during area calculation:", i, p1, p2);
                return 0; // Or handle error appropriately
            }
            area += (p1.x * p2.y - p2.x * p1.y);
        }
        return Math.abs(area) / 2.0;
    }

    // --- Drawing Functions ---

    function drawGrid() {
        ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear canvas first
        ctx.fillStyle = '#2c3e50'; // Set background color (optional if set in CSS)
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.strokeStyle = '#445566'; // Color for grid lines
        ctx.lineWidth = 0.5;

        // Draw grid lines and pegs (Simplified for clarity)
        for (let x = 0; x <= canvas.width; x += GRID_SPACING) {
             // Vertical lines
             ctx.beginPath();
             ctx.moveTo(x, 0);
             ctx.lineTo(x, canvas.height);
             ctx.stroke();
             // Pegs along the top edge (except corner handled later)
             if (x > 0 && x < canvas.width) drawPeg(x, 0);
        }
         for (let y = 0; y <= canvas.height; y += GRID_SPACING) {
             // Horizontal lines
             ctx.beginPath();
             ctx.moveTo(0, y);
             ctx.lineTo(canvas.width, y);
             ctx.stroke();
            // Pegs along the left edge (except corner handled later)
            if (y > 0 && y < canvas.height) drawPeg(0, y);

             // Draw inner pegs
             for (let x = GRID_SPACING; x < canvas.width; x += GRID_SPACING) {
                  if (y > 0 && y < canvas.height) {
                       drawPeg(x, y);
                  }
             }
         }
         drawPeg(0,0); // Draw top-left corner peg


        // Draw Axis numbers (simplified)
        ctx.fillStyle = '#ccc';
        ctx.font = '10px sans-serif';
        for (let i = 1; i * GRID_SPACING < canvas.width; i++) {
             ctx.fillText(i, i * GRID_SPACING - 3, 12);
        }
         for (let i = 1; i * GRID_SPACING < canvas.height; i++) {
             ctx.fillText(i, 5, i * GRID_SPACING + 4);
        }
    }


    function drawPeg(x, y) {
        ctx.beginPath();
        ctx.arc(x, y, PEG_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = PEG_COLOR;
        ctx.fill();
    }

    function drawPolygon() {
        if (vertices.length < 1) return;

        ctx.strokeStyle = LINE_COLOR;
        ctx.lineWidth = LINE_WIDTH;
        ctx.lineJoin = 'round'; // Nicer corners
        ctx.lineCap = 'round';

        // Draw the lines
        ctx.beginPath();
        ctx.moveTo(vertices[0].x, vertices[0].y);
        for (let i = 1; i < vertices.length; i++) {
            ctx.lineTo(vertices[i].x, vertices[i].y);
        }
        if (isClosed && vertices.length > 1) {
            ctx.closePath(); // Connects last point to first
        }
        ctx.stroke();

         // Highlight vertices slightly to show they are interactive points
         vertices.forEach((v, index) => {
            ctx.beginPath();
            ctx.arc(v.x, v.y, PEG_RADIUS + (index === draggedVertexIndex ? 3 : 1), 0, Math.PI * 2); // Make dragged vertex bigger
            ctx.fillStyle = index === draggedVertexIndex ? 'red' : LINE_COLOR; // Highlight dragged vertex
            ctx.fill();
        });
    }

    function redrawCanvas() {
        drawGrid();
        drawPolygon();
    }

    // --- UI Update Functions ---

    function updateCalculations() {
        const perimeter = calculatePerimeter(vertices, isClosed);
        // Area only makes sense for a closed polygon with 3+ vertices
        const area = (isClosed && vertices.length >= 3) ? calculateArea(vertices) : 0;

        // Convert pixels to grid units for display (assuming 1 grid unit = GRID_SPACING pixels)
        const perimeterUnits = perimeter / GRID_SPACING;
        const areaUnits = area / (GRID_SPACING * GRID_SPACING); // Area is in square units

        perimeterDisplay.textContent = `Perimeter: ${perimeterUnits.toFixed(2)} units`;
        areaDisplay.textContent = `Area: ${areaUnits.toFixed(2)} sq. units`;

        // Hide area if not applicable for open shapes or < 3 vertices
        areaDisplay.style.display = (isClosed && vertices.length >= 3) ? 'block' : 'none';
    }

    // --- Event Handlers ---

    // Function to get mouse position relative to canvas
    function getMousePos(event) {
         const rect = canvas.getBoundingClientRect();
         return {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
         };
    }

    // Function to find the nearest grid point (peg)
    function snapToGrid(mouseX, mouseY) {
        const gridX = Math.round(mouseX / GRID_SPACING);
        const gridY = Math.round(mouseY / GRID_SPACING);

        const snappedX = gridX * GRID_SPACING;
        const snappedY = gridY * GRID_SPACING;

        // Basic boundary check - Ensure snapped points are within canvas bounds
        // Adjust slightly if pegs are exactly on the edge and might round outside
        const canvasWidth = canvas.width; // Assuming pegs can be at width/height
        const canvasHeight = canvas.height;

        const clampedX = Math.max(0, Math.min(snappedX, canvasWidth - (canvasWidth % GRID_SPACING === 0 ? 0 : GRID_SPACING)));
        const clampedY = Math.max(0, Math.min(snappedY, canvasHeight - (canvasHeight % GRID_SPACING === 0 ? 0 : GRID_SPACING)));


         // Return null if outside a reasonable boundary (optional stricter check)
        if (mouseX < -GRID_SPACING/2 || mouseX > canvas.width + GRID_SPACING/2 ||
            mouseY < -GRID_SPACING/2 || mouseY > canvas.height + GRID_SPACING/2) {
            return null;
        }


        return { x: clampedX, y: clampedY };
    }


    // Function to find which vertex is near the mouse position
    function findVertexNear(pos) {
        for (let i = 0; i < vertices.length; i++) {
            if (calculateDistance(pos, vertices[i]) < DRAG_THRESHOLD) {
                return i; // Return the index of the found vertex
            }
        }
        return -1; // Return -1 if no vertex is found nearby
    }


    function handleMouseDown(event) {
        const mousePos = getMousePos(event);
        const clickedVertexIndex = findVertexNear(mousePos);

        if (clickedVertexIndex !== -1) {
            isDragging = true;
            draggedVertexIndex = clickedVertexIndex;
            canvas.style.cursor = 'grabbing'; // Change cursor
            redrawCanvas(); // Redraw to highlight dragged vertex
        } else {
            isDragging = false; // Ensure dragging is off if clicking empty space
            draggedVertexIndex = -1;
        }
    }

    function handleMouseMove(event) {
        if (!isDragging || draggedVertexIndex === -1) {
            // Optional: Change cursor if hovering over a vertex even when not dragging
            const mousePos = getMousePos(event);
            if (findVertexNear(mousePos) !== -1) {
                canvas.style.cursor = 'grab';
            } else {
                canvas.style.cursor = 'crosshair';
            }
            return;
        }

        canvas.style.cursor = 'grabbing'; // Keep cursor grabbing
        const mousePos = getMousePos(event);
        const snappedPoint = snapToGrid(mousePos.x, mousePos.y);

        if (snappedPoint &&
            (snappedPoint.x !== vertices[draggedVertexIndex].x || snappedPoint.y !== vertices[draggedVertexIndex].y))
        {
            // Check if the snapped point is already occupied by another vertex (optional)
            let occupied = false;
            for(let i=0; i<vertices.length; i++) {
                if (i !== draggedVertexIndex && vertices[i].x === snappedPoint.x && vertices[i].y === snappedPoint.y) {
                    occupied = true;
                    break;
                }
            }

            if (!occupied) {
                vertices[draggedVertexIndex] = snappedPoint;
                redrawCanvas();
                updateCalculations();
            }
        }
    }

    function handleMouseUp(event) {
        if (isDragging) {
            isDragging = false;
            draggedVertexIndex = -1;
            canvas.style.cursor = 'crosshair'; // Reset cursor
            redrawCanvas(); // Redraw to unhighlight vertex
            updateCalculations(); // Final update
        }
    }

    function handleMouseLeave(event) {
         // If dragging and mouse leaves canvas, treat it like mouse up
         if (isDragging) {
            handleMouseUp(event);
         }
          canvas.style.cursor = 'crosshair'; // Reset cursor when leaving
    }


    // MODIFIED CLICK HANDLER
    function handleCanvasClick(event) {
        // If a drag operation just finished on this element, don't process click to add point
         if (isDragging) {
             return; // Dragging handles its own logic on mouse up
         }

        const mousePos = getMousePos(event);

        // Crucial check: If the click was near an existing vertex, do nothing.
        // The mousedown would have already initiated a drag if intended.
        if (findVertexNear(mousePos) !== -1) {
            return;
        }

        // --- Original Add Point Logic (runs only if not clicking existing vertex) ---
        if (isClosed) return; // Don't add points if shape is already closed

        const snappedPoint = snapToGrid(mousePos.x, mousePos.y);

        if (!snappedPoint) return; // Ignore clicks outside grid

        // Check if clicking near the start point to close the shape
        if (vertices.length > 1) {
             const distToStart = calculateDistance(snappedPoint, vertices[0]);
             if (distToStart < SNAP_THRESHOLD) {
                 // Close the shape only if it's not the exact same point as the last one
                 const lastPoint = vertices[vertices.length-1];
                 if (snappedPoint.x !== lastPoint.x || snappedPoint.y !== lastPoint.y) {
                      isClosed = true;
                      console.log("Shape closed");
                      // Don't add the starting point again, just mark as closed
                 }
             } else {
                 // Add the new point if it's not the same as the last point
                 if (vertices.length === 0 || !(snappedPoint.x === vertices[vertices.length-1].x && snappedPoint.y === vertices[vertices.length-1].y)) {
                      vertices.push(snappedPoint);
                 }
             }
        } else {
             // Add the first or second point
             if (vertices.length === 0 || !(snappedPoint.x === vertices[vertices.length-1].x && snappedPoint.y === vertices[vertices.length-1].y)) {
                vertices.push(snappedPoint);
             }
        }

        redrawCanvas();
        updateCalculations();
    }


    function handleClear() {
        vertices = [];
        isClosed = false;
        isDragging = false; // Reset drag state too
        draggedVertexIndex = -1;
        redrawCanvas();
        updateCalculations();
        areaDisplay.style.display = 'block'; // Show area label again initially
        console.log("Board cleared");
         areaDisplay.style.display = 'none'; // Hide area initially
    }

    // --- Initialization ---
    clearButton.addEventListener('click', handleClear);

    // Add new event listeners for drag-and-drop
    canvas.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove); // Listen on document to catch mouse moves outside canvas
    document.addEventListener('mouseup', handleMouseUp);     // Listen on document to catch mouse up outside canvas
    canvas.addEventListener('mouseleave', handleMouseLeave); // Handle mouse leaving canvas while dragging

    // Keep the original click listener, but its logic is now adjusted
    canvas.addEventListener('click', handleCanvasClick);

    redrawCanvas(); // Initial draw of the empty grid
    updateCalculations(); // Initial calculation display (zeros)
    areaDisplay.style.display = 'none'; // Hide area initially
});
