(function() {
    // DOM and Canvas Elements
    var offscreenCanvas = document.getElementById('terminalCanvas');
    var ctx;

    // Create offscreen canvas if it doesn't exist or set dimensions if needed
    if (!offscreenCanvas) {
        offscreenCanvas = document.createElement('canvas');
        offscreenCanvas.id = 'terminalCanvas';
        offscreenCanvas.width = 800;
        offscreenCanvas.height = 600;
        offscreenCanvas.style.display = 'none';
        document.body.appendChild(offscreenCanvas);
    } else if (!offscreenCanvas.width || !offscreenCanvas.height) {
        offscreenCanvas.width = 800;
        offscreenCanvas.height = 600;
    }

    ctx = offscreenCanvas.getContext('2d');

    // Create a second canvas specifically for the border
    var borderCanvas = document.createElement('canvas');
    borderCanvas.width = offscreenCanvas.width;
    borderCanvas.height = offscreenCanvas.height;
    var borderCtx = borderCanvas.getContext('2d');

    // Assets
    var logoImage = new Image();
    logoImage.crossOrigin = "anonymous";
    var gifFrames = [];
    var currentFrameIndex = 0;
    var totalFrames = 48;
    var frameDelay = 80;
    var isFocused = true;

    // Terminal state
    var bootSequence = [
        {type: "line", content: "Starting MS-GOD..."},
        {type: "line", content: "Shinku is testing extended memory...done."},
        {type: "line", content: "Starting GIAD Terminal Protocol..."},
        {
            type: "block", content: [
                "C:\\GIAD\\TERMINAL.EXE",
                "God is a designer © All Rights Reserved.",
                "1981 to 2049 / United States of America.",
                "神はクリエイターである"
            ]
        },
        {type: "line", content: "Department of Design and Aesthetics"},
        {type: "line", content: "創造に触発されて"},
        {type: "line", content: ""},
        {
            type: "block", content: [
                "DOS        <DIR>     12.05.20       15:57",
                "COMMAND    COM       94.05.31       6:22",
                "GIAD20     2008      173.255.189.42 6:22",
                "CONFIG     SYS       12.05.20       15:57",
                "AUTOEXEC  BAT        12.05.20",
                "5 File(s)             292864 bytes free",
                "Memory size: 116432 bytes"
            ]
        },
        {type: "line", content: "Free disk space: 1842 MB"},
        {type: "line", content: "GIAD<r> Terminal Protocol initiated."},
        {type: "line", content: "Press any key to continue..."}
    ];
    var bootDisplayLines = [];
    var bootIndex = 0;
    var phase = "boot";
    var bootPhaseEndTime = 0;
    var postBootEndTime = 0;
    var commandInput = "";
    var eggMessage = "";
    var showCursor = true;
    var cursorTimer = 0;
    var startTime = Date.now();

    // Rendering properties - Use fixed internal resolution
    var terminalWidth = offscreenCanvas.width;
    var terminalHeight = offscreenCanvas.height;
    var terminalAspect = terminalWidth / terminalHeight;
    var glitchSpeed = 50;
    var currentGlitchY = 0;
    var lastGlitchUpdate = Date.now();

    // Three.js objects
    var terminalTexture, borderTexture, planeMesh, borderPlaneMesh;
    var renderer, camera, scene;

    // Load GIF frames for animation
    (function loadGifFrames() {
        for (var i = 0; i < totalFrames; i++) {
            var frameNumber = i < 10 ? "0" + i : i;
            var img = new Image();
            img.crossOrigin = "anonymous";
            img.src = "gif-frames/frame_" + frameNumber + "_delay-0.08s.gif";
            gifFrames.push(img);
        }
    })();

    function launchPhase2() {
        if (phase === "postBoot") return;
        phase = "postBoot";
        postBootEndTime = Date.now() + 90000;

        if (window.innerWidth > window.innerHeight) return;

        var cmdInput = document.getElementById('cmd');
        if (!cmdInput) {
            cmdInput = document.createElement('input');
            cmdInput.id = 'cmd';
            cmdInput.type = 'text';
            cmdInput.style.position = 'absolute';
            cmdInput.style.opacity = '0';
            cmdInput.style.pointerEvents = 'none';
            document.body.appendChild(cmdInput);
        }
        cmdInput.focus();
    }

    function updateGifFrame() {
        var elapsed = Date.now() - startTime;
        currentFrameIndex = Math.floor(elapsed / frameDelay) % totalFrames;
    }

    function drawRoundedRect(ctx, x, y, width, height, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
    }

    function drawInvertedBorder(ctx, x, y, width, height, radius) {
        // Save the current state
        ctx.save();

        // Draw a full canvas rectangle
        ctx.beginPath();
        ctx.rect(0, 0, ctx.canvas.width, ctx.canvas.height);

        // Create the rounded rectangle path
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);

        // This creates a path that is the outside of the rounded rectangle
        // by using the "evenodd" fill rule
        ctx.fill("evenodd");

        // Restore the context
        ctx.restore();
    }

    // Function to draw only the border on the separate canvas
    function drawBorder() {
        // Clear the border canvas
        borderCtx.clearRect(0, 0, terminalWidth, terminalHeight);

        const borderMargin = 40;
        const borderRadius = 0;

        // Disable anti-aliasing for sharper edges
        borderCtx.imageSmoothingEnabled = true;

        // Fill the inverted area (the main bezel)
        borderCtx.fillStyle = '#2A2520';
        drawInvertedBorder(
            borderCtx,
            borderMargin,
            borderMargin,
            terminalWidth - 2 * borderMargin,
            terminalHeight - 2 * borderMargin,
            borderRadius
        );

        const baseRadius = Math.sqrt(
            Math.pow(terminalWidth / 2, 2) +
            Math.pow(terminalHeight / 2, 2)
        );

        const centerX = terminalWidth / 2;
        const centerY = terminalHeight / 2;


        const radius = baseRadius * gradientSettings.radiusMultiplier;
        const offsetCenterX = centerX + gradientSettings.centerOffset;
        const offsetCenterY = centerY + gradientSettings.centerOffset;

        var grad = borderCtx.createRadialGradient(
            offsetCenterX, offsetCenterY, 0,  // Start point (center)
            offsetCenterX, offsetCenterY, radius  // End point (diagonal length)
        );

        // Add color stops with dynamic color values
        grad.addColorStop(0, `rgba(${gradientSettings.startColorR}, ${gradientSettings.startColorG}, ${gradientSettings.startColorB}, ${gradientSettings.startColorA})`);
        grad.addColorStop(1, `rgba(${gradientSettings.endColorR}, ${gradientSettings.endColorG}, ${gradientSettings.endColorB}, ${gradientSettings.endColorA})`);

        borderCtx.fillStyle = grad;

        drawInvertedBorder(
            borderCtx,
            borderMargin,
            borderMargin,
            terminalWidth - 2 * borderMargin,
            terminalHeight - 2 * borderMargin,
            borderRadius
        );


        // Draw a subtle inner edge
        borderCtx.save();
        drawRoundedRect(
            borderCtx,
            borderMargin,
            borderMargin,
            terminalWidth - 2 * borderMargin,
            terminalHeight - 2 * borderMargin,
            borderRadius
        );
        borderCtx.globalCompositeOperation = "soft-light";
        borderCtx.strokeStyle = '#2A2520';
        borderCtx.shadowBlur = 10;
        borderCtx.shadowColor = '#00bbff';
        borderCtx.lineWidth = 1;
        borderCtx.stroke();

        borderCtx.fillStyle = '#000';
        borderCtx.globalCompositeOperation = "source-out";
        borderCtx.shadowBlur = 10;
        borderCtx.shadowColor = '#fff';
        borderCtx.shadowOffsetX = 25;
        borderCtx.shadowOffsetY = 20;
        borderCtx.clip();
        borderCtx.fill();

        borderCtx.fillStyle = '#000';
        borderCtx.shadowBlur = 10;
        borderCtx.shadowColor = '#fff';
        borderCtx.shadowOffsetX = -25;
        borderCtx.shadowOffsetY = -20;
        borderCtx.clip();
        borderCtx.fill();

        borderCtx.restore();

        let borderWidth = 1;
        drawRoundedRect(
            borderCtx,
            borderWidth * 2,
            borderWidth * 2,
            (terminalWidth - 2 * borderMargin) + ((borderMargin * 2) - 5),
            (terminalHeight - 2 * borderMargin) + ((borderMargin * 2) - 5),
            25
        );
        borderCtx.strokeStyle = 'rgba(255,255,255,.15)';
        borderCtx.lineWidth = borderWidth;
        borderCtx.stroke();
        borderCtx.restore();

        // Draw the outer edge with a FILL instead of a stroke to avoid corner gaps
        borderCtx.save();

        // Draw the outer border using two paths and fill the area between them
        const outerBorderWidth = 1; // Border width

        // First draw the outer edge of the border
        borderCtx.beginPath();
        drawRoundedRect(
            borderCtx,
            1,
            1,
            terminalWidth - 2,
            terminalHeight - 2,
            borderRadius + (borderMargin - 1)
        );

        // Create a second path (slightly smaller) for the inner edge of the border
        borderCtx.beginPath();
        // Outer path
        borderCtx.moveTo(0, 0);
        borderCtx.lineTo(terminalWidth, 0);
        borderCtx.lineTo(terminalWidth, terminalHeight);
        borderCtx.lineTo(0, terminalHeight);
        borderCtx.lineTo(0, 0);
        borderCtx.closePath();

        // Inner path (subtracts from outer path)
        const ir = 20
        borderCtx.moveTo(1 + outerBorderWidth + ir, 1 + outerBorderWidth);
        borderCtx.lineTo(terminalWidth - 1 - outerBorderWidth - ir, 1 + outerBorderWidth);
        borderCtx.arcTo(
            terminalWidth - 1 - outerBorderWidth, 1 + outerBorderWidth,
            terminalWidth - 1 - outerBorderWidth, 1 + outerBorderWidth + ir,
            ir
        );
        borderCtx.lineTo(terminalWidth - 1 - outerBorderWidth, terminalHeight - 1 - outerBorderWidth - ir);
        borderCtx.arcTo(
            terminalWidth - 1 - outerBorderWidth, terminalHeight - 1 - outerBorderWidth,
            terminalWidth - 1 - outerBorderWidth - ir, terminalHeight - 1 - outerBorderWidth,
            ir
        );
        borderCtx.lineTo(1 + outerBorderWidth + ir, terminalHeight - 1 - outerBorderWidth);
        borderCtx.arcTo(
            1 + outerBorderWidth, terminalHeight - 1 - outerBorderWidth,
            1 + outerBorderWidth, terminalHeight - 1 - outerBorderWidth - ir,
            ir
        );
        borderCtx.lineTo(1 + outerBorderWidth, 1 + outerBorderWidth + ir);
        borderCtx.arcTo(
            1 + outerBorderWidth, 1 + outerBorderWidth,
            1 + outerBorderWidth + ir, 1 + outerBorderWidth,
            ir
        );
        borderCtx.closePath();

        // Fill the area between paths
        borderCtx.fillStyle = '#1A1A1A';
        borderCtx.fill('evenodd');
        borderCtx.restore();

        // Update the border texture if it exists
        if (borderTexture) {
            borderTexture.needsUpdate = true;
        }
    }

    const gui = new dat.GUI();

    // Gradient center controls
    const centerFolder = gui.addFolder('Gradient Center');
    centerFolder.add(gradientSettings, 'centerOffset', -500, 500).onChange(drawBorder);
    centerFolder.add(gradientSettings, 'radiusMultiplier', 0.1, 2).onChange(drawBorder);
    centerFolder.open();

    // Start Color Folder
    const startColorFolder = gui.addFolder('Start Color');
    startColorFolder.add(gradientSettings, 'startColorR', 0, 255).onChange(drawBorder);
    startColorFolder.add(gradientSettings, 'startColorG', 0, 255).onChange(drawBorder);
    startColorFolder.add(gradientSettings, 'startColorB', 0, 255).onChange(drawBorder);
    startColorFolder.add(gradientSettings, 'startColorA', 0, 1).step(0.01).onChange(drawBorder);
    startColorFolder.open();

    // End Color Folder
    const endColorFolder = gui.addFolder('End Color');
    endColorFolder.add(gradientSettings, 'endColorR', 0, 255).onChange(drawBorder);
    endColorFolder.add(gradientSettings, 'endColorG', 0, 255).onChange(drawBorder);
    endColorFolder.add(gradientSettings, 'endColorB', 0, 255).onChange(drawBorder);
    endColorFolder.add(gradientSettings, 'endColorA', 0, 1).step(0.01).onChange(drawBorder);
    endColorFolder.open();

    function drawTerminal() {
        // Clear the offscreen canvas
        ctx.clearRect(0, 0, terminalWidth, terminalHeight);

        // Draw background: blue gradient
        var grad = ctx.createLinearGradient(0, 0, 0, terminalHeight);
        grad.addColorStop(0, '#082538');
        grad.addColorStop(1, '#03203b');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, terminalWidth, terminalHeight);

        // Draw full screen horizontal stripes to mimic an old computer screen
        var stripeHeight = 4;
        ctx.save();
        ctx.globalAlpha = 0.1;
        ctx.fillStyle = '#000';
        for (var y = 0; y < terminalHeight; y += stripeHeight * 2) {
            ctx.fillRect(0, y, terminalWidth, stripeHeight);
        }
        ctx.restore();

        // IMPORTANT: We remove the border drawing from here
        // It will be drawn on the borderCanvas instead

        ctx.shadowColor = '#cfdfff';
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#cfdfff';
        ctx.font = '16px IBM1971';
        var lineHeight = 24;

        var now = Date.now();
        const textMarginX = Math.floor(terminalWidth * 0.05) + 50;

        if (phase === "boot") {

            // LOGO

            var giadLogoImage = new Image();
            giadLogoImage.src = 'GIAD-AestheticPreserver_Pixelated.png';
            giadLogoImage.onerror = function() {
                console.error('Failed to load GIAD logo image');
            };
            if (giadLogoImage && giadLogoImage.complete) {
                const padding = 100; // Padding from the edge
                const aspectRatio = 1

                // Calculate height to maintain aspect ratio
                const imageHeight = 175;
                const imageWidth = imageHeight * aspectRatio;

                // Position in top right corner
                const imageX = terminalWidth - imageWidth - padding;
                const imageY = padding;

                ctx.drawImage(
                    giadLogoImage,
                    imageX,
                    imageY,
                    imageWidth,
                    imageHeight
                );
            }

            // Maximum visible lines on screen
            const maxVisibleLines = Math.floor((terminalHeight - 100) / lineHeight);

            // If we have more lines than can fit, trim the oldest ones
            let visibleLines = bootDisplayLines;
            if (bootDisplayLines.length > maxVisibleLines) {
                visibleLines = bootDisplayLines.slice(-maxVisibleLines);
            }

            // Calculate vertical centering
            const totalTextHeight = visibleLines.length * lineHeight;
            //const startY = (terminalHeight - totalTextHeight) / 2;
            const startY = 100

            // Draw boot sequence lines, left-aligned but vertically centered
            for (var i = 0; i < visibleLines.length; i++) {
                ctx.fillText(visibleLines[i], textMarginX, startY + i * lineHeight);
            }

            if (bootPhaseEndTime > 0) {
                var remaining = Math.ceil((bootPhaseEndTime - now) / 1000);
                // Place countdown below the content, centered on the screen
                const countdownY = startY + visibleLines.length * lineHeight + 25;
                ctx.textAlign = 'center';
                ctx.fillText("AUTO LOADING IN [ " + remaining + " ]", terminalWidth / 2, countdownY);
                ctx.textAlign = 'left';
            }
        } else if (phase === "postBoot") {
            // For post-boot phase, center the logo vertically in the upper portion
            const upperPortion = terminalHeight * 0.4;

            // Draw the current gif frame
            if (gifFrames.length > 0 && gifFrames[currentFrameIndex] && gifFrames[currentFrameIndex].complete) {
                var logoWidth = 130;
                var logoHeight = gifFrames[currentFrameIndex].height * (logoWidth / gifFrames[currentFrameIndex].width);
                var centerX = terminalWidth / 2;
                var centerY = upperPortion / 2;
                ctx.drawImage(gifFrames[currentFrameIndex], centerX - logoWidth / 2, centerY - logoHeight / 2, logoWidth, logoHeight);
            }

            // Draw ACCESS TERMINAL button text
            ctx.textAlign = 'center';
            ctx.fillText("ACCESS TERMINAL", terminalWidth / 2, terminalHeight * 0.6);
            var textMetrics = ctx.measureText("ACCESS TERMINAL");
            var textX = terminalWidth / 2 - textMetrics.width / 2;
            var textY = terminalHeight * 0.6 + 4;
            ctx.beginPath();
            ctx.moveTo(textX, textY);
            ctx.lineTo(textX + textMetrics.width, textY);
            ctx.lineWidth = 1;
            ctx.strokeStyle = ctx.fillStyle;
            ctx.stroke();

            // Draw 90-second countdown
            var countdownRemaining = Math.max(0, Math.ceil((postBootEndTime - Date.now()) / 1000));
            ctx.fillText("LOADING IN [ " + countdownRemaining + " ]", terminalWidth / 2, terminalHeight * 0.65);

            // Draw command prompt - left-aligned
            ctx.textAlign = 'left';
            var prompt = "C:\\GIAD> ";
            ctx.fillText(prompt + commandInput + (showCursor ? "_" : ""), textMarginX, terminalHeight * 0.8);

            // Draw egg message if available - left-aligned
            if (eggMessage !== "") {
                ctx.fillText(eggMessage, textMarginX, terminalHeight * 0.85);
            }
        }

        // Draw glitch effects (common to both phases)
        var thickness = Math.random() * 0.2 + 0.1;
        var alpha = 0.2 + Math.random() * 0.3;
        ctx.fillStyle = "rgba(255,255,255," + alpha + ")";
        ctx.fillRect(0, currentGlitchY, terminalWidth, thickness);

        // Update terminal texture
        if (terminalTexture) {
            terminalTexture.needsUpdate = true;
        }
    }

    function addBootLine(content) {
        const maxVisibleLines = 16;
        bootDisplayLines.push(content);
        if (bootDisplayLines.length > maxVisibleLines) {
            bootDisplayLines.shift();
        }
        return bootDisplayLines.length;
    }

    function runBootSequence() {
        if (bootIndex < bootSequence.length) {
            var entry = bootSequence[bootIndex++];
            if (entry.type === "line") {
                addBootLine(entry.content);
                setTimeout(runBootSequence, 150);
            } else if (entry.type === "block") {
                entry.content.forEach(function (line) {
                    addBootLine(line);
                });
                setTimeout(runBootSequence, 500);
            }
        } else {
            if (bootPhaseEndTime === 0) {
                bootPhaseEndTime = Date.now() + 3000;
            }
        }
    }

    function calculateCrtValues() {
        // Get actual window dimensions
        const clientWidth = document.documentElement.clientWidth || window.innerWidth;
        const clientHeight = document.documentElement.clientHeight || window.innerHeight;

        // Calculate aspect-ratio friendly dimensions
        const windowAspect = clientWidth / clientHeight;
        //const contentAspect = terminalWidth / terminalHeight;
        const contentAspect = windowAspect;

        // Use nearly all of the screen space - remove the margins
        const maxScreenPct = 1

        let width, height;

        // Determine dimensions based on aspect ratio
        if (windowAspect > contentAspect) {
            // Window is wider than content aspect ratio - height constrained
            height = clientHeight * maxScreenPct;
            width = height * contentAspect;
        } else {
            // Window is taller than content aspect ratio - width constrained
            width = clientWidth * maxScreenPct;
            height = width / contentAspect;
        }

        // Calculate left and top positions to center - minimal margins
        const leftX = (clientWidth - width) / 2;
        const topY = (clientHeight - height) / 2;

        // Calculate distortion based on aspect ratio and screen size
        const isMobile = clientWidth < 768 || clientHeight < 600;
        const horizontalCurveFactor = isMobile ? 0.05 : (windowAspect < 1 ? 0.1 : 0.3);
        const verticalCurveFactor = isMobile ? 0.05 : 0.2;

        return {
            innerWidth: width,
            innerHeight: height,
            innerLeftX: leftX,
            innerTopY: topY,
            horizontalCurveFactor: horizontalCurveFactor,
            verticalCurveFactor: verticalCurveFactor
        };
    }

    function animate() {
        // Request the next frame first to ensure smooth animation
        if (isFocused) {
            requestAnimationFrame(animate);
        } else {
            // If not focused, reduce animation frequency to save resources
            setTimeout(() => {
                requestAnimationFrame(animate);
            }, 1000);
            return;
        }

        // Ensure canvas is properly set up
        ensureOffscreenCanvas();

        var now = Date.now();
        var delta = (now - lastGlitchUpdate) / 1000;
        lastGlitchUpdate = now;
        currentGlitchY += glitchSpeed * delta;
        if (Math.random() < 0.015) {
            currentGlitchY = Math.random() * terminalHeight;
        }
        if (currentGlitchY >= terminalHeight) {
            currentGlitchY -= terminalHeight;
        }

        // Update blinking cursor every 0.5 seconds
        cursorTimer += delta;
        if (cursorTimer >= 0.5) {
            showCursor = !showCursor;
            cursorTimer = 0;
        }

        // Update the current gif frame
        updateGifFrame();

        // If in boot phase and boot countdown has elapsed, transition to post boot
        if (phase === "boot" && bootPhaseEndTime > 0 && now >= bootPhaseEndTime) {
            launchPhase2();
        }

        const shouldRedirect = phase === "postBoot" && now >= postBootEndTime;
        const isDevMode = window.location.href.includes('localhost');

        // If in post boot phase and countdown expired, redirect
        if (shouldRedirect) {
            if (isDevMode) {
                window.location.reload();
            } else {
                window.location.href = "https://terminal.godisadesigner.com/";
            }
        }

        // Draw the terminal content
        drawTerminal();

        // Draw the border on the separate canvas
        drawBorder();

        var elapsed = (Date.now() - startTime) / 1000;

        // Update time uniform for main content
        if (planeMesh && planeMesh.material && planeMesh.material.uniforms && planeMesh.material.uniforms.time) {
            planeMesh.material.uniforms.time.value = elapsed;
        }

        // Update time uniform for border
        if (borderPlaneMesh && borderPlaneMesh.material && borderPlaneMesh.material.uniforms && borderPlaneMesh.material.uniforms.time) {
            borderPlaneMesh.material.uniforms.time.value = elapsed;
        }

        renderer.render(scene, camera);
    }

    function init() {
        // Ensure canvas is ready before initializing
        ensureOffscreenCanvas();

        // Create renderer with proper settings - full screen with dark background
        renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: false,
            powerPreference: 'high-performance'
        });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setClearColor(0x1A1A1A, 1); // Dark gray background for entire canvas
        renderer.setPixelRatio(window.devicePixelRatio || 1);

        // Add renderer to document and make it fill screen
        document.body.appendChild(renderer.domElement);
        renderer.domElement.style.position = 'fixed';
        renderer.domElement.style.top = '0';
        renderer.domElement.style.left = '0';
        renderer.domElement.style.width = '100%';
        renderer.domElement.style.height = '100%';
        document.body.style.margin = '0';
        document.body.style.overflow = 'hidden';

        // Initialize the CRT values for responsive positioning
        window.crtValues = calculateCrtValues();

        // Create an orthographic camera covering the whole window
        camera = new THREE.OrthographicCamera(
            window.innerWidth / -2, window.innerWidth / 2,
            window.innerHeight / 2, window.innerHeight / -2,
            -1000, 1000
        );
        camera.position.z = 1;

        // Create scene
        scene = new THREE.Scene();

        // Start the boot sequence
        runBootSequence();

        // Create texture from the terminal canvas
        terminalTexture = new THREE.CanvasTexture(offscreenCanvas);
        terminalTexture.premultiplyAlpha = false;

        // Create texture from the border canvas
        borderTexture = new THREE.CanvasTexture(borderCanvas);
        borderTexture.premultiplyAlpha = false;

        // Load noise texture for effects
        var noiseTexture = new THREE.TextureLoader().load('crt_text_white.svg', function(texture) {
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.minFilter = THREE.LinearFilter;
            texture.magFilter = THREE.LinearFilter;
        });

        var overlayRepeat = new THREE.Vector2(1, 1);
        var overlayTexture = new THREE.TextureLoader().load(
            'crt_text_white.svg',
            function(texture) {
                texture.wrapS = THREE.RepeatWrapping;
                texture.wrapT = THREE.RepeatWrapping;
                texture.minFilter = THREE.LinearFilter;
                texture.magFilter = THREE.NearestFilter;

                var imgWidth = texture.image.width;
                var imgHeight = texture.image.height;

                var planeW = window.innerWidth;
                var planeH = window.innerHeight;

                let desiredTileWidth = 55;
                let desiredTileHeight = (imgHeight / imgWidth) * desiredTileWidth;
                let repeatsX = planeW / desiredTileWidth;
                let repeatsY = planeH / desiredTileHeight;

                overlayRepeat.set(repeatsX, repeatsY);
                texture.offset.set(0, 0);
                texture.repeat.set(repeatsX, repeatsY);
            }
        );

        // Helper functions for the shaders
        const helperFunctions = `
    float min2(vec2 v) { return min(v.x, v.y); }
    float max2(vec2 v) { return max(v.x, v.y); }
    float prod2(vec2 v) { return v.x * v.y; }
    float sum2(vec2 v) { return v.x + v.y; }
    float rgb2grey(vec3 v) { return dot(v, vec3(0.21, 0.72, 0.04)); }
    
    vec2 positiveLog(vec2 x) {
        return clamp(log(x), vec2(0.0), vec2(100.0));
    }
    
    float isInScreen(vec2 v) {
        return min2(step(0.0, v) - step(1.0, v));
    }
    `;

        // Content fragment shader with CRT effects
        var contentFragmentShader = `
    uniform sampler2D tDiffuse;
    uniform sampler2D tOverlay;
    uniform sampler2D tNoise;
    uniform float distortion;
    uniform float time;
    uniform vec2 overlayRepeat;
    uniform float overlayOpacity;
    uniform vec2 virtualResolution;
    uniform float screenCurvature;
    uniform float staticNoise;
    uniform float flickering;
    uniform float horizontalSync;
    uniform float glowingLine;
    uniform float rasterizationIntensity;
    uniform vec3 fontColor;
    uniform vec3 backgroundColor;
    uniform float chromaColor;
    
    varying vec2 vUv;
    
    ${helperFunctions}
    
    // Rasterization effect (scanlines)
    #define INTENSITY 0.30
    #define BRIGHTBOOST 0.30
    vec3 applyRasterization(vec2 screenCoords, vec3 texel, vec2 virtualRes, float intensity) {
        vec3 pixelHigh = ((1.0 + BRIGHTBOOST) - (0.2 * texel)) * texel;
        vec3 pixelLow  = ((1.0 - INTENSITY) + (0.1 * texel)) * texel;
        vec2 coords = fract(screenCoords * virtualRes) * 2.0 - vec2(1.0);
        float mask = 1.0 - abs(coords.y);
        vec3 rasterizationColor = mix(pixelLow, pixelHigh, mask);
        return mix(texel, rasterizationColor, intensity);
    }
    
    // Glowing line effect
    float randomPass(vec2 coords) {
        return fract(smoothstep(-120.0, 0.0, coords.y - (virtualResolution.y + 120.0) * fract(time * 0.00015)));
    }
    
    // Overlay blending
    vec3 blendOverlay(vec3 base, vec3 blend) {
        return mix(2.0 * base * blend, 1.0 - 2.0 * (1.0 - base) * (1.0 - blend), step(0.5, base));
    }
    
    // Convert with chroma adjustment
    vec3 convertWithChroma(vec3 inColor) {
        vec3 outColor;
        outColor = fontColor * mix(vec3(rgb2grey(inColor)), inColor, chromaColor);
        return outColor;
    }
    
    // Barrel distortion for screen curvature
    vec2 barrel(vec2 v, vec2 cc) {
        float distortion = dot(cc, cc) * screenCurvature;
        return (v - cc * (1.0 + distortion) * distortion);
    }
    
    void main() {
        // Center coordinates for distortion
        vec2 cc = vec2(0.5) - vUv;
        float distance = length(cc);
        
        // Apply screen curvature distortion
        vec2 staticCoords = barrel(vUv, cc);
        
        // Horizontal sync distortion
        vec2 coords = vUv;
        if (horizontalSync > 0.0) {
            vec2 noiseCoords = vec2(fract(time/2048.0), fract(time/1048576.0));
            vec4 noiseTexel = texture2D(tNoise, noiseCoords);
            float distortionScale = step(0.0, horizontalSync - noiseTexel.r) * (horizontalSync - noiseTexel.r) * horizontalSync * 0.5;
            float distortionFreq = mix(4.0, 40.0, noiseTexel.g);
            float dst = sin((coords.y + time * 0.001) * distortionFreq);
            coords.x += dst * distortionScale;
        }
        
        // Static noise and jitter effects
        vec2 txt_coords = coords;
        vec3 noiseColor = vec3(0.0);
        
        if (staticNoise > 0.0) {
            vec2 scaleNoiseSize = vec2(3.0, 3.0);
            vec4 noiseTexel = texture2D(tNoise, coords * scaleNoiseSize + vec2(fract(time / 51.0), fract(time / 237.0)));
            float noiseVal = noiseTexel.a * staticNoise * (1.0 - distance * 1.3) * 0.1;
            noiseColor += vec3(noiseVal);
        }
        
        // Apply glowing line effect
        if (glowingLine > 0.0) {
            noiseColor += vec3(randomPass(coords * virtualResolution) * glowingLine);
        }
        
        // Sample the main texture
        vec4 baseColor = texture2D(tDiffuse, staticCoords);
        vec3 txt_color = baseColor.rgb;
        
        // Add noise effects
        txt_color += noiseColor;
        
        // Apply overlay
        vec4 overlayColor = texture2D(tOverlay, txt_coords * overlayRepeat);
        vec3 blended = blendOverlay(txt_color, overlayColor.rgb);
        
        // Apply flickering effect
        if (flickering > 0.0) {
            vec2 flickerCoords = vec2(fract(time/2048.0), fract(time/1048576.0));
            vec4 flickerNoise = texture2D(tNoise, flickerCoords);
            float brightness = 1.0 + (flickerNoise.g - 0.5) * flickering * 0.3;
            txt_color *= brightness;
        }
        
        // Apply scanline effect
        vec3 rasterized = applyRasterization(staticCoords, blended, virtualResolution, rasterizationIntensity);
        
        // Final color
        vec3 finalColor = mix(txt_color, rasterized, overlayOpacity);
        
        // Apply ambient light at edges
        finalColor += vec3(0.1) * (1.0 - distance) * (1.0 - distance);
        
        gl_FragColor = vec4(finalColor, baseColor.a);
    }
    `;

        // Vertex shader for content
        var contentVertexShader = `
    uniform float curvature;
    varying vec2 vUv;
    
    void main() {
        vUv = uv;
        vec2 cc = uv - 0.5;
        float dist = dot(cc, cc);
        vec3 newPosition = position;
        newPosition.z -= dist * curvature * 300.0;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
    }
    `;

        let distortValue = 0.35;
        if (window.innerWidth < window.innerHeight) {
            distortValue = 0.1;
        }

        // Create content geometry - will be properly sized by updatePlaneGeometry
        var contentGeometry = new THREE.PlaneGeometry(1, 1);

        // Create a shader material for terminal content
        var contentMaterial = new THREE.ShaderMaterial({
            uniforms: {
                tDiffuse: { value: terminalTexture },
                tOverlay: { value: overlayTexture },
                tNoise: { value: noiseTexture },
                overlayRepeat: { value: overlayRepeat },
                distortion: { value: distortValue },
                time: { value: 0.0 },
                overlayOpacity: { value: 0.15 },
                virtualResolution: { value: new THREE.Vector2(800, 600) },
                screenCurvature: { value: 0.35 },
                staticNoise: { value: 0 },
                flickering: { value: 0.05 },
                horizontalSync: { value: 0.1 },
                glowingLine: { value: 0.0 },
                rasterizationIntensity: { value: 0.7 },
                fontColor: { value: new THREE.Color(0xffffff) },
                backgroundColor: { value: new THREE.Color(0x000000) },
                chromaColor: { value: 0.5 }
            },
            vertexShader: contentVertexShader,
            fragmentShader: contentFragmentShader,
            transparent: true
        });

        // Create content mesh and add to scene
        planeMesh = new THREE.Mesh(contentGeometry, contentMaterial);
        scene.add(planeMesh);

        // Create a shader material for the border with the same effects
        var borderMaterial = new THREE.ShaderMaterial({
            uniforms: {
                tDiffuse: { value: borderTexture },
                tOverlay: { value: overlayTexture },
                tNoise: { value: noiseTexture },
                overlayRepeat: { value: overlayRepeat },
                distortion: { value: distortValue },
                time: { value: 0.0 },
                overlayOpacity: { value: 0 },
                virtualResolution: { value: new THREE.Vector2(800, 600) },
                screenCurvature: { value: 0.5 },
                staticNoise: { value: 0.0 },  // No static on border
                flickering: { value: 0.0 },   // No flickering on border
                horizontalSync: { value: 0.0 }, // No sync distortion on border
                glowingLine: { value: 0.0 },
                rasterizationIntensity: { value: 0.0 }, // No rasterization on border
                fontColor: { value: new THREE.Color(0xffffff) },
                backgroundColor: { value: new THREE.Color(0x000000) },
                chromaColor: { value: 0.5 }
            },
            vertexShader: contentVertexShader,
            fragmentShader: contentFragmentShader,
            transparent: true
        });

        // Create border mesh and add to scene
        borderPlaneMesh = new THREE.Mesh(contentGeometry, borderMaterial);
        borderPlaneMesh.position.z = 0.5; // Position in front of content
        scene.add(borderPlaneMesh);


        // Update mesh geometry and position based on current window dimensions
        updatePlaneGeometry();

        // Draw the border once initially
        drawBorder();

        // Initial terminal draw
        drawTerminal();

        // Append the logoImage to the DOM
        if (!logoImage.parentElement) {
            document.body.appendChild(logoImage);
            logoImage.style.position = 'absolute';
            logoImage.style.top = '0';
            logoImage.style.left = '0';
            logoImage.style.visibility = 'hidden';
            logoImage.style.pointerEvents = 'none';
        }

    }

    // Code that comes after the init() function

    function animate() {
        // Request the next frame first to ensure smooth animation
        if (isFocused) {
            requestAnimationFrame(animate);
        } else {
            // If not focused, reduce animation frequency to save resources
            setTimeout(() => {
                requestAnimationFrame(animate);
            }, 1000);
            return;
        }

        // Ensure canvas is properly set up
        ensureOffscreenCanvas();

        var now = Date.now();
        var delta = (now - lastGlitchUpdate) / 1000;
        lastGlitchUpdate = now;
        currentGlitchY += glitchSpeed * delta;
        if (Math.random() < 0.015) {
            currentGlitchY = Math.random() * terminalHeight;
        }
        if (currentGlitchY >= terminalHeight) {
            currentGlitchY -= terminalHeight;
        }

        // Update blinking cursor every 0.5 seconds
        cursorTimer += delta;
        if (cursorTimer >= 0.5) {
            showCursor = !showCursor;
            cursorTimer = 0;
        }

        // Update the current gif frame
        updateGifFrame();

        // If in boot phase and boot countdown has elapsed, transition to post boot
        if (phase === "boot" && bootPhaseEndTime > 0 && now >= bootPhaseEndTime) {
            launchPhase2();
        }

        const shouldRedirect = phase === "postBoot" && now >= postBootEndTime;
        const isDevMode = window.location.href.includes('localhost');

        // If in post boot phase and countdown expired, redirect
        if (shouldRedirect) {
            if (isDevMode) {
                window.location.reload();
            } else {
                window.location.href = "https://terminal.godisadesigner.com/";
            }
        }

        // Draw the terminal content
        drawTerminal();

        // Draw the border on the separate canvas
        drawBorder();

        var elapsed = (Date.now() - startTime) / 1000;

        // Update time uniform for main content
        if (planeMesh && planeMesh.material && planeMesh.material.uniforms && planeMesh.material.uniforms.time) {
            planeMesh.material.uniforms.time.value = elapsed;
        }

        // Update time uniform for border
        if (borderPlaneMesh && borderPlaneMesh.material && borderPlaneMesh.material.uniforms && borderPlaneMesh.material.uniforms.time) {
            borderPlaneMesh.material.uniforms.time.value = elapsed;
        }

        renderer.render(scene, camera);
    }

    function onWindowResize() {
        // Update renderer size to match window - this should always fill the entire screen
        renderer.setSize(window.innerWidth, window.innerHeight);

        // Keep the offscreen canvas resolution fixed - never change these
        // This is our internal "virtual resolution"
        terminalWidth = 800;
        terminalHeight = 600;
        terminalAspect = terminalWidth / terminalHeight;

        // Update camera frustum to match new window dimensions
        camera.left = window.innerWidth / -2;
        camera.right = window.innerWidth / 2;
        camera.top = window.innerHeight / 2;
        camera.bottom = window.innerHeight / -2;
        camera.updateProjectionMatrix();

        scene.background = new THREE.Color(0x1A1A1A);

        // Ensure textures update
        if (terminalTexture) terminalTexture.needsUpdate = true;
        if (borderTexture) borderTexture.needsUpdate = true;
    }

