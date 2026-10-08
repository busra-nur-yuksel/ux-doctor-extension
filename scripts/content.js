/**
 * Content Script for UX Doctor
 * Coordinates analysis, overlay highlighting, and communication with popup
 */

// Load engines dynamically
let deterministicEngine = null;
let llmEvaluator = null;
let currentReport = null;
let isSensitive = false;

/**
 * Check if page is sensitive (contains password fields or session tokens)
 */
function checkSensitivePage() {
  // Check for password fields
  const passwordInputs = document.querySelectorAll('input[type="password"]');
  if (passwordInputs.length > 0) {
    return true;
  }

  // Check for session tokens in URL
  const url = window.location.href.toLowerCase();
  const sensitiveKeywords = ['session', 'token', 'auth', 'login', 'signin', 'password'];
  
  for (const keyword of sensitiveKeywords) {
    if (url.includes(keyword)) {
      return true;
    }
  }

  return false;
}

/**
 * Load the deterministic engine
 */
async function loadDeterministicEngine() {
  if (deterministicEngine) return deterministicEngine;

  try {
    // Create engine inline since we can't load external scripts easily
    deterministicEngine = new class {
      constructor() {
        this.findings = [];
        this.score = 100;
        this.categoryStats = {
          language: { total: 0, errors: 0, maxPenalty: 15 },
          title: { total: 0, errors: 0, maxPenalty: 10 },
          forms: { total: 0, errors: 0, maxPenalty: 25 },
          touchTargets: { total: 0, errors: 0, maxPenalty: 25 },
          images: { total: 0, errors: 0, maxPenalty: 25 },
          links: { total: 0, errors: 0, maxPenalty: 15 }
        };
      }

      generateSelector(element) {
        if (!element) return null;
        if (element.id) return `#${element.id}`;
        
        const path = [];
        let current = element;
        
        while (current && current !== document.body) {
          let selector = current.tagName.toLowerCase();
          if (current.className && typeof current.className === 'string') {
            const classes = current.className.trim().split(/\s+/).filter(c => c);
            if (classes.length > 0) selector += '.' + classes.join('.');
          }
          if (!current.id && (!current.className || current.className.trim() === '')) {
            const siblings = Array.from(current.parentElement?.children || []);
            const index = siblings.indexOf(current) + 1;
            selector += `:nth-child(${index})`;
          }
          path.unshift(selector);
          current = current.parentElement;
          if (path.length > 10) break;
        }
        return path.join(' > ');
      }

      checkLanguage() {
        this.categoryStats.language.total = 1;
        const html = document.documentElement;
        if (!html || !html.hasAttribute('lang')) {
          this.categoryStats.language.errors = 1;
          this.findings.push({
            selector: 'html',
            rule: 'WCAG 3.1.1',
            severity: 'Kritik',
            message: 'Sayfa dili belirtilmemiş. HTML elementinde lang attribute eksik.',
            recommendation: 'HTML elementine lang="tr" veya uygun dil kodunu ekleyin.'
          });
        } else {
          const lang = html.getAttribute('lang');
          if (!lang || lang.trim() === '') {
            this.categoryStats.language.errors = 1;
            this.findings.push({
              selector: 'html',
              rule: 'WCAG 3.1.1',
              severity: 'Kritik',
              message: 'lang attribute boş.',
              recommendation: 'HTML elementine geçerli bir dil kodu ekleyin (örn: lang="tr").'
            });
          }
        }
      }

      checkImages() {
        const images = document.querySelectorAll('img');
        this.categoryStats.images.total = images.length;
        images.forEach(img => {
          const selector = this.generateSelector(img);
          if (!selector) return;
          const alt = img.getAttribute('alt');
          if (alt === null) {
            this.categoryStats.images.errors++;
            this.findings.push({
              selector: selector,
              rule: 'WCAG 1.1.1',
              severity: 'Yüksek',
              message: 'Görselde alt attribute eksik.',
              recommendation: 'Görsel için açıklayıcı alt metni ekleyin veya dekoratifse alt="" kullanın.'
            });
          } else if (alt.trim() === '' && !img.getAttribute('role')) {
            this.categoryStats.images.errors++;
            this.findings.push({
              selector: selector,
              rule: 'WCAG 1.1.1',
              severity: 'Düşük',
              message: 'Görselde boş alt attribute, dekoratif amaç belirtilmemiş.',
              recommendation: 'Dekoratifse role="presentation" veya aria-hidden="true" ekleyin.'
            });
          }
        });
      }

      checkFormLabels() {
        const formControls = document.querySelectorAll('input, select, textarea');
        let checkedControls = 0;
        
        formControls.forEach(control => {
          const selector = this.generateSelector(control);
          if (!selector) return;
          const type = control.getAttribute('type');
          if (type === 'hidden' || type === 'submit' || type === 'button') return;
          
          checkedControls++;
          
          if (control.hasAttribute('aria-label') && control.getAttribute('aria-label').trim() !== '') return;
          if (control.hasAttribute('aria-labelledby')) return;
          const parentLabel = control.closest('label');
          if (parentLabel) return;
          const id = control.id;
          if (id) {
            const associatedLabel = document.querySelector(`label[for="${id}"]`);
            if (associatedLabel) return;
          }
          
          this.categoryStats.forms.errors++;
          this.findings.push({
            selector: selector,
            rule: 'WCAG 1.3.1 / 3.3.2',
            severity: 'Yüksek',
            message: 'Form kontrolü ile ilişkilendirilmiş label eksik.',
            recommendation: 'Label for="..." kullanın veya aria-label/aria-labelledby ekleyin.'
          });
        });
        
        this.categoryStats.forms.total = checkedControls;
      }

      checkTouchTargets() {
        const clickable = document.querySelectorAll('button, a[href], input[type="button"], input[type="submit"], [role="button"]');
        this.categoryStats.touchTargets.total = clickable.length;
        
        clickable.forEach(el => {
          const selector = this.generateSelector(el);
          if (!selector) return;
          const rect = el.getBoundingClientRect();
          const width = rect.width;
          const height = rect.height;
          if (width < 24 || height < 24) {
            this.categoryStats.touchTargets.errors++;
            this.findings.push({
              selector: selector,
              rule: 'WCAG 2.5.8',
              severity: 'Orta',
              message: `Dokunmatik hedef boyutu küçük: ${Math.round(width)}x${Math.round(height)}px (minimum 24x24px gerekli).`,
              recommendation: 'Tıklanabilir alanı en az 24x24px boyutuna büyütün veya padding ekleyin.'
            });
          }
        });
      }

      checkEmptyLinks() {
        const links = document.querySelectorAll('a');
        let checkedLinks = 0;
        
        links.forEach(link => {
          const selector = this.generateSelector(link);
          if (!selector) return;
          if (!link.hasAttribute('href') || link.getAttribute('href') === '#') return;
          
          checkedLinks++;
          
          if (link.hasAttribute('aria-label') && link.getAttribute('aria-label').trim() !== '') return;
          const text = link.textContent.trim();
          if (text !== '') return;
          const img = link.querySelector('img');
          if (img && img.hasAttribute('alt') && img.getAttribute('alt').trim() !== '') return;
          
          this.categoryStats.links.errors++;
          this.findings.push({
            selector: selector,
            rule: 'WCAG 2.4.4',
            severity: 'Yüksek',
            message: 'Link metni veya açıklaması eksik.',
            recommendation: 'Link anlamlı metin ekleyin veya aria-label kullanın.'
          });
        });
        
        this.categoryStats.links.total = checkedLinks;
      }

      checkPageTitle() {
        this.categoryStats.title.total = 1;
        const title = document.querySelector('title');
        if (!title) {
          this.categoryStats.title.errors = 1;
          this.findings.push({
            selector: 'title',
            rule: 'WCAG 2.4.2',
            severity: 'Kritik',
            message: 'Sayfa başlığı (title elementi) eksik.',
            recommendation: 'HTML head sectionına anlamlı bir title elementi ekleyin.'
          });
        } else {
          const titleText = title.textContent.trim();
          if (titleText === '') {
            this.categoryStats.title.errors = 1;
            this.findings.push({
              selector: 'title',
              rule: 'WCAG 2.4.2',
              severity: 'Kritik',
              message: 'Sayfa başlığı boş.',
              recommendation: 'Title elementine anlamlı bir sayfa başlığı ekleyin.'
            });
          }
        }
      }

      calculateScore() {
        let totalDeduction = 0;
        
        for (const [category, stats] of Object.entries(this.categoryStats)) {
          if (stats.total === 0) continue;
          
          const errorRatio = stats.errors / stats.total;
          const categoryDeduction = Math.min(errorRatio * stats.maxPenalty, stats.maxPenalty);
          totalDeduction += categoryDeduction;
        }
        
        this.score = Math.max(0, Math.round(100 - totalDeduction));
        return this.score;
      }

      runAllChecks() {
        this.findings = [];
        this.score = 100;
        
        this.categoryStats = {
          language: { total: 0, errors: 0, maxPenalty: 15 },
          title: { total: 0, errors: 0, maxPenalty: 10 },
          forms: { total: 0, errors: 0, maxPenalty: 25 },
          touchTargets: { total: 0, errors: 0, maxPenalty: 25 },
          images: { total: 0, errors: 0, maxPenalty: 25 },
          links: { total: 0, errors: 0, maxPenalty: 15 }
        };
        
        this.checkLanguage();
        this.checkImages();
        this.checkFormLabels();
        this.checkTouchTargets();
        this.checkEmptyLinks();
        this.checkPageTitle();
        this.calculateScore();
        
        const limitedFindings = this.findings.slice(0, 30);
        
        return {
          findings: limitedFindings,
          totalFindings: this.findings.length,
          score: this.score,
          categoryStats: this.categoryStats
        };
      }
    };

    return deterministicEngine;
  } catch (error) {
    console.error('Error loading deterministic engine:', error);
    return null;
  }
}

