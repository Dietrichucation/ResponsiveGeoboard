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
    const SNAP_THRESHOLD = 15; // How close to click to a peg

    let vertices = []; // Stores {x, y} coordinates of polygon vertices
    let isClosed = false; // Track if the polygon is closed by clicking near start

    // --- Geometry Functions ---

    function calculateDistance(p1, p2) {
        return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
    }

    function calculatePerimeter(verts, closed) {
        let perimeter = 0;
        if (verts.length < 2) return 0;

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
        const n = verts.length;
        if (n < 3) return 0; // Need at least 3 vertices for area

        for (let i = 0; i < n; i++) {
            const p1 = verts[i];
            const p2 = verts[(i + 1) % n]; // Wrap around for the last vertex
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

        // Draw vertical lines and pegs
        for (let x = GRID_SPACING; x < canvas.width; x += GRID_SPACING) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
            for (let y = GRID_SPACING; y < canvas.height; y += GRID_SPACING) {
                 drawPeg(x, y);
            }
        }
        // Draw horizontal lines and pegs along y-axis (avoiding double drawing)
         for (let y = GRID_SPACING; y < canvas.height; y += GRID_SPACING) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
             for (let x = GRID_SPACING; x < canvas.width; x += GRID_SPACING) {
                 if (y === GRID_SPACING) { // Only draw pegs on the first horizontal pass
                    drawPeg(x, y);
                 }
             }
             // Draw pegs along the y-axis itself
             drawPeg(0, y);
        }
         // Draw pegs along the x-axis itself
        for (let x = GRID_SPACING; x < canvas.width; x += GRID_SPACING) {
             drawPeg(x, 0);
        }
        drawPeg(0,0); // Draw corner peg

        // Draw Axis numbers (simplified)
        ctx.fillStyle = '#ccc';
        ctx.font = '10px sans-serif';
        for (let x = GRID_SPACING; x < canvas.width; x += GRID_SPACING) {
             ctx.fillText(x / GRID_SPACING, x - 3, 12);
        }
         for (let y = GRID_SPACING; y < canvas.height; y += GRID_SPACING) {
             ctx.fillText(y / GRID_SPACING, 5, y + 4);
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

        // Optionally, draw circles at vertices if desired (pegs are already drawn by grid)
        // vertices.forEach(v => {
        //     ctx.beginPath();
        //     ctx.arc(v.x, v.y, PEG_RADIUS + 1, 0, Math.PI * 2); // Slightly larger to overlay grid peg
        //     ctx.fillStyle = LINE_COLOR;
        //     ctx.fill();
        // });
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

        // Hide area if not applicable
         areaDisplay.style.display = (isClosed && vertices.length >= 3) ? 'block' : 'none';

    }

    // --- Event Handlers ---

    function snapToGrid(mouseX, mouseY) {
        const gridX = Math.round(mouseX / GRID_SPACING);
        const gridY = Math.round(mouseY / GRID_SPACING);

        const snappedX = gridX * GRID_SPACING;
        const snappedY = gridY * GRID_SPACING;

        // Basic boundary check
        if (snappedX < 0 || snappedX >= canvas.width || snappedY < 0 || snappedY >= canvas.height) {
             return null; // Clicked outside usable grid area
        }

        return { x: snappedX, y: snappedY };
    }

    function handleCanvasClick(event) {
        if (isClosed) return; // Don't add points if shape is already closed

        const rect = canvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;

        const snappedPoint = snapToGrid(mouseX, mouseY);

        if (!snappedPoint) return; // Ignore clicks outside grid

        // Check if clicking near the start point to close the shape
        if (vertices.length > 1) {
             const distToStart = calculateDistance(snappedPoint, vertices[0]);
             if (distToStart < SNAP_THRESHOLD) {
                 // Close the shape
                 isClosed = true;
                 console.log("Shape closed");
                 // Don't add the starting point again, just mark as closed
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
        redrawCanvas();
        updateCalculations();
        areaDisplay.style.display = 'block'; // Show area label again initially
        console.log("Board cleared");
    }

    // --- Initialization ---
    clearButton.addEventListener('click', handleClear);
    canvas.addEventListener('click', handleCanvasClick);
    redrawCanvas(); // Initial draw of the empty grid
    updateCalculations(); // Initial calculation display (zeros)
     areaDisplay.style.display = 'none'; // Hide area initially
});