// Function to update frame and content on resize
    function updateFrameAndContent() {
        if (!planeMesh || !borderPlaneMesh) return;

        // Get the CRT values
        const { innerWidth, innerHeight } = window.crtValues;

        // Update content plane to match desired dimensions
        planeMesh.geometry.dispose();
        planeMesh.geometry = new THREE.PlaneGeometry(innerWidth, innerHeight);

        // Update border plane
        borderPlaneMesh.geometry.dispose();
        borderPlaneMesh.geometry = new THREE.PlaneGeometry(innerWidth, innerHeight);

        // Update distortion value based on orientation
        let newDistortValue = window.innerWidth < window.innerHeight ? 0.1 : 0.5;
        if (planeMesh.material.uniforms.distortion) {
            planeMesh.material.uniforms.distortion.value = newDistortValue;
        }
        if (borderPlaneMesh.material.uniforms.distortion) {
            borderPlaneMesh.material.uniforms.distortion.value = newDistortValue;
        }

        // Update virtual resolution to maintain proper aspect ratio
        // This is crucial for the scanline effect to look correct
        const virtualWidth = 800;
        const virtualHeight = 600;

        if (planeMesh.material.uniforms.virtualResolution) {
            planeMesh.material.uniforms.virtualResolution.value.set(
                virtualWidth,
                virtualHeight
            );
        }

        if (borderPlaneMesh.material.uniforms.virtualResolution) {
            borderPlaneMesh.material.uniforms.virtualResolution.value.set(
                virtualWidth,
                virtualHeight
            );
        }
    }

    function updatePlaneGeometry() {
        // Ensure CRT values exist
        if (!window.crtValues) {
            window.crtValues = calculateCrtValues();
        }

        if (!planeMesh || !borderPlaneMesh) return;

        const { innerWidth, innerHeight, innerLeftX, innerTopY } = window.crtValues;

        // Update plane sizes to match content area
        planeMesh.geometry.dispose();
        planeMesh.geometry = new THREE.PlaneGeometry(innerWidth, innerHeight);

        borderPlaneMesh.geometry.dispose();
        borderPlaneMesh.geometry = new THREE.PlaneGeometry(innerWidth, innerHeight);

        // Position the planes correctly in the scene - this is crucial for responsive layout
        // We need to convert from window coordinates to scene coordinates
        // For orthographic camera, the scene coordinates go from -window.innerWidth/2 to window.innerWidth/2
        const leftPos = innerLeftX + innerWidth/2 - window.innerWidth/2;
        const topPos = -(innerTopY + innerHeight/2) + window.innerHeight/2;

        planeMesh.position.set(leftPos, topPos, 0);
        borderPlaneMesh.position.set(leftPos, topPos, 0.5); // Border slightly in front

        // Update distortion values based on screen orientation
        if (planeMesh.material && planeMesh.material.uniforms &&
            borderPlaneMesh.material && borderPlaneMesh.material.uniforms) {
            const { horizontalCurveFactor, verticalCurveFactor } = window.crtValues;
            // Use weighted average of horizontal and vertical factors
            const distortValue = (horizontalCurveFactor * 0.7 + verticalCurveFactor * 0.3);

            // Update distortion for both meshes
            if (planeMesh.material.uniforms.distortion) {
                planeMesh.material.uniforms.distortion.value = distortValue;
            }

            if (borderPlaneMesh.material.uniforms.distortion) {
                borderPlaneMesh.material.uniforms.distortion.value = distortValue;
            }
        }
    }

