// First, let's extend the TerminalConfig to include text styling options
const textStyleConfig = {
    // Add this to the TerminalConfig object
    text: {
        color: "#ffffff",      // Text color
        glowColor: "#fd501f",  // Text glow/shadow color
        glowIntensity: 10,     // Glow intensity (shadow blur)
        lineHeight: 24,        // Line height for text
        fontSize: {
            desktop: 18,         // Font size for desktop
            mobile: 20           // Font size for mobile
        },
        fontFamily: "IBM1971"  // Font family
    }
};

// Function to extend TerminalConfig with the new text styling options
function extendConfigWithTextStyling() {
    // Only add if not already present
    if (!TerminalConfig.text) {
        TerminalConfig.text = JSON.parse(JSON.stringify(textStyleConfig.text));

        // Ensure the getter for text.color is a THREE.Color object if used in shaders
        TerminalConfig.crt.colors.font = new THREE.Color(TerminalConfig.text.color);
    }
}

// Update the TerminalRenderer's setupTextStyle method to use the config
function updateTextStyleMethod() {
    // Update the setupTextStyle method in TerminalRenderer
    TerminalRenderer.setupTextStyle = function(isMobile) {
        const config = TerminalConfig.text;

        // Apply text shadow/glow
        this.ctx.shadowColor = config.glowColor;
        this.ctx.shadowBlur = config.glowIntensity;

        // Apply text color
        this.ctx.fillStyle = config.color;

        // Apply font size based on device
        const fontSize = isMobile ? config.fontSize.mobile : config.fontSize.desktop;
        this.ctx.font = `${fontSize}px ${config.fontFamily}`;
    };

    // Update lineHeight usage throughout the renderer
    const origDrawCommandArea = TerminalRenderer.drawCommandAreaFromBottom;
    TerminalRenderer.drawCommandAreaFromBottom = function(textMarginX, commandPromptY) {
        // Use the configured line height
        const lineHeight = TerminalConfig.text.lineHeight;

        // Rest of the function remains the same but uses the new lineHeight
        this.ctx.textAlign = 'left';
        const maxWidth = TerminalConfig.canvas.width - (textMarginX * 2);
        const prompt = "C:\\GIAD> ";

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

        // Always draw command prompt at the specified Y position
        this.ctx.fillText(
            prompt + TerminalState.commandInput + (TerminalState.showCursor ? "_" : ""),
            textMarginX,
            commandPromptY
        );
    };

    // Also update bootPhase drawing to use the configured line height
    const origDrawBootPhase = TerminalRenderer.drawBootPhase;
    TerminalRenderer.drawBootPhase = function(textMarginX, now) {
        // Draw GIAD logo in boot phase
        this.drawGiadLogo();

        const lineHeight = TerminalConfig.text.lineHeight;

        // Handle boot sequence text display
        const maxVisibleLines = Math.floor((TerminalConfig.canvas.height - 100) / lineHeight);
        let visibleLines = TerminalState.bootDisplayLines.length > maxVisibleLines ?
            TerminalState.bootDisplayLines.slice(-maxVisibleLines) :
            TerminalState.bootDisplayLines;

        const startY = 100;

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
    };
}

// Add text controls to the dat.GUI
function addTextControlsToGUI(controller) {
    // Make sure we have the text config
    extendConfigWithTextStyling();

    // Update the renderer methods
    updateTextStyleMethod();

    // Make sure controller has guiControllers initialized
    if (!controller.guiControllers) {
        controller.guiControllers = {};
    }

    // Add text settings folder to the GUI
    const textFolder = controller.gui.addFolder('Text Settings');

    // Color picker for text color
    // We need to convert the hex color string to a properly formatted hex value
    const textColorObj = {
        color: TerminalConfig.text.color
    };

    controller.guiControllers.textColor = textFolder.addColor(textColorObj, 'color')
        .name('Text Color')
        .onChange(value => {
            // Update both the text config and the CRT colors
            TerminalConfig.text.color = value;
            // Also update the crt.colors.font for shader compatibility
            TerminalConfig.crt.colors.font = new THREE.Color(value);

            // Update shader uniform if it exists
            if (TerminalRenderer.planeMesh &&
                TerminalRenderer.planeMesh.material &&
                TerminalRenderer.planeMesh.material.uniforms) {
                TerminalRenderer.planeMesh.material.uniforms.fontColor.value = new THREE.Color(value);
            }

            // Force redraw
            TerminalRenderer.drawTerminal();
        });

    // Color picker for text glow color
    const glowColorObj = {
        color: TerminalConfig.text.glowColor
    };

    controller.guiControllers.glowColor = textFolder.addColor(glowColorObj, 'color')
        .name('Glow Color')
        .onChange(value => {
            TerminalConfig.text.glowColor = value;
            TerminalRenderer.drawTerminal();
        });

    // Glow intensity
    controller.guiControllers.glowIntensity = textFolder.add(TerminalConfig.text, 'glowIntensity', 0, 30)
        .name('Glow Intensity')
        .onChange(value => {
            TerminalConfig.text.glowIntensity = value;
            TerminalRenderer.drawTerminal();
        });

    // Line height
    controller.guiControllers.lineHeight = textFolder.add(TerminalConfig.text, 'lineHeight', 16, 40)
        .step(1)
        .name('Line Height')
        .onChange(value => {
            TerminalConfig.text.lineHeight = value;
            TerminalRenderer.drawTerminal();
        });

    // Font size (Desktop)
    controller.guiControllers.fontSizeDesktop = textFolder.add(TerminalConfig.text.fontSize, 'desktop', 12, 30)
        .step(1)
        .name('Font Size (Desktop)')
        .onChange(value => {
            TerminalConfig.text.fontSize.desktop = value;
            TerminalRenderer.drawTerminal();
        });

    // Font size (Mobile)
    controller.guiControllers.fontSizeMobile = textFolder.add(TerminalConfig.text.fontSize, 'mobile', 12, 30)
        .step(1)
        .name('Font Size (Mobile)')
        .onChange(value => {
            TerminalConfig.text.fontSize.mobile = value;
            TerminalRenderer.drawTerminal();
        });

    // Open the text folder
    textFolder.open();

    // Return the folder for further modifications
    return textFolder;
}

