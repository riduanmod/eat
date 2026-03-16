document.addEventListener('DOMContentLoaded', () => {
    // URL Parse Elements (Bottom Section)
    const urlForm = document.getElementById('url-form');
    const urlInput = document.getElementById('redirect-url');
    const analyzeBtn = document.getElementById('analyze-btn');
    const resultPanel = document.getElementById('result-panel');
    const resultsGrid = document.getElementById('results-grid');
    const errorMsg = document.getElementById('error-message');

    // Token Generator Elements (Top Section)
    const genForm = document.getElementById('generate-token-form');
    const genInput = document.getElementById('eat-token-input');
    const genBtn = document.getElementById('gen-btn');
    const genResultPanel = document.getElementById('gen-result-panel');
    const genResultsGrid = document.getElementById('gen-results-grid');
    const genErrorMsg = document.getElementById('gen-error-msg');

    const displayOrder = ['nickname', 'account_id', 'region', 'eat', 'code', 'token'];

    // ==========================================
    // 1. Token Generation Logic (Top Section)
    // ==========================================
    genForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // --- NEW: নিচের সেকশন ক্লিয়ার করার লজিক ---
        urlInput.value = '';
        resultPanel.style.display = 'none';
        errorMsg.style.display = 'none';
        resultsGrid.innerHTML = '';
        // ------------------------------------------

        const eatToken = genInput.value.trim();
        const tokenType = document.querySelector('input[name="token_type"]:checked').value;
        
        if (!eatToken) return;

        genErrorMsg.style.display = 'none';
        genResultPanel.style.display = 'none';
        
        genBtn.innerHTML = '<span>Generating...</span> <i class="fa-solid fa-spinner fa-spin"></i>';
        genBtn.disabled = true;

        try {
            const response = await fetch('/api/generate-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: tokenType, eat_token: eatToken })
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Failed to generate token.');
            }

            // Clear previous grid data
            genResultsGrid.innerHTML = '';
            
            // Render extracted URL data (Nickname, Account ID, Region) if provided
            if (data.extracted_data && Object.keys(data.extracted_data).length > 0) {
                const params = data.extracted_data;
                const topKeys = ['nickname', 'account_id', 'region'];
                
                topKeys.forEach(key => {
                    if (params[key]) {
                        genResultsGrid.appendChild(createResultElement(key, params[key]));
                    }
                });
            }

            // Render Final Generated Token Box
            const tokenCard = document.createElement('div');
            tokenCard.className = 'data-box full-span';
            tokenCard.style.borderColor = 'rgba(16, 185, 129, 0.4)';
            tokenCard.style.background = 'rgba(16, 185, 129, 0.05)';
            tokenCard.innerHTML = `
                <div class="box-header">
                    <div class="box-title" style="color: var(--success);"><i class="fa-solid fa-shield-halved"></i> <span>GENERATED ${data.token_name}</span></div>
                    <button type="button" class="btn-copy" onclick="copyToClipboard('${data.token}')" title="Copy">
                        <i class="fa-regular fa-copy"></i>
                    </button>
                </div>
                <div class="box-content" style="color: #ffffff; border-color: rgba(16, 185, 129, 0.2); word-break: break-all;">${data.token}</div>
            `;
            genResultsGrid.appendChild(tokenCard);
            
            genResultPanel.style.display = 'block';
            setTimeout(() => genResultPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);

        } catch (error) {
            genErrorMsg.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> ${error.message}`;
            genErrorMsg.style.display = 'block';
        } finally {
            genBtn.innerHTML = '<span>Generate Now</span> <i class="fa-solid fa-gears"></i>';
            genBtn.disabled = false;
        }
    });

    // ==========================================
    // 2. Original URL Parse Logic (Bottom Section)
    // ==========================================
    urlForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // --- NEW: ওপরের সেকশন ক্লিয়ার করার লজিক ---
        genInput.value = '';
        genResultPanel.style.display = 'none';
        genErrorMsg.style.display = 'none';
        genResultsGrid.innerHTML = '';
        // ------------------------------------------

        const rawUrl = urlInput.value.trim();
        if (!rawUrl) return;

        errorMsg.style.display = 'none';
        resultPanel.style.display = 'none';
        
        analyzeBtn.innerHTML = '<span>Processing...</span> <i class="fa-solid fa-spinner fa-spin"></i>';
        analyzeBtn.disabled = true;

        try {
            const response = await fetch('/api/parse-url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: rawUrl })
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Failed to process URL');
            }

            const extractedParams = {};
            let foundTarget = false;
            const targetKeys = ['eat', 'code', 'token', 'account_id', 'nickname', 'region'];

            targetKeys.forEach(key => {
                if (data.data && data.data[key]) {
                    extractedParams[key] = data.data[key];
                    foundTarget = true;
                }
            });

            if (!foundTarget) {
                throw new Error('No valid tokens found. Please check your copied URL.');
            }

            // Render URL details
            resultsGrid.innerHTML = ''; 
            displayOrder.forEach(key => {
                if (extractedParams[key]) resultsGrid.appendChild(createResultElement(key, extractedParams[key]));
            });
            Object.keys(extractedParams).forEach(key => {
                if (!displayOrder.includes(key)) resultsGrid.appendChild(createResultElement(key, extractedParams[key]));
            });

            resultPanel.style.display = 'block';
            setTimeout(() => resultPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);

        } catch (error) {
            errorMsg.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> ${error.message}`;
            errorMsg.style.display = 'block';
        } finally {
            analyzeBtn.innerHTML = '<span>Analyze URL</span> <i class="fa-solid fa-wand-magic-sparkles"></i>';
            analyzeBtn.disabled = false;
        }
    });

    // ==========================================
    // Helper: Create Data Box UI Element
    // ==========================================
    function createResultElement(key, value) {
        const card = document.createElement('div');
        const isLongText = key === 'eat' || key === 'token' || key === 'code';
        card.className = isLongText ? 'data-box full-span' : 'data-box';
        
        let displayLabel = key.replace('_', ' ').toUpperCase();
        if (key === 'eat') displayLabel = 'SESSION TOKEN (EAT)';

        let iconHtml = '<i class="fa-solid fa-code"></i>';
        if (key === 'nickname') iconHtml = '<i class="fa-regular fa-user"></i>';
        if (key === 'account_id') iconHtml = '<i class="fa-regular fa-id-badge"></i>';
        if (key === 'region') iconHtml = '<i class="fa-solid fa-location-dot"></i>';
        if (isLongText) iconHtml = '<i class="fa-solid fa-key"></i>';

        // Escaping single quotes for clipboard function
        const safeValue = value.replace(/'/g, "\\'");

        card.innerHTML = `
            <div class="box-header">
                <div class="box-title">${iconHtml} <span>${displayLabel}</span></div>
                <button type="button" class="btn-copy" onclick="copyToClipboard('${safeValue}')" title="Copy">
                    <i class="fa-regular fa-copy"></i>
                </button>
            </div>
            <div class="box-content">${value}</div>
        `;
        return card;
    }
});

// Global Copy Function
window.copyToClipboard = async function(text) {
    try {
        await navigator.clipboard.writeText(text);
        showToast();
    } catch (err) {
        alert('Copy failed. Please copy manually.');
    }
};

let toastTimeout;
function showToast() {
    const toast = document.getElementById("toast");
    clearTimeout(toastTimeout);
    toast.classList.remove("show");
    setTimeout(() => {
        toast.classList.add("show");
        toastTimeout = setTimeout(() => toast.classList.remove("show"), 2000);
    }, 50);
}
