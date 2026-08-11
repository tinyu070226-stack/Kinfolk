document.addEventListener('DOMContentLoaded', () => {
    const canvasCtrl = new CanvasController('drawingCanvas');
    const syncCtrl = new SyncController();
    
    let currentNoteId = null;

    // Register Service Worker
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('sw.js').then(reg => {
                console.log('ServiceWorker registered:', reg);
                // Check for updates on load
                reg.update();
            }).catch(err => console.log('SW registration failed:', err));
        });
    }

    // Auto Sync on Launch / Visibility Change
    async function performAutoSync() {
        if (!syncCtrl.token) return;
        const result = await syncCtrl.pullLatest();
        if (result.status === 'success' && result.count > 0) {
            showToast('已同步至最新進度 (Synced to Latest)');
            renderHomeLists();
            if (currentNoteId) {
                // Refresh current note without losing unsaved canvas if we have conflict resolution?
                // For simplicity, just reload the view if not modifying actively
                showEditorView(currentNoteId); 
            }
        }
    }

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.ready.then(reg => reg.update());
            }
            performAutoSync();
        }
    });

    window.addEventListener('focus', () => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then(reg => reg.update());
        }
        performAutoSync();
    });

    // Toast Helper
    function showToast(message) {
        const toast = document.getElementById('toast-container');
        if (toast) {
            toast.innerText = message;
            toast.style.display = 'block';
            setTimeout(() => {
                toast.style.display = 'none';
            }, 3000);
        }
    }

    // Trigger initial sync
    performAutoSync();

    // UI Elements
    const body = document.body;
    const homeView = document.getElementById('homeView');
    const editorView = document.getElementById('editorView');
    const textOverlay = document.getElementById('textOverlay');
    const paperElement = document.getElementById('paper');
    const drawingCanvas = document.getElementById('drawingCanvas');
    const paperContainer = document.getElementById('paperContainer');
    
    // View Switchers
    function showHomeView() {
        homeView.classList.add('active');
        editorView.classList.remove('active');
        renderHomeLists();
    }
    
    function showEditorView(noteId) {
        homeView.classList.remove('active');
        editorView.classList.add('active');
        currentNoteId = noteId;
        
        // Load note data
        const notes = syncCtrl.getAllLocalNotes();
        const note = notes.find(n => n.id === noteId);
        
        if (note) {
            document.getElementById('editor-note-title').value = note.title || 'Untitled Note';
            textOverlay.innerHTML = note.text || '';
            // Restore paper height based on content
            paperElement.style.height = (note.paperHeight || 1130) + 'px';
            // Need to resize canvas after layout update
            setTimeout(() => {
                canvasCtrl.resize();
                canvasCtrl.loadExportData(note.canvasData);
            }, 50);
        } else {
            document.getElementById('editor-note-title').value = 'Untitled Note';
            textOverlay.innerHTML = '';
            paperElement.style.height = '1130px';
            setTimeout(() => {
                canvasCtrl.resize();
                canvasCtrl.clear();
            }, 50);
        }
        
        renderDrawerList();
    }

    document.getElementById('btn-back-home').addEventListener('click', () => {
        saveCurrentNote();
        showHomeView();
    });

    document.getElementById('btn-create-new').addEventListener('click', () => {
        showEditorView(Date.now().toString());
    });

    // Drawer Toggle
    const drawer = document.getElementById('editor-drawer');
    document.getElementById('drawerToggleBtn').addEventListener('click', () => {
        drawer.classList.toggle('open');
    });

    // Tools
    document.querySelectorAll('.dock-btn[data-tool]').forEach(btn => {
        const selectTool = (e) => {
            document.querySelectorAll('.dock-btn[data-tool]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const tool = btn.dataset.tool;
            body.setAttribute('data-mode', tool);
            
            if (tool === 'type') {
                canvasCtrl.mode = 'select';
                paperElement.style.touchAction = 'auto';
                drawingCanvas.style.touchAction = 'auto';
                paperContainer.style.touchAction = 'auto';
                
                textOverlay.focus();
                const range = document.createRange();
                const sel = window.getSelection();
                range.selectNodeContents(textOverlay);
                range.collapse(false);
                sel.removeAllRanges();
                sel.addRange(range);
            } else if (tool === 'draw') {
                canvasCtrl.mode = 'draw';
                canvasCtrl.brush = btn.dataset.brush;
                paperElement.style.touchAction = 'none';
                drawingCanvas.style.touchAction = 'none';
                paperContainer.style.touchAction = 'none';
                
                document.getElementById('shape-select-group').style.display = 'none';
                document.getElementById('fill-color-group').style.display = 'none';
                shapeInspector.classList.add('active');
            } else if (tool === 'erase') {
                canvasCtrl.mode = 'erase';
                paperElement.style.touchAction = 'none';
                drawingCanvas.style.touchAction = 'none';
                paperContainer.style.touchAction = 'none';
            } else if (tool === 'shape') {
                canvasCtrl.mode = 'shape';
                paperElement.style.touchAction = 'none';
                drawingCanvas.style.touchAction = 'none';
                paperContainer.style.touchAction = 'none';
                
                document.getElementById('shape-select-group').style.display = 'flex';
                document.getElementById('fill-color-group').style.display = 'flex';
                shapeInspector.classList.add('active');
            } else {
                canvasCtrl.mode = 'select';
                paperElement.style.touchAction = 'auto';
                drawingCanvas.style.touchAction = 'auto';
                paperContainer.style.touchAction = 'auto';
            }
        };
        btn.addEventListener('click', selectTool);
        btn.addEventListener('pointerdown', (e) => {
            if (btn.dataset.tool === 'type') {
                selectTool(e);
            }
        });
    });

    // Shape Inspector Popover
    const shapePopoverBtn = document.getElementById('btn-shape-popover');
    const shapeInspector = document.getElementById('shape-inspector');
    
    shapePopoverBtn.addEventListener('click', (e) => {
        shapeInspector.classList.toggle('active');
    });
    
    // Close inspector when clicking outside
    document.addEventListener('click', (e) => {
        if (!shapeInspector.contains(e.target) && !shapePopoverBtn.contains(e.target)) {
            shapeInspector.classList.remove('active');
        }
    });

    // Inspector Events
    document.getElementById('stroke-color').addEventListener('input', e => canvasCtrl.strokeColor = e.target.value);
    document.getElementById('fill-color').addEventListener('input', e => canvasCtrl.fillColor = e.target.value);
    document.getElementById('stroke-width').addEventListener('input', e => canvasCtrl.strokeWidth = parseInt(e.target.value));
    document.getElementById('shape-type').addEventListener('change', e => canvasCtrl.shapeType = e.target.value);

    // Color Swatches
    document.querySelectorAll('.swatch').forEach(swatch => {
        swatch.addEventListener('click', (e) => {
            const color = e.target.dataset.color;
            canvasCtrl.strokeColor = color;
            document.getElementById('stroke-color').value = color;
        });
    });

    // Multi-page Auto Expand
    function expandPaper() {
        const currentHeight = paperElement.offsetHeight;
        const newHeight = currentHeight + 1130;
        paperElement.style.height = newHeight + 'px';
        
        // Add page divider
        const divider = document.createElement('div');
        divider.style.position = 'absolute';
        divider.style.top = currentHeight + 'px';
        divider.style.left = '0';
        divider.style.width = '100%';
        divider.style.borderTop = '1px dashed var(--accent-color)';
        divider.style.opacity = '0.5';
        divider.style.pointerEvents = 'none';
        divider.style.zIndex = '20';
        
        const label = document.createElement('span');
        label.innerText = `Page ${Math.floor(newHeight / 1130)}`;
        label.style.position = 'absolute';
        label.style.top = '-10px';
        label.style.right = '20px';
        label.style.background = '#FFF';
        label.style.padding = '0 10px';
        label.style.color = 'var(--accent-color)';
        label.style.fontSize = '12px';
        label.style.fontFamily = "'Noto Serif JP', serif";
        
        divider.appendChild(label);
        paperElement.appendChild(divider);

        setTimeout(() => {
            canvasCtrl.resize();
        }, 50); // allow layout to update
    }

    document.getElementById('add-page-btn').addEventListener('click', expandPaper);

    textOverlay.addEventListener('input', () => {
        if (textOverlay.scrollHeight > paperElement.offsetHeight - 80) {
            expandPaper();
        }
    });

    // Side Inspectors Toggle
    const leftInspector = document.getElementById('left-inspector');
    const rightInspector = document.getElementById('right-inspector');
    const toggleLeft = document.getElementById('toggle-left-inspector');
    const toggleRight = document.getElementById('toggle-right-inspector');
    
    if (toggleLeft && leftInspector) {
        toggleLeft.addEventListener('click', () => {
            leftInspector.classList.toggle('open');
            toggleLeft.classList.toggle('open');
            
            if (leftInspector.classList.contains('open')) {
                const rect = toggleLeft.getBoundingClientRect();
                leftInspector.style.left = (rect.right + 10) + 'px';
                leftInspector.style.top = (rect.top) + 'px';
            }
        });
    }

    let selectionChangeRaf = null;
    document.addEventListener('selectionchange', () => {
        if (!leftInspector || !leftInspector.classList.contains('open') || body.getAttribute('data-mode') !== 'type') return;
        
        if (selectionChangeRaf) cancelAnimationFrame(selectionChangeRaf);
        
        selectionChangeRaf = requestAnimationFrame(() => {
            const selection = window.getSelection();
            if (selection.rangeCount > 0 && !selection.isCollapsed) {
                const range = selection.getRangeAt(0);
                const rect = range.getBoundingClientRect();
                
                leftInspector.style.left = Math.max(10, rect.left + rect.width / 2 - 130) + 'px';
                leftInspector.style.top = Math.max(10, rect.top - leftInspector.offsetHeight - 10) + 'px';
            }
        });
    });
    if (toggleRight && rightInspector) {
        toggleRight.addEventListener('click', () => {
            rightInspector.classList.toggle('open');
            toggleRight.classList.toggle('open');
        });
    }

    // Typography Controls
    const fontSelect = document.getElementById('typo-font');
    const sizeSlider = document.getElementById('typo-size');
    const lineHeightSlider = document.getElementById('typo-lineheight');
    const alignSelect = document.getElementById('typo-align');
    const typoColor = document.getElementById('typo-color');

    if (fontSelect) fontSelect.addEventListener('change', e => textOverlay.style.fontFamily = e.target.value);
    if (sizeSlider) sizeSlider.addEventListener('input', e => textOverlay.style.fontSize = e.target.value + 'px');
    if (lineHeightSlider) lineHeightSlider.addEventListener('input', e => textOverlay.style.lineHeight = e.target.value);
    if (alignSelect) alignSelect.addEventListener('change', e => textOverlay.style.textAlign = e.target.value);
    if (typoColor) typoColor.addEventListener('input', e => textOverlay.style.color = e.target.value);
    
    // Brush Controls
    const brushWidth = document.getElementById('brush-width');
    if (brushWidth) brushWidth.addEventListener('input', e => canvasCtrl.strokeWidth = parseInt(e.target.value));


    // Mobile Visual Viewport for Keyboard Adaptability
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', () => {
            const h = window.visualViewport.height;
            document.body.style.height = `${h}px`;
            
            // Adjust dock so it's not hidden
            const bottomDock = document.getElementById('bottom-dock');
            bottomDock.style.bottom = `${window.innerHeight - h + 24}px`;
        });
        window.visualViewport.addEventListener('scroll', () => {
            const bottomDock = document.getElementById('bottom-dock');
            bottomDock.style.transform = `translate(-50%, ${window.visualViewport.offsetTop}px)`;
        });
    }

    // Actions
    document.getElementById('btn-undo').addEventListener('click', () => canvasCtrl.undo());
    document.getElementById('btn-redo').addEventListener('click', () => canvasCtrl.redo());

    // File Insert
    document.getElementById('btn-insert-image').addEventListener('click', () => {
        document.getElementById('file-insert').click();
    });
    document.getElementById('file-insert').addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            canvasCtrl.insertImage(e.target.files[0]);
        }
    });

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
        if (e.metaKey || e.ctrlKey) {
            if (e.key === 'z') {
                e.preventDefault();
                if (e.shiftKey) canvasCtrl.redo();
                else canvasCtrl.undo();
            } else if (e.key === 's') {
                e.preventDefault();
                saveCurrentNote();
            }
        }
    });
    
    // Manual Sync Button
    document.getElementById('btn-manual-sync').addEventListener('click', async () => {
        const dot = document.getElementById('status-dot');
        const txt = document.getElementById('status-text');
        
        if (dot && txt) {
            dot.className = 'status-dot syncing';
            txt.innerText = 'Syncing...';
        }

        const result = await syncCtrl.pullLatest();
        if (result.status === 'success') {
            if (dot && txt) {
                dot.className = 'status-dot success';
                txt.innerText = 'Synced';
            }
            showToast('已同步至最新進度 (Synced to Latest)');
            renderHomeLists();
            if (currentNoteId) showEditorView(currentNoteId);
        } else {
            if (dot && txt) {
                dot.className = 'status-dot error';
                txt.innerText = 'Sync Error';
            }
            showToast('Sync Failed');
        }
    });

    // Modals
    const syncModal = document.getElementById('sync-modal');
    document.getElementById('btn-settings').addEventListener('click', () => {
        document.getElementById('gh-token').value = syncCtrl.token || '';
        document.getElementById('gh-repo').value = syncCtrl.repo || '';
        document.getElementById('gh-branch').value = syncCtrl.branch || 'main';
        syncModal.classList.add('active');
    });
    const homeSettingsBtn = document.getElementById('btn-home-settings');
    if (homeSettingsBtn) {
        homeSettingsBtn.addEventListener('click', () => {
            document.getElementById('gh-token').value = syncCtrl.token || '';
            document.getElementById('gh-repo').value = syncCtrl.repo || '';
            document.getElementById('gh-branch').value = syncCtrl.branch || 'main';
            syncModal.classList.add('active');
        });
    }
    document.getElementById('btn-sync-cancel').addEventListener('click', () => syncModal.classList.remove('active'));
    document.getElementById('btn-sync-save').addEventListener('click', () => {
        syncCtrl.setCredentials(
            document.getElementById('gh-token').value,
            document.getElementById('gh-repo').value,
            document.getElementById('gh-branch').value
        );
        syncModal.classList.remove('active');
        saveCurrentNote();
    });
    
    document.getElementById('btn-sync-force-pull').addEventListener('click', async () => {
        syncCtrl.setCredentials(
            document.getElementById('gh-token').value,
            document.getElementById('gh-repo').value,
            document.getElementById('gh-branch').value
        );
        const result = await syncCtrl.pullLatest();
        if (result.status === 'success') {
            showToast('已同步至最新進度 (Synced to Latest)');
            renderHomeLists();
            if (currentNoteId) showEditorView(currentNoteId);
        } else {
            showToast('Sync Failed');
        }
        syncModal.classList.remove('active');
    });

    const exportModal = document.getElementById('export-modal');
    document.getElementById('btn-export').addEventListener('click', () => exportModal.classList.add('active'));
    document.getElementById('btn-export-cancel').addEventListener('click', () => exportModal.classList.remove('active'));
    
    document.getElementById('btn-export-png').addEventListener('click', () => {
        const title = document.getElementById('editor-note-title').value || 'note';
        const includeGrid = document.getElementById('export-include-grid') ? document.getElementById('export-include-grid').checked : true;
        ExportController.exportPNG(paperElement, title, includeGrid);
        exportModal.classList.remove('active');
    });
    document.getElementById('btn-export-jpg').addEventListener('click', () => {
        const title = document.getElementById('editor-note-title').value || 'note';
        const includeGrid = document.getElementById('export-include-grid') ? document.getElementById('export-include-grid').checked : true;
        ExportController.exportJPG(paperElement, title, includeGrid);
        exportModal.classList.remove('active');
    });
    document.getElementById('btn-export-pdf').addEventListener('click', () => {
        const title = document.getElementById('editor-note-title').value || 'note';
        const includeGrid = document.getElementById('export-include-grid') ? document.getElementById('export-include-grid').checked : true;
        ExportController.exportPDF(paperElement, title, includeGrid);
        exportModal.classList.remove('active');
    });
    document.getElementById('btn-export-docx').addEventListener('click', () => {
        const title = document.getElementById('editor-note-title').value || 'note';
        const includeGrid = document.getElementById('export-include-grid') ? document.getElementById('export-include-grid').checked : true;
        ExportController.exportDOCX(paperElement, title, includeGrid);
        exportModal.classList.remove('active');
    });

    // Note Management
    async function saveCurrentNote() {
        if (!currentNoteId) return;

        const dot = document.getElementById('status-dot');
        const txt = document.getElementById('status-text');
        
        if (dot && txt) {
            dot.className = 'status-dot syncing';
            txt.innerText = 'Syncing...';
        }

        const title = document.getElementById('editor-note-title').value;
        const notes = syncCtrl.getAllLocalNotes();
        const existingNote = notes.find(n => n.id === currentNoteId);

        const payload = {
            id: currentNoteId,
            title: title || 'Untitled Note',
            text: textOverlay.innerHTML,
            paperHeight: paperElement.offsetHeight,
            canvasData: canvasCtrl.getExportData(),
            updatedAt: Date.now(),
            isCompleted: existingNote ? existingNote.isCompleted : false
        };

        const result = await syncCtrl.syncNote(currentNoteId, payload);
        
        if (dot && txt) {
            if (result.status === 'success') {
                dot.className = 'status-dot success';
                txt.innerText = 'Synced';
            } else if (result.status === 'error') {
                dot.className = 'status-dot error';
                txt.innerText = 'Sync Error (Saved Local)';
            } else {
                dot.className = 'status-dot';
                txt.innerText = 'Saved Offline';
            }
        }
    }

    function toggleNoteCompletion(noteId) {
        const notes = syncCtrl.getAllLocalNotes();
        const note = notes.find(n => n.id === noteId);
        if (note) {
            note.isCompleted = !note.isCompleted;
            syncCtrl.saveLocal(noteId, note);
            renderHomeLists();
        }
    }

    function createNoteCard(note) {
        const card = document.createElement('div');
        card.className = 'note-card';
        
        const title = document.createElement('div');
        title.className = 'note-card-title';
        title.innerText = note.title || 'Untitled Note';
        
        const date = document.createElement('div');
        date.className = 'note-card-date';
        date.innerText = new Date(note.updatedAt).toLocaleDateString();
        
        const actions = document.createElement('div');
        actions.className = 'note-card-actions';
        
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'toggle-complete-btn';
        toggleBtn.innerText = note.isCompleted ? 'Mark In-Progress' : 'Mark Completed';
        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleNoteCompletion(note.id);
        });
        
        actions.appendChild(toggleBtn);
        card.appendChild(title);
        card.appendChild(date);
        card.appendChild(actions);
        
        card.addEventListener('click', () => showEditorView(note.id));
        
        return card;
    }

    function renderHomeLists() {
        const draftsGrid = document.getElementById('drafts-grid');
        const completedGrid = document.getElementById('completed-grid');
        
        if (!draftsGrid || !completedGrid) return;
        
        draftsGrid.innerHTML = '';
        completedGrid.innerHTML = '';
        
        const notes = syncCtrl.getAllLocalNotes().sort((a, b) => b.updatedAt - a.updatedAt);
        
        notes.forEach(note => {
            const card = createNoteCard(note);
            if (note.isCompleted) {
                completedGrid.appendChild(card);
            } else {
                draftsGrid.appendChild(card);
            }
        });
    }

    function renderDrawerList() {
        const list = document.getElementById('drawer-note-list');
        if (!list) return;
        list.innerHTML = '';
        
        const notes = syncCtrl.getAllLocalNotes().sort((a, b) => b.updatedAt - a.updatedAt);
        
        notes.forEach(n => {
            const item = document.createElement('div');
            item.className = `drawer-note-item ${n.id === currentNoteId ? 'active' : ''}`;
            item.innerText = n.title || 'Untitled Note';
            
            item.addEventListener('click', () => {
                saveCurrentNote();
                showEditorView(n.id);
            });
            
            list.appendChild(item);
        });
    }

    // Initialize auto-save
    setInterval(() => {
        if (editorView.classList.contains('active')) {
            saveCurrentNote();
        }
    }, 30000);

    // Initial render
    showHomeView();
});
