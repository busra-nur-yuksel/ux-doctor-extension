/**
 * Popup Script for UX Doctor
 * Handles UI interactions and communication with content script
 */

let currentReport = null;
let apiKey = '';
let apiProvider = 'openrouter';
let apiBaseUrl = '';
let apiModel = '';

// DOM Elements
const apiKeyInput = document.getElementById('apiKey');
const apiProviderSelect = document.getElementById('apiProvider');
const apiBaseUrlInput = document.getElementById('apiBaseUrl');
const apiModelInput = document.getElementById('apiModel');
const saveApiKeyBtn = document.getElementById('saveApiKey');
const sensitiveWarning = document.getElementById('sensitiveWarning');
const analyzeBtn = document.getElementById('analyzeBtn');
const exportBtn = document.getElementById('exportBtn');
const loadingOverlay = document.getElementById('loadingOverlay');
const findingsList = document.getElementById('findingsList');
const findingsCount = document.getElementById('findingsCount');

// Score elements
const weightedScore = document.getElementById('weightedScore');
const weightedFill = document.getElementById('weightedFill');
const deterministicScore = document.getElementById('deterministicScore');
const deterministicFill = document.getElementById('deterministicFill');
const llmScore = document.getElementById('llmScore');
const llmFill = document.getElementById('llmFill');

// Don Norman Sub-scores DOM elements
const subScoreKeys = ['visibility', 'feedback', 'constraints', 'mapping', 'consistency', 'affordance'];
const subScoreElements = {
  visibility: { val: document.getElementById('subVisibility'), fill: document.getElementById('fillVisibility') },
  feedback: { val: document.getElementById('subFeedback'), fill: document.getElementById('fillFeedback') },
  constraints: { val: document.getElementById('subConstraints'), fill: document.getElementById('fillConstraints') },
  mapping: { val: document.getElementById('subMapping'), fill: document.getElementById('fillMapping') },
  consistency: { val: document.getElementById('subConsistency'), fill: document.getElementById('fillConsistency') },
  affordance: { val: document.getElementById('subAffordance'), fill: document.getElementById('fillAffordance') }
};

/**
 * Initialize popup
 */
async function init() {
  // Load saved API credentials
  const result = await chrome.storage.local.get(['apiKey', 'apiBaseUrl', 'apiModel', 'apiProvider']);
  if (result.apiKey) {
    apiKey = result.apiKey;
    apiKeyInput.value = apiKey;
  }
  if (result.apiProvider) {
    apiProvider = result.apiProvider;
    apiProviderSelect.value = apiProvider;
  }
  if (result.apiBaseUrl) {
    apiBaseUrl = result.apiBaseUrl;
    apiBaseUrlInput.value = apiBaseUrl;
  }
  if (result.apiModel) {
    apiModel = result.apiModel;
    apiModelInput.value = apiModel;
  }

  // Setup event listeners
  saveApiKeyBtn.addEventListener('click', saveApiKey);
  analyzeBtn.addEventListener('click', runAnalysis);
  exportBtn.addEventListener('click', exportReport);

  // Check if there's a previous report
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.id) {
    chrome.tabs.sendMessage(tab.id, { action: 'getReport' }, (response) => {
      if (response && !chrome.runtime.lastError) {
        currentReport = response;
        displayResults(response);
      }
    });
  }
}

/**
 * Save API key and config to storage
 */
async function saveApiKey() {
  apiKey = apiKeyInput.value.trim();
  apiProvider = apiProviderSelect.value;
  apiBaseUrl = apiBaseUrlInput.value.trim();
  apiModel = apiModelInput.value.trim();
  
  await chrome.storage.local.set({
    apiKey: apiKey,
    apiProvider: apiProvider,
    apiBaseUrl: apiBaseUrl,
    apiModel: apiModel
  });
  
  // Visual feedback
  saveApiKeyBtn.textContent = 'Kaydedildi!';
  setTimeout(() => {
    saveApiKeyBtn.textContent = 'Kaydet';
  }, 1500);
}

/**
 * Run analysis
 */
async function runAnalysis() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!tab || !tab.id) {
    console.error('No active tab found');
    return;
  }

  // Read latest input values
  apiKey = apiKeyInput.value.trim();
  apiProvider = apiProviderSelect.value;
  apiBaseUrl = apiBaseUrlInput.value.trim();
  apiModel = apiModelInput.value.trim();

  // Show loading
  loadingOverlay.classList.remove('hidden');
  analyzeBtn.disabled = true;

  try {
    // Send message to content script
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'runAnalysis',
      apiKey: apiKey,
      apiProvider: apiProvider,
      apiBaseUrl: apiBaseUrl,
      apiModel: apiModel
    });

    if (response) {
      currentReport = response;
      displayResults(response);
    }
  } catch (error) {
    console.error('Analysis error:', error);
    findingsList.innerHTML = `
      <div class="empty-state">
        <p style="color: #dc2626;">Analiz hatası: ${error.message}</p>
      </div>
    `;
  } finally {
    loadingOverlay.classList.add('hidden');
    analyzeBtn.disabled = false;
  }
}

