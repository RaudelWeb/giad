// Terminal Configuration with JSON Import/Export functionality
// Base configuration structure
let TerminalConfig = {
    // Canvas dimensions and properties
    /*canvas: {
        width: window.innerWidth,
        height: window.innerHeight,
        get aspect() { return this.width / this.height; }
    },*/

    // Visual settings for the CRT effect
    crt: {
        // Curve and distortion
        curvature: 0.25,
        distortion: 0.35,

        // Scanline and rasterization
        rasterization: {
            intensity: 0.7,
            brightBoost: 0.30,
            scanlineIntensity: 0.30,
        },

        // Effects
        effects: {
            staticNoise: 0,
            flickering: 0.05,
            horizontalSync: 0.1,
            glowingLine: 0.0,
        },

        // Colors
        colors: {
            font: "#ffffff",  // Store as hex string for JSON compatibility
            background: "#000000",
            bezel: '#2A2520',
            chromaColor: 0.5,
        }
    },

    // Gradient settings for border
    gradient: {
        radiusMultiplier: 1.0,
        centerOffset: 0,
        startColor: {
            r: 100, g: 100, b: 100, a: 0.3,
            get rgba() { return `rgba(${this.r}, ${this.g}, ${this.b}, ${this.a})`; }
        },
        endColor: {
            r: 50, g: 50, b: 50, a: 0.1,
            get rgba() { return `rgba(${this.r}, ${this.g}, ${this.b}, ${this.a})`; }
        }
    },

    // Terminal content settings
    terminal: {
        // Animation
        frameDelay: 80,
        totalFrames: 48,
        glitchSpeed: 50,

        // Phases
        phases: {
            bootDuration: 3000,
            postBootDuration: 90000
        },

        // Boot sequence text
        bootSequence: [
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
        ]
    },

    // API settings
    api: {
        endpoint: "https://giad-gpt-proxy.vercel.app/api/giad-gpt",
        defaultMessages: {
            'giad': "GIAD™ IS NOT A BRAND. IT'S A PROPHECY.",
            'god': "\"GOD IS A DESIGNER. THAT'S NOT A STATEMENT — IT'S A JOB TITLE.\""
        }
    },

    // Button and interactive elements
    ui: {
        accessButton: {
            text: "ACCESS TERMINAL",
            url: "https://terminal.godisadesigner.com/",
            position: {
                x: 0.5, // center horizontally (percentage of width)
                y: 200  // position vertically (percentage of height)
            },
            size: {
                width: 300,
                height: 50
            }
        },
        borderMargin: 25,
        borderRadius: 20
    },

    debugging: {
        showGrid: false,
        fullConsoleLogging: false,
    }
};