/**
 * Load the LLM evaluator
 */
async function loadLLMEvaluator() {
  if (llmEvaluator) return llmEvaluator;

  try {
    llmEvaluator = new class {
      constructor() {
        this.apiKey = null;
        this.apiProvider = 'openrouter';
        this.apiBaseUrl = '';
        this.apiModel = '';
        this.findings = [];
        this.score = 100;
      }

      setCredentials(apiKey, provider = 'openrouter', apiBaseUrl = '', apiModel = '') {
        this.apiKey = apiKey;
        this.apiProvider = provider;
        this.apiBaseUrl = apiBaseUrl;
        this.apiModel = apiModel;
      }

      generateSelector(element) {
        if (!element) return null;
        if (element.id) return `#${element.id}`;
        const path = [];
        let current = element;
        while (current && current !== document.body) {
          let selector = current.tagName.toLowerCase();
          if (current.className && typeof current.className === 'string') {
            const classes = current.className.trim().split(/\s+/).filter(c => c);
            if (classes.length > 0) selector += '.' + classes.join('.');
          }
          if (!current.id && (!current.className || current.className.trim() === '')) {
            const siblings = Array.from(current.parentElement?.children || []);
            const index = siblings.indexOf(current) + 1;
            selector += `:nth-child(${index})`;
          }
          path.unshift(selector);
          current = current.parentElement;
          if (path.length > 10) break;
        }
        return path.join(' > ');
      }

      sanitizeDOM() {
        const digest = {
          buttons: [],
          links: [],
          inputs: [],
          forms: [],
          headings: [],
          images: []
        };

        // Extract button information - limit to 10
        const buttons = Array.from(document.querySelectorAll('button, [role="button"]')).slice(0, 10);
        buttons.forEach(btn => {
          const selector = this.generateSelector(btn);
          if (selector) {
            digest.buttons.push({
              selector: selector,
              text: btn.textContent.trim().substring(0, 40),
              hasIcon: btn.querySelector('svg, i, .icon') !== null
            });
          }
        });

        // Extract link information - limit to 8
        const links = Array.from(document.querySelectorAll('a[href]')).slice(0, 8);
        links.forEach(link => {
          const selector = this.generateSelector(link);
          if (selector) {
            digest.links.push({
              selector: selector,
              text: link.textContent.trim().substring(0, 40),
              isExternal: link.hostname !== window.location.hostname
            });
          }
        });

        // Extract input information - limit to 5
        const inputs = Array.from(document.querySelectorAll('input, select, textarea')).slice(0, 5);
        inputs.forEach(input => {
          const selector = this.generateSelector(input);
          if (selector) {
            digest.inputs.push({
              selector: selector,
              type: input.getAttribute('type') || input.tagName.toLowerCase(),
              hasPlaceholder: input.hasAttribute('placeholder'),
              hasLabel: input.closest('label') !== null || 
                        (input.id && document.querySelector(`label[for="${input.id}"]`))
            });
          }
        });

        // Extract form structure - limit to 3
        const forms = Array.from(document.querySelectorAll('form')).slice(0, 3);
        forms.forEach(form => {
          const selector = this.generateSelector(form);
          if (selector) {
            digest.forms.push({
              selector: selector,
              inputCount: form.querySelectorAll('input, select, textarea').length,
              hasSubmitButton: form.querySelector('button[type="submit"], input[type="submit"]') !== null
            });
          }
        });

        // Extract headings - only h1, h2, limit to 4
        const headings = Array.from(document.querySelectorAll('h1, h2')).slice(0, 4);
        headings.forEach(heading => {
          const selector = this.generateSelector(heading);
          if (selector) {
            digest.headings.push({
              selector: selector,
              level: heading.tagName.toLowerCase(),
              text: heading.textContent.trim().substring(0, 40)
            });
          }
        });

        // Extract image information - limit to 5
        const images = Array.from(document.querySelectorAll('img')).slice(0, 5);
        images.forEach(img => {
          const selector = this.generateSelector(img);
          if (selector) {
            digest.images.push({
              selector: selector,
              hasAlt: img.hasAttribute('alt'),
              altLength: img.getAttribute('alt')?.length || 0
            });
          }
        });

        return digest;
      }

      buildPrompt(digest) {
        return `You are a UX expert evaluating a web page based on Don Norman's 6 Principles of Design:
1. Visibility - Can users see what actions are possible?
2. Feedback - Does the system provide clear feedback?
3. Constraints - Are there appropriate limits on actions?
4. Mapping - Do controls relate to their effects?
5. Consistency - Are similar things handled similarly?
6. Affordance - Do objects suggest their proper use?

IMPORTANT RULES:
- You MUST ONLY use the CSS selectors provided in the data below
- NEVER invent or hallucinate new selectors
- If you cannot find an issue with the provided selectors, do not report one
- Set temperature to 0.1 for consistent results
- SADECE en kritik 3-4 bulguyu raporla, fazlasını yazma
- JSON yapısının en başında mutlaka "subScores" objesi ve "llmScore" (0-100 arası sayı) yer almalıdır
- "subScores" objesinde 6 ilke için (visibility, feedback, constraints, mapping, consistency, affordance) 0-100 arası tamsayı puanlar verilmelidir
- "llmScore" bu 6 alt skorun tam aritmetik ortalaması (yuvarlanmış) olmalıdır ZORUNLUDUR
- Each finding must include: selector (from provided list), rule (Visibility/Feedback/Constraints/Mapping/Consistency/Affordance), severity (Kritik/Yüksek/Orta/Düşük), message, recommendation

Page Data (Sanitized):
${JSON.stringify(digest, null, 2)}

Return findings in this exact JSON format:
{
  "subScores": {
    "visibility": 75,
    "feedback": 70,
    "constraints": 80,
    "mapping": 65,
    "consistency": 85,
    "affordance": 70
  },
  "llmScore": 74,
  "findings": [
    {
      "selector": "exact selector from data",
      "rule": "Visibility",
      "severity": "Kritik",
      "message": "specific issue description",
      "recommendation": "concrete fix suggestion"
    }
  ]
}`;
      }

      async callLLM(prompt) {
        // Read from chrome.storage.local dynamically
        const storageData = await chrome.storage.local.get(['apiKey', 'apiProvider', 'apiBaseUrl', 'apiModel']);
        const apiKey = storageData.apiKey || this.apiKey;
        const apiProvider = storageData.apiProvider || this.apiProvider || 'openrouter';
        const apiBaseUrl = storageData.apiBaseUrl || this.apiBaseUrl || '';
        const apiModel = storageData.apiModel || this.apiModel || '';

        const endpoints = {
          openrouter: 'https://openrouter.ai/api/v1/chat/completions',
          claude: 'https://api.anthropic.com/v1/messages',
          openai: 'https://api.openai.com/v1/chat/completions'
        };

        let targetUrl;
        let body, headers;

        if (apiProvider === 'custom' || (apiBaseUrl && apiBaseUrl.trim() !== '')) {
          const cleanBaseUrl = apiBaseUrl.trim().replace(/\/+$/, '');
          targetUrl = cleanBaseUrl.endsWith('/chat/completions')
            ? cleanBaseUrl
            : `${cleanBaseUrl}/chat/completions`;
          headers = {
            'Content-Type': 'application/json'
          };
          if (apiKey) {
            headers['Authorization'] = `Bearer ${apiKey}`;
          }
          body = {
            model: apiModel || 'gemma4',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.1,
            max_tokens: 1500
          };
        } else if (apiProvider === 'claude') {
          targetUrl = endpoints.claude;
          headers = {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
          };
          body = {
            model: apiModel || 'claude-3-haiku-20240307',
            max_tokens: 1500,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.1
          };
        } else if (apiProvider === 'openai') {
          targetUrl = endpoints.openai;
          headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          };
          body = {
            model: apiModel || 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.1,
            max_tokens: 1500
          };
        } else {
          // OpenRouter (default)
          targetUrl = endpoints.openrouter;
          headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          };
          body = {
            model: apiModel || 'anthropic/claude-3-haiku',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.1,
            max_tokens: 1500
          };
        }

        // Debug logging
        console.log('İstek Gönderiliyor:', { 
          url: targetUrl, 
          provider: apiProvider,
          model: body.model,
          headers: { Authorization: `Bearer ${apiKey ? 'VAR' : 'YOK'}` } 
        });

        try {
          const response = await fetch(targetUrl, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(body)
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API request failed: ${response.status} - ${errorText}`);
          }

          const data = await response.json();
          let rawContent;
          if (apiProvider === 'claude') {
            rawContent = data.content[0].text;
          } else {
            rawContent = data.choices[0].message.content;
          }

          // Parse JSON from response with markdown block handling
          try {
            rawContent = rawContent.trim();

            // Markdown kod bloklarını temizle
            rawContent = rawContent.replace(/```json\s*/gi, '').replace(/```\s*$/gi, '').replace(/```/g, '').trim();

            // İlk '{' ile son '}' arasını güvenli şekilde al
            const firstBrace = rawContent.indexOf('{');
            const lastBrace = rawContent.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1) {
              rawContent = rawContent.substring(firstBrace, lastBrace + 1);
            }

            const parsedJson = JSON.parse(rawContent);

            // Don Norman 6 Principles Sub-scores verification
            const defaultSubScores = {
              visibility: 75,
              feedback: 75,
              constraints: 75,
              mapping: 75,
              consistency: 75,
              affordance: 75
            };

            const subScores = { ...defaultSubScores };

            if (parsedJson.subScores && typeof parsedJson.subScores === 'object') {
              const keys = ['visibility', 'feedback', 'constraints', 'mapping', 'consistency', 'affordance'];
              keys.forEach(k => {
                if (typeof parsedJson.subScores[k] === 'number') {
                  subScores[k] = Math.max(0, Math.min(100, Math.round(parsedJson.subScores[k])));
                }
              });
            } else if (parsedJson.findings && Array.isArray(parsedJson.findings)) {
              // Derive subScores from findings if subScores object missing
              const deductions = { visibility: 0, feedback: 0, constraints: 0, mapping: 0, consistency: 0, affordance: 0 };
              const severityDeduction = { 'Kritik': 15, 'Yüksek': 10, 'Orta': 5, 'Düşük': 2 };
              parsedJson.findings.forEach(f => {
                const ruleKey = (f.rule || '').toLowerCase();
                for (const k of Object.keys(deductions)) {
                  if (ruleKey.includes(k)) {
                    deductions[k] += (severityDeduction[f.severity] || 5);
                  }
                }
              });
              Object.keys(subScores).forEach(k => {
                subScores[k] = Math.max(0, 100 - deductions[k]);
              });
            }

            // Calculate arithmetic mean of 6 subScores
            const sumSubScores = subScores.visibility + subScores.feedback + subScores.constraints +
                                 subScores.mapping + subScores.consistency + subScores.affordance;
            const arithmeticMean = Math.round(sumSubScores / 6);

            parsedJson.subScores = subScores;
            parsedJson.llmScore = arithmeticMean;

            return parsedJson;
          } catch (parseError) {
            console.error('JSON Parse Error:', parseError);
            const fallbackSubScores = {
              visibility: 70, feedback: 70, constraints: 70, mapping: 70, consistency: 70, affordance: 70
            };
            return { subScores: fallbackSubScores, llmScore: 70, findings: [] };
          }
        } catch (error) {
          console.error('LLM API Error:', error);
          const fallbackSubScores = {
            visibility: 70, feedback: 70, constraints: 70, mapping: 70, consistency: 70, affordance: 70
          };
          return { subScores: fallbackSubScores, llmScore: 70, findings: [] };
        }
      }

      validateFindings(findings) {
        const totalFindings = findings ? findings.length : 0;
        const validFindings = [];
        let hallucinatedCount = 0;
        
        if (Array.isArray(findings)) {
          findings.forEach(finding => {
            if (finding && finding.selector) {
              const element = document.querySelector(finding.selector);
              if (element !== null) {
                validFindings.push(finding);
              } else {
                hallucinatedCount++;
                console.warn(`Hallucinated selector discarded: ${finding.selector}`);
              }
            } else {
              hallucinatedCount++;
            }
          });
        }

        const hallucinationRateNum = totalFindings > 0 ? Number(((hallucinatedCount / totalFindings) * 100).toFixed(2)) : 0;

        const hallucinationMetrics = {
          totalFindings: totalFindings,
          validFindings: validFindings.length,
          hallucinatedCount: hallucinatedCount,
          hallucinationRate: `${hallucinationRateNum}%`
        };

        return {
          validFindings,
          hallucinationMetrics
        };
      }

      calculateScore(findings) {
        const maxDeductionPerFinding = {
          'Kritik': 15,
          'Yüksek': 10,
          'Orta': 5,
          'Düşük': 2
        };
        let totalDeduction = 0;
        findings.forEach(finding => {
          const deduction = maxDeductionPerFinding[finding.severity] || 5;
          totalDeduction += deduction;
        });
        this.score = Math.max(0, 100 - totalDeduction);
        return this.score;
      }

      async evaluate() {
        if (!this.apiKey) {
          return {
            findings: [],
            score: null,
            subScores: null,
            hallucinationMetrics: null,
            error: 'API key not provided'
          };
        }

        try {
          const digest = this.sanitizeDOM();
          const prompt = this.buildPrompt(digest);
          const response = await this.callLLM(prompt);
          
          const validation = this.validateFindings(response.findings || []);
          const validFindings = validation.validFindings;
          const hallucinationMetrics = validation.hallucinationMetrics;

          const subScores = response.subScores || {
            visibility: 75, feedback: 75, constraints: 75, mapping: 75, consistency: 75, affordance: 75
          };
          
          const score = response.llmScore !== undefined ? response.llmScore : 75;
          
          return {
            findings: validFindings,
            score: score,
            subScores: subScores,
            hallucinationMetrics: hallucinationMetrics
          };
        } catch (error) {
          console.error('LLM Evaluation Error:', error);
          return {
            findings: [],
            score: null,
            subScores: null,
            hallucinationMetrics: null,
            error: error.message
          };
        }
      }
    };

    return llmEvaluator;
  } catch (error) {
    console.error('Error loading LLM evaluator:', error);
    return null;
  }
}