// Main initialization function
    window.addEventListener('DOMContentLoaded', function() {
        // Check if THREE.js is available
        if (typeof THREE === 'undefined') {
            console.error('THREE.js is not loaded. Please include THREE.js library.');
            return;
        }

        // Initialize and start animation
        init();

        // Trigger initial resize to position everything correctly
        doResize();

        // Start animation loop
        animate();

        // Adjusted click event listener on the canvas
        renderer.domElement.addEventListener('click', function(e) {
            // Calculate click position relative to window
            const windowX = e.clientX;
            const windowY = e.clientY;

            // Get CRT values for current dimensions
            const { innerWidth, innerHeight, innerLeftX, innerTopY } = window.crtValues;

            // Calculate scaled coordinates based on relative position within the terminal area
            // First check if the click is within the terminal bounds
            if (windowX >= innerLeftX &&
                windowX <= innerLeftX + innerWidth &&
                windowY >= innerTopY &&
                windowY <= innerTopY + innerHeight) {

                // Convert window coordinates to normalized terminal coordinates (0-1)
                const relativeX = (windowX - innerLeftX) / innerWidth;
                const relativeY = (windowY - innerTopY) / innerHeight;

                // Scale to terminal resolution
                const terminalX = relativeX * terminalWidth;
                const terminalY = relativeY * terminalHeight;

                // Define the bounding box for the ACCESS TERMINAL button
                var btnCenterX = terminalWidth / 2;
                var btnCenterY = terminalHeight * 0.6;
                var btnWidth = 300;
                var btnHeight = 50;
                var btnLeft = btnCenterX - btnWidth / 2;
                var btnRight = btnCenterX + btnWidth / 2;
                var btnTop = btnCenterY - btnHeight / 2;
                var btnBottom = btnCenterY + btnHeight / 2;

                // Check if the click is inside the button area
                if (terminalX >= btnLeft &&
                    terminalX <= btnRight &&
                    terminalY >= btnTop &&
                    terminalY <= btnBottom &&
                    phase === "postBoot") {
                    window.location.href = "https://terminal.godisadesigner.com/";
                }
            }
        });

        document.addEventListener('keydown', function(e) {
            // In boot phase, any key triggers phase2
            if (phase === "boot" && bootIndex > 10) {
                launchPhase2();
                return;
            }
            // In post boot phase, handle command input
            if (phase === "postBoot") {
                if (e.key === 'Backspace') {
                    e.preventDefault();
                    commandInput = commandInput.slice(0, -1);
                } else if (e.key === 'Enter') {
                    var cmd = commandInput.trim().toLowerCase();
                    if (cmd === 'giad') {
                        eggMessage = "GIAD™ IS NOT A BRAND. IT'S A PROPHECY.";
                    } else if (cmd === 'god') {
                        eggMessage = "\"GOD IS A DESIGNER. THAT'S NOT A STATEMENT — IT'S A JOB TITLE.\"";
                    } else if (cmd === 'help') {
                        eggMessage = "AVAILABLE COMMANDS: GIAD, GOD, HELP";
                    } else {
                        eggMessage = "";
                    }
                    commandInput = "";
                } else if (e.key.length === 1) {
                    commandInput += e.key;
                }
            }
        });
    });

