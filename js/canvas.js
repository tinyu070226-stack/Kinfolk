class CanvasController {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        
        this.setupHighDPI();
        
        this.paths = [];
        this.currentPath = null;
        this.undoStack = [];
        this.redoStack = [];
        
        this.mode = 'draw'; // draw, erase, shape, select
        this.brush = 'pen'; // pen, pencil
        this.strokeColor = '#2D2B2A';
        this.fillColor = 'transparent';
        this.strokeWidth = 3;
        this.shapeType = 'rect'; // rect, circle, triangle, line, dashed, arrow
        
        this.isDrawing = false;
        this.currentShape = null;

        // Gestures & Pointers
        this.activePointers = new Map();
        this.lastPinchDist = null;
        this.lastPanCenter = null;
        this.doubleTapState = { count: 0, lastTime: 0 };
        this.zoomLevel = 1;

        // EMA Smoothing
        this.emaAlpha = 0.3; // Smoothing factor
        this.lastEmaPoint = null;

        this.bindEvents();
    }

    setupHighDPI() {
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.parentElement.getBoundingClientRect();
        
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        
        this.ctx.scale(dpr, dpr);
        this.canvas.style.width = `${rect.width}px`;
        this.canvas.style.height = `${rect.height}px`;
    }

    resize() {
        const paths = JSON.parse(JSON.stringify(this.paths));
        this.setupHighDPI();
        this.paths = paths;
        this.render();
    }

    handleDoubleTap() {
        const now = Date.now();
        if (now - this.doubleTapState.lastTime < 300) {
            this.doubleTapState.count++;
            if (this.doubleTapState.count === 2) {
                this.undo();
                this.doubleTapState.count = 0;
            }
        } else {
            this.doubleTapState.count = 1;
        }
        this.doubleTapState.lastTime = now;
    }

    bindEvents() {
        const container = document.getElementById('paperContainer');
        container.addEventListener('pointerdown', this.onPointerDown.bind(this));
        container.addEventListener('pointermove', this.onPointerMove.bind(this));
        container.addEventListener('pointerup', this.onPointerUp.bind(this));
        container.addEventListener('pointercancel', this.onPointerUp.bind(this));

        container.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) e.preventDefault();
        }, { passive: false });
        container.addEventListener('touchmove', (e) => {
            if (e.touches.length === 2) e.preventDefault();
        }, { passive: false });
    }

    onPointerDown(e) {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        this.activePointers.set(e.pointerId, e);
        
        if (this.mode !== 'select') {
            document.getElementById('paperContainer').setPointerCapture(e.pointerId);
        }

        if (this.activePointers.size === 2) {
            this.isDrawing = false;
            this.currentPath = null;
            this.lastPinchDist = null;
            this.lastPanCenter = null;
            this.handleDoubleTap();
            return;
        }

        if (this.activePointers.size === 1) {
            if (this.mode === 'select') return;
            this.isDrawing = true;
            const pt = this.getPoint(e);
            this.lastEmaPoint = { x: pt.x, y: pt.y };
            
            if (this.mode === 'draw') {
                this.currentPath = {
                    tool: this.brush,
                    color: this.strokeColor,
                    width: this.strokeWidth,
                    points: [{ x: pt.x, y: pt.y, pressure: e.pressure || 0.5 }]
                };
            } else if (this.mode === 'erase') {
                this.eraseAt(pt);
            } else if (this.mode === 'shape') {
                this.currentShape = {
                    type: this.shapeType,
                    startX: pt.x, startY: pt.y,
                    endX: pt.x, endY: pt.y,
                    color: this.strokeColor,
                    fill: this.fillColor,
                    width: this.strokeWidth
                };
            }
        }
    }

    onPointerMove(e) {
        if (this.activePointers.has(e.pointerId)) {
            this.activePointers.set(e.pointerId, e);
        }

        if (this.activePointers.size === 2) {
            // Pan & Zoom
            const pointers = Array.from(this.activePointers.values());
            const p1 = pointers[0];
            const p2 = pointers[1];
            
            const dist = Math.hypot(p1.clientX - p2.clientX, p1.clientY - p2.clientY);
            const center = {
                x: (p1.clientX + p2.clientX) / 2,
                y: (p1.clientY + p2.clientY) / 2
            };

            const container = document.getElementById('paperContainer');
            
            if (this.lastPanCenter) {
                const dx = center.x - this.lastPanCenter.x;
                const dy = center.y - this.lastPanCenter.y;
                container.scrollLeft -= dx;
                container.scrollTop -= dy;
            }
            
            // basic zoom
            if (this.lastPinchDist) {
                const scaleDiff = dist / this.lastPinchDist;
                this.zoomLevel *= scaleDiff;
                this.zoomLevel = Math.max(0.5, Math.min(this.zoomLevel, 3.0));
                const paper = document.getElementById('paper');
                if (paper) {
                    paper.style.transform = `scale(${this.zoomLevel})`;
                }
            }

            this.lastPinchDist = dist;
            this.lastPanCenter = center;
            return;
        }

        if (!this.isDrawing || this.activePointers.size > 1) return;
        
        const pt = this.getPoint(e);
        
        // Apply EMA Smoothing
        if (this.lastEmaPoint) {
            pt.x = this.emaAlpha * pt.x + (1 - this.emaAlpha) * this.lastEmaPoint.x;
            pt.y = this.emaAlpha * pt.y + (1 - this.emaAlpha) * this.lastEmaPoint.y;
            this.lastEmaPoint = { x: pt.x, y: pt.y };
        }

        if (this.mode === 'draw' && this.currentPath) {
            this.currentPath.points.push({ x: pt.x, y: pt.y, pressure: e.pressure || 0.5 });
            this.render(); // Real-time feedback
        } else if (this.mode === 'erase') {
            this.eraseAt(pt);
        } else if (this.mode === 'shape' && this.currentShape) {
            this.currentShape.endX = pt.x;
            this.currentShape.endY = pt.y;
            this.render();
        }
    }

    onPointerUp(e) {
        this.activePointers.delete(e.pointerId);

        if (this.activePointers.size < 2) {
            this.lastPinchDist = null;
            this.lastPanCenter = null;
        }

        if (this.activePointers.size === 0) {
            if (this.isDrawing) {
                this.isDrawing = false;
                if (this.mode === 'draw' && this.currentPath) {
                    const pathCopy = JSON.parse(JSON.stringify(this.currentPath));
                    this.paths.push(pathCopy);
                    this.currentPath = null;
                    this.saveState();
                } else if (this.mode === 'shape' && this.currentShape) {
                    this.paths.push({ shape: { ...this.currentShape } });
                    this.currentShape = null;
                    this.saveState();
                }
                this.render();
            }
        }
    }

    getPoint(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    eraseAt(pt) {
        const eraseRadius = 15;
        this.paths = this.paths.filter(p => {
            if (p.shape) {
                const s = p.shape;
                const minX = Math.min(s.startX, s.endX) - eraseRadius;
                const maxX = Math.max(s.startX, s.endX) + eraseRadius;
                const minY = Math.min(s.startY, s.endY) - eraseRadius;
                const maxY = Math.max(s.startY, s.endY) + eraseRadius;
                if (pt.x >= minX && pt.x <= maxX && pt.y >= minY && pt.y <= maxY) {
                    return false;
                }
                return true;
            }
            if (p.points) {
                return !p.points.some(point => 
                    Math.hypot(point.x - pt.x, point.y - pt.y) < eraseRadius
                );
            }
            return true;
        });
        this.render();
        this.saveState(); 
    }

    render() {
        if (this.renderPending) return;
        this.renderPending = true;
        
        requestAnimationFrame(() => {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            
            // Render saved paths
            for (const p of this.paths) {
                if (p.shape) this.drawShape(p.shape);
                else this.drawFreehand(p);
            }

            // Render current
            if (this.currentPath) {
                this.drawFreehand(this.currentPath);
            }
            if (this.currentShape) {
                this.drawShape(this.currentShape);
            }
            
            this.renderPending = false;
        });
    }

    getSvgPathFromStroke(stroke) {
        if (!stroke.length) return '';
        const d = stroke.reduce(
            (acc, [x0, y0], i, arr) => {
                const [x1, y1] = arr[(i + 1) % arr.length];
                acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
                return acc;
            },
            ['M', ...stroke[0], 'Q']
        );
        d.push('Z');
        return d.join(' ');
    }

    drawFreehand(path) {
        if (!path.points || path.points.length === 0) return;
        
        if (path.tool === 'pen' && window.perfectFreehand) {
            const strokePoints = path.points.map(p => [p.x, p.y, p.pressure]);
            const options = {
                size: path.width * 2,
                thinning: 0.5,
                smoothing: 0.5,
                streamline: 0.5,
                simulatePressure: true
            };
            const stroke = window.perfectFreehand.getStroke(strokePoints, options);
            if (stroke && stroke.length > 0) {
                const pathData = this.getSvgPathFromStroke(stroke);
                const p2d = new Path2D(pathData);
                this.ctx.fillStyle = path.color;
                this.ctx.fill(p2d);
            }
        } else {
            // Graphite pencil with Catmull-Rom smoothing
            this.ctx.beginPath();
            this.ctx.lineCap = 'round';
            this.ctx.lineJoin = 'round';
            this.ctx.strokeStyle = path.color;
            this.ctx.lineWidth = path.width;
            this.ctx.globalAlpha = path.tool === 'pencil' ? 0.6 : 1.0;
            
            const pts = path.points;
            if (pts.length < 3) {
                this.ctx.moveTo(pts[0].x, pts[0].y);
                if (pts[1]) this.ctx.lineTo(pts[1].x, pts[1].y);
                else this.ctx.lineTo(pts[0].x + 0.1, pts[0].y + 0.1);
            } else {
                this.ctx.moveTo(pts[0].x, pts[0].y);
                const tension = 1.0; // Tuning tension for smoothness
                for (let i = 0; i < pts.length - 1; i++) {
                    const p0 = i > 0 ? pts[i - 1] : pts[0];
                    const p1 = pts[i];
                    const p2 = pts[i + 1];
                    const p3 = i !== pts.length - 2 ? pts[i + 2] : p2;

                    for (let t = 0; t < 1; t += 0.1) {
                        const t2 = t * t;
                        const t3 = t2 * t;

                        const x = 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * tension * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * tension * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * tension * t3);
                        const y = 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * tension * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * tension * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * tension * t3);

                        this.ctx.lineTo(x, y);
                    }
                }
                this.ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
            }
            
            this.ctx.stroke();
            this.ctx.globalAlpha = 1.0;
        }
    }

    drawShape(shape) {
        this.ctx.strokeStyle = shape.color;
        this.ctx.lineWidth = shape.width;
        this.ctx.fillStyle = shape.fill === '#000000' && shape.color !== '#000000' ? 'transparent' : shape.fill;
        
        // Reset dash
        this.ctx.setLineDash([]);
        
        this.ctx.beginPath();
        
        if (shape.type === 'rect') {
            const w = shape.endX - shape.startX;
            const h = shape.endY - shape.startY;
            this.ctx.rect(shape.startX, shape.startY, w, h);
        } else if (shape.type === 'circle') {
            const r = Math.hypot(shape.endX - shape.startX, shape.endY - shape.startY);
            this.ctx.arc(shape.startX, shape.startY, r, 0, Math.PI * 2);
        } else if (shape.type === 'triangle') {
            this.ctx.moveTo(shape.startX + (shape.endX - shape.startX) / 2, shape.startY);
            this.ctx.lineTo(shape.endX, shape.endY);
            this.ctx.lineTo(shape.startX, shape.endY);
            this.ctx.closePath();
        } else if (shape.type === 'line') {
            this.ctx.moveTo(shape.startX, shape.startY);
            this.ctx.lineTo(shape.endX, shape.endY);
        } else if (shape.type === 'dashed') {
            this.ctx.setLineDash([10, 10]);
            this.ctx.moveTo(shape.startX, shape.startY);
            this.ctx.lineTo(shape.endX, shape.endY);
        } else if (shape.type === 'arrow') {
            this.ctx.moveTo(shape.startX, shape.startY);
            this.ctx.lineTo(shape.endX, shape.endY);
            const angle = Math.atan2(shape.endY - shape.startY, shape.endX - shape.startX);
            this.ctx.lineTo(shape.endX - 15 * Math.cos(angle - Math.PI / 6), shape.endY - 15 * Math.sin(angle - Math.PI / 6));
            this.ctx.moveTo(shape.endX, shape.endY);
            this.ctx.lineTo(shape.endX - 15 * Math.cos(angle + Math.PI / 6), shape.endY - 15 * Math.sin(angle + Math.PI / 6));
        }
        
        if (shape.fill !== 'transparent' && shape.type !== 'line' && shape.type !== 'dashed' && shape.type !== 'arrow') {
            this.ctx.fill();
        }
        this.ctx.stroke();
        this.ctx.setLineDash([]);
    }

    saveState() {
        this.undoStack.push(JSON.stringify(this.paths));
        this.redoStack = []; 
    }

    undo() {
        if (this.undoStack.length > 0) {
            this.redoStack.push(JSON.stringify(this.paths));
            const state = this.undoStack.pop();
            this.paths = JSON.parse(state);
            this.render();
        } else if (this.paths.length > 0) {
             this.redoStack.push(JSON.stringify(this.paths));
             this.paths = [];
             this.render();
        }
    }

    redo() {
        if (this.redoStack.length > 0) {
            this.undoStack.push(JSON.stringify(this.paths));
            const state = this.redoStack.pop();
            this.paths = JSON.parse(state);
            this.render();
        }
    }

    clear() {
        this.saveState();
        this.paths = [];
        this.render();
    }

    insertImage(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                this.paths.push({
                    shape: {
                        type: 'image',
                        img: img,
                        src: e.target.result,
                        startX: 100, startY: 100,
                        endX: 100 + img.width/2, endY: 100 + img.height/2
                    }
                });
                const originalDraw = this.drawShape.bind(this);
                this.drawShape = (shape) => {
                    if (shape.type === 'image') {
                        let i = shape.img;
                        if (!i) {
                           i = new Image();
                           i.src = shape.src;
                           shape.img = i;
                        }
                        this.ctx.drawImage(i, shape.startX, shape.startY, shape.endX - shape.startX, shape.endY - shape.startY);
                    } else {
                        originalDraw(shape);
                    }
                };
                this.saveState();
                this.render();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    getExportData() {
        return {
            paths: this.paths
        };
    }

    loadExportData(data) {
        if (data && data.paths) {
            this.paths = data.paths;
            this.render();
        }
    }
}
window.CanvasController = CanvasController;
