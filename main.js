(function() {
    var offscreenCanvas = document.getElementById('terminalCanvas');
    var ctx = offscreenCanvas.getContext('2d');
    var logoImage = new Image();
    logoImage.crossOrigin = "anonymous";

    var gifFrames = [];
    var currentFrameIndex = 0;
    var totalFrames = 48; // frames 00 to 47
    var frameDelay = 80; // frame delay in milliseconds (0.08s)

    // Boot sequence logic extracted from the old version.
    var bootSequence = [
        { type: "line", content: "Starting MS-GOD..." },
        { type: "line", content: "Shinku is testing extended memory...done." },
        { type: "line", content: "Starting GIAD Terminal Protocol..." },
        { type: "block", content: [
            "C:\\GIAD\\TERMINAL.EXE",
            "God is a designer © All Rights Reserved.",
            "1981 to 2049 / United States of America.",
            "神はクリエイターである"
        ]},
        { type: "line", content: "Department of Design and Aesthetics" },
        { type: "line", content: "創造に触発されて" },
        { type: "line", content: "" },
        { type: "block", content: [
            "DOS        <DIR>     12.05.20       15:57",
            "COMMAND    COM       94.05.31       6:22",
            "GIAD20     2008      173.255.189.42 6:22",
            "CONFIG     SYS       12.05.20       15:57",
            "AUTOEXEC  BAT        12.05.20",
            "5 File(s)             292864 bytes free",
            "Memory size: 116432 bytes"
        ]},
        { type: "line", content: "Free disk space: 1842 MB" },
        { type: "line", content: "GIAD<r> Terminal Protocol initiated." },
        { type: "line", content: "Press any key to continue..." }
    ];
    var bootDisplayLines = [];
    var bootIndex = 0;
    var phase = "boot"; // 'boot' or 'postBoot'
    var bootPhaseEndTime = 0; // Timestamp when boot auto-load countdown ends
    var postBootEndTime = 0; // Timestamp for 90-second countdown in post boot
    var commandInput = ""; // For command line input in post boot phase
    var eggMessage = ""; // For secret message output
    var showCursor = true;
    var cursorTimer = 0;
    var startTime = Date.now();
    var terminalWidth = offscreenCanvas.width;   // 800
    var terminalHeight = offscreenCanvas.height; // 600
    var terminalAspect = terminalWidth / terminalHeight; // 4:3
    var glitchSpeed = 50; // pixels per second
    var currentGlitchY = 0;
    var lastGlitchUpdate = Date.now();
    var terminalTexture, planeMesh;

    (function loadGifFrames() {
        for (var i = 0; i < totalFrames; i++) {
            var frameNumber = i < 10 ? "0" + i : i;
            var img = new Image();
            img.crossOrigin = "anonymous";
            img.src = "gif-frames/frame_" + frameNumber + "_delay-0.08s.gif";
            gifFrames.push(img);
        }
    })();

    function runBootSequence() {
        if (bootIndex < bootSequence.length) {
            var entry = bootSequence[bootIndex++];
            if (entry.type === "line") {
                bootDisplayLines.push(entry.content);
                setTimeout(runBootSequence, 150);
            } else if (entry.type === "block") {
                entry.content.forEach(function(line) {
                    bootDisplayLines.push(line);
                });
                setTimeout(runBootSequence, 500);
            }
        } else {
            // Boot sequence complete, start 3-second countdown if not already started
            if (bootPhaseEndTime === 0) {
                bootPhaseEndTime = Date.now() + 3000;
            }
        }
    }

    function launchPhase2() {
        if (phase === "postBoot") return;
        phase = "postBoot";
        postBootEndTime = Date.now() + 90000; // 90 seconds countdown
    }

    function updateGifFrame() {
        var elapsed = Date.now() - startTime;
        currentFrameIndex = Math.floor(elapsed / frameDelay) % totalFrames;
    }

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

        ctx.shadowColor = '#cfdfff';
        ctx.shadowBlur = 8;
        ctx.fillStyle = '#cfdfff';
        ctx.font = '20px monospace';
        var lineHeight = 24;

        var now = Date.now();

        if (phase === "boot") {
            // Draw boot sequence lines
            for (var i = 0; i < bootDisplayLines.length; i++) {
                ctx.fillText(bootDisplayLines[i], 20, 40 + i * lineHeight);
            }

            // If boot sequence is complete, draw auto-loading countdown
            if (bootPhaseEndTime > 0) {
                var remaining = Math.ceil((bootPhaseEndTime - now) / 1000);
                ctx.fillText("AUTO LOADING IN [ " + remaining + " ]", 20, 40 + bootDisplayLines.length * lineHeight + 20);
            }
        } else if (phase === "postBoot") {
            // Draw the current gif frame without rotation or extrusion
            if (gifFrames.length > 0 && gifFrames[currentFrameIndex].complete) {
                var logoWidth = terminalWidth * 0.3;
                var logoHeight = gifFrames[currentFrameIndex].height * (logoWidth / gifFrames[currentFrameIndex].width);
                var centerX = terminalWidth / 2;
                var centerY = 20 + logoHeight / 2;
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

            // Draw command prompt
            ctx.textAlign = 'left';
            var prompt = "C:\\GIAD> ";
            ctx.fillText(prompt + commandInput + (showCursor ? "_" : ""), 20, terminalHeight * 0.8);

            // Draw egg message if available
            if (eggMessage !== "") {
                ctx.fillText(eggMessage, 20, terminalHeight * 0.85);
            }
        }

        // Draw glitch effects (common to both phases)
        var thickness = Math.random() * 0.2 + 0.1;
        var alpha = 0.2 + Math.random() * 0.3;
        ctx.fillStyle = "rgba(255,255,255," + alpha + ")";
        ctx.fillRect(0, currentGlitchY, terminalWidth, thickness);

        terminalTexture.needsUpdate = true;
    }

    function animate() {
        requestAnimationFrame(animate);
        var now = Date.now();
        var delta = (now - lastGlitchUpdate) / 1000; // delta in seconds
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

        // If in post boot phase and countdown expired, redirect
        if (phase === "postBoot" && now >= postBootEndTime) {
            window.location.href = "https://terminal.godisadesigner.com/";
        }

        drawTerminal();
        var elapsed = (Date.now() - startTime) / 1000;
        planeMesh.material.uniforms.time.value = elapsed;
        renderer.render(scene, camera);
    }

    function init() {
        // Create renderer
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setClearAlpha(0);
        document.body.appendChild(renderer.domElement);

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

        // Create texture from the offscreen canvas
        terminalTexture = new THREE.CanvasTexture(offscreenCanvas);
        terminalTexture.premultiplyAlpha = false;

        // Create plane geometry for the terminal display
        var geometry = new THREE.PlaneGeometry(window.innerWidth, window.innerHeight);

        // Vertex shader to pass UV coordinates
        var vertexShader = `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `;

        // Simple fragment shader for displaying the terminal texture
        var fragmentShader = `
            uniform sampler2D tDiffuse;
            uniform float distortion;
            uniform float time;
            varying vec2 vUv;
            void main() {
                vec2 uv = vUv - 0.5;
                float r = length(uv);
                uv *= (1.0 + distortion * pow(r, 3.0));
                uv += 0.5;
                vec4 color = texture2D(tDiffuse, uv);
                gl_FragColor = color;
            }
        `;

        // Create a shader material using the shaders
        var material = new THREE.ShaderMaterial({
            uniforms: {
                tDiffuse: { value: terminalTexture },
                distortion: { value: 0.25 },
                time: { value: 0.0 }
            },
            vertexShader: vertexShader,
            fragmentShader: fragmentShader
        });

        // Create mesh and add to the scene
        planeMesh = new THREE.Mesh(geometry, material);
        scene.add(planeMesh);

        // Update on window resize
        window.addEventListener('resize', onWindowResize, false);

        // Append the logoImage to the DOM in a transparent container to ensure the animated GIF continues to update its frames
        if (!logoImage.parentElement) {
            document.body.appendChild(logoImage);
            logoImage.style.position = 'absolute';
            logoImage.style.top = '0';
            logoImage.style.left = '0';
            // Use visibility:hidden instead of opacity:0 so the image updates its animation frames
            logoImage.style.visibility = 'hidden';
            logoImage.style.pointerEvents = 'none';
        }
    }

    function onWindowResize() {
        // Update renderer size to match the window dimensions
        renderer.setSize(window.innerWidth, window.innerHeight);

        // Do NOT change the offscreen canvas resolution;
        // keep it fixed at 800x600 so that text remains at the baseline size
        // offscreenCanvas.width = window.innerWidth;
        // offscreenCanvas.height = window.innerHeight;

        // Update terminal dimensions based on the fixed offscreenCanvas resolution
        terminalWidth = 800;   // fixed width
        terminalHeight = 600;  // fixed height
        terminalAspect = terminalWidth / terminalHeight;

        // Update camera parameters (for orthographic camera)
        camera.left = window.innerWidth / -2;
        camera.right = window.innerWidth / 2;
        camera.top = window.innerHeight / 2;
        camera.bottom = window.innerHeight / -2;
        camera.updateProjectionMatrix();

        // Update the plane geometry for the terminal display to fill the window
        planeMesh.geometry.dispose();
        planeMesh.geometry = new THREE.PlaneGeometry(window.innerWidth, window.innerHeight);
    }

    window.addEventListener('DOMContentLoaded', function() {
        init();
        animate();

        // Adjusted click event listener on the canvas
        renderer.domElement.addEventListener('click', function(e) {
            // Get the canvas bounding rectangle
            var rect = renderer.domElement.getBoundingClientRect();
            // Calculate scale factors based on the canvas's internal size vs. its displayed size
            var scaleX = terminalWidth / rect.width;
            var scaleY = terminalHeight / rect.height;

            // Calculate click coordinates relative to the canvas in its internal coordinate space
            var x = (e.clientX - rect.left) * scaleX;
            var y = (e.clientY - rect.top) * scaleY;

            console.log("Click at:", x, y); // Debug log

            // Define the bounding box for the ACCESS TERMINAL button (in internal canvas coordinates)
            var btnCenterX = terminalWidth / 2;
            var btnCenterY = terminalHeight * 0.6;
            var btnWidth = 300; // expanded approximate width
            var btnHeight = 100; // expanded approximate height
            var btnLeft = btnCenterX - btnWidth / 2;
            var btnRight = btnCenterX + btnWidth / 2;
            var btnTop = btnCenterY - btnHeight / 2;
            var btnBottom = btnCenterY + btnHeight / 2;

            console.log("Button bounds:", btnLeft, btnTop, btnRight, btnBottom); // Debug log

            // Check if the click is inside the button area
            if (x >= btnLeft && x <= btnRight && y >= btnTop && y <= btnBottom) {
                console.log("Redirecting to terminal site");
                window.location.href = "https://terminal.godisadesigner.com/";
            }
        });

        document.addEventListener('keydown', function(e) {
            // In boot phase, any key triggers phase2
            if (phase === "boot") {
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
                        eggMessage = "GIAD™ IS NOT A BRAND. IT’S A PROPHECY.";
                    } else if (cmd === 'god') {
                        eggMessage = "“GOD IS A DESIGNER. THAT’S NOT A STATEMENT — IT’S A JOB TITLE.”";
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
})();