// Configuration Manager - handles loading, saving, and applying configs
const ConfigManager = {
    // Convert THREE.Color objects to hex strings for JSON compatibility
    prepareForExport(config) {
        const exportConfig = JSON.parse(JSON.stringify(config));

        // Remove getters (which can't be serialized)
        if (exportConfig.canvas) {
            delete exportConfig.canvas.aspect;
        }

        if (exportConfig.gradient && exportConfig.gradient.startColor) {
            delete exportConfig.gradient.startColor.rgba;
        }

        if (exportConfig.gradient && exportConfig.gradient.endColor) {
            delete exportConfig.gradient.endColor.rgba;
        }

        return exportConfig;
    },

    // Apply loaded config to the current TerminalConfig
    applyConfig(loadedConfig) {
        // Make a deep copy of the loaded config
        const configCopy = JSON.parse(JSON.stringify(loadedConfig));

        // Restore getter functions
        if (configCopy.canvas) {
            Object.defineProperty(configCopy.canvas, 'aspect', {
                get: function() { return this.width / this.height; },
                enumerable: true,
                configurable: true
            });
        }

        if (configCopy.gradient && configCopy.gradient.startColor) {
            Object.defineProperty(configCopy.gradient.startColor, 'rgba', {
                get: function() {
                    return `rgba(${this.r}, ${this.g}, ${this.b}, ${this.a})`;
                },
                enumerable: true,
                configurable: true
            });
        }

        if (configCopy.gradient && configCopy.gradient.endColor) {
            Object.defineProperty(configCopy.gradient.endColor, 'rgba', {
                get: function() {
                    return `rgba(${this.r}, ${this.g}, ${this.b}, ${this.a})`;
                },
                enumerable: true,
                configurable: true
            });
        }

        // Convert color hex strings to THREE.Color objects if needed
        if (configCopy.crt && configCopy.crt.colors) {
            if (typeof configCopy.crt.colors.font === 'string') {
                configCopy.crt.colors.font = new THREE.Color(configCopy.crt.colors.font);
            }
            if (typeof configCopy.crt.colors.background === 'string') {
                configCopy.crt.colors.background = new THREE.Color(configCopy.crt.colors.background);
            }
        }

        // Merge with current config
        return this.mergeConfigs(TerminalConfig, configCopy);
    },

    // Deep merge of configs
    mergeConfigs(target, source) {
        // Create a new object to avoid modifying the original
        const result = Object.assign({}, target);

        // Iterate through source properties
        Object.keys(source).forEach(key => {
            // Check if property is an object and not null
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                // If target doesn't have this property or it's not an object, create it
                if (!target[key] || typeof target[key] !== 'object') {
                    result[key] = {};
                }
                // Recursively merge the nested object
                result[key] = this.mergeConfigs(target[key] || {}, source[key]);
            } else {
                // For non-objects, just copy the value
                result[key] = source[key];
            }
        });

        return result;
    },

    // Load config from a JSON file
    loadFromFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (event) => {
                try {
                    const configData = JSON.parse(event.target.result);
                    resolve(configData);
                } catch (error) {
                    reject(new Error('Invalid JSON file: ' + error.message));
                }
            };

            reader.onerror = () => {
                reject(new Error('Error reading file'));
            };

            reader.readAsText(file);
        });
    },

    // Save current config to a JSON file
    saveToFile(filename = 'terminal-config.json') {
        const configToExport = this.prepareForExport(TerminalConfig);
        const jsonString = JSON.stringify(configToExport, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });

        // Create download link
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;

        // Append to body, click and remove
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    },

    // Initialize with default settings
    async initialize() {
        // Try to load config.json by default
        try {
            const response = await fetch('config.json');
            if (response.ok) {
                const configData = await response.json();
                TerminalConfig = this.applyConfig(configData);
                console.log('Configuration loaded from config.json');
            }
        } catch (error) {
            console.warn('Could not load config.json, using default configuration');
        }

        // Make sure THREE.Color objects are properly instantiated
        if (typeof TerminalConfig.crt.colors.font === 'string') {
            TerminalConfig.crt.colors.font = new THREE.Color(TerminalConfig.crt.colors.font);
        }
        if (typeof TerminalConfig.crt.colors.background === 'string') {
            TerminalConfig.crt.colors.background = new THREE.Color(TerminalConfig.crt.colors.background);
        }
    }
};

// Setup file upload handler
function setupConfigFileUpload() {
    // Create invisible file input
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);

    // Handle file selection
    fileInput.addEventListener('change', async (event) => {
        if (event.target.files.length > 0) {
            try {
                const configData = await ConfigManager.loadFromFile(event.target.files[0]);
                TerminalConfig = ConfigManager.applyConfig(configData);

                // Update the terminal with new config
                if (window.TerminalApp) {
                    // Force redraw with new config
                    window.TerminalApp.renderer.drawBorder();
                    window.TerminalApp.renderer.drawTerminal();

                    // Update dat.GUI
                    if (window.TerminalApp.controller) {
                        window.TerminalApp.controller.refreshDatGUI();
                    }

                    console.log('Configuration loaded successfully');
                }
            } catch (error) {
                console.error('Failed to load configuration:', error);
                alert('Failed to load configuration file: ' + error.message);
            }
        }
    });

    return fileInput;
}

// Initialize on DOMContentLoaded
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize config manager
    await ConfigManager.initialize();

    // Make it globally available
    window.TerminalConfig = TerminalConfig;
    window.ConfigManager = ConfigManager;

    // Set up config file upload
    const fileInput = setupConfigFileUpload();
    window.uploadConfig = () => fileInput.click();
});

// Additional function to add to the dat.GUI for config file operations
function setupConfigGUI(gui) {
    const configFolder = gui.addFolder('Configuration');

    const configFunctions = {
        loadConfig: () => {
            window.uploadConfig();
        },
        saveConfig: () => {
            ConfigManager.saveToFile();
        },
        resetConfig: () => {
            if (confirm('Reset to default configuration?')) {
                location.reload();
            }
        }
    };

    configFolder.add(configFunctions, 'loadConfig').name('Load Config');
    configFolder.add(configFunctions, 'saveConfig').name('Save Config');
    configFolder.add(configFunctions, 'resetConfig').name('Reset to Default');

    configFolder.open();
    return configFolder;
}

