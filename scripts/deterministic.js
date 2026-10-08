/**
 * Deterministic Engine for UX Doctor
 * Performs WCAG-compliant accessibility checks directly against the DOM
 * All findings must include verifiable CSS selectors
 */

class DeterministicEngine {
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

  /**
   * Generate a unique CSS selector for an element
   * Uses ID, class, tag, and position to create a reliable path
   */
  generateSelector(element) {
    if (!element) return null;
    
    // If element has ID, use it
    if (element.id) {
      return `#${element.id}`;
    }

    // Build path from root
    const path = [];
    let current = element;
    
    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase();
      
      // Add classes if present
      if (current.className && typeof current.className === 'string') {
        const classes = current.className.trim().split(/\s+/).filter(c => c);
        if (classes.length > 0) {
          selector += '.' + classes.join('.');
        }
      }
      
      // Add nth-child if no ID or class
      if (!current.id && (!current.className || current.className.trim() === '')) {
        const siblings = Array.from(current.parentElement?.children || []);
        const index = siblings.indexOf(current) + 1;
        selector += `:nth-child(${index})`;
      }
      
      path.unshift(selector);
      current = current.parentElement;
      
      // Safety limit
      if (path.length > 10) break;
    }
    
    return path.join(' > ');
  }

  /**
   * WCAG 3.1.1 - Language of Page
   * Check if html element has lang attribute
   */
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

  /**
   * WCAG 1.1.1 - Non-text Content
   * Find images without valid alt attributes
   */
  checkImages() {
    const images = document.querySelectorAll('img');
    this.categoryStats.images.total = images.length;
    
    images.forEach(img => {
      const selector = this.generateSelector(img);
      if (!selector) return;
      
      const alt = img.getAttribute('alt');
      
      // Check if alt is missing or empty (unless decorative)
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
        // Empty alt without role="presentation" or aria-hidden
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

  /**
   * WCAG 1.3.1 / 3.3.2 - Labels for Form Controls
   * Detect inputs without associated labels
   */
  checkFormLabels() {
    const formControls = document.querySelectorAll('input, select, textarea');
    let checkedControls = 0;
    
    formControls.forEach(control => {
      const selector = this.generateSelector(control);
      if (!selector) return;
      
      // Skip hidden inputs and submit buttons
      const type = control.getAttribute('type');
      if (type === 'hidden' || type === 'submit' || type === 'button') return;
      
      checkedControls++;
      
      // Check for aria-label
      if (control.hasAttribute('aria-label') && control.getAttribute('aria-label').trim() !== '') {
        return;
      }
      
      // Check for aria-labelledby
      if (control.hasAttribute('aria-labelledby'))return;
      
      // Check if wrapped in label
      const parentLabel = control.closest('label');
      if (parentLabel) return;
      
      // Check for associated label via for attribute
      const id = control.id;
      if (id) {
        const associatedLabel = document.querySelector(`label[for="${id}"]`);
        if (associatedLabel) return;
      }
      
      // No label found
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

  /**
   * WCAG 2.5.8 - Touch Target Size
   * Find clickable elements smaller than 24x24px
   */
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

  /**
   * WCAG 2.4.4 - Link Purpose
   * Find empty links without text or aria-label
   */
  checkEmptyLinks() {
    const links = document.querySelectorAll('a');
    let checkedLinks = 0;
    
    links.forEach(link => {
      const selector = this.generateSelector(link);
      if (!selector) return;
      
      // Skip anchor links
      if (!link.hasAttribute('href') || link.getAttribute('href') === '#') return;
      
      checkedLinks++;
      
      // Check for aria-label
      if (link.hasAttribute('aria-label') && link.getAttribute('aria-label').trim() !== '') {
        return;
      }
      
      // Check for text content
      const text = link.textContent.trim();
      if (text !== '') return;
      
      // Check if contains image with alt
      const img = link.querySelector('img');
      if (img && img.hasAttribute('alt') && img.getAttribute('alt').trim() !== '') {
        return;
      }
      
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

  /**
   * WCAG 2.4.2 - Page Title
   * Check for missing or empty page title
   */
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

  /**
   * Calculate deterministic score based on category ratios
   * Uses category-based caps to prevent score from dropping to 0 on large pages
   */
  calculateScore() {
    let totalDeduction = 0;
    
    // Calculate deduction for each category based on error ratio
    for (const [category, stats] of Object.entries(this.categoryStats)) {
      if (stats.total === 0) continue;
      
      const errorRatio = stats.errors / stats.total;
      const categoryDeduction = Math.min(errorRatio * stats.maxPenalty, stats.maxPenalty);
      totalDeduction += categoryDeduction;
    }
    
    this.score = Math.max(0, Math.round(100 - totalDeduction));
    return this.score;
  }

  /**
   * Run all deterministic checks
   */
  runAllChecks() {
    this.findings = [];
    this.score = 100;
    
    // Reset category stats
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
    
    // Limit findings to first 30 to prevent DOM bloat
    const limitedFindings = this.findings.slice(0, 30);
    
    return {
      findings: limitedFindings,
      totalFindings: this.findings.length,
      score: this.score,
      categoryStats: this.categoryStats
    };
  }
}

// Export for use in content script
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DeterministicEngine;
}
