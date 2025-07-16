// Glavien Helm Charts Repository - Interactive Features
class HelmChartsRepository {
    constructor() {
        this.chartsContainer = document.getElementById('charts-grid');
        this.init();
    }

    init() {
        this.loadCharts();
        this.setupCopyButtons();
        this.addAnimations();
    }

    async loadCharts() {
        try {
            this.showLoading();
            console.log('Loading charts from index.yaml...');
            const response = await fetch('./index.yaml');
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const yamlText = await response.text();
            console.log('YAML loaded, length:', yamlText.length);
            console.log('First 500 chars:', yamlText.substring(0, 500));
            
            const charts = this.parseHelmIndex(yamlText);
            console.log('Parsed charts:', charts);
            
            // Fallback: if no charts parsed, try simple regex approach
            if (charts.length === 0) {
                console.log('No charts found, trying fallback parser...');
                const fallbackCharts = this.parseHelmIndexFallback(yamlText);
                console.log('Fallback parsed charts:', fallbackCharts);
                this.renderCharts(fallbackCharts);
            } else {
                this.renderCharts(charts);
            }
        } catch (error) {
            console.error('Error loading charts:', error);
            this.showError();
        }
    }

    parseHelmIndex(yamlText) {
        const charts = [];
        const lines = yamlText.split('\n');
        let currentChart = null;
        let currentEntry = null;
        let inEntries = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmedLine = line.trim();

            // Skip empty lines and comments
            if (!trimmedLine || trimmedLine.startsWith('#')) continue;

            // Check if we're in the entries section
            if (trimmedLine === 'entries:') {
                inEntries = true;
                continue;
            }

            if (!inEntries) continue;

            // Chart name (starts with two spaces, ends with colon)
            if (line.match(/^  [a-zA-Z][a-zA-Z0-9-]*:$/)) {
                const chartName = line.replace(/^\s+/, '').replace(':', '');
                currentChart = {
                    name: chartName,
                    entries: []
                };
                charts.push(currentChart);
                continue;
            }

            // Chart entry (starts with "  - ")
            if (line.startsWith('  - ') && currentChart) {
                currentEntry = {};
                currentChart.entries.push(currentEntry);
                continue;
            }

            // Chart properties (start with 4+ spaces)
            if (currentEntry && line.match(/^    \w+:/)) {
                const [key, ...valueParts] = line.trim().split(':');
                let value = valueParts.join(':').trim();
                
                // Remove quotes if present
                if (value.startsWith('"') && value.endsWith('"')) {
                    value = value.slice(1, -1);
                }
                
                // Handle multi-line values
                if (key === 'description' && value.includes('for cluster nodes.')) {
                    // This is a continuation of description, combine with previous line
                    const nextLine = lines[i + 1];
                    if (nextLine && nextLine.trim().startsWith('for cluster nodes.')) {
                        value = value + ' ' + nextLine.trim();
                        i++; // Skip next line as we've processed it
                    }
                }
                
                currentEntry[key] = value;
            }
        }

        // Convert to the format expected by renderCharts
        const processedCharts = [];
        charts.forEach(chart => {
            if (chart.entries && chart.entries.length > 0) {
                // Use the latest version (first entry)
                const latestEntry = chart.entries[0];
                processedCharts.push({
                    name: chart.name,
                    version: latestEntry.version || 'unknown',
                    appVersion: latestEntry.appVersion || latestEntry.version || 'unknown',
                    description: latestEntry.description || 'No description available',
                    created: latestEntry.created || new Date().toISOString()
                });
            }
        });