/**
 * Run full analysis
 */
async function runAnalysis(apiKey = null, apiProvider = 'openrouter', apiBaseUrl = '', apiModel = '') {
  // Check if page is sensitive
  isSensitive = checkSensitivePage();
  
  // Load engines
  const deterministic = await loadDeterministicEngine();
  const llm = await loadLLMEvaluator();
  
  // Run deterministic checks
  const deterministicResult = deterministic.runAllChecks();
  
  // Run LLM evaluation (only if not sensitive and API key provided)
  let llmResult = { findings: [], score: null, subScores: null, hallucinationMetrics: null, skipped: false };
  if (!isSensitive && apiKey) {
    llm.setCredentials(apiKey, apiProvider, apiBaseUrl, apiModel);
    llmResult = await llm.evaluate();
  } else if (isSensitive) {
    llmResult = {
      findings: [],
      score: null,
      subScores: null,
      hallucinationMetrics: null,
      skipped: true,
      reason: 'Sensitive page detected - LLM evaluation disabled for privacy'
    };
  } else if (!apiKey) {
    llmResult = {
      findings: [],
      score: null,
      subScores: null,
      hallucinationMetrics: null,
      skipped: true,
      reason: 'API key not provided'
    };
  }
  
  // Calculate weighted score
  // If LLM score is null (not run), use only deterministic score
  const weightedScore = llmResult.score !== null 
    ? (deterministicResult.score * 0.55) + (llmResult.score * 0.45)
    : deterministicResult.score;
  
  // Combine findings
  const allFindings = [
    ...deterministicResult.findings.map(f => ({ ...f, source: 'deterministic' })),
    ...llmResult.findings.map(f => ({ ...f, source: 'llm' }))
  ];
  
  currentReport = {
    url: window.location.href,
    timestamp: new Date().toISOString(),
    isSensitive: isSensitive,
    deterministicScore: deterministicResult.score,
    llmScore: llmResult.score,
    weightedScore: Math.round(weightedScore),
    scores: {
      deterministic: deterministicResult.score,
      llm: llmResult.score,
      weighted: Math.round(weightedScore),
      subScores: llmResult.subScores || null
    },
    subScores: llmResult.subScores || null,
    hallucinationMetrics: llmResult.hallucinationMetrics || null,
    findings: allFindings
  };
  
  return currentReport;
}

