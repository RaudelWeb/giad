// Terminal Debugger - Handles debugging functionality
const TerminalDebugger = {
    // Performance monitoring
    performance: {
        fps: 0,
        lastFrameTime: 0,
        frameCount: 0,
        updateInterval: 1000, // update every second
        lastUpdateTime: 0
    },

    // GUI controllers
    controllers: {
        fps: null,
        debugFolder: null
    },

    // Initialize debugger
    init(terminalApp) {
        this.app = terminalApp;

        // Add debugging settings to config if not present
        if (!this.app.config.debugging) {
            this.app.config.debugging = {
                showGrid: false,
                fullConsoleLogging: false
            };
        }

        return this;
    },

    // Setup dat.GUI debugging interface
    setupGUI(gui) {
        // Create debug folder
        this.controllers.debugFolder = gui.addFolder('Debugging');

        // Toggle debug grid
        this.controllers.debugFolder.add(TerminalConfig.debugging, 'showGrid')
            .name('Show Grid')
            .onChange(value => {
                TerminalConfig.debugging.showGrid = value
                console.log(value);
                // Redraw terminal when toggled
                this.app.renderer.drawTerminal();
            });

        // Toggle console logging
        this.controllers.debugFolder.add(this.app.config.debugging, 'fullConsoleLogging')
            .name('Verbose Logging')
            .onChange(value => {
                if (value) {
                    console.log('Verbose logging enabled');
                    this.logCurrentState();
                }
            });

        // Add performance monitoring sub-folder
        this.setupPerformanceGUI();

        // Add texture debugging sub-folder
        this.setupTextureGUI();

        // Add shader debugging sub-folder
        this.setupShaderGUI();

        return this;
    },

    // Setup performance monitoring GUI
    setupPerformanceGUI() {
        const performanceFolder = this.controllers.debugFolder.addFolder('Performance');
        this.controllers.fps = performanceFolder.add(this.performance, 'fps')
            .name('FPS')
            .listen();

        return this;
    },

    // Setup texture debugging GUI
    setupTextureGUI() {
        const textureFolder = this.controllers.debugFolder.addFolder('Textures');
        textureFolder.add(this, 'reloadTextures').name('Reload Textures');
        textureFolder.add(this, 'logTextureDetails').name('Log Texture Details');

        return this;
    },

    // Setup shader debugging GUI
    setupShaderGUI() {
        const shaderFolder = this.controllers.debugFolder.addFolder('Shaders');
        shaderFolder.add(this, 'logUniforms').name('Log Uniforms');
        shaderFolder.add(this, 'toggleDistortion').name('Toggle Distortion');

        return this;
    },

    // Update FPS counter
    updateFPS() {
        const now = Date.now();

        // Update FPS counter
        this.performance.frameCount++;
        if (now - this.performance.lastUpdateTime >= this.performance.updateInterval) {
            this.performance.fps = Math.round(
                (this.performance.frameCount * 1000) / (now - this.performance.lastUpdateTime)
            );
            this.performance.lastUpdateTime = now;
            this.performance.frameCount = 0;
        }

        return this;
    },

    // Draw debug grid on canvas
    drawDebugGrid(ctx, canvas) {
        if (!this.app.config.debugging.showGrid) return;

        // Save context
        ctx.save();

        // Draw a grid to visualize texture mapping
        ctx.strokeStyle = 'rgba(255,0,0,0.3)';
        ctx.lineWidth = 1;

        // Draw major grid lines
        ctx.strokeStyle = 'rgba(255,0,0,0.5)';
        ctx.lineWidth = 2;

        // Vertical center line
        ctx.beginPath();
        ctx.moveTo(canvas.width / 2, 0);
        ctx.lineTo(canvas.width / 2, canvas.height);
        ctx.stroke();

        // Horizontal center line
        ctx.beginPath();
        ctx.moveTo(0, canvas.height / 2);
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();

        // Draw minor grid lines
        ctx.strokeStyle = 'rgba(255,0,0,0.3)';
        ctx.lineWidth = 1;

        // Draw vertical grid lines
        for (let x = 0; x <= canvas.width; x += 100) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
        }

        // Draw horizontal grid lines
        for (let y = 0; y <= canvas.height; y += 100) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }

        // Draw coordinate markers at corners and center
        ctx.fillStyle = '#ff0000';
        ctx.font = '16px monospace';
        ctx.fillText(`(0,0)`, 5, 15);
        ctx.fillText(`(${canvas.width},0)`, canvas.width - 80, 15);
        ctx.fillText(`(0,${canvas.height})`, 5, canvas.height - 5);
        ctx.fillText(`(${canvas.width},${canvas.height})`, canvas.width - 80, canvas.height - 5);

        // Add center coordinates
        ctx.fillText(`(${canvas.width/2},${canvas.height/2})`,
            canvas.width/2 - 40, canvas.height/2 - 10);

        // Draw canvas dimensions
        ctx.fillText(`Canvas: ${canvas.width}x${canvas.height}`,
            canvas.width/2 - 100, 30);

        // Restore context
        ctx.restore();

        return this;
    },

    // Log current application state
    logCurrentState() {
        console.log('Current state:', {
            canvasDimensions: {
                terminal: {
                    width: this.app.renderer.offscreenCanvas.width,
                    height: this.app.renderer.offscreenCanvas.height
                },
                border: {
                    width: this.app.renderer.borderCanvas.width,
                    height: this.app.renderer.borderCanvas.height
                }
            },
            meshDimensions: {
                terminal: this.app.renderer.planeMesh.geometry.parameters,
                border: this.app.renderer.borderPlaneMesh.geometry.parameters
            },
            configDimensions: {
                width: this.app.config.canvas.width,
                height: this.app.config.canvas.height,
                aspect: this.app.config.canvas.aspect
            },
            viewport: {
                width: window.innerWidth,
                height: window.innerHeight
            }
        });

        return this;
    },

    // Reload textures
    reloadTextures() {
        if (this.app.renderer.terminalTexture) {
            this.app.renderer.terminalTexture.needsUpdate = true;
        }
        if (this.app.renderer.borderTexture) {
            this.app.renderer.borderTexture.needsUpdate = true;
        }
        console.log('Textures reloaded');

        return this;
    },

    // Log texture details
    logTextureDetails() {
        const terminalTexture = this.app.renderer.terminalTexture;
        const borderTexture = this.app.renderer.borderTexture;

        console.log('Texture details:', {
            terminal: terminalTexture ? {
                uuid: terminalTexture.uuid,
                format: terminalTexture.format,
                type: terminalTexture.type,
                minFilter: terminalTexture.minFilter,
                magFilter: terminalTexture.magFilter,
                wrapS: terminalTexture.wrapS,
                wrapT: terminalTexture.wrapT,
                repeat: [terminalTexture.repeat.x, terminalTexture.repeat.y],
                offset: [terminalTexture.offset.x, terminalTexture.offset.y]
            } : 'Not available',
            border: borderTexture ? {
                uuid: borderTexture.uuid,
                format: borderTexture.format,
                type: borderTexture.type,
                minFilter: borderTexture.minFilter,
                magFilter: borderTexture.magFilter,
                wrapS: borderTexture.wrapS,
                wrapT: borderTexture.wrapT,
                repeat: [borderTexture.repeat.x, borderTexture.repeat.y],
                offset: [borderTexture.offset.x, borderTexture.offset.y]
            } : 'Not available'
        });

        return this;
    },

    // Log shader uniforms
    logUniforms() {
        if (this.app.renderer.planeMesh && this.app.renderer.planeMesh.material) {
            console.log('Terminal shader uniforms:',
                JSON.parse(JSON.stringify(this.app.renderer.planeMesh.material.uniforms)));
        }

        return this;
    },

    // Toggle distortion effect
    toggleDistortion() {
        if (this.app.renderer.planeMesh &&
            this.app.renderer.planeMesh.material &&
            this.app.renderer.planeMesh.material.uniforms) {
            const current = this.app.renderer.planeMesh.material.uniforms.distortion.value;
            this.app.renderer.planeMesh.material.uniforms.distortion.value = current > 0 ? 0 : 0.35;
            console.log('Distortion toggled to:',
                this.app.renderer.planeMesh.material.uniforms.distortion.value);
        }

        return this;
    }
};

// Export the debugger
window.TerminalDebugger = TerminalDebugger;