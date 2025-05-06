// Terminal Controller - Manages the application and ties components together
const TerminalController = {
    // Animation properties
    resizeTimeout: null,
    initialResize: true,

    _ab_controller: new AbortController(),

    // Initialize the terminal
    init( refresh = false ) {

        // Initialize components
        TerminalState.init();
        TerminalRenderer.init();

        TerminalDebugger.init({
            config: TerminalConfig,
            state: TerminalState,
            renderer: TerminalRenderer
        });

        // Create meshes after textures are loaded
        TerminalRenderer.createMeshes();

        // Start the boot sequence
        TerminalState.runBootSequence();

        setTimeout(() => {
            // Explicitly draw the border and terminal
            TerminalRenderer.drawBorder();
            TerminalRenderer.drawTerminal();

            // Force texture updates
            if (TerminalRenderer.borderTexture) {
                TerminalRenderer.borderTexture.needsUpdate = true;
            }
            if (TerminalRenderer.terminalTexture) {
                TerminalRenderer.terminalTexture.needsUpdate = true;
            }

            // Force a render frame
            TerminalRenderer.renderer.render(TerminalRenderer.scene, TerminalRenderer.camera);

            console.log('Three.js setup:', {
                windowWidth: window.innerWidth,
                windowHeight: window.innerHeight,
                canvasWidth: TerminalRenderer.offscreenCanvas.width,
                canvasHeight: TerminalRenderer.offscreenCanvas.height,
                rendererSize: {
                    width: TerminalRenderer.renderer.domElement?.width,
                    height: TerminalRenderer.renderer.domElement?.height
                }
            });
        }, 0);

        // Set up event listeners
        this.setupEventListeners( this._ab_controller.signal );

        // Set up dat.GUI for settings
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('dev_mode') === 'true' && !refresh) {
            this.setupDatGUI();
        }

        // Start animation loop
        this.animate();
    },

    refreshDatGUI() {
        // Remove the old GUI
        if (this.gui) {
            this.gui.destroy();
        }

        // Create a new GUI
        this.gui = new dat.GUI({ width: 300 });

        // Setup all GUI controls
        this.setupDatGUI();

        console.log('GUI refreshed with new configuration');
    },

    // Set up event listeners
    setupEventListeners( signal ) {
        // Handle window resize
        window.addEventListener('resize', () => this.handleResize(), { signal: signal });

        // Handle orientation change for mobile
        window.addEventListener('orientationchange', () => {
            this.handleResize();
            setTimeout(() => this.handleResize(), 500);
        }, { signal: signal });

        // Handle window focus/blur
        window.addEventListener('blur', () => {
            TerminalState.isFocused = false;
        }, { signal: signal });

        window.addEventListener('focus', () => {
            TerminalState.isFocused = true;
        }, { signal: signal });

        // Handle visibility change
        document.addEventListener('visibilitychange', () => {
            TerminalState.isFocused = !document.hidden;
        }, { signal: signal });

        // Handle click events
        TerminalRenderer.renderer.domElement.addEventListener('click', (e) => {
            this.handleClick(e);
        }, { signal: signal });

        // Handle keyboard events
        document.addEventListener('keydown', (e) => {
            this.handleKeyDown(e);
        }, { signal: signal });
    },

    // Set up dat.GUI interface
    setupDatGUI() {
        // Make sure we have a GUI instance
        if (!this.gui) {
            this.gui = new dat.GUI({ width: 300 });
        }

        // Setup configuration folder using the function from ConfigManager
        setupConfigGUI(this.gui);

        // CRT Effects folder
        const crtFolder = this.gui.addFolder('CRT Effects');
        crtFolder.add(TerminalConfig.crt, 'curvature', 0, 1).name('Screen Curvature').onChange(val => {
            if (TerminalRenderer.planeMesh && TerminalRenderer.planeMesh.material &&
                TerminalRenderer.planeMesh.material.uniforms) {
                TerminalRenderer.planeMesh.material.uniforms.screenCurvature.value = val;
                TerminalRenderer.borderPlaneMesh.material.uniforms.screenCurvature.value = val;
            }
        });

        crtFolder.add(TerminalConfig.crt.rasterization, 'intensity', 0, 1).name('Scanline Intensity').onChange(val => {
            if (TerminalRenderer.planeMesh && TerminalRenderer.planeMesh.material &&
                TerminalRenderer.planeMesh.material.uniforms) {
                TerminalRenderer.planeMesh.material.uniforms.rasterizationIntensity.value = val;
            }
        });

        crtFolder.add(TerminalConfig.crt.effects, 'staticNoise', 0, 1).name('Static Noise').onChange(val => {
            if (TerminalRenderer.planeMesh && TerminalRenderer.planeMesh.material &&
                TerminalRenderer.planeMesh.material.uniforms) {
                TerminalRenderer.planeMesh.material.uniforms.staticNoise.value = val;
            }
        });

        crtFolder.add(TerminalConfig.crt.effects, 'flickering', 0, 0.5).name('Flickering').onChange(val => {
            if (TerminalRenderer.planeMesh && TerminalRenderer.planeMesh.material &&
                TerminalRenderer.planeMesh.material.uniforms) {
                TerminalRenderer.planeMesh.material.uniforms.flickering.value = val;
            }
        });

        crtFolder.add(TerminalConfig.crt.effects, 'horizontalSync', 0, 0.5).name('H-Sync Distortion').onChange(val => {
            if (TerminalRenderer.planeMesh && TerminalRenderer.planeMesh.material &&
                TerminalRenderer.planeMesh.material.uniforms) {
                TerminalRenderer.planeMesh.material.uniforms.horizontalSync.value = val;
            }
        });

        crtFolder.add(TerminalConfig.crt.effects, 'glowingLine', 0, 1).name('Glowing Line').onChange(val => {
            if (TerminalRenderer.planeMesh && TerminalRenderer.planeMesh.material &&
                TerminalRenderer.planeMesh.material.uniforms) {
                TerminalRenderer.planeMesh.material.uniforms.glowingLine.value = val;
            }
        });

        /*crtFolder.open();*/

        // Gradient Settings folder
        const gradientFolder = this.gui.addFolder('Gradient Settings');

        gradientFolder.add(TerminalConfig.gradient, 'radiusMultiplier', 0.1, 2).name('Radius Multiplier').onChange(() => {
            TerminalRenderer.drawBorder();
        });

        gradientFolder.add(TerminalConfig.gradient, 'centerOffset', -500, 500).name('Center Offset').onChange(() => {
            TerminalRenderer.drawBorder();
        });

        /*// Start Color subfolder
        const startColorFolder = gradientFolder.addFolder('Start Color');
        startColorFolder.add(TerminalConfig.gradient.startColor, 'r', 0, 255).name('Red').onChange(() => {
            TerminalRenderer.drawBorder();
        });
        startColorFolder.add(TerminalConfig.gradient.startColor, 'g', 0, 255).name('Green').onChange(() => {
            TerminalRenderer.drawBorder();
        });
        startColorFolder.add(TerminalConfig.gradient.startColor, 'b', 0, 255).name('Blue').onChange(() => {
            TerminalRenderer.drawBorder();
        });
        startColorFolder.add(TerminalConfig.gradient.startColor, 'a', 0, 1).step(0.01).name('Alpha').onChange(() => {
            TerminalRenderer.drawBorder();
        });

        // End Color subfolder
        const endColorFolder = gradientFolder.addFolder('End Color');
        endColorFolder.add(TerminalConfig.gradient.endColor, 'r', 0, 255).name('Red').onChange(() => {
            TerminalRenderer.drawBorder();
        });
        endColorFolder.add(TerminalConfig.gradient.endColor, 'g', 0, 255).name('Green').onChange(() => {
            TerminalRenderer.drawBorder();
        });
        endColorFolder.add(TerminalConfig.gradient.endColor, 'b', 0, 255).name('Blue').onChange(() => {
            TerminalRenderer.drawBorder();
        });
        endColorFolder.add(TerminalConfig.gradient.endColor, 'a', 0, 1).step(0.01).name('Alpha').onChange(() => {
            TerminalRenderer.drawBorder();
        });*/

        /*gradientFolder.open();*/

        // UI Settings folder
        const uiFolder = this.gui.addFolder('UI Settings');
        uiFolder.add(TerminalConfig.ui, 'borderMargin', 10, 100).name('Border Margin').onChange(val => {
            TerminalConfig.ui.borderMargin = val
            TerminalRenderer.drawBorder();
        });

        uiFolder.add(TerminalConfig.ui, 'borderRadius', 0, 50).name('Inner Border Radius').onChange(val => {
            TerminalConfig.ui.borderRadius = val
            TerminalRenderer.drawBorder();
        });

        // Terminal Settings folder
        const terminalFolder = this.gui.addFolder('Terminal Settings');
        terminalFolder.add(TerminalConfig.terminal, 'frameDelay', 40, 200).name('Animation Speed');
        terminalFolder.add(TerminalConfig.terminal.phases, 'bootDuration', 1000, 10000).name('Boot Duration');
        terminalFolder.add(TerminalConfig.terminal.phases, 'postBootDuration', 30000, 120000).name('Post-Boot Duration');

        TerminalDebugger.setupGUI(this.gui);

        // Add a button to restart animation
        const restartObj = { restart: () => {
                this.restartTerminal();
            }};
        this.gui.add(restartObj, 'restart').name('Restart Terminal');

    },

    clear() {
        // 1. Reset all state in one go
        Object.assign(TerminalState, {
            bootIndex: 0,
            bootDisplayLines: [],
            bootPhaseEndTime: 0,
            postBootEndTime: 0,
            phase: "boot",
            commandInput: "",
            eggMessage: "",
            terminalScrollOffset: 0,
            startTime: Date.now(),
            lastGlitchUpdate: Date.now()
        });

        // 2. Clear canvas contexts
        const canvasWidth = TerminalConfig.canvas.width;
        const canvasHeight = TerminalConfig.canvas.height;

        [TerminalRenderer.ctx, TerminalRenderer.borderCtx].forEach(ctx => {
            if (ctx) ctx.clearRect(0, 0, canvasWidth, canvasHeight);
        });

        // 3. Properly dispose Three.js resources
        if (TerminalRenderer.scene) {
            // Use forEach for cleaner code
            TerminalRenderer.scene.children.slice().forEach(object => {
                // Dispose geometry
                if (object.geometry) object.geometry.dispose();

                // Dispose material and textures
                if (object.material) {
                    // Handle materials array
                    if (Array.isArray(object.material)) {
                        object.material.forEach(material => disposeMaterial(material));
                    } else {
                        disposeMaterial(object.material);
                    }
                }

                // Remove from scene
                TerminalRenderer.scene.remove(object);
            });
        }

        // 4. Force texture updates
        if (TerminalRenderer.terminalTexture) TerminalRenderer.terminalTexture.needsUpdate = true;
        if (TerminalRenderer.borderTexture) TerminalRenderer.borderTexture.needsUpdate = true;

        // Helper function to properly dispose material resources
        function disposeMaterial(material) {
            // Dispose any maps/textures
            Object.keys(material).forEach(prop => {
                if (!material[prop]) return;
                if (material[prop].isTexture) material[prop].dispose();

                // Also dispose any material uniforms that are textures
                if (prop === 'uniforms') {
                    Object.keys(material.uniforms).forEach(name => {
                        const uniform = material.uniforms[name];
                        if (uniform && uniform.value && uniform.value.isTexture) {
                            uniform.value.dispose();
                        }
                    });
                }
            });

            // Finally dispose the material itself
            material.dispose();
        }
    },

    clearEventListeners() {
      this._ab_controller.abort();
    },

    // Restart the terminal animation
    restartTerminal() {
        this.clearEventListeners();
        this._ab_controller = new AbortController();
        this.clear();
        this.init();
    },

    // Animation loop
    animate() {
        // Request the next frame first to ensure smooth animation
        if (TerminalState.isFocused) {
            requestAnimationFrame(() => this.animate());
        } else {
            // If not focused, reduce animation frequency to save resources
            setTimeout(() => {
                requestAnimationFrame(() => this.animate());
            }, 1000);
            return;
        }

        TerminalDebugger.updateFPS();

        const now = Date.now();
        const delta = (now - TerminalState.lastGlitchUpdate) / 1000;

        // Update glitch effect position
        TerminalState.lastGlitchUpdate = now;
        TerminalState.currentGlitchY += TerminalConfig.terminal.glitchSpeed * delta;
        if (Math.random() < 0.015) {
            TerminalState.currentGlitchY = Math.random() * TerminalConfig.canvas.height;
        }
        if (TerminalState.currentGlitchY >= TerminalConfig.canvas.height) {
            TerminalState.currentGlitchY -= TerminalConfig.canvas.height;
        }

        // Update blinking cursor every 0.5 seconds
        TerminalState.cursorTimer += delta;
        if (TerminalState.cursorTimer >= 0.5) {
            TerminalState.showCursor = !TerminalState.showCursor;
            TerminalState.cursorTimer = 0;
        }

        // Update the current gif frame
        TerminalState.updateGifFrame();

        // Check for phase transitions
        if (TerminalState.phase === "boot" && TerminalState.bootPhaseEndTime > 0 && now >= TerminalState.bootPhaseEndTime) {
            TerminalState.launchPhase2();
        }

        // Check for post-boot completion
        const shouldRedirect = TerminalState.phase === "postBoot" && now >= TerminalState.postBootEndTime;
        const isDevMode = window.location.href.includes('localhost');

        if (shouldRedirect) {
            if (isDevMode) {
                window.location.reload();
            } else {
                window.location.href = TerminalConfig.ui.accessButton.url;
            }
        }

        // Draw the terminal content
        TerminalRenderer.drawTerminal();

        // Update time uniform for main content
        const elapsed = (now - TerminalState.startTime) / 1000;

        if (TerminalRenderer.planeMesh &&
            TerminalRenderer.planeMesh.material &&
            TerminalRenderer.planeMesh.material.uniforms &&
            TerminalRenderer.planeMesh.material.uniforms.time) {
            TerminalRenderer.planeMesh.material.uniforms.time.value = elapsed;
        }

        // Update time uniform for border
        if (TerminalRenderer.borderPlaneMesh &&
            TerminalRenderer.borderPlaneMesh.material &&
            TerminalRenderer.borderPlaneMesh.material.uniforms &&
            TerminalRenderer.borderPlaneMesh.material.uniforms.time) {
            TerminalRenderer.borderPlaneMesh.material.uniforms.time.value = elapsed;
        }

        // Render the scene
        TerminalRenderer.renderer.render(TerminalRenderer.scene, TerminalRenderer.camera);
    },

    // Handle window resize
    handleResize() {
        // Clear previous timeout
        if (this.resizeTimeout) {
            clearTimeout(this.resizeTimeout);
        }

        // Immediate response for first resize or after page load
        if (this.initialResize) {
            this.initialResize = false;
            this.doResize();
            // Also schedule another resize after a delay to handle any OS/browser adjustments
            this.resizeTimeout = setTimeout(() => this.doResize(), 300);
            return;
        }

        // Set a timeout to prevent excessive recalculations during resize
        this.resizeTimeout = setTimeout(() => this.doResize(), 100);
    },

    // Perform resize operations
    doResize() {
        // Ensure canvas exists and is properly sized
        TerminalRenderer.ensureOffscreenCanvas();

        // Update renderer pixel ratio and size
        TerminalRenderer.renderer.setPixelRatio(window.devicePixelRatio || 1);
        TerminalRenderer.renderer.setSize(window.innerWidth, window.innerHeight);

        // Update rendering
        TerminalRenderer.onWindowResize();

        // Force render a frame
        TerminalRenderer.renderer.render(TerminalRenderer.scene, TerminalRenderer.camera);
    },

    // Handle click events
    handleClick(e) {

        // Calculate click position relative to window
        const windowX = e.clientX;
        const windowY = e.clientY;

        // Get CRT values for current dimensions
        const crtValues = TerminalRenderer.calculateCrtValues();
        const { innerWidth: _innerWidth, innerHeight: _innerHeight, innerLeftX, innerTopY } = crtValues;

        // First check if the click is within the terminal bounds
        if (windowX >= innerLeftX &&
            windowX <= innerLeftX + _innerWidth &&
            windowY >= innerTopY &&
            windowY <= innerTopY + _innerHeight) {

            // Convert window coordinates to normalized terminal coordinates (0-1)
            const relativeX = (windowX - innerLeftX) / _innerWidth;
            const relativeY = (windowY - innerTopY) / _innerHeight;

            // Scale to terminal resolution
            const terminalX = relativeX * TerminalConfig.canvas.width;
            const terminalY = relativeY * TerminalConfig.canvas.height;

            // Define button area based on configuration
            const buttonConfig = TerminalConfig.ui.accessButton;
            const btnCenterX = TerminalConfig.canvas.width * buttonConfig.position.x;
            const btnCenterY = TerminalConfig.canvas.height * buttonConfig.position.y;
            const btnWidth = buttonConfig.size.width;
            const btnHeight = buttonConfig.size.height;

            const btnLeft = btnCenterX - btnWidth / 2;
            const btnRight = btnCenterX + btnWidth / 2;
            const btnTop = btnCenterY - btnHeight / 2;
            const btnBottom = btnCenterY + btnHeight / 2;

            // Check if click is on the button
            if (terminalX >= btnLeft &&
                terminalX <= btnRight &&
                terminalY >= btnTop &&
                terminalY <= btnBottom &&
                TerminalState.phase === "postBoot") {

                // Navigate to configured URL
                window.location.href = buttonConfig.url;
            }
            else if (TerminalState.phase === 'postBoot') {
                // Check if it's likely a mobile device (portrait orientation)
                if (window.innerWidth < window.innerHeight) {
                    let cmdInput = document.getElementById('cmd');

                    // If input doesn't exist, create it
                    if (!cmdInput) {
                        cmdInput = document.createElement('input');
                        cmdInput.id = 'cmd';
                        cmdInput.type = 'text';
                        cmdInput.style.position = 'absolute';
                        cmdInput.style.opacity = '0';          // Keep input invisible
                        cmdInput.style.pointerEvents = 'none'; // Avoid interfering with clicks
                        document.body.appendChild(cmdInput);
                    }

                    // Focus to trigger the keyboard
                    cmdInput.focus();
                }
            }
        }
    },

    // Handle keyboard events
    handleKeyDown(e) {
        // In boot phase, any key triggers phase2
        if (TerminalState.phase === "boot" && TerminalState.bootIndex > 10) {
            TerminalState.launchPhase2();
            return;
        }

        // In post boot phase, handle terminal scrolling with arrow keys
        if (TerminalState.phase === "postBoot") {
            if (e.key === 'ArrowUp' && !TerminalState.commandInput) {
                if (TerminalState.terminalScrollOffset > 0) {
                    TerminalState.terminalScrollOffset--;
                    TerminalRenderer.drawTerminal();
                    if (TerminalRenderer.terminalTexture) TerminalRenderer.terminalTexture.needsUpdate = true;
                    e.preventDefault();
                }
            } else if (e.key === 'ArrowDown' && !TerminalState.commandInput) {
                // Scroll down further
                TerminalState.terminalScrollOffset++;
                TerminalRenderer.drawTerminal();
                if (TerminalRenderer.terminalTexture) TerminalRenderer.terminalTexture.needsUpdate = true;
                e.preventDefault();
                return;
            }
        }

        // In post boot phase, handle command input
        if (TerminalState.phase === "postBoot") {
            switch (e.key) {
                case 'Backspace':
                    e.preventDefault();
                    TerminalState.commandInput = TerminalState.commandInput.slice(0, -1);
                    break;
                case 'Enter':
                    const cmd = TerminalState.commandInput.trim().toLowerCase();
                    if (cmd) {
                        TerminalState.processCommand(cmd);
                    }
                    break;
                default:
                    const modifierKeys = ['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab', 'Escape',
                        'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
                        'Home', 'End', 'PageUp', 'PageDown'];
                    if (!modifierKeys.includes(e.key)) {
                        TerminalState.commandInput += e.key;
                    }
            }
        }
    }
};