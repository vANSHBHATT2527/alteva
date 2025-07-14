// Dark Mode Toggle Functionality
document.addEventListener('DOMContentLoaded', function() {
    // Initialize theme from localStorage or default to light
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    // Find theme toggle button
    const themeToggle = document.getElementById('themeToggle');
    
    if (themeToggle) {
        // Set initial icon state
        updateThemeIcon(savedTheme);
        
        // Add click event listener
        themeToggle.addEventListener('click', function() {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';
            
            // Update theme
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            
            // Update icon
            updateThemeIcon(newTheme);
            
            // Optional: Add a subtle animation effect
            addThemeTransitionEffect();
        });
    }
});

// Update theme icon based on current theme
function updateThemeIcon(theme) {
    const themeToggle = document.getElementById('themeToggle');
    if (!themeToggle) return;
    
    const sunIcon = themeToggle.querySelector('.sun-icon');
    const moonIcon = themeToggle.querySelector('.moon-icon');
    
    if (theme === 'dark') {
        if (sunIcon) sunIcon.style.display = 'block';
        if (moonIcon) moonIcon.style.display = 'none';
    } else {
        if (sunIcon) sunIcon.style.display = 'none';
        if (moonIcon) moonIcon.style.display = 'block';
    }
}

// Add a subtle transition effect when switching themes
function addThemeTransitionEffect() {
    // Add a temporary class for transition effect
    document.body.classList.add('theme-transitioning');
    
    // Remove the class after transition completes
    setTimeout(() => {
        document.body.classList.remove('theme-transitioning');
    }, 300);
}

// Function to get current theme
function getCurrentTheme() {
    return document.documentElement.getAttribute('data-theme') || 'light';
}

// Function to set theme programmatically
function setTheme(theme) {
    if (theme !== 'light' && theme !== 'dark') return;
    
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    updateThemeIcon(theme);
}

// Function to toggle theme programmatically
function toggleTheme() {
    const currentTheme = getCurrentTheme();
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
}

// Auto-detect system preference (optional)
function detectSystemTheme() {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
    }
    return 'light';
}

// Listen for system theme changes (optional)
if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(e) {
        // Only auto-switch if user hasn't manually set a preference
        if (!localStorage.getItem('theme')) {
            const newTheme = e.matches ? 'dark' : 'light';
            setTheme(newTheme);
        }
    });
}

// Export functions for use in other scripts
window.DarkMode = {
    getCurrentTheme,
    setTheme,
    toggleTheme,
    detectSystemTheme
}; 