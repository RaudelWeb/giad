// Terminal Text Styling with Responsive Features

// First, let's extend the TerminalConfig to include text styling options
const textStyleConfig = {
    // Add this to the TerminalConfig object
    text: {
        color: "#ffffff",      // Text color
        glowColor: "#fd501f",  // Text glow/shadow color
        glowIntensity: 10,     // Glow intensity (shadow blur)
        get lineHeight() {
            if(window.innerWidth < window.innerHeight) {
                return 20;
            } else {
                return window.innerWidth * 0.02;
            }
        },
        fontSize: {
            get desktop() {
                return window.innerWidth * 0.02 + "px";
            },
            mobile: "20px"     // Font size for mobile
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

        // Apply text shadow/glow - reduce glow on mobile for performance
        this.ctx.shadowColor = config.glowColor;
        this.ctx.shadowBlur = isMobile ? Math.min(config.glowIntensity, 5) : config.glowIntensity;

        // Apply text color
        this.ctx.fillStyle = config.color;

        // Apply font size based on device
        // Use responsive font sizing to ensure text is readable on all devices
        if (isMobile) {
            // For portrait orientation, calculate size based on viewport width
            // This ensures text is proportionally sized to the screen
            const fontSize = typeof config.fontSize.mobile === 'string' ?
                config.fontSize.mobile :
                Math.max(16, Math.min(20, window.innerWidth * 0.05)) + 'px';
            this.ctx.font = `${fontSize} ${config.fontFamily}`;
        } else {
            // For landscape/desktop, use the configured desktop size
            const fontSize = typeof config.fontSize.desktop === 'string' ?
                config.fontSize.desktop :
                Math.max(16, Math.min(24, window.innerWidth * 0.015)) + 'px';
            this.ctx.font = `${fontSize} ${config.fontFamily}`;
        }

        // Set text baseline for more consistent positioning
        this.ctx.textBaseline = 'middle';
    };

    // Enhanced wrapText method with improved mobile support
    TerminalRenderer.wrapText = function(text, maxWidth) {
        // Check if we're on mobile
        const isMobile = window.innerWidth < window.innerHeight;

        // For mobile, use more aggressive wrapping with smaller max width
        const effectiveMaxWidth = isMobile ? maxWidth * 0.85 : maxWidth;

        // Calculate a reasonable character limit for mobile
        const avgCharWidth = this.ctx.measureText('m').width; // Use 'm' as average char width
        const charsPerLine = Math.floor(effectiveMaxWidth / avgCharWidth);

        // For very narrow screens, enforce hard character limit to prevent overflow
        if (isMobile && window.innerWidth < 480) {
            return this.wrapTextByCharCount(text, charsPerLine);
        }

        // Standard word-based wrapping for normal screens
        const words = text.split(' ');
        let lines = [];
        let currentLine = '';

        for (let word of words) {
            // For mobile, break long words that would overflow
            if (isMobile && this.ctx.measureText(word).width > effectiveMaxWidth * 0.8) {
                // If current line isn't empty, complete it first
                if (currentLine) {
                    lines.push(currentLine);
                    currentLine = '';
                }

                // Break the long word into parts
                const parts = this.breakLongWord(word, effectiveMaxWidth * 0.9);
                lines = lines.concat(parts);
                continue;
            }

            // Normal word wrapping logic
            const testLine = currentLine + (currentLine ? ' ' : '') + word;
            const metrics = this.ctx.measureText(testLine);

            if (metrics.width > effectiveMaxWidth) {
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
    };

    // Add helper method to break long words into parts
    TerminalRenderer.breakLongWord = function(word, maxWidth) {
        const parts = [];
        let currentPart = '';

        for (let i = 0; i < word.length; i++) {
            const testPart = currentPart + word[i];
            const metrics = this.ctx.measureText(testPart);

            if (metrics.width > maxWidth) {
                parts.push(currentPart);
                currentPart = word[i];
            } else {
                currentPart = testPart;
            }
        }

        if (currentPart) {
            parts.push(currentPart);
        }

        return parts;
    };

    // Add method for character-based wrapping for very narrow screens
    TerminalRenderer.wrapTextByCharCount = function(text, charsPerLine) {
        const lines = [];

        // Remove existing line breaks and normalize spaces
        const normalizedText = text.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ');

        // Break text into chunks of charsPerLine
        for (let i = 0; i < normalizedText.length; i += charsPerLine) {
            // If we're not at the start of the text, try to find a space to break at
            if (i > 0) {
                // Look for a space within the last 1/4 of the line to break at
                const searchStartIndex = Math.max(i - Math.floor(charsPerLine / 4), 0);
                const searchEndIndex = Math.min(i + 5, normalizedText.length);

                // Find the nearest space in this range
                let breakIndex = normalizedText.lastIndexOf(' ', searchEndIndex);

                // If we found a space in our search range, use it
                if (breakIndex >= searchStartIndex) {
                    lines.push(normalizedText.substring(i - charsPerLine, breakIndex).trim());
                    i = breakIndex; // Skip to the space we found
                    continue;
                }
            }

            // If we couldn't find a good break point, just use the character count
            lines.push(normalizedText.substring(i, i + charsPerLine).trim());
        }

        return lines;
    };

    // Update lineHeight usage throughout the renderer
    TerminalRenderer.drawCommandAreaFromBottom = function(textMarginX, commandPromptY) {
        // Check if we're on mobile
        const isMobile = window.innerWidth < window.innerHeight;

        // Use the configured line height
        let lineHeight = TerminalConfig.text.lineHeight;

        // For very small screens, reduce line height slightly to fit more text
        if (isMobile && window.innerWidth < 380) {
            lineHeight = Math.max(lineHeight * 0.9, 18); // Don't go too small
        }

        this.ctx.textAlign = 'left';
        const maxWidth = TerminalConfig.canvas.width - (textMarginX * 2);
        const prompt = "C:\\GIAD> ";

        // Calculate available space for text
        const interfaceBottom = TerminalConfig.canvas.height * (isMobile ? 0.55 : 0.65) + 20;
        const availableSpace = commandPromptY - interfaceBottom;
        const availableLines = Math.floor(availableSpace / lineHeight);

        // Handle egg message if it exists
        if (TerminalState.eggMessage !== "") {
            // Use enhanced wrapping for better mobile support
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
        const promptY = isMobile ?
            commandPromptY - 5 : // Adjust for mobile to prevent overlap
            commandPromptY;

        this.ctx.fillText(
            prompt + TerminalState.commandInput + (TerminalState.showCursor ? "_" : ""),
            textMarginX,
            promptY
        );
    };

    // Also update bootPhase drawing to use the configured line height
    // Improve the drawBootPhase function to handle line rendering more carefully
    TerminalRenderer.drawBootPhase = function(textMarginX, now) {
        // Draw GIAD logo in boot phase
        this.drawGiadLogo();

        // Use a consistent line height
        const lineHeight = typeof TerminalConfig.text.lineHeight === 'function'
            ? TerminalConfig.text.lineHeight()
            : TerminalConfig.text.lineHeight;

        // Calculate starting position with enough space for the logo
        const startY = 120; // Increase this value to move text lower if needed

        // Calculate available vertical space
        const availableHeight = TerminalConfig.canvas.height - startY - 50; // leave room at bottom
        const maxVisibleLines = Math.floor(availableHeight / lineHeight);

        // Get the lines to display, prioritizing most recent ones
        let visibleLines = TerminalState.bootDisplayLines.length > maxVisibleLines
            ? TerminalState.bootDisplayLines.slice(-maxVisibleLines)
            : TerminalState.bootDisplayLines;

        // Log for debugging
        console.log(`Rendering ${visibleLines.length} boot lines with height ${lineHeight}`);

        // Draw each line with careful positioning
        for (let i = 0; i < visibleLines.length; i++) {
            const y = startY + (i * lineHeight);
            const line = visibleLines[i];

            // Check if line might be too long for the screen width
            if (this.ctx.measureText(line).width > (TerminalConfig.canvas.width - textMarginX * 2)) {
                // Handle wrapping for long lines
                const maxWidth = TerminalConfig.canvas.width - textMarginX * 2;
                const wrappedLines = this.wrapText(line, maxWidth);

                // Only render the first part to avoid overflow
                this.ctx.fillText(wrappedLines[0], textMarginX, y);
            } else {
                // Render normal line
                this.ctx.fillText(line, textMarginX, y);
            }
        }

        // Draw countdown if needed
        if (TerminalState.bootPhaseEndTime > 0) {
            const remaining = Math.ceil((TerminalState.bootPhaseEndTime - now) / 1000);
            const countdownY = TerminalConfig.canvas.height - textStyleConfig.text.lineHeight - TerminalConfig.ui.borderMargin - 20;
            this.ctx.textAlign = 'center';
            this.ctx.fillText(
                "AUTO LOADING IN [ " + remaining + " ]",
                TerminalConfig.canvas.width / 2,
                countdownY
            );
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

    // Line height is now a getter, so we need a custom object for the GUI
    const lineHeightObj = {
        lineHeight: typeof TerminalConfig.text.lineHeight === 'function' ?
            TerminalConfig.text.lineHeight() :
            TerminalConfig.text.lineHeight
    };

    controller.guiControllers.lineHeight = textFolder.add(lineHeightObj, 'lineHeight', 16, 40)
        .step(1)
        .name('Line Height')
        .onChange(value => {
            // Override the getter with a fixed value when changed via GUI
            Object.defineProperty(TerminalConfig.text, 'lineHeight', {
                value: value,
                writable: true,
                configurable: true
            });
            TerminalRenderer.drawTerminal();
        });

    // Add responsive line height toggle
    const responsiveObj = { responsiveLineHeight: false };
    controller.guiControllers.responsiveLineHeight = textFolder.add(responsiveObj, 'responsiveLineHeight')
        .name('Responsive Height')
        .onChange(value => {
            if (value) {
                // Restore original getter behavior
                Object.defineProperty(TerminalConfig.text, 'lineHeight', {
                    get: function() {
                        if(window.innerWidth < window.innerHeight) {
                            return 20;
                        } else {
                            return window.innerWidth * 0.02;
                        }
                    },
                    configurable: true
                });
            } else {
                // Use fixed height from slider
                const currentHeight = lineHeightObj.lineHeight;
                Object.defineProperty(TerminalConfig.text, 'lineHeight', {
                    value: currentHeight,
                    writable: true,
                    configurable: true
                });
            }
            TerminalRenderer.drawTerminal();
        });

    // Font size controls need special handling for getter/setter properties
    const fontSizeDesktopObj = {
        size: typeof TerminalConfig.text.fontSize.desktop === 'string' ?
            parseInt(TerminalConfig.text.fontSize.desktop) :
            18
    };

    controller.guiControllers.fontSizeDesktop = textFolder.add(fontSizeDesktopObj, 'size', 12, 30)
        .step(1)
        .name('Font Size (Desktop)')
        .onChange(value => {
            // Override the getter with a fixed value when changed via GUI
            TerminalConfig.text.fontSize.desktop = value + 'px';
            TerminalRenderer.drawTerminal();
        });

    // Font size (Mobile)
    const fontSizeMobileObj = {
        size: typeof TerminalConfig.text.fontSize.mobile === 'string' ?
            parseInt(TerminalConfig.text.fontSize.mobile) :
            20
    };

    controller.guiControllers.fontSizeMobile = textFolder.add(fontSizeMobileObj, 'size', 12, 30)
        .step(1)
        .name('Font Size (Mobile)')
        .onChange(value => {
            TerminalConfig.text.fontSize.mobile = value + 'px';
            TerminalRenderer.drawTerminal();
        });

    // Add responsive font size toggle
    const responsiveFontObj = { responsiveFontSize: true };
    controller.guiControllers.responsiveFont = textFolder.add(responsiveFontObj, 'responsiveFontSize')
        .name('Responsive Font')
        .onChange(value => {
            if (value) {
                // Use responsive font sizing
                Object.defineProperty(TerminalConfig.text.fontSize, 'desktop', {
                    get: function() {
                        return window.innerWidth * 0.02 + "px";
                    },
                    configurable: true
                });

                // Mobile can use either responsive or fixed
                const mobileSize = window.innerWidth < 480 ?
                    Math.max(16, window.innerWidth * 0.04) :
                    20;
                TerminalConfig.text.fontSize.mobile = mobileSize + "px";
            } else {
                // Use fixed sizes from sliders
                TerminalConfig.text.fontSize.desktop = fontSizeDesktopObj.size + "px";
                TerminalConfig.text.fontSize.mobile = fontSizeMobileObj.size + "px";
            }
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

        // lineHeight is handled differently because it might be a getter
        if (this.guiControllers.lineHeight) {
            const lineHeight = typeof TerminalConfig.text.lineHeight === 'function' ?
                TerminalConfig.text.lineHeight() :
                TerminalConfig.text.lineHeight;
            this.guiControllers.lineHeight.setValue(lineHeight);
        }

        // Font sizes are also getters potentially
        if (this.guiControllers.fontSizeDesktop) {
            const desktopSize = typeof TerminalConfig.text.fontSize.desktop === 'string' ?
                parseInt(TerminalConfig.text.fontSize.desktop) :
                18;
            this.guiControllers.fontSizeDesktop.setValue(desktopSize);
        }

        if (this.guiControllers.fontSizeMobile) {
            const mobileSize = typeof TerminalConfig.text.fontSize.mobile === 'string' ?
                parseInt(TerminalConfig.text.fontSize.mobile) :
                20;
            this.guiControllers.fontSizeMobile.setValue(mobileSize);
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

// Initialize everything
export function initTextControls() {
    console.log("Initializing text controls...");

    try {
        // Make sure text config exists
        extendConfigWithTextStyling();

        // Update the renderer methods
        updateTextStyleMethod();

        // Extend ConfigManager if it exists
        if (window.ConfigManager) {
            extendConfigManager();
        }

        // Add the controls to the GUI if controller is ready
        if (window.TerminalApp && window.TerminalApp.controller && window.TerminalApp.controller.gui) {
            console.log("Adding text controls to GUI...");

            // Add text controls to the GUI
            addTextControlsToGUI(window.TerminalApp.controller);

            // Extend updateAllGuiValues method
            extendUpdateAllGuiValues(window.TerminalApp.controller);

            console.log("Text controls initialized successfully");
            return true;
        } else {
            console.log("TerminalApp controller or GUI not ready");
            return false;
        }
    } catch (error) {
        console.error("Error initializing text controls:", error);
        return false;
    }
}