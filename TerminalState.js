// Terminal State Manager
const TerminalState = {
    // State variables
    phase: "boot",           // Current phase: "boot" or "postBoot"
    bootIndex: 0,            // Current index in boot sequence
    bootDisplayLines: [],    // Lines displayed during boot
    bootPhaseEndTime: 0,     // Timestamp for boot phase end
    postBootEndTime: 0,      // Timestamp for post-boot phase end

    // User input
    commandInput: "",        // Current command being typed
    eggMessage: "",          // Message displayed as response
    terminalScrollOffset: 0, // For scrolling terminal output

    // Visual state
    currentFrameIndex: 0,    // Current animation frame
    currentGlitchY: 0,       // Y position of the glitch effect
    showCursor: true,        // Toggle cursor visibility
    cursorTimer: 0,          // Timer for cursor blinking
    lastGlitchUpdate: 0,     // Timestamp of last glitch update
    isFocused: true,         // Is the window currently focused
    startTime: 0,            // Animation start time

    // Method to initialize state
    init() {
        this.startTime = Date.now();
        this.lastGlitchUpdate = Date.now();
        this.bootDisplayLines = [];
        this.bootIndex = 0;
        this.phase = "boot";
        this.commandInput = "";
        this.eggMessage = "";
    },

    // Method to add a line to the boot sequence display
    addBootLine(content) {
        const maxVisibleLines = 16;
        this.bootDisplayLines.push(content);
        if (this.bootDisplayLines.length > maxVisibleLines) {
            this.bootDisplayLines.shift();
        }
        return this.bootDisplayLines.length;
    },

    // Method to run the boot sequence
    runBootSequence(callback) {
        if (this.bootIndex < TerminalConfig.terminal.bootSequence.length) {
            var entry = TerminalConfig.terminal.bootSequence[this.bootIndex++];
            if (entry.type === "line") {
                this.addBootLine(entry.content);
                setTimeout(() => this.runBootSequence(callback), 150);
            } else if (entry.type === "block") {
                entry.content.forEach(line => {
                    this.addBootLine(line);
                });
                setTimeout(() => this.runBootSequence(callback), 500);
            }
        } else {
            if (this.bootPhaseEndTime === 0) {
                this.bootPhaseEndTime = Date.now() + TerminalConfig.terminal.phases.bootDuration;
            }
            callback && callback();
        }
    },

    // Method to launch the second phase
    launchPhase2() {
        if (this.phase === "postBoot") return;

        this.phase = "postBoot";
        this.postBootEndTime = Date.now() + TerminalConfig.terminal.phases.postBootDuration;

        // Focus input for mobile
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
    },

    // Method to update the current animation frame
    updateGifFrame() {
        var elapsed = Date.now() - this.startTime;
        this.currentFrameIndex = Math.floor(elapsed / TerminalConfig.terminal.frameDelay) % TerminalConfig.terminal.totalFrames;
    },

    // Method to process a command
    processCommand(cmd) {
        cmd = cmd.trim().toLowerCase();
        this.commandInput = "";

        // Start loading animation
        let loadingStates = ['–', '/', '|', '\\'];
        let loadingIndex = 0;
        let loadingInterval;

        // Display initial loading state
        this.eggMessage = "LOADING " + loadingStates[loadingIndex];

        // Update loading animation every 200ms
        loadingInterval = setInterval(() => {
            loadingIndex = (loadingIndex + 1) % loadingStates.length;
            this.eggMessage = "LOADING " + loadingStates[loadingIndex];
        }, 200);

        // Make POST request
        fetch(TerminalConfig.api.endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userInput: cmd })
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                // Stop loading animation
                clearInterval(loadingInterval);

                // Display response from API
                this.eggMessage = data.message || TerminalConfig.api.defaultMessages[cmd];
            })
            .catch(error => {
                // Stop loading animation
                clearInterval(loadingInterval);

                // Show error message
                this.eggMessage = "CONNECTION TIMED OUT. USING FALLBACK: " +
                    (TerminalConfig.api.defaultMessages[cmd] || "Command not recognized.");
                console.error('Error:', error);
            });
    }
};

// Export the terminal state
window.TerminalState = TerminalState;