/**
 * Highlight element in DOM
 */
function highlightElement(selector) {
  // Clear existing highlights
  clearHighlights();
  
  const element = document.querySelector(selector);
  if (!element) {
    console.error(`Element not found: ${selector}`);
    return false;
  }
  
  // Scroll to element
  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  
  // Add highlight class
  element.classList.add('ux-doctor-highlight');
  
  // Create badge
  const badge = document.createElement('div');
  badge.className = 'ux-doctor-badge';
  badge.id = 'ux-doctor-badge';
  
  // Find the finding for this selector
  const finding = currentReport?.findings.find(f => f.selector === selector);
  if (finding) {
    badge.innerHTML = `
      <strong>${finding.rule}</strong><br>
      <span class="ux-doctor-severity-${finding.severity.toLowerCase()}">${finding.severity}</span><br>
      ${finding.message}
    `;
  }
  
  document.body.appendChild(badge);
  
  // Position badge near element
  const rect = element.getBoundingClientRect();
  badge.style.top = `${rect.top + window.scrollY - 60}px`;
  badge.style.left = `${rect.left + window.scrollX}px`;
  
  return true;
}

/**
 * Clear all highlights
 */
function clearHighlights() {
  document.querySelectorAll('.ux-doctor-highlight').forEach(el => {
    el.classList.remove('ux-doctor-highlight');
  });
  
  const badge = document.getElementById('ux-doctor-badge');
  if (badge) {
    badge.remove();
  }
}

/**
 * Listen for messages from popup
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'runAnalysis') {
    runAnalysis(request.apiKey, request.apiProvider)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ error: error.message }));
    return true; // Async response
  }
  
  if (request.action === 'highlightElement') {
    const success = highlightElement(request.selector);
    sendResponse({ success });
  }
  
  if (request.action === 'clearHighlights') {
    clearHighlights();
    sendResponse({ success: true });
  }
  
  if (request.action === 'getReport') {
    sendResponse(currentReport);
  }
});

// Initialize on load
console.log('UX Doctor content script loaded');
