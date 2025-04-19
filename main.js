// Main script that initializes and runs the terminal

// Wait for DOM to be loaded before initializing
document.addEventListener('DOMContentLoaded', () => {
    // Check if THREE.js is available
    if (typeof THREE === 'undefined') {
        console.error('THREE.js is not loaded. Please include THREE.js library.');
        return;
    }

    // Check if dat.GUI is available
    if (typeof dat === 'undefined') {
        console.error('dat.GUI is not loaded. Please include dat.GUI library.');
        return;
    }

    // Set up body styles
    document.body.style.margin = '0';
    document.body.style.overflow = 'hidden';
    document.body.style.backgroundColor = '#1A1A1A';

    // Initialize the terminal
    TerminalController.init();
});

// Export to window for debugging
window.TerminalApp = {
    config: TerminalConfig,
    state: TerminalState,
    renderer: TerminalRenderer,
    controller: TerminalController
};