// Extend the updateAllGuiValues method in TerminalController to include text controls
function extendUpdateAllGuiValues(controller) {
    const origUpdateAllGuiValues = controller.updateAllGuiValues;

    controller.updateAllGuiValues = function() {
        // Call the original method
        origUpdateAllGuiValues.call(this);

        // Ensure guiControllers exists
        if (!this.guiControllers) {
            return;
        }

        // Update text controls if they exist
        if (this.guiControllers.textColor) {
            this.guiControllers.textColor.setValue(TerminalConfig.text.color);
        }

        if (this.guiControllers.glowColor) {
            this.guiControllers.glowColor.setValue(TerminalConfig.text.glowColor);
        }

        if (this.guiControllers.glowIntensity) {
            this.guiControllers.glowIntensity.setValue(TerminalConfig.text.glowIntensity);
        }

        if (this.guiControllers.lineHeight) {
            this.guiControllers.lineHeight.setValue(TerminalConfig.text.lineHeight);
        }

        if (this.guiControllers.fontSizeDesktop) {
            this.guiControllers.fontSizeDesktop.setValue(TerminalConfig.text.fontSize.desktop);
        }

        if (this.guiControllers.fontSizeMobile) {
            this.guiControllers.fontSizeMobile.setValue(TerminalConfig.text.fontSize.mobile);
        }
    };
}

// Update ConfigManager to handle text settings
function extendConfigManager() {
    // Extend the applyConfig method to handle text settings
    const origApplyConfig = ConfigManager.applyConfig;

    ConfigManager.applyConfig = function(loadedConfig) {
        // Make sure text config exists
        extendConfigWithTextStyling();

        // Apply the configuration using the original method
        const result = origApplyConfig.call(this, loadedConfig);

        // Make sure text color and crt.colors.font are in sync
        if (result.text && result.text.color) {
            // Convert hex to THREE.Color if needed
            if (typeof result.crt.colors.font !== 'object') {
                result.crt.colors.font = new THREE.Color(result.text.color);
            }
        }

        return result;
    };
}

// Wait for DOM content to be loaded
document.addEventListener('DOMContentLoaded', function() {
    // Use a timeout to ensure the TerminalConfig is loaded
    setTimeout(initTextControls, 500);
});

// Initialize everything
function initTextControls() {
    console.log("Initializing text controls...");

    console.log(window.TerminalRenderer);
    // Make sure we have required objects
    if (!window.TerminalConfig || !window.TerminalRenderer) {
        console.warn("Required objects not found, retrying in 1 second...");
        setTimeout(initTextControls, 1000);
        return;
    }

    try {
        // Make sure text config exists
        extendConfigWithTextStyling();

        // Update the renderer methods
        updateTextStyleMethod();

        // Extend ConfigManager if it exists
        if (window.ConfigManager) {
            extendConfigManager();
        }

        // Add the controls to the GUI when the controller is ready
        if (window.TerminalApp && window.TerminalApp.controller && window.TerminalApp.controller.gui) {
            console.log("Adding text controls to GUI...");

            // Add text controls to the GUI
            addTextControlsToGUI(window.TerminalApp.controller);

            // Extend updateAllGuiValues method
            extendUpdateAllGuiValues(window.TerminalApp.controller);

            console.log("Text controls initialized successfully");
        } else {
            console.log("TerminalApp controller or GUI not ready, waiting...");

            // If TerminalApp is not ready, wait for it
            const checkInterval = setInterval(() => {
                if (window.TerminalApp &&
                    window.TerminalApp.controller &&
                    window.TerminalApp.controller.gui) {
                    clearInterval(checkInterval);

                    console.log("TerminalApp controller found, adding text controls...");

                    // Add text controls to the GUI
                    addTextControlsToGUI(window.TerminalApp.controller);

                    // Extend updateAllGuiValues method
                    extendUpdateAllGuiValues(window.TerminalApp.controller);

                    console.log("Text controls initialized successfully");
                }
            }, 500);
        }
    } catch (error) {
        console.error("Error initializing text controls:", error);
    }
}