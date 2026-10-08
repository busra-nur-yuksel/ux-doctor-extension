/**
 * LLM Evaluator for UX Doctor
 * Evaluates Don Norman's 6 Principles using AI
 * Strict privacy and hallucination prevention measures
 */

  constructor() {
    this.apiKey = null;
    this.apiProvider = 'openrouter'; // openrouter, openai, claude, custom
    this.apiBaseUrl = '';
    this.apiModel = '';
    this.findings = [];
    this.score = 100;
  }

  /**
   * Set API key, provider, base URL and model
   */
  setCredentials(apiKey, provider = 'openrouter', apiBaseUrl = '', apiModel = '') {
    this.apiKey = apiKey;
    this.apiProvider = provider;
    this.apiBaseUrl = apiBaseUrl;
    this.apiModel = apiModel;
  }

  /**
   * Sanitize DOM for privacy - extract only structural information
   * Never send raw HTML, input values, or sensitive data
   * Optimized to keep prompt under 1500-2000 tokens
   */
  sanitizeDOM() {
    const digest = {
      buttons: [],
      links: [],
      inputs: [],
      forms: [],
      headings: [],
      images: []
    };

    // Extract button information (text only, no values) - limit to 10
    const buttons = Array.from(document.querySelectorAll('button, [role="button"]')).slice(0, 10);
    buttons.forEach(btn => {
      const selector = this.generateSelector(btn);
      if (selector) {
        digest.buttons.push({
          selector: selector,
          text: btn.textContent.trim().substring(0, 40), // Reduced to 40 chars
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
          text: link.textContent.trim().substring(0, 40), // Reduced to 40 chars
          isExternal: link.hostname !== window.location.hostname
        });
      }
    });

    // Extract input information (types only, never values) - limit to 5
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
          text: heading.textContent.trim().substring(0, 40) // Reduced to 40 chars
        });
      }
    });

    // Extract image information (alt only) - limit to 5
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

  /**
   * Generate CSS selector for an element
   */
  generateSelector(element) {
    if (!element) return null;
    
    if (element.id) {
      return `#${element.id}`;
    }

    const path = [];
    let current = element;
    
    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase();
      
      if (current.className && typeof current.className === 'string') {
        const classes = current.className.trim().split(/\s+/).filter(c => c);
        if (classes.length > 0) {
          selector += '.' + classes.join('.');
        }
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

  /**
   * Build the prompt for LLM evaluation
   * Strict instruction to only use provided selectors
   */
  /**
   * Build the prompt for LLM evaluation
   * Strict instruction to produce 6 Norman principle sub-scores and use provided selectors
   */
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

  /**
   * Call LLM API (OpenRouter, Claude, OpenAI, or Custom)
   */
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
      
      // Extract content based on provider
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

  /**
   * Validate LLM findings against actual DOM
   * Discard hallucinated selectors and produce hallucination metrics
   */
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

  /**
   * Calculate LLM score based on findings
   */
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

  /**
   * Run full LLM evaluation
   */
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
      // Sanitize DOM
      const digest = this.sanitizeDOM();
      
      // Build prompt
      const prompt = this.buildPrompt(digest);
      
      // Call LLM
      const response = await this.callLLM(prompt);
      
      // Validate findings against actual DOM
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
}

// Export for use in content script
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LLMEvaluator;
}
