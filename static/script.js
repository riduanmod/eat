document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('url-form');
    const input = document.getElementById('redirect-url');
    const analyzeBtn = document.getElementById('analyze-btn');
    const resultPanel = document.getElementById('result-panel');
    const resultsGrid = document.getElementById('results-grid');
    const errorMsg = document.getElementById('error-message');

    const targetKeys = ['eat', 'code', 'token', 'account_id', 'nickname', 'region'];
    const displayOrder = ['nickname', 'account_id', 'region', 'eat', 'code', 'token'];

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const rawUrl = input.value.trim();
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

            if (!response.ok) {
                throw new Error(data.message || 'Failed to process URL');
            }

            const extractedParams = {};
            let foundTarget = false;

            targetKeys.forEach(key => {
                if (data.data && data.data[key]) {
                    extractedParams[key] = data.data[key];
                    foundTarget = true;
                }
            });

            if (!foundTarget) {
                throw new Error('No valid tokens found. Please check your copied URL.');
            }

            renderResults(extractedParams);

        } catch (error) {
            errorMsg.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> ${error.message}`;
            errorMsg.style.display = 'block';
        } finally {
            analyzeBtn.innerHTML = '<span>Analyze Token</span> <i class="fa-solid fa-wand-magic-sparkles"></i>';
            analyzeBtn.disabled = false;
        }
    });

    function renderResults(params) {
        resultsGrid.innerHTML = ''; 

        displayOrder.forEach(key => {
            if (params[key]) appendResultCard(key, params[key]);
        });

        Object.keys(params).forEach(key => {
            if (!displayOrder.includes(key)) appendResultCard(key, params[key]);
        });

        resultPanel.style.display = 'block';
        setTimeout(() => resultPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
    }

    function appendResultCard(key, value) {
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

        card.innerHTML = `
            <div class="box-header">
                <div class="box-title">${iconHtml} <span>${displayLabel}</span></div>
                <button type="button" class="btn-copy" onclick="copyToClipboard('${value}')" title="Copy">
                    <i class="fa-regular fa-copy"></i>
                </button>
            </div>
            <div class="box-content">${value}</div>
        `;
        resultsGrid.appendChild(card);
    }
});

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
