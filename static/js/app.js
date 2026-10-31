/**
 * CodeBuddy AI — Frontend Application Logic
 * Supports Google Gemma 4 AI integration, code generation, logic explanation,
 * bug debugging, code optimization, test case creation, and interactive
 * conversational follow-up chat with history.
 */

document.addEventListener('DOMContentLoaded', () => {
    // ==========================================
    // State Management
    // ==========================================
    const state = {
        activeView: 'landing',
        activeLanguage: 'python',
        activeMode: 'explain',
        isAnalyzing: false,
        isChatting: false,
        sampleCodes: {},
        history: [],
        chatHistory: [],
        lastAnalyzedCode: '',
        lastAnalyzedLang: 'python'
    };

    // ==========================================
    // DOM Elements Cache
    // ==========================================
    const elements = {
        // Nav & Views
        views: {
            landing: document.getElementById('view-landing'),
            studio: document.getElementById('view-studio'),
            about: document.getElementById('view-about')
        },
        navBtns: document.querySelectorAll('.nav-btn'),
        brandLogo: document.getElementById('brand-logo'),
        btnQuickStudio: document.getElementById('btn-quick-studio'),
        btnHeroLaunch: document.getElementById('btn-hero-launch'),
        btnHeroSample: document.getElementById('btn-hero-sample'),
        aiStatusIndicator: document.getElementById('ai-status-indicator'),
        aiStatusText: document.getElementById('ai-status-text'),

        // Sidebar & Controls
        languageSelect: document.getElementById('language-select'),
        activeModeBadge: document.getElementById('active-mode-badge'),
        modeBtns: document.querySelectorAll('.mode-btn'),
        btnLoadSample: document.getElementById('btn-load-sample'),
        historyContainer: document.getElementById('history-items-container'),
        historyCountBadge: document.getElementById('history-count-badge'),
        btnClearHistory: document.getElementById('btn-clear-history'),

        // Editor
        editor: document.getElementById('code-editor'),
        lineNumbers: document.getElementById('editor-line-numbers'),
        charCounter: document.getElementById('char-counter'),
        lineCounter: document.getElementById('line-counter'),
        editorLangIndicator: document.getElementById('editor-lang-indicator'),
        editorPaneLabel: document.getElementById('editor-pane-label'),
        btnCopyInput: document.getElementById('btn-copy-input'),
        btnClearInput: document.getElementById('btn-clear-input'),
        btnAnalyze: document.getElementById('btn-analyze-code'),
        btnAnalyzeText: document.getElementById('btn-analyze-text'),

        // Results
        resultsModeIndicator: document.getElementById('results-mode-indicator'),
        resultsDemoBadge: document.getElementById('results-demo-badge'),
        emptyState: document.getElementById('results-empty-state'),
        loadingState: document.getElementById('results-loading-state'),
        loadingTitle: document.getElementById('loading-title'),
        loadingSubtitle: document.getElementById('loading-subtitle'),
        resultsContent: document.getElementById('results-content-area'),
        resultsContainer: document.getElementById('results-container'),
        toastContainer: document.getElementById('toast-container'),

        // Follow-up Chat Elements
        followupChatSection: document.getElementById('followup-chat-section'),
        chatMessagesContainer: document.getElementById('chat-messages-container'),
        chatForm: document.getElementById('chat-form'),
        chatInput: document.getElementById('chat-input'),
        btnChatSend: document.getElementById('btn-chat-send'),
        btnClearChat: document.getElementById('btn-clear-chat')
    };

    // ==========================================
    // Initialization
    // ==========================================
    initApp();

    async function initApp() {
        bindEvents();
        updateLineNumbers();
        loadHistoryFromStorage();
        await fetchInitialData();
    }

    async function fetchInitialData() {
        try {
            // 1. Fetch Health & Engine Status
            const healthRes = await fetch('/api/health');
            if (healthRes.ok) {
                const health = await healthRes.json();
                if (health.is_live_ai) {
                    elements.aiStatusIndicator.className = 'status-indicator-pill live';
                    elements.aiStatusText.textContent = `Live ${health.provider || 'AI'}`;
                } else {
                    elements.aiStatusIndicator.className = 'status-indicator-pill demo';
                    elements.aiStatusText.textContent = 'Gemma 4 Demo';
                }
            }

            // 2. Fetch Sample Snippets
            const sampleRes = await fetch('/api/samples');
            if (sampleRes.ok) {
                const data = await sampleRes.json();
                state.sampleCodes = data.samples || {};
            }
        } catch (err) {
            console.warn('Backend initial fetch failed, using fallback mode:', err);
        }
    }

    // ==========================================
    // Event Bindings
    // ==========================================
    function bindEvents() {
        // Navigation Switcher
        elements.navBtns.forEach(btn => {
            btn.addEventListener('click', () => switchView(btn.dataset.view));
        });

        if (elements.brandLogo) {
            elements.brandLogo.addEventListener('click', () => switchView('landing'));
        }
        if (elements.btnQuickStudio) {
            elements.btnQuickStudio.addEventListener('click', () => switchView('studio'));
        }
        if (elements.btnHeroLaunch) {
            elements.btnHeroLaunch.addEventListener('click', () => switchView('studio'));
        }
        if (elements.btnHeroSample) {
            elements.btnHeroSample.addEventListener('click', () => {
                switchView('studio');
                setLanguage('python');
                loadSampleForCurrentLanguage();
            });
        }

        // Footer navigation links
        document.querySelectorAll('.footer-link-action').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                switchView(link.dataset.view);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        });

        // Feature cards click on landing page
        document.querySelectorAll('.feature-card').forEach(card => {
            card.addEventListener('click', () => {
                const targetMode = card.dataset.mode;
                if (targetMode) {
                    switchView('studio');
                    setMode(targetMode);
                } else if (card.id === 'card-history-feature') {
                    switchView('studio');
                }
            });
        });

        // Language Select
        elements.languageSelect.addEventListener('change', (e) => {
            setLanguage(e.target.value);
        });

        // Mode Buttons
        elements.modeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                setMode(btn.dataset.mode);
            });
        });

        // Load Sample Button
        elements.btnLoadSample.addEventListener('click', () => {
            loadSampleForCurrentLanguage();
        });

        // Clear History Button
        elements.btnClearHistory.addEventListener('click', clearHistory);

        // Follow-Up Chat Form Submit
        if (elements.chatForm) {
            elements.chatForm.addEventListener('submit', (e) => {
                e.preventDefault();
                sendChatMessage();
            });
        }

        // Reset Chat Button
        if (elements.btnClearChat) {
            elements.btnClearChat.addEventListener('click', resetChatHistory);
        }

        // Code Editor Input Events
        elements.editor.addEventListener('input', () => {
            updateLineNumbers();
            updateCounters();
        });

        elements.editor.addEventListener('scroll', () => {
            elements.lineNumbers.scrollTop = elements.editor.scrollTop;
        });

        // Tab key support & Ctrl+Enter shortcut in textarea
        elements.editor.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                e.preventDefault();
                const start = elements.editor.selectionStart;
                const end = elements.editor.selectionEnd;
                elements.editor.value = elements.editor.value.substring(0, start) + '    ' + elements.editor.value.substring(end);
                elements.editor.selectionStart = elements.editor.selectionEnd = start + 4;
                updateLineNumbers();
                updateCounters();
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                runAnalysis();
            }
        });

        // Editor Action Buttons
        elements.btnCopyInput.addEventListener('click', copyInputCode);
        elements.btnClearInput.addEventListener('click', clearInputCode);
        elements.btnAnalyze.addEventListener('click', runAnalysis);
    }

    // ==========================================
    // View & Mode Navigation
    // ==========================================
    function switchView(viewName) {
        if (!elements.views[viewName]) return;
        state.activeView = viewName;

        Object.keys(elements.views).forEach(name => {
            elements.views[name].classList.toggle('active', name === viewName);
        });

        elements.navBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === viewName);
        });

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function setLanguage(lang) {
        state.activeLanguage = lang;
        elements.languageSelect.value = lang;
        elements.editorLangIndicator.textContent = lang;
    }

    function setMode(mode) {
        state.activeMode = mode;
        elements.modeBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });

        const modeTitles = {
            generate: 'Generate Code',
            explain: 'Explain',
            bugs: 'Find Bugs',
            improve: 'Improve',
            tests: 'Test Cases',
            learn: 'Learn'
        };

        const title = modeTitles[mode] || mode;
        elements.activeModeBadge.textContent = title;
        elements.resultsModeIndicator.textContent = title;

        // Dynamic editor placeholders & button labels
        if (mode === 'generate') {
            if (elements.editorPaneLabel) elements.editorPaneLabel.textContent = "Problem Description / Prompt";
            elements.editor.placeholder = "Describe what you want to build in plain English...\n\nExample:\nWrite a function that calculates the factorial of a positive integer, including boundary checks for 0 and negative inputs.\n\nShortcut: Press Ctrl + Enter to generate!";
            elements.btnAnalyzeText.textContent = "Generate with Gemma";
        } else {
            if (elements.editorPaneLabel) elements.editorPaneLabel.textContent = "Code Input";
            elements.editor.placeholder = "Paste or type your code here... (or click 'Insert Sample' from the sidebar to test immediately)\n\nShortcut: Press Ctrl + Enter to analyze!";
            elements.btnAnalyzeText.textContent = "Analyze with Gemma";
        }
    }

    // ==========================================
    // Editor Utilities
    // ==========================================
    function updateLineNumbers() {
        const lines = elements.editor.value.split('\n');
        const count = lines.length;
        let lineNumbersHtml = '';
        for (let i = 1; i <= count; i++) {
            lineNumbersHtml += `${i}<br>`;
        }
        elements.lineNumbers.innerHTML = lineNumbersHtml;
    }

    function updateCounters() {
        const text = elements.editor.value;
        const charCount = text.length;
        const lineCount = text.split('\n').length;
        elements.charCounter.textContent = `${charCount} chars`;
        elements.lineCounter.textContent = `${lineCount} lines`;
    }

    function copyInputCode() {
        const code = elements.editor.value;
        if (!code) {
            showToast('Editor is empty', 'warning');
            return;
        }
        navigator.clipboard.writeText(code).then(() => {
            showToast('Copied to clipboard!', 'success');
        }).catch(() => {
            showToast('Failed to copy to clipboard', 'error');
        });
    }

    function clearInputCode() {
        elements.editor.value = '';
        updateLineNumbers();
        updateCounters();
        showToast('Editor cleared', 'info');
    }

    function loadSampleForCurrentLanguage() {
        if (state.activeMode === 'generate') {
            const generatePrompts = {
                python: "Write a function to check if a word or phrase is a palindrome, ignoring casing and punctuation.",
                javascript: "Create a function that debounces another function so it only runs after 300ms of user inactivity.",
                java: "Write a program that finds all prime numbers between 1 and 100 with step-by-step logic.",
                c: "Write a function that dynamically reverses an array of integers in-place.",
                cpp: "Create a Student class with name, score, and methods to calculate letter grades."
            };
            elements.editor.value = generatePrompts[state.activeLanguage] || generatePrompts.python;
            updateLineNumbers();
            updateCounters();
            showToast(`Loaded prompt sample for ${state.activeLanguage}!`, 'info');
            return;
        }

        const sample = state.sampleCodes[state.activeLanguage];
        if (sample && sample.code) {
            elements.editor.value = sample.code;
            updateLineNumbers();
            updateCounters();
            showToast(`Loaded sample: ${sample.title}`, 'info');
        } else {
            showToast(`No sample snippet available for ${state.activeLanguage}`, 'warning');
        }
    }

    // ==========================================
    // Code Analysis & Generation Execution
    // ==========================================
    async function runAnalysis() {
        if (state.isAnalyzing) return;

        const code = elements.editor.value.trim();
        if (!code) {
            showToast('Please type code or enter a prompt before running!', 'warning');
            elements.editor.focus();
            return;
        }

        if (code.length > 15000) {
            showToast('Input exceeds maximum limit of 15,000 characters.', 'error');
            return;
        }

        state.isAnalyzing = true;
        setLoadingState(true);

        try {
            const response = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: code,
                    language: state.activeLanguage,
                    mode: state.activeMode
                })
            });

            const data = await response.json();

            if (!response.ok || data.status !== 'success') {
                throw new Error(data.message || 'Analysis request failed.');
            }

            const analysisData = data.data;

            // Cache active code and language for follow-up chat context
            state.lastAnalyzedCode = code;
            state.lastAnalyzedLang = state.activeLanguage;

            // Render Results
            renderResults(analysisData);

            // Save to Session History
            saveAnalysisToHistory(code, state.activeLanguage, state.activeMode, analysisData);

            showToast('Analysis completed successfully!', 'success');

        } catch (error) {
            console.error('Analysis error:', error);
            showToast(error.message || 'An error occurred during analysis.', 'error');
            elements.emptyState.style.display = 'flex';
            elements.resultsContent.style.display = 'none';
            if (elements.followupChatSection) elements.followupChatSection.style.display = 'none';
        } finally {
            state.isAnalyzing = false;
            setLoadingState(false);
        }
    }

    function setLoadingState(isLoading) {
        if (isLoading) {
            elements.emptyState.style.display = 'none';
            elements.resultsContent.style.display = 'none';
            if (elements.followupChatSection) elements.followupChatSection.style.display = 'none';
            elements.loadingState.style.display = 'flex';
            elements.btnAnalyze.disabled = true;
            elements.btnAnalyzeText.textContent = 'Gemma is Thinking...';

            const messages = [
                { title: 'Reading Code & Context...', sub: 'Evaluating tokens, structures and syntax rules' },
                { title: 'Applying Gemma 4 Mentorship...', sub: 'Translating technical reasoning into beginner-accessible terms' },
                { title: 'Finalizing Explanations...', sub: 'Polishing formatting, code blocks, and guidance tips' }
            ];

            let msgIndex = 0;
            elements.loadingTitle.textContent = messages[0].title;
            elements.loadingSubtitle.textContent = messages[0].sub;

            const interval = setInterval(() => {
                if (!state.isAnalyzing) {
                    clearInterval(interval);
                    return;
                }
                msgIndex = (msgIndex + 1) % messages.length;
                elements.loadingTitle.textContent = messages[msgIndex].title;
                elements.loadingSubtitle.textContent = messages[msgIndex].sub;
            }, 1200);

        } else {
            elements.loadingState.style.display = 'none';
            elements.btnAnalyze.disabled = false;
            elements.btnAnalyzeText.textContent = state.activeMode === 'generate' ? 'Generate with Gemma' : 'Analyze with Gemma';
        }
    }

    // ==========================================
    // Results Renderers for Each Mode
    // ==========================================
    function renderResults(data) {
        elements.resultsContent.innerHTML = '';
        elements.resultsContent.style.display = 'flex';
        elements.emptyState.style.display = 'none';

        // Toggle Demo Badge
        if (data.is_demo) {
            elements.resultsDemoBadge.style.display = 'inline-flex';
            if (data.warning_message) {
                showToast(data.warning_message, 'warning', 6000);
            }
        } else {
            elements.resultsDemoBadge.style.display = 'none';
        }

        const mode = data.mode || state.activeMode;

        switch (mode) {
            case 'generate':
                renderGenerateView(data);
                break;
            case 'explain':
                renderExplainView(data);
                break;
            case 'bugs':
                renderBugsView(data);
                break;
            case 'improve':
                renderImproveView(data);
                break;
            case 'tests':
                renderTestsView(data);
                break;
            case 'learn':
                renderLearnView(data);
                break;
            default:
                renderGenericView(data);
        }

        // Show Follow-up Chat section
        if (elements.followupChatSection) {
            elements.followupChatSection.style.display = 'flex';
        }

        // Highlight newly rendered code snippets with Prism
        if (window.Prism) {
            Prism.highlightAllUnder(elements.resultsContent);
        }

        // Scroll top of results pane
        elements.resultsContainer.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // 0. Code Generation View
    function renderGenerateView(data) {
        let html = '';

        if (data.summary) {
            html += `
                <div class="result-card card-highlight">
                    <div class="card-heading"><i class="fa-solid fa-code-merge"></i> Generation Summary</div>
                    <p class="summary-text">${escapeHtml(data.summary)}</p>
                </div>
            `;
        }

        // Generated Code Block with Action Buttons
        if (data.generated_code) {
            const prismLang = getPrismLangClass(state.activeLanguage);
            html += `
                <div class="syntax-code-wrap">
                    <div class="code-block-header">
                        <span><i class="fa-solid fa-code"></i> Generated ${escapeHtml(state.activeLanguage)} Code</span>
                        <div style="display: flex; gap: 8px;">
                            <button class="btn btn-icon btn-sm btn-insert-editor" id="btn-insert-generated" title="Insert into Editor">
                                <i class="fa-solid fa-arrow-left"></i> Insert in Editor
                            </button>
                            <button class="btn btn-icon btn-sm" id="btn-copy-generated">
                                <i class="fa-regular fa-copy"></i> Copy Code
                            </button>
                        </div>
                    </div>
                    <pre><code class="language-${prismLang}">${escapeHtml(data.generated_code)}</code></pre>
                </div>
            `;
        }

        // How it works step-by-step
        if (Array.isArray(data.how_it_works) && data.how_it_works.length > 0) {
            html += `
                <div class="result-card">
                    <div class="card-heading"><i class="fa-solid fa-list-ol"></i> Step-by-Step Explanation</div>
                    <div class="steps-timeline">
                        ${data.how_it_works.map((step, idx) => `
                            <div class="step-item">
                                <div class="step-number">${idx + 1}</div>
                                <div class="step-text">${escapeHtml(step)}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        // Key Concepts Used
        if (Array.isArray(data.key_concepts_used) && data.key_concepts_used.length > 0) {
            html += `
                <div class="result-card">
                    <div class="card-heading"><i class="fa-solid fa-cubes"></i> Key Concepts Applied</div>
                    <div class="jargon-grid">
                        ${data.key_concepts_used.map(k => `
                            <div class="jargon-item">
                                <div class="jargon-term">${escapeHtml(k.concept)}</div>
                                <div class="jargon-meaning">${escapeHtml(k.explanation)}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        // Usage Example
        if (data.usage_example) {
            html += `
                <div class="result-card">
                    <div class="card-heading"><i class="fa-solid fa-terminal"></i> How to Run & Usage Example</div>
                    <div class="output-box">${escapeHtml(data.usage_example)}</div>
                </div>
            `;
        }

        // Beginner Tip
        if (data.beginner_tip) {
            html += `
                <div class="challenge-box">
                    <div class="challenge-title"><i class="fa-solid fa-lightbulb"></i> Next Step Tip</div>
                    <div class="challenge-desc">${escapeHtml(data.beginner_tip)}</div>
                </div>
            `;
        }

        elements.resultsContent.innerHTML = html;

        // Wire Copy & Insert buttons
        const btnCopyGen = document.getElementById('btn-copy-generated');
        if (btnCopyGen && data.generated_code) {
            btnCopyGen.addEventListener('click', () => {
                navigator.clipboard.writeText(data.generated_code).then(() => {
                    showToast('Generated code copied to clipboard!', 'success');
                });
            });
        }

        const btnInsertGen = document.getElementById('btn-insert-generated');
        if (btnInsertGen && data.generated_code) {
            btnInsertGen.addEventListener('click', () => {
                elements.editor.value = data.generated_code;
                updateLineNumbers();
                updateCounters();
                showToast('Inserted into editor! You can now edit, test, or explain it.', 'info');
            });
        }
    }

    // 1. Explain View
    function renderExplainView(data) {
        let html = '';

        if (data.summary) {
            html += `
                <div class="result-card card-highlight">
                    <div class="card-heading"><i class="fa-solid fa-compass"></i> What This Program Does</div>
                    <p class="summary-text">${escapeHtml(data.summary)}</p>
                </div>
            `;
        }

        if (Array.isArray(data.how_it_works) && data.how_it_works.length > 0) {
            html += `
                <div class="result-card">
                    <div class="card-heading"><i class="fa-solid fa-list-ol"></i> Step-by-Step Logic Flow</div>
                    <div class="steps-timeline">
                        ${data.how_it_works.map((step, idx) => `
                            <div class="step-item">
                                <div class="step-number">${idx + 1}</div>
                                <div class="step-text">${escapeHtml(step)}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        if (Array.isArray(data.components) && data.components.length > 0) {
            html += `
                <div class="result-card">
                    <div class="card-heading"><i class="fa-solid fa-cubes"></i> Key Variables & Functions</div>
                    <table class="components-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Type</th>
                                <th>Purpose in Code</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.components.map(c => `
                                <tr>
                                    <td><code>${escapeHtml(c.name || 'Component')}</code></td>
                                    <td>${escapeHtml(c.type || 'variable')}</td>
                                    <td>${escapeHtml(c.purpose || '')}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }

        if (data.expected_output) {
            html += `
                <div class="result-card">
                    <div class="card-heading"><i class="fa-solid fa-terminal"></i> Expected Output</div>
                    <div class="output-box">${escapeHtml(data.expected_output)}</div>
                </div>
            `;
        }

        if (Array.isArray(data.beginner_concepts) && data.beginner_concepts.length > 0) {
            html += `
                <div class="result-card">
                    <div class="card-heading"><i class="fa-solid fa-graduation-cap"></i> Concepts to Understand</div>
                    <div class="jargon-grid">
                        ${data.beginner_concepts.map(bc => `
                            <div class="jargon-item">
                                <div class="jargon-term">${escapeHtml(bc.concept)}</div>
                                <div class="jargon-meaning">${escapeHtml(bc.explanation)}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        if (data.encouragement) {
            html += `
                <div class="challenge-box">
                    <div class="challenge-title"><i class="fa-solid fa-heart"></i> Mentor Note</div>
                    <div class="challenge-desc">${escapeHtml(data.encouragement)}</div>
                </div>
            `;
        }

        elements.resultsContent.innerHTML = html;
    }

    // 2. Bugs View
    function renderBugsView(data) {
        let html = '';

        const status = data.status || 'clean';
        const statusMap = {
            clean: { class: 'clean', icon: 'fa-circle-check', text: 'Clean Code! No critical bugs detected.' },
            warnings_found: { class: 'warnings_found', icon: 'fa-triangle-exclamation', text: 'Potential Gotchas & Warnings Found' },
            errors_found: { class: 'errors_found', icon: 'fa-circle-xmark', text: 'Errors or Critical Pitfalls Identified' }
        };

        const curStatus = statusMap[status] || statusMap['warnings_found'];

        html += `
            <div class="bug-status-banner ${curStatus.class}">
                <i class="fa-solid ${curStatus.icon}"></i>
                <span>${curStatus.text}</span>
            </div>
        `;

        if (data.summary) {
            html += `
                <div class="result-card card-highlight">
                    <div class="card-heading"><i class="fa-solid fa-shield-halved"></i> Analysis Overview</div>
                    <p class="summary-text">${escapeHtml(data.summary)}</p>
                </div>
            `;
        }

        if (Array.isArray(data.issues) && data.issues.length > 0) {
            html += `<div class="issues-list">`;
            data.issues.forEach(issue => {
                const sev = (issue.severity || 'info').toLowerCase();
                const certainty = (issue.certainty || 'suspected').toLowerCase();
                const sevClass = `badge-${sev}`;
                const certClass = `badge-${certainty}`;

                html += `
                    <div class="issue-item ${sev}">
                        <div class="issue-header">
                            <div class="issue-badges">
                                <span class="badge-pill ${sevClass}">${escapeHtml(issue.type || 'Issue')}</span>
                                <span class="badge-pill ${certClass}">${certainty === 'verified' ? 'Verified Error' : 'Suspected Bug'}</span>
                            </div>
                            <span class="issue-loc">${escapeHtml(issue.line_reference || 'Code Context')}</span>
                        </div>
                        <div class="issue-problem">${escapeHtml(issue.problem || '')}</div>
                        ${issue.suggested_fix ? `
                            <div class="issue-fix">
                                <div class="issue-fix-label"><i class="fa-solid fa-wrench"></i> Recommended Fix:</div>
                                <code>${escapeHtml(issue.suggested_fix)}</code>
                            </div>
                        ` : ''}
                    </div>
                `;
            });
            html += `</div>`;
        } else {
            html += `
                <div class="result-card">
                    <div class="card-heading"><i class="fa-solid fa-thumbs-up"></i> Great Job!</div>
                    <p class="summary-text">Your code structure looks safe and does not display common beginner pitfalls.</p>
                </div>
            `;
        }

        if (data.prevention_tip) {
            html += `
                <div class="analogy-card">
                    <div class="analogy-title"><i class="fa-solid fa-lightbulb"></i> How to Prevent This in the Future</div>
                    <div class="analogy-text">${escapeHtml(data.prevention_tip)}</div>
                </div>
            `;
        }

        elements.resultsContent.innerHTML = html;
    }

    // 3. Improve / Optimize View
    function renderImproveView(data) {
        let html = '';

        if (data.summary) {
            html += `
                <div class="result-card card-highlight">
                    <div class="card-heading"><i class="fa-solid fa-wand-magic-sparkles"></i> Refactoring Overview</div>
                    <p class="summary-text">${escapeHtml(data.summary)}</p>
                </div>
            `;
        }

        if (data.improved_code) {
            const prismLang = getPrismLangClass(state.activeLanguage);
            html += `
                <div class="syntax-code-wrap">
                    <div class="code-block-header">
                        <span><i class="fa-solid fa-code"></i> Optimized & Clean Code (${escapeHtml(state.activeLanguage)})</span>
                        <button class="btn btn-icon btn-sm" id="btn-copy-improved">
                            <i class="fa-regular fa-copy"></i> Copy Corrected Code
                        </button>
                    </div>
                    <pre><code class="language-${prismLang}">${escapeHtml(data.improved_code)}</code></pre>
                </div>
            `;
        }

        if (Array.isArray(data.improvements_made) && data.improvements_made.length > 0) {
            html += `
                <div class="result-card">
                    <div class="card-heading"><i class="fa-solid fa-circle-check"></i> What Changed & Why</div>
                    <div class="steps-timeline">
                        ${data.improvements_made.map(item => `
                            <div class="step-item">
                                <div class="step-number"><i class="fa-solid fa-check"></i></div>
                                <div class="step-text">
                                    <strong>${escapeHtml(item.change)}:</strong> ${escapeHtml(item.benefit)}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        if (Array.isArray(data.best_practices_learned) && data.best_practices_learned.length > 0) {
            html += `
                <div class="result-card">
                    <div class="card-heading"><i class="fa-solid fa-bookmark"></i> Coding Best Practices</div>
                    <ul class="tech-list">
                        ${data.best_practices_learned.map(bp => `<li>${escapeHtml(bp)}</li>`).join('')}
                    </ul>
                </div>
            `;
        }

        if (data.disclaimer) {
            html += `<p class="text-muted text-sm mt-2"><i class="fa-solid fa-info-circle"></i> ${escapeHtml(data.disclaimer)}</p>`;
        }

        elements.resultsContent.innerHTML = html;

        const btnCopyImproved = document.getElementById('btn-copy-improved');
        if (btnCopyImproved && data.improved_code) {
            btnCopyImproved.addEventListener('click', () => {
                navigator.clipboard.writeText(data.improved_code).then(() => {
                    showToast('Corrected code copied to clipboard!', 'success');
                });
            });
        }
    }

    // 4. Tests View
    function renderTestsView(data) {
        let html = '';

        if (data.summary) {
            html += `
                <div class="result-card card-highlight">
                    <div class="card-heading"><i class="fa-solid fa-list-check"></i> Testing Strategy</div>
                    <p class="summary-text">${escapeHtml(data.summary)}</p>
                </div>
            `;
        }

        if (Array.isArray(data.test_cases) && data.test_cases.length > 0) {
            html += `
                <div class="test-cases-grid">
                    ${data.test_cases.map((tc, idx) => `
                        <div class="test-case-card">
                            <div class="test-header">
                                <span class="test-category-tag">
                                    <i class="fa-solid fa-vial"></i> Case #${idx + 1}: ${escapeHtml(tc.category || 'Test Case')}
                                </span>
                            </div>
                            <div class="test-row">
                                <span class="test-label">Input:</span>
                                <span class="test-val">${escapeHtml(tc.input || '')}</span>
                            </div>
                            <div class="test-row">
                                <span class="test-label">Expected:</span>
                                <span class="test-val">${escapeHtml(tc.expected_output || '')}</span>
                            </div>
                            <div class="test-rationale">
                                <strong>Why this matters:</strong> ${escapeHtml(tc.rationale || '')}
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        if (data.testing_tip) {
            html += `
                <div class="analogy-card mt-4">
                    <div class="analogy-title"><i class="fa-solid fa-lightbulb"></i> Pro Testing Tip</div>
                    <div class="analogy-text">${escapeHtml(data.testing_tip)}</div>
                </div>
            `;
        }

        elements.resultsContent.innerHTML = html;
    }

    // 5. Learn View
    function renderLearnView(data) {
        let html = '';

        if (data.primary_concept) {
            html += `
                <div class="learning-banner">
                    <h4><i class="fa-solid fa-graduation-cap"></i> ${escapeHtml(data.primary_concept)}</h4>
                    <p>${escapeHtml(data.plain_english_definition || '')}</p>
                </div>
            `;
        }

        if (data.real_world_analogy) {
            html += `
                <div class="analogy-card">
                    <div class="analogy-title"><i class="fa-solid fa-brain"></i> Real-World Metaphor</div>
                    <div class="analogy-text">"${escapeHtml(data.real_world_analogy)}"</div>
                </div>
            `;
        }

        if (Array.isArray(data.jargon_buster) && data.jargon_buster.length > 0) {
            html += `
                <div class="result-card">
                    <div class="card-heading"><i class="fa-solid fa-book"></i> Jargon Buster</div>
                    <div class="jargon-grid">
                        ${data.jargon_buster.map(item => `
                            <div class="jargon-item">
                                <div class="jargon-term">${escapeHtml(item.term)}</div>
                                <div class="jargon-meaning">${escapeHtml(item.simple_meaning)}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        if (data.mini_example) {
            const prismLang = getPrismLangClass(state.activeLanguage);
            html += `
                <div class="syntax-code-wrap">
                    <div class="code-block-header">
                        <span><i class="fa-solid fa-code"></i> Mini Concept Example</span>
                    </div>
                    <pre><code class="language-${prismLang}">${escapeHtml(data.mini_example)}</code></pre>
                </div>
            `;
        }

        if (Array.isArray(data.next_topics_to_explore) && data.next_topics_to_explore.length > 0) {
            html += `
                <div class="result-card">
                    <div class="card-heading"><i class="fa-solid fa-route"></i> What to Learn Next</div>
                    <ul class="tech-list">
                        ${data.next_topics_to_explore.map(topic => `<li>${escapeHtml(topic)}</li>`).join('')}
                    </ul>
                </div>
            `;
        }

        if (data.practice_challenge) {
            html += `
                <div class="challenge-box">
                    <div class="challenge-title"><i class="fa-solid fa-fire"></i> Mini Practice Challenge</div>
                    <div class="challenge-desc">${escapeHtml(data.practice_challenge)}</div>
                </div>
            `;
        }

        elements.resultsContent.innerHTML = html;
    }

    // Generic fallback view
    function renderGenericView(data) {
        elements.resultsContent.innerHTML = `
            <div class="result-card">
                <div class="card-heading"><i class="fa-solid fa-sparkles"></i> Analysis Result</div>
                <pre style="white-space: pre-wrap; font-family: var(--font-mono); font-size: 0.85rem;">${escapeHtml(JSON.stringify(data, null, 2))}</pre>
            </div>
        `;
    }

    // ==========================================
    // Interactive Follow-up Chat System
    // ==========================================
    async function sendChatMessage() {
        if (!elements.chatInput || state.isChatting) return;

        const message = elements.chatInput.value.trim();
        if (!message) return;

        // Append user bubble to UI
        appendChatBubble('user', message);
        state.chatHistory.push({ role: 'user', content: message });
        elements.chatInput.value = '';

        state.isChatting = true;
        elements.btnChatSend.disabled = true;

        // Append placeholder thinking bubble
        const thinkingId = 'chat-thinking-' + Date.now();
        const thinkingHtml = `
            <div class="chat-bubble model" id="${thinkingId}">
                <div class="chat-bubble-author"><i class="fa-brands fa-google"></i> Gemma 4 Mentor</div>
                <div class="text-muted"><i class="fa-solid fa-circle-notch fa-spin"></i> Thinking...</div>
            </div>
        `;
        elements.chatMessagesContainer.insertAdjacentHTML('beforeend', thinkingHtml);
        elements.chatMessagesContainer.scrollTop = elements.chatMessagesContainer.scrollHeight;

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: message,
                    code: state.lastAnalyzedCode || elements.editor.value,
                    language: state.lastAnalyzedLang || state.activeLanguage,
                    history: state.chatHistory.slice(-8) // Send up to last 8 turns
                })
            });

            const data = await res.json();
            const thinkingEl = document.getElementById(thinkingId);
            if (thinkingEl) thinkingEl.remove();

            if (!res.ok || data.status !== 'success') {
                throw new Error(data.message || 'Chat request failed.');
            }

            const reply = data.data.reply;
            state.chatHistory.push({ role: 'model', content: reply });
            appendChatBubble('model', reply);

        } catch (err) {
            console.error('Chat error:', err);
            const thinkingEl = document.getElementById(thinkingId);
            if (thinkingEl) thinkingEl.remove();
            appendChatBubble('model', "I had trouble generating an answer. Please check your connection or API key and try again.");
            showToast(err.message || 'Error sending chat message', 'error');
        } finally {
            state.isChatting = false;
            elements.btnChatSend.disabled = false;
            elements.chatMessagesContainer.scrollTop = elements.chatMessagesContainer.scrollHeight;
        }
    }

    function appendChatBubble(role, text) {
        if (!elements.chatMessagesContainer) return;
        const author = role === 'user' ? 'You' : '<i class="fa-brands fa-google"></i> Gemma 4 Mentor';
        const bubble = document.createElement('div');
        bubble.className = `chat-bubble ${role}`;
        bubble.innerHTML = `
            <div class="chat-bubble-author">${author}</div>
            <div class="chat-bubble-text">${formatChatMarkdown(text)}</div>
        `;
        elements.chatMessagesContainer.appendChild(bubble);
        elements.chatMessagesContainer.scrollTop = elements.chatMessagesContainer.scrollHeight;
    }

    function resetChatHistory() {
        state.chatHistory = [];
        if (elements.chatMessagesContainer) {
            elements.chatMessagesContainer.innerHTML = `
                <div class="chat-intro-msg">
                    <i class="fa-solid fa-graduation-cap"></i>
                    <span>Chat history reset! Ask any new question about your code snippet.</span>
                </div>
            `;
        }
        showToast('Chat history cleared', 'info');
    }

    function formatChatMarkdown(text) {
        // Escape HTML
        let escaped = escapeHtml(text);
        // Simple inline code backticks
        escaped = escaped.replace(/`([^`]+)`/g, '<code style="background: rgba(0,0,0,0.3); padding: 2px 5px; border-radius: 4px; color: var(--accent-cyan);">$1</code>');
        // Simple bold
        escaped = escaped.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        // Linebreaks
        escaped = escaped.replace(/\n/g, '<br>');
        return escaped;
    }

    // ==========================================
    // Session History Management
    // ==========================================
    function saveAnalysisToHistory(code, language, mode, resultData) {
        const item = {
            id: 'hist_' + Date.now(),
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            language: language,
            mode: mode,
            codePreview: code.split('\n')[0].substring(0, 32) || 'Code snippet',
            fullCode: code,
            resultData: resultData
        };

        state.history.unshift(item);
        if (state.history.length > 15) {
            state.history.pop();
        }

        try {
            localStorage.setItem('codebuddy_history', JSON.stringify(state.history));
        } catch (e) {
            console.warn('LocalStorage save failed:', e);
        }

        renderHistoryItems();
    }

    function loadHistoryFromStorage() {
        try {
            const stored = localStorage.getItem('codebuddy_history');
            if (stored) {
                state.history = JSON.parse(stored);
            }
        } catch (e) {
            state.history = [];
        }
        renderHistoryItems();
    }

    function renderHistoryItems() {
        elements.historyCountBadge.textContent = `${state.history.length} items`;

        if (state.history.length === 0) {
            elements.historyContainer.innerHTML = '<div class="history-empty">No analyses yet in this session.</div>';
            return;
        }

        elements.historyContainer.innerHTML = state.history.map(item => `
            <div class="history-item" data-id="${item.id}">
                <div class="history-item-left">
                    <span class="history-mode-tag">${escapeHtml(item.mode.toUpperCase())} • ${escapeHtml(item.language)}</span>
                    <span class="history-code-preview">${escapeHtml(item.codePreview)}</span>
                </div>
                <span class="history-time">${escapeHtml(item.time)}</span>
            </div>
        `).join('');

        elements.historyContainer.querySelectorAll('.history-item').forEach(el => {
            el.addEventListener('click', () => {
                const id = el.dataset.id;
                const found = state.history.find(h => h.id === id);
                if (found) {
                    elements.editor.value = found.fullCode;
                    setLanguage(found.language);
                    setMode(found.mode);
                    updateLineNumbers();
                    updateCounters();
                    renderResults(found.resultData);
                    showToast('Restored previous analysis from history!', 'info');
                }
            });
        });
    }

    function clearHistory() {
        state.history = [];
        try {
            localStorage.removeItem('codebuddy_history');
        } catch (e) {}
        renderHistoryItems();
        showToast('Session history cleared', 'info');
    }

    // ==========================================
    // Toast Notification System
    // ==========================================
    function showToast(message, type = 'info', duration = 3500) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const icons = {
            success: 'fa-circle-check',
            error: 'fa-circle-exclamation',
            warning: 'fa-triangle-exclamation',
            info: 'fa-circle-info'
        };

        const iconClass = icons[type] || icons.info;

        toast.innerHTML = `
            <i class="fa-solid ${iconClass} toast-icon"></i>
            <span class="toast-msg">${escapeHtml(message)}</span>
        `;

        elements.toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'toastFadeOut 0.25s forwards';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 250);
        }, duration);
    }

    function getPrismLangClass(lang) {
        const map = {
            python: 'python',
            javascript: 'javascript',
            java: 'java',
            c: 'c',
            cpp: 'cpp'
        };
        return map[lang] || 'clike';
    }

    function escapeHtml(str) {
        if (!str && str !== 0) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
});