// Handle tab visibility changes to save resources
    document.addEventListener('visibilitychange', (event) => {
        isFocused = !document.hidden;

        // If becoming visible again, force a redraw
        if (isFocused) {
            drawTerminal();
            drawBorder();

            if (terminalTexture) terminalTexture.needsUpdate = true;
            if (borderTexture) borderTexture.needsUpdate = true;

            // Request a frame to restart animation
            requestAnimationFrame(animate);
        }
    }, false);

// Handle window resize with debouncing to prevent performance issues
    let resizeTimeout;
    let initialResize = true;

    function handleResize() {
        // Clear previous timeout
        if (resizeTimeout) {
            clearTimeout(resizeTimeout);
        }

        // Immediate response for first resize or after page load
        if (initialResize) {
            initialResize = false;
            doResize();
            // Also schedule another resize after a delay to handle any OS/browser adjustments
            resizeTimeout = setTimeout(doResize, 300);
            return;
        }

        // Set a timeout to prevent excessive recalculations during resize
        resizeTimeout = setTimeout(doResize, 100);
    }

    function doResize() {
        // Ensure canvas exists and is properly sized
        ensureOffscreenCanvas();

        // Recalculate values based on new window size
        window.crtValues = calculateCrtValues();

        // Update renderer pixel ratio and size
        renderer.setPixelRatio(window.devicePixelRatio || 1);
        renderer.setSize(window.innerWidth, window.innerHeight);

        // Update rendering
        onWindowResize();
        updatePlaneGeometry();
        updateFrameAndContent();
        drawTerminal();
        drawBorder();

        // Update textures
        if (terminalTexture) terminalTexture.needsUpdate = true;
        if (borderTexture) borderTexture.needsUpdate = true;

        // Force render a frame
        renderer.render(scene, camera);
    }

    window.addEventListener('resize', handleResize);