        return processedCharts;
    }

    parseHelmIndexFallback(yamlText) {
        // Simple regex-based fallback parser
        const charts = [];
        
        // Find chart names
        const chartNameMatches = yamlText.match(/^  ([a-zA-Z][a-zA-Z0-9-]+):$/gm);
        
        if (chartNameMatches) {
            chartNameMatches.forEach(match => {
                const chartName = match.replace(/^\s+/, '').replace(':', '');
                
                // Find the section for this chart
                const chartSection = yamlText.split(match)[1];
                if (chartSection) {
                    const versionMatch = chartSection.match(/version:\s*"?([^"\n]+)"?/);
                    const appVersionMatch = chartSection.match(/appVersion:\s*"?([^"\n]+)"?/);
                    const descriptionMatch = chartSection.match(/description:\s*"?([^"\n]+)"?/);
                    const createdMatch = chartSection.match(/created:\s*"?([^"\n]+)"?/);
                    
                    charts.push({
                        name: chartName,
                        version: versionMatch ? versionMatch[1] : 'unknown',
                        appVersion: appVersionMatch ? appVersionMatch[1] : 'unknown',
                        description: descriptionMatch ? descriptionMatch[1] : 'No description available',
                        created: createdMatch ? createdMatch[1] : new Date().toISOString()
                    });
                }
            });
        }
        
        return charts;
    }

    renderCharts(charts) {
        if (charts.length === 0) {
            this.chartsContainer.innerHTML = `
                <div class="no-charts">
                    <i class="fas fa-cube"></i>
                    <h3>No charts available yet</h3>
                    <p>Charts will appear here once they are published.</p>
                </div>
            `;
            return;
        }

        this.chartsContainer.innerHTML = charts.map(chart => this.createChartCard(chart)).join('');
    }

    createChartCard(chart) {
        const createdDate = chart.created ? new Date(chart.created).toLocaleDateString() : 'Unknown';
        const description = chart.description || 'No description available';
        
        return `
            <div class="chart-card">
                <div class="chart-header">
                    <div class="chart-icon">
                        ${this.getChartIcon(chart.name)}
                    </div>
                    <div class="chart-info">
                        <h3>${chart.name}</h3>
                        <span class="chart-version">v${chart.version}</span>
                    </div>
                </div>
                <p class="chart-description">${description}</p>
                <div class="chart-meta">
                    <span><i class="fas fa-tag"></i> App: ${chart.appVersion || chart.version}</span>
                    <span><i class="fas fa-calendar"></i> ${createdDate}</span>
                </div>
                <div class="chart-actions">
                    <button class="install-btn" onclick="app.showInstallCommand('${chart.name}')">
                        <i class="fas fa-download"></i> Install
                    </button>
                </div>
            </div>
        `;
    }

    getChartIcon(chartName) {
        const iconMap = {
            'hostendpoint-operator': '<i class="fas fa-network-wired"></i>',
            'default': '<i class="fas fa-cube"></i>'
        };
        
        return iconMap[chartName] || iconMap['default'];
    }

    showInstallCommand(chartName) {
        const command = `helm install my-${chartName} glavien/${chartName}`;
        
        // Create modal or show command
        this.showModal(
            `Install ${chartName}`,
            `
                <p>Run this command to install the chart:</p>
                <div class="code-block">
                    <code id="install-command">${command}</code>
                    <button class="copy-btn" onclick="app.copyToClipboard('install-command')">
                        <i class="fas fa-copy"></i>
                    </button>
                </div>
                <p class="install-note">
                    <i class="fas fa-info-circle"></i>
                    Make sure you have the glavien repository added first.
                </p>
            `
        );
    }

    showModal(title, content) {
        // Remove existing modal
        const existingModal = document.querySelector('.modal');
        if (existingModal) {
            existingModal.remove();
        }

        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-backdrop" onclick="this.parentElement.remove()"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <h3>${title}</h3>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    ${content}
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        
        // Add modal styles if not already present
        if (!document.querySelector('#modal-styles')) {
            const styles = document.createElement('style');
            styles.id = 'modal-styles';
            styles.textContent = `
                .modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    z-index: 1000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    animation: fadeIn 0.3s ease;
                }
                
                .modal-backdrop {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.5);
                    backdrop-filter: blur(4px);
                }
                
                .modal-content {
                    background: var(--bg-primary);
                    border-radius: var(--border-radius-lg);
                    box-shadow: var(--shadow-xl);
                    max-width: 500px;
                    width: 90%;
                    max-height: 80vh;
                    overflow-y: auto;
                    position: relative;
                    border: 1px solid var(--border-color);
                }
                
                .modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 1.5rem;
                    border-bottom: 1px solid var(--border-color);
                }
                
                .modal-header h3 {
                    margin: 0;
                    font-size: 1.25rem;
                    font-weight: 600;
                }
                
                .modal-close {
                    background: none;
                    border: none;
                    font-size: 1.25rem;
                    cursor: pointer;
                    color: var(--text-muted);
                    padding: 0.5rem;
                    border-radius: var(--border-radius-sm);
                    transition: all 0.2s ease;
                }
                
                .modal-close:hover {
                    background: var(--bg-secondary);
                    color: var(--text-primary);
                }
                
                .modal-body {
                    padding: 1.5rem;
                }
                
                .install-note {
                    margin-top: 1rem;
                    padding: 1rem;
                    background: var(--bg-secondary);
                    border-radius: var(--border-radius);
                    color: var(--text-secondary);
                    font-size: 0.875rem;
                }
                
                .install-note i {
                    color: var(--primary-color);
                    margin-right: 0.5rem;
                }
                
                .chart-actions {
                    margin-top: 1rem;
                    display: flex;
                    gap: 0.5rem;
                }
                
                .install-btn {
                    background: var(--success-color);
                    color: white;
                    border: none;
                    padding: 0.5rem 1rem;
                    border-radius: var(--border-radius-sm);
                    cursor: pointer;
                    font-size: 0.875rem;
                    font-weight: 500;
                    transition: all 0.2s ease;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }
                
                .install-btn:hover {
                    background: #059669;
                    transform: translateY(-1px);
                }
                
                .no-charts {
                    grid-column: 1 / -1;
                    text-align: center;
                    padding: 3rem;
                    color: var(--text-muted);
                }
                
                .no-charts i {
                    font-size: 3rem;
                    margin-bottom: 1rem;
                    color: var(--text-muted);
                }
            `;
            document.head.appendChild(styles);
        }
    }

    showLoading() {
        this.chartsContainer.innerHTML = `
            <div class="loading">
                <div class="spinner"></div>
                <span>Loading charts...</span>
            </div>
        `;
    }

    showError() {
        this.chartsContainer.innerHTML = `
            <div class="error">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Error loading charts</h3>
                <p>Please try refreshing the page.</p>
            </div>
        `;
    }

    setupCopyButtons() {
        // Setup copy functionality
        window.copyToClipboard = (elementIdOrElement) => {
            let element;
            if (typeof elementIdOrElement === 'string') {
                element = document.getElementById(elementIdOrElement);
            } else {
                element = elementIdOrElement;
            }
            
            if (!element) return;
            
            const text = element.textContent;
            
            if (navigator.clipboard) {
                navigator.clipboard.writeText(text).then(() => {
                    this.showCopySuccess();
                });
            } else {
                // Fallback for older browsers
                const textArea = document.createElement('textarea');
                textArea.value = text;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                this.showCopySuccess();
            }
        };
    }

    showCopySuccess() {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.innerHTML = `
            <i class="fas fa-check"></i>
            Copied to clipboard!
        `;
        
        // Add toast styles if not already present
        if (!document.querySelector('#toast-styles')) {
            const styles = document.createElement('style');
            styles.id = 'toast-styles';
            styles.textContent = `
                .toast {
                    position: fixed;
                    bottom: 2rem;
                    right: 2rem;
                    background: var(--success-color);
                    color: white;
                    padding: 1rem 1.5rem;
                    border-radius: var(--border-radius);
                    box-shadow: var(--shadow-lg);
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    z-index: 1000;
                    animation: slideInUp 0.3s ease, fadeOut 0.3s ease 2.7s;
                }
                
                @keyframes slideInUp {
                    from {
                        transform: translateY(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateY(0);
                        opacity: 1;
                    }
                }
                
                @keyframes fadeOut {
                    to {
                        opacity: 0;
                        transform: translateY(-20px);
                    }
                }
            `;
            document.head.appendChild(styles);
        }
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }

    addAnimations() {
        // Add intersection observer for scroll animations
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.animation = 'fadeIn 0.6s ease-out';
                }
            });
        });

        // Observe all sections
        document.querySelectorAll('section').forEach(section => {
            observer.observe(section);
        });
    }
}

// Initialize the application
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new HelmChartsRepository();
});

// Global copy function for templates
window.copyToClipboard = function(elementIdOrElement) {
    if (app) {
        app.copyToClipboard(elementIdOrElement);
    }
};