/**
 * Display analysis results
 */
function displayResults(report) {
  // Update scores
  weightedScore.textContent = report.weightedScore;
  weightedFill.style.width = `${report.weightedScore}%`;
  
  deterministicScore.textContent = report.deterministicScore;
  deterministicFill.style.width = `${report.deterministicScore}%`;
  
  // Handle LLM score - show N/A if not available
  if (report.llmScore === null) {
    llmScore.textContent = 'N/A';
    llmFill.style.width = '0%';
    llmFill.style.background = '#d1d5db';
  } else {
    llmScore.textContent = report.llmScore;
    llmFill.style.width = `${report.llmScore}%`;
    updateScoreColor(llmFill, report.llmScore);
  }

  // Update Don Norman Sub-Scores UI
  const subScores = report.subScores || (report.scores ? report.scores.subScores : null);
  subScoreKeys.forEach(key => {
    const el = subScoreElements[key];
    if (el && el.val && el.fill) {
      if (subScores && typeof subScores[key] === 'number') {
        const scoreVal = subScores[key];
        el.val.textContent = scoreVal;
        el.fill.style.width = `${scoreVal}%`;
        updateScoreColor(el.fill, scoreVal);
      } else {
        el.val.textContent = 'N/A';
        el.fill.style.width = '0%';
        el.fill.style.background = '#d1d5db';
      }
    }
  });

  // Update score colors based on value
  updateScoreColor(weightedFill, report.weightedScore);
  updateScoreColor(deterministicFill, report.deterministicScore);

  // Show/hide sensitive warning
  if (report.isSensitive) {
    sensitiveWarning.classList.remove('hidden');
  } else {
    sensitiveWarning.classList.add('hidden');
  }

  // Update findings count
  findingsCount.textContent = report.findings.length;

  // Enable export button
  exportBtn.disabled = false;

  // Render findings
  renderFindings(report.findings);
}

/**
 * Update score bar color based on value
 */
function updateScoreColor(element, score) {
  if (score >= 80) {
    element.style.background = '#22c55e';
  } else if (score >= 60) {
    element.style.background = '#eab308';
  } else if (score >= 40) {
    element.style.background = '#f97316';
  } else {
    element.style.background = '#dc2626';
  }
}

/**
 * Render findings list
 */
function renderFindings(findings) {
  if (findings.length === 0) {
    findingsList.innerHTML = `
      <div class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
        <p style="color: #22c55e; font-weight: 500;">Hiçbir sorun bulunamadı!</p>
      </div>
    `;
    return;
  }

  // Sort by severity
  const severityOrder = { 'Kritik': 0, 'Yüksek': 1, 'Orta': 2, 'Düşük': 3 };
  const sortedFindings = [...findings].sort((a, b) => {
    return severityOrder[a.severity] - severityOrder[b.severity];
  });

  findingsList.innerHTML = sortedFindings.map(finding => `
    <div class="finding-item">
      <div class="finding-header">
        <span class="finding-rule">${finding.rule}</span>
        <span class="finding-source">${finding.source}</span>
      </div>
      <div class="finding-message">${finding.message}</div>
      <div class="finding-recommendation">
        <strong>Öneri:</strong> ${finding.recommendation}
      </div>
      <div class="finding-selector">${finding.selector}</div>
      <div class="finding-actions">
        <button class="btn-highlight" data-selector="${escapeHtml(finding.selector)}">
          Sayfada Vurgula
        </button>
      </div>
    </div>
  `).join('');

  // Add event listeners to highlight buttons
  document.querySelectorAll('.btn-highlight').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const selector = e.target.dataset.selector;
      await highlightElement(selector);
    });
  });
}

/**
 * Highlight element in page
 */
async function highlightElement(selector) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!tab || !tab.id) return;

  await chrome.tabs.sendMessage(tab.id, {
    action: 'highlightElement',
    selector: selector
  });
}

/**
 * Export report as JSON
 */
function exportReport() {
  if (!currentReport) return;

  const reportToExport = {
    url: currentReport.url,
    timestamp: currentReport.timestamp,
    isSensitive: currentReport.isSensitive,
    deterministicScore: currentReport.deterministicScore,
    llmScore: currentReport.llmScore,
    weightedScore: currentReport.weightedScore,
    scores: currentReport.scores || {
      deterministic: currentReport.deterministicScore,
      llm: currentReport.llmScore,
      weighted: currentReport.weightedScore,
      subScores: currentReport.subScores || null
    },
    subScores: currentReport.subScores || null,
    hallucinationMetrics: currentReport.hallucinationMetrics || null,
    findings: currentReport.findings
  };

  const blob = new Blob([JSON.stringify(reportToExport, null, 2)], {
    type: 'application/json'
  });
  
  const url = URL.createObjectURL(blob);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `ux-doctor-report-${timestamp}.json`;
  
  chrome.downloads.download({
    url: url,
    filename: filename,
    saveAs: true
  });
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Initialize on load
init();