// Also handle orientation change specifically for mobile devices
    window.addEventListener('orientationchange', function() {
        // First update immediately
        handleResize();

        // Then set a timer to update again after orientation change completes
        setTimeout(handleResize, 500);
    });

    // Helper function to ensure the offscreen canvas is properly sized and has a context
    function ensureOffscreenCanvas() {
        // If for some reason the offscreen canvas isn't found, create it
        if (!offscreenCanvas) {
            offscreenCanvas = document.createElement('canvas');
            offscreenCanvas.id = 'terminalCanvas';
            offscreenCanvas.width = 800;
            offscreenCanvas.height = 600;
            offscreenCanvas.style.display = 'none';
            document.body.appendChild(offscreenCanvas);
            ctx = offscreenCanvas.getContext('2d');
        }

        // Make sure border canvas matches offscreen canvas
        if (!borderCanvas) {
            borderCanvas = document.createElement('canvas');
            borderCanvas.width = 800;
            borderCanvas.height = 600;
            borderCanvas.style.display = 'none';
            document.body.appendChild(borderCanvas);
            borderCtx = borderCanvas.getContext('2d');
        }

        // Ensure dimensions
        if (offscreenCanvas.width !== 800 || offscreenCanvas.height !== 600) {
            offscreenCanvas.width = 800;
            offscreenCanvas.height = 600;
            borderCanvas.width = 800;
            borderCanvas.height = 600;

            // Update global vars to match
            terminalWidth = offscreenCanvas.width;
            terminalHeight = offscreenCanvas.height;
            terminalAspect = terminalWidth / terminalHeight;
        }

        // Make sure we have contexts
        if (!ctx) {
            ctx = offscreenCanvas.getContext('2d');
        }

        if (!borderCtx) {
            borderCtx = borderCanvas.getContext('2d');
        }

        return true;
    }

    function createRenderer() {
        renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: false, // Change to false so we can have a solid background
            powerPreference: 'high-performance'
        });
        renderer.setClearColor(0x1A1A1A, 1); // Set dark gray background color

        // Set renderer to full window size
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setClearAlpha(0);
        renderer.setPixelRatio(window.devicePixelRatio || 1);

        // Make sure the renderer's canvas fills the screen
        document.body.appendChild(renderer.domElement);
        renderer.domElement.style.position = 'fixed';
        renderer.domElement.style.top = '0';
        renderer.domElement.style.left = '0';
        renderer.domElement.style.width = '100%';
        renderer.domElement.style.height = '100%';
        renderer.domElement.style.zIndex = '1';

        return renderer;
    }

})();