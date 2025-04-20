// Terminal Renderer - Handles drawing operations
const TerminalRenderer = {
    // Canvas elements
    offscreenCanvas: null,
    borderCanvas: null,
    ctx: null,
    borderCtx: null,

    // Three.js objects
    renderer: null,
    camera: null,
    scene: null,
    terminalTexture: null,
    borderTexture: null,
    planeMesh: null,
    borderPlaneMesh: null,

    // Assets
    logoImage: null,
    gifFrames: [],

    get baseTerminalPadding() {
        return Math.max( window.innerWidth * 0.05, TerminalConfig.ui.borderMargin + 60 )
    },

    // Initialize the renderer
    init() {
        this.ensureOffscreenCanvas();
        this.initThreeJs();
        this.loadAssets();
        this.createShaders();
    },

    // Create/ensure offscreen canvas exists
    // In TerminalRenderer.ensureOffscreenCanvas(), be very explicit about dimensions:
    ensureOffscreenCanvas() {
        // Get or create main canvas
        this.offscreenCanvas = document.getElementById('terminalCanvas');
        if (!this.offscreenCanvas) {
            this.offscreenCanvas = document.createElement('canvas');
            this.offscreenCanvas.id = 'terminalCanvas';
            // Force dimensions and prevent resizing
            Object.defineProperties(this.offscreenCanvas, {
                width: {
                    writable: true,
                    value: window.innerWidth
                },
                height: {
                    writable: true,
                    value: window.innerHeight
                }
            });
            this.offscreenCanvas.style.display = 'none';
            document.body.appendChild(this.offscreenCanvas);
        } else {
            // Force dimensions if canvas exists
            this.offscreenCanvas.width = window.innerWidth;
            this.offscreenCanvas.height = window.innerHeight;
        }

        // Log to confirm dimensions are correct
        console.log('Canvas created with dimensions:', {
            width: this.offscreenCanvas.width,
            height: this.offscreenCanvas.height
        });

        this.ctx = this.offscreenCanvas.getContext('2d');

        // Same for border canvas
        this.borderCanvas = document.getElementById('borderCanvas') || document.createElement('canvas');
        this.borderCanvas.id = 'borderCanvas';
        this.borderCanvas.width = window.innerWidth;
        this.borderCanvas.height = window.innerHeight;
        this.borderCanvas.style.display = 'none';
        if (!this.borderCanvas.parentElement) {
            document.body.appendChild(this.borderCanvas);
        }
        this.borderCtx = this.borderCanvas.getContext('2d');

        // Update config to match actual dimensions
        TerminalConfig.canvas.width = this.offscreenCanvas.width;
        TerminalConfig.canvas.height = this.offscreenCanvas.height;

        return true;
    },

    // Initialize Three.js renderer, camera, and scene
    initThreeJs() {
        // Create WebGL renderer
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: false,
            powerPreference: 'high-performance'
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0x1A1A1A, 1);
        this.renderer.setPixelRatio(window.devicePixelRatio || 1);

        // Add renderer to document and configure style
        document.body.appendChild(this.renderer.domElement);
        this.renderer.domElement.style.position = 'fixed';
        this.renderer.domElement.style.top = '0';
        this.renderer.domElement.style.left = '0';
        this.renderer.domElement.style.width = '100%';
        this.renderer.domElement.style.height = '100%';
        document.body.style.margin = '0';
        document.body.style.overflow = 'hidden';

        // Create orthographic camera
        this.camera = new THREE.OrthographicCamera(
            window.innerWidth / -2, window.innerWidth / 2,
            window.innerHeight / 2, window.innerHeight / -2,
            -1000, 1000
        );
        this.camera.position.z = 1;

        // Create scene
        this.scene = new THREE.Scene();
    },

    // Load assets (GIF frames and logo)
    loadAssets() {
        // Load logo image
        this.logoImage = new Image();
        this.logoImage.crossOrigin = "anonymous";

        // Load GIF frames
        this.gifFrames = [];
        for (let i = 0; i < TerminalConfig.terminal.totalFrames; i++) {
            const frameNumber = i < 10 ? "0" + i : i;
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.src = "gif-frames/frame_" + frameNumber + "_delay-0.08s.gif";
            this.gifFrames.push(img);
        }
    },

    // Create shaders and materials
    createShaders() {
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
        const contentFragmentShader = `
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
        const contentVertexShader = `
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

        // Store shader code
        this.shaders = {
            content: {
                vertex: contentVertexShader,
                fragment: contentFragmentShader
            }
        };
    },

    // Create material with appropriate shader and uniforms
    createMaterial(isContent) {
        // Load noise texture for effects
        const noiseTexture = new THREE.TextureLoader().load('crt_text_white.svg', function(texture) {
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.minFilter = THREE.LinearFilter;
            texture.magFilter = THREE.LinearFilter;
        });

        // Create overlay texture with appropriate config
        const overlayRepeat = new THREE.Vector2(1, 1);
        const overlayTexture = new THREE.TextureLoader().load(
            'crt_text_white.svg',
            function(texture) {
                texture.wrapS = THREE.RepeatWrapping;
                texture.wrapT = THREE.RepeatWrapping;
                texture.minFilter = THREE.LinearFilter;
                texture.magFilter = THREE.NearestFilter;

                // Calculate repeat value based on window size
                const imgWidth = texture.image.width;
                const imgHeight = texture.image.height;
                const planeW = window.innerWidth;
                const planeH = window.innerHeight;

                const desiredTileWidth = 55;
                const desiredTileHeight = (imgHeight / imgWidth) * desiredTileWidth;
                const repeatsX = planeW / desiredTileWidth;
                const repeatsY = planeH / desiredTileHeight;

                overlayRepeat.set(repeatsX, repeatsY);
                texture.offset.set(0, 0);
                texture.repeat.set(repeatsX, repeatsY);
            }
        );

        // Determine distortion based on screen orientation
        let distortValue = window.innerWidth < window.innerHeight ? 0.1 : 0.35;

        // Source texture (either terminal or border)
        const sourceTexture = isContent ? this.terminalTexture : this.borderTexture;

        // Create shader material with appropriate uniforms
        return new THREE.ShaderMaterial({
            uniforms: {
                tDiffuse: { value: sourceTexture },
                tOverlay: { value: overlayTexture },
                tNoise: { value: noiseTexture },
                overlayRepeat: { value: overlayRepeat },
                distortion: { value: distortValue },
                time: { value: 0.0 },
                overlayOpacity: { value: isContent ? 0.15 : 0 },
                /*virtualResolution: { value: new THREE.Vector2(TerminalConfig.canvas.width, TerminalConfig.canvas.height) },*/
                virtualResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
                screenCurvature: { value: TerminalConfig.crt.curvature },
                staticNoise: { value: isContent ? TerminalConfig.crt.effects.staticNoise : 0 },
                flickering: { value: isContent ? TerminalConfig.crt.effects.flickering : 0 },
                horizontalSync: { value: isContent ? TerminalConfig.crt.effects.horizontalSync : 0 },
                glowingLine: { value: isContent ? TerminalConfig.crt.effects.glowingLine : 0 },
                rasterizationIntensity: { value: isContent ? TerminalConfig.crt.rasterization.intensity : 0 },
                fontColor: { value: TerminalConfig.crt.colors.font },
                backgroundColor: { value: TerminalConfig.crt.colors.background },
                chromaColor: { value: TerminalConfig.crt.colors.chromaColor }
            },
            vertexShader: this.shaders.content.vertex,
            fragmentShader: this.shaders.content.fragment,
            transparent: true
        });
    },

    // Create meshes for terminal and border
    createMeshes() {
        // Create textures from canvases
        this.terminalTexture = new THREE.CanvasTexture(this.offscreenCanvas);
        this.terminalTexture.premultiplyAlpha = false;

        this.borderTexture = new THREE.CanvasTexture(this.borderCanvas);
        this.borderTexture.premultiplyAlpha = false;

        // Get current CRT values
        const crtValues = this.calculateCrtValues();
        const { innerWidth: _innerWidth, innerHeight: _innerHeight} = crtValues;

        // Create geometry for both planes
        const geometry = new THREE.PlaneGeometry(_innerWidth, _innerHeight);

        // Create terminal mesh with appropriate material
        const contentMaterial = this.createMaterial(true);
        this.planeMesh = new THREE.Mesh(geometry, contentMaterial);
        this.scene.add(this.planeMesh);

        // Create border mesh with appropriate material
        const borderMaterial = this.createMaterial(false);
        this.borderPlaneMesh = new THREE.Mesh(geometry, borderMaterial);
        this.borderPlaneMesh.position.z = 0.5; // Position in front of content
        this.scene.add(this.borderPlaneMesh);

        // Update mesh positioning
        this.updatePlaneGeometry();
    },

    // Calculate CRT display values for responsive layout
    calculateCrtValues() {
        // Get actual window dimensions
        const clientWidth = document.documentElement.clientWidth || window.innerWidth;
        const clientHeight = document.documentElement.clientHeight || window.innerHeight;

        // Calculate aspect-ratio friendly dimensions
        const windowAspect = clientWidth / clientHeight;
        const contentAspect = windowAspect; // Using window aspect for content

        // Use nearly all of the screen space
        const maxScreenPct = 1;

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

        // Calculate left and top positions to center
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
    },

    // Update geometry and positioning for responsive layout
    updatePlaneGeometry() {
        if (!this.planeMesh || !this.borderPlaneMesh) return;

        // Get current CRT values
        const crtValues = this.calculateCrtValues();
        const { innerWidth: _innerWidth, innerHeight: _innerHeight, innerLeftX, innerTopY, horizontalCurveFactor, verticalCurveFactor } = crtValues;

        // Update plane sizes to match content area
        this.planeMesh.geometry.dispose();
        this.planeMesh.geometry = new THREE.PlaneGeometry(_innerWidth, _innerHeight);

        this.borderPlaneMesh.geometry.dispose();
        this.borderPlaneMesh.geometry = new THREE.PlaneGeometry(window.innerWidth, window.innerHeight);

        // Position the planes correctly in the scene
        // Convert from window coordinates to scene coordinates
        const leftPos = innerLeftX + _innerWidth/2 - window.innerWidth/2;
        const topPos = -(innerTopY + _innerHeight/2) + window.innerHeight/2;

        this.planeMesh.position.set(leftPos, topPos, 0);
        this.borderPlaneMesh.position.set(leftPos, topPos, 0.5); // Border slightly in front

        // Update distortion values based on screen orientation
        if (this.planeMesh.material && this.planeMesh.material.uniforms &&
            this.borderPlaneMesh.material && this.borderPlaneMesh.material.uniforms) {

            // Use weighted average of horizontal and vertical factors
            const distortValue = (horizontalCurveFactor * 0.7 + verticalCurveFactor * 0.3);

            // Update distortion for both meshes
            if (this.planeMesh.material.uniforms.distortion) {
                this.planeMesh.material.uniforms.distortion.value = distortValue;
            }

            if (this.borderPlaneMesh.material.uniforms.distortion) {
                this.borderPlaneMesh.material.uniforms.distortion.value = distortValue;
            }
        }
    },

    // Handle window resize
    onWindowResize() {
        TerminalController.restartTerminal()
    },

    // Drawing functions

    drawDebugGrid() {
        const ctx = this.ctx;

        // Save context
        ctx.save();

        // Draw a grid to visualize texture mapping
        ctx.strokeStyle = 'rgba(255,0,0,0.3)';
        ctx.lineWidth = 1;

        // Draw vertical grid lines
        for (let x = 0; x <= this.offscreenCanvas.width; x += 100) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, this.offscreenCanvas.height);
            ctx.stroke();
        }

        // Draw horizontal grid lines
        for (let y = 0; y <= this.offscreenCanvas.height; y += 100) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(this.offscreenCanvas.width, y);
            ctx.stroke();
        }

        // Draw coordinate markers at corners
        ctx.fillStyle = '#ff0000';
        ctx.font = '16px monospace';
        ctx.fillText('(0,0)', 5, 15);
        ctx.fillText(`(${this.offscreenCanvas.width},0)`, this.offscreenCanvas.width - 50, 15);
        ctx.fillText(`(0,${this.offscreenCanvas.height})`, 5, this.offscreenCanvas.height - 5);
        ctx.fillText(`(${this.offscreenCanvas.width},${this.offscreenCanvas.height})`,
            this.offscreenCanvas.width - 50, this.offscreenCanvas.height - 5);

        // Restore context
        ctx.restore();
    },

    // Draw the terminal content
    drawTerminal() {
        // Clear the offscreen canvas
        this.ctx.clearRect(0, 0, TerminalConfig.canvas.width, TerminalConfig.canvas.height);

        // Check if we're on mobile
        const isMobile = window.innerWidth < window.innerHeight;

        // Save the context state
        this.ctx.save();

        // On mobile, we need to adjust the scale to preserve text aspect ratio
        if (isMobile) {
            // Reset any transformations
            this.ctx.setTransform(1, 0, 0, 1, 0, 0);

            // Scale horizontally to maintain text aspect ratio on narrower mobile screens
            // This is the key part that prevents text from being squished
            const scaleFactor = 1.0; // Adjust this as needed - 1.0 means no horizontal scaling
            this.ctx.scale(scaleFactor, 1.0);
        }

        // Draw background
        this.drawBackground();

        // Add debug grid if enabled
        if (TerminalConfig.debugging && TerminalConfig.debugging.showGrid) {
            TerminalDebugger.drawDebugGrid(this.ctx, this.offscreenCanvas);
        }

        // Common text settings - adjust font size for mobile
        this.setupTextStyle(isMobile);

        const now = Date.now();
        const textMarginX = this.baseTerminalPadding;

        // Draw appropriate phase content
        if (TerminalState.phase === "boot") {
            this.drawBootPhase(textMarginX, now);
        } else if (TerminalState.phase === "postBoot") {
            this.drawPostBootPhase(textMarginX);
        }

        // Draw glitch effects (common to both phases)
        this.drawGlitchEffect();

        // Restore the context to its original state
        this.ctx.restore();

        // Update terminal texture
        if (this.terminalTexture) {
            this.terminalTexture.needsUpdate = true;
        }
    },

    // Draw background for terminal
    drawBackground() {
        // Draw background gradient
        const grad = this.ctx.createLinearGradient(0, 0, 0, TerminalConfig.canvas.height);
        grad.addColorStop(0, '#1c1c1c');
        grad.addColorStop(1, '#1c1c1c');
        this.ctx.globalCompositeOperation = 'source-over';
        this.ctx.fillStyle = grad;
        this.ctx.fillRect(0, 0, TerminalConfig.canvas.width, TerminalConfig.canvas.height);

        // Draw CRT screen stripes
        const stripeHeight = 4;
        this.ctx.save();
        this.ctx.globalAlpha = 0.1;
        this.ctx.fillStyle = '#000';
        for (let y = 0; y < TerminalConfig.canvas.height; y += stripeHeight * 2) {
            this.ctx.fillRect(0, y, TerminalConfig.canvas.width, stripeHeight);
        }
        this.ctx.restore();
    },

    // Setup text style
    setupTextStyle(isMobile) {
        this.ctx.shadowColor = '#fd501f';
        this.ctx.shadowBlur = 10;
        this.ctx.fillStyle = '#fff';

        // Use a slightly larger font size on mobile for better readability
        // This prevents the text from looking too small when the screen is narrow
        if (isMobile) {
            this.ctx.font = '20px IBM1971'; // Slightly larger for mobile
        } else {
            this.ctx.font = '18px IBM1971'; // Normal size for desktop
        }
    },

    // Draw boot phase content
    drawBootPhase(textMarginX, now) {
        // Draw GIAD logo in boot phase
        this.drawGiadLogo();

        const lineHeight = 24;

        // Handle boot sequence text display
        const maxVisibleLines = Math.floor((TerminalConfig.canvas.height - 100) / lineHeight);
        let visibleLines = TerminalState.bootDisplayLines.length > maxVisibleLines ?
            TerminalState.bootDisplayLines.slice(-maxVisibleLines) :
            TerminalState.bootDisplayLines;

        const startY = this.baseTerminalPadding;

        // Draw boot sequence lines
        for (let i = 0; i < visibleLines.length; i++) {
            this.ctx.fillText(visibleLines[i], textMarginX, startY + i * lineHeight);
        }

        // Draw countdown if needed
        if (TerminalState.bootPhaseEndTime > 0) {
            const remaining = Math.ceil((TerminalState.bootPhaseEndTime - now) / 1000);
            const countdownY = startY + visibleLines.length * lineHeight + 25;
            this.ctx.textAlign = 'center';
            this.ctx.fillText("AUTO LOADING IN [ " + remaining + " ]", TerminalConfig.canvas.width / 2, countdownY);
            this.ctx.textAlign = 'left';
        }
    },

    // Draw GIAD logo
    drawGiadLogo() {
        const giadLogoImage = new Image();
        giadLogoImage.src = 'GIAD-AestheticPreserver_Pixelated.png';
        giadLogoImage.onerror = function() {
            console.error('Failed to load GIAD logo image');
        };

        if (giadLogoImage && giadLogoImage.complete) {
            const padding = this.baseTerminalPadding;
            const aspectRatio = 1;
            const imageHeight = Math.max(175, window.innerWidth * 0.2);
            const imageWidth = imageHeight * aspectRatio;

            // Position in top right corner
            const imageX = TerminalConfig.canvas.width - imageWidth - padding;
            const imageY = padding;

            this.ctx.drawImage(giadLogoImage, imageX, imageY, imageWidth, imageHeight);
        }
    },

    // Draw post-boot phase content
    drawPostBootPhase(textMarginX) {
        const lineHeight = 24;
        const isMobile = window.innerWidth < window.innerHeight;

        // Draw animated logo in upper portion
        // Position logo higher on mobile
        const upperPortion = isMobile ?
            TerminalConfig.canvas.height * 0.3 : // Higher on mobile
            TerminalConfig.canvas.height * 0.4;  // Normal position on desktop

        this.drawAnimatedLogo(upperPortion);

        // Draw terminal interface elements
        this.drawTerminalInterface(isMobile);

        // Draw terminal output area with command line fixed at bottom
        // On mobile, position command area higher so it's more visible
        const commandPromptY = isMobile ?
            TerminalConfig.canvas.height - 80 : // Higher on mobile
            TerminalConfig.canvas.height - 100; // Normal position on desktop

        this.drawCommandAreaFromBottom(textMarginX, commandPromptY);
    },

    // Draw animated logo
    drawAnimatedLogo(upperPortion) {
        if (this.gifFrames.length > 0 &&
            this.gifFrames[TerminalState.currentFrameIndex] &&
            this.gifFrames[TerminalState.currentFrameIndex].complete) {
            const logoWidth = 130;
            const logoHeight = this.gifFrames[TerminalState.currentFrameIndex].height *
                (logoWidth / this.gifFrames[TerminalState.currentFrameIndex].width);
            const centerX = TerminalConfig.canvas.width / 2;
            const centerY = TerminalConfig.canvas.height / 2;

            this.ctx.drawImage(
                this.gifFrames[TerminalState.currentFrameIndex],
                centerX - logoWidth / 2,
                centerY - logoHeight,
                logoWidth,
                logoHeight);
        }
    },

    // Draw terminal interface
    drawTerminalInterface() {
        // Draw ACCESS TERMINAL button
        this.ctx.textAlign = 'center';
        const buttonText = TerminalConfig.ui.accessButton.text;
        const buttonY = TerminalConfig.canvas.height * TerminalConfig.ui.accessButton.position.y;

        this.ctx.fillText(buttonText, TerminalConfig.canvas.width / 2, buttonY);

        // Draw underline
        const textMetrics = this.ctx.measureText(buttonText);
        const textX = TerminalConfig.canvas.width / 2 - textMetrics.width / 2;
        const textY = buttonY + (textMetrics.actualBoundingBoxAscent + textMetrics.actualBoundingBoxDescent);

        this.ctx.beginPath();
        this.ctx.moveTo(textX, textY);
        this.ctx.lineTo(textX + textMetrics.width, textY);
        this.ctx.lineWidth = 1;
        this.ctx.strokeStyle = this.ctx.fillStyle;
        this.ctx.stroke();

        // Draw countdown
        const countdownRemaining = Math.max(0, Math.ceil((TerminalState.postBootEndTime - Date.now()) / 1000));
        const text = "LOADING IN [ " + countdownRemaining + " ]";
        const countdownTextMetrics = this.ctx.measureText(text);
        const accessTextHeigth = countdownTextMetrics.actualBoundingBoxAscent + countdownTextMetrics.actualBoundingBoxDescent;

        this.ctx.fillText(text,
            TerminalConfig.canvas.width / 2,
            (buttonY + accessTextHeigth + 30 ));
    },

    // Draw command area from bottom
    drawCommandAreaFromBottom(textMarginX) {
        this.ctx.textAlign = 'left';
        const lineHeight = 24;
        const maxWidth = TerminalConfig.canvas.width - (textMarginX * 2);
        const prompt = "C:\\GIAD> ";

        // Fixed position for command prompt at bottom
        const commandPromptY = TerminalConfig.canvas.height - 100;

        // Calculate available space for text
        const interfaceBottom = TerminalConfig.canvas.height * 0.65 + 20;
        const availableSpace = commandPromptY - interfaceBottom;
        const availableLines = Math.floor(availableSpace / lineHeight);

        // Handle egg message if it exists
        if (TerminalState.eggMessage !== "") {
            // Wrap text into lines
            const lines = this.wrapText(TerminalState.eggMessage, maxWidth);

            // Apply scroll offset (but don't scroll beyond available content)
            const maxScroll = Math.max(0, lines.length - availableLines);
            const effectiveScrollOffset = Math.min(TerminalState.terminalScrollOffset, maxScroll);

            // If offset is valid, show appropriate portion of content
            if (lines.length > availableLines) {
                // Show scrolled view of lines
                const startLine = effectiveScrollOffset;
                const endLine = Math.min(startLine + availableLines, lines.length);
                const visibleLines = lines.slice(startLine, endLine);

                // Draw visible lines
                for (let i = 0; i < visibleLines.length; i++) {
                    const lineY = interfaceBottom + (i * lineHeight);
                    this.ctx.fillText(visibleLines[i], textMarginX, lineY);
                }

                if (effectiveScrollOffset < maxScroll) {
                    this.ctx.textAlign = 'right';
                    this.ctx.fillText("↓ more", TerminalConfig.canvas.width - textMarginX, commandPromptY - 10);
                    this.ctx.textAlign = 'left';
                }
            } else {
                // If all content fits, just show it all
                for (let i = 0; i < lines.length; i++) {
                    const lineY = interfaceBottom + (i * lineHeight);
                    this.ctx.fillText(lines[i], textMarginX, lineY);
                }
            }
        }

        // Always draw command prompt at fixed bottom position
        this.ctx.fillText(
            prompt + TerminalState.commandInput + (TerminalState.showCursor ? "_" : ""),
            textMarginX,
            commandPromptY
        );
    },

    // Wrap text to fit width
    wrapText(text, maxWidth) {
        const words = text.split(' ');
        let lines = [];
        let currentLine = '';

        for (let word of words) {
            const testLine = currentLine + (currentLine ? ' ' : '') + word;
            const metrics = this.ctx.measureText(testLine);

            if (metrics.width > maxWidth) {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        }

        if (currentLine) {
            lines.push(currentLine);
        }

        return lines;
    },

    // Draw glitch effect
    drawGlitchEffect() {
        const thickness = Math.random() * 0.2 + 0.1;
        const alpha = 0.2 + Math.random() * 0.3;
        this.ctx.fillStyle = "rgba(255,255,255," + alpha + ")";
        this.ctx.fillRect(0, TerminalState.currentGlitchY, TerminalConfig.canvas.width, thickness);
    },

    // Draw the border
    drawBorder() {
        // Clear the border canvas
        this.borderCtx.clearRect(0, 0, TerminalConfig.canvas.width, TerminalConfig.canvas.height);

        const borderMargin = TerminalConfig.ui.borderMargin;
        const borderRadius = TerminalConfig.ui.borderRadius;

        // Disable anti-aliasing for sharper edges
        this.borderCtx.imageSmoothingEnabled = true;

        // Fill the inverted area (the main bezel)
        this.borderCtx.fillStyle = TerminalConfig.crt.colors.bezel;
        this.drawInvertedBorder(
            this.borderCtx,
            borderMargin,
            borderMargin,
            TerminalConfig.canvas.width - 2 * borderMargin,
            TerminalConfig.canvas.height - 2 * borderMargin,
            borderRadius
        );

        // Calculate gradient properties
        const baseRadius = Math.sqrt(
            Math.pow(TerminalConfig.canvas.width / 2, 2) +
            Math.pow(TerminalConfig.canvas.height / 2, 2)
        );

        const centerX = TerminalConfig.canvas.width / 2;
        const centerY = TerminalConfig.canvas.height / 2;

        const radius = baseRadius * TerminalConfig.gradient.radiusMultiplier;
        const offsetCenterX = centerX + TerminalConfig.gradient.centerOffset;
        const offsetCenterY = centerY + TerminalConfig.gradient.centerOffset;

        // Create radial gradient
        const grad = this.borderCtx.createRadialGradient(
            offsetCenterX, offsetCenterY, 0,  // Start point (center)
            offsetCenterX, offsetCenterY, radius  // End point (diagonal length)
        );

        // Add color stops with dynamic color values
        grad.addColorStop(0, TerminalConfig.gradient.startColor.rgba);
        grad.addColorStop(1, TerminalConfig.gradient.endColor.rgba);

        this.borderCtx.fillStyle = grad;

        this.drawInvertedBorder(
            this.borderCtx,
            borderMargin,
            borderMargin,
            TerminalConfig.canvas.width - 2 * borderMargin,
            TerminalConfig.canvas.height - 2 * borderMargin,
            borderRadius
        );

        // Draw a subtle inner edge
        this.borderCtx.save();
        this.drawRoundedRect(
            this.borderCtx,
            borderMargin,
            borderMargin,
            TerminalConfig.canvas.width - 2 * borderMargin,
            TerminalConfig.canvas.height - 2 * borderMargin,
            borderRadius
        );
        this.borderCtx.globalCompositeOperation = "soft-light";
        this.borderCtx.strokeStyle = TerminalConfig.crt.colors.bezel;
        this.borderCtx.shadowBlur = 10;
        this.borderCtx.shadowColor = '#00bbff';
        this.borderCtx.lineWidth = 1;
        this.borderCtx.stroke();

        this.borderCtx.fillStyle = '#000';
        this.borderCtx.globalCompositeOperation = "source-out";
        this.borderCtx.shadowBlur = 10;
        this.borderCtx.shadowColor = '#fff';
        this.borderCtx.shadowOffsetX = 25;
        this.borderCtx.shadowOffsetY = 20;
        this.borderCtx.clip();
        this.borderCtx.fill();

        this.borderCtx.fillStyle = '#000';
        this.borderCtx.shadowBlur = 10;
        this.borderCtx.shadowColor = '#fff';
        this.borderCtx.shadowOffsetX = -25;
        this.borderCtx.shadowOffsetY = -20;
        this.borderCtx.clip();
        this.borderCtx.fill();

        this.borderCtx.restore();

        // Draw outer border
        let borderWidth = 1;
        this.drawRoundedRect(
            this.borderCtx,
            borderWidth * 2,
            borderWidth * 2,
            (TerminalConfig.canvas.width - 2 * borderMargin) + ((borderMargin * 2) - 5),
            (TerminalConfig.canvas.height - 2 * borderMargin) + ((borderMargin * 2) - 5),
            25
        );
        this.borderCtx.strokeStyle = 'rgba(255,255,255,.15)';
        this.borderCtx.lineWidth = borderWidth;
        this.borderCtx.stroke();
        this.borderCtx.restore();

        // Draw the outer edge with a FILL instead of a stroke to avoid corner gaps
        this.borderCtx.save();

        // Draw the outer border using two paths and fill the area between them
        const outerBorderWidth = 1; // Border width

        // First draw the outer edge of the border
        this.borderCtx.beginPath();
        this.drawRoundedRect(
            this.borderCtx,
            1,
            1,
            TerminalConfig.canvas.width - 2,
            TerminalConfig.canvas.height - 2,
            borderRadius + (borderMargin - 1)
        );

        // Create a second path (slightly smaller) for the inner edge of the border
        this.borderCtx.beginPath();
        // Outer path
        this.borderCtx.moveTo(0, 0);
        this.borderCtx.lineTo(TerminalConfig.canvas.width, 0);
        this.borderCtx.lineTo(TerminalConfig.canvas.width, TerminalConfig.canvas.height);
        this.borderCtx.lineTo(0, TerminalConfig.canvas.height);
        this.borderCtx.lineTo(0, 0);
        this.borderCtx.closePath();

        // Inner path (subtracts from outer path)
        const ir = 20;
        this.borderCtx.moveTo(1 + outerBorderWidth + ir, 1 + outerBorderWidth);
        this.borderCtx.lineTo(TerminalConfig.canvas.width - 1 - outerBorderWidth - ir, 1 + outerBorderWidth);
        this.borderCtx.arcTo(
            TerminalConfig.canvas.width - 1 - outerBorderWidth, 1 + outerBorderWidth,
            TerminalConfig.canvas.width - 1 - outerBorderWidth, 1 + outerBorderWidth + ir,
            ir
        );
        this.borderCtx.lineTo(TerminalConfig.canvas.width - 1 - outerBorderWidth, TerminalConfig.canvas.height - 1 - outerBorderWidth - ir);
        this.borderCtx.arcTo(
            TerminalConfig.canvas.width - 1 - outerBorderWidth, TerminalConfig.canvas.height - 1 - outerBorderWidth,
            TerminalConfig.canvas.width - 1 - outerBorderWidth - ir, TerminalConfig.canvas.height - 1 - outerBorderWidth,
            ir
        );
        this.borderCtx.lineTo(1 + outerBorderWidth + ir, TerminalConfig.canvas.height - 1 - outerBorderWidth);
        this.borderCtx.arcTo(
            1 + outerBorderWidth, TerminalConfig.canvas.height - 1 - outerBorderWidth,
            1 + outerBorderWidth, TerminalConfig.canvas.height - 1 - outerBorderWidth - ir,
            ir
        );
        this.borderCtx.lineTo(1 + outerBorderWidth, 1 + outerBorderWidth + ir);
        this.borderCtx.arcTo(
            1 + outerBorderWidth, 1 + outerBorderWidth,
            1 + outerBorderWidth + ir, 1 + outerBorderWidth,
            ir
        );
        this.borderCtx.closePath();

        // Fill the area between paths
        this.borderCtx.fillStyle = '#1A1A1A';
        this.borderCtx.fill('evenodd');
        this.borderCtx.restore();

        // Update the border texture if it exists
        if (this.borderTexture) {
            this.borderTexture.needsUpdate = true;
        }
    },

    // Draw rounded rectangle
    drawRoundedRect(ctx, x, y, width, height, radius) {
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
    },

    // Draw inverted border
    drawInvertedBorder(ctx, x, y, width, height, radius) {
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
}


window.TerminalRenderer = TerminalRenderer;