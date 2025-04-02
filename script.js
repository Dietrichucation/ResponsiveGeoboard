    // Inside the script.js file...

    // ... (keep all the code before drawIntersections) ...

    function drawIntersections() {
        let intersectionAreaTotal = 0;
        intersectionDisplay.textContent = `Intersection Area: N/A`;

        let closedPolygons = polygons.filter(p => p.isClosed && p.vertices.length >= 3);

        if (closedPolygons.length < 2) return;

        ctx.fillStyle = INTERSECTION_COLOR;

        for (let i = 0; i < closedPolygons.length; i++) {
            for (let j = i + 1; j < closedPolygons.length; j++) {
                let poly1 = closedPolygons[i];
                let poly2 = closedPolygons[j];
                let bb1 = getBoundingBox(poly1.vertices);
                let bb2 = getBoundingBox(poly2.vertices);

                // *** ADD THIS CONSOLE LOG ***
                if (isDragging) { // Only log during drag to avoid flooding console
                     console.log(`Dragging - Checking Intersection BBs: Poly${i}:(${bb1.minX},${bb1.minY})->(${bb1.maxX},${bb1.maxY}), Poly${j}:(${bb2.minX},${bb2.minY})->(${bb2.maxX},${bb2.maxY})`);
                }
                // *** END OF ADDED LOG ***


                if (boundingBoxesOverlap(bb1, bb2)) {
                    let overlapX = Math.max(bb1.minX, bb2.minX);
                    let overlapY = Math.max(bb1.minY, bb2.minY);
                    let overlapMaxX = Math.min(bb1.maxX, bb2.maxX);
                    let overlapMaxY = Math.min(bb1.maxY, bb2.maxY);
                    let overlapW = overlapMaxX - overlapX;
                    let overlapH = overlapMaxY - overlapY;

                    if (overlapW > 0 && overlapH > 0) {
                        ctx.beginPath();
                        ctx.rect(overlapX, overlapY, overlapW, overlapH);
                        ctx.fill();

                        let approxIntersectionArea = (overlapW * overlapH) / (GRID_SPACING * GRID_SPACING);
                        intersectionAreaTotal += approxIntersectionArea;
                    }
                }
                // ... (rest of the loop and function)
            }
        }
        // ... (update display logic) ...
         if (intersectionAreaTotal > 0) {
             // Update text only if there's an overlap calculated this frame
             intersectionDisplay.textContent = `Intersection Area: ${intersectionAreaTotal.toFixed(2)} sq. units (Approx)`;
        } else {
            // Explicitly set to 0 if no overlap found this frame
             intersectionDisplay.textContent = `Intersection Area: 0.00 sq. units`;
        }
    }


    // ... (rest of the script.js code) ...
