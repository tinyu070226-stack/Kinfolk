class ExportController {
    static async generateCompositeCanvas(paperElement, backgroundColor, includeGrid = true) {
        if (typeof html2canvas === 'undefined') {
            alert("html2canvas library is missing.");
            return null;
        }

        const originalBackgroundImage = paperElement.style.backgroundImage || window.getComputedStyle(paperElement).backgroundImage;
        if (!includeGrid) {
            paperElement.style.backgroundImage = 'none';
        }

        const canvas = await html2canvas(paperElement, {
            backgroundColor: backgroundColor,
            scale: 4, // Retina 300+ DPI quality
            useCORS: true,
            logging: false
        });

        if (!includeGrid) {
            paperElement.style.backgroundImage = originalBackgroundImage;
        }

        return canvas;
    }

    static async exportPNG(paperElement, noteTitle = 'note', includeGrid = true) {
        const canvas = await this.generateCompositeCanvas(paperElement, null, includeGrid);
        if (!canvas) return;
        const link = document.createElement('a');
        link.download = `${noteTitle}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    }

    static async exportJPG(paperElement, noteTitle = 'note', includeGrid = true) {
        const canvas = await this.generateCompositeCanvas(paperElement, '#F8F7F2', includeGrid);
        if (!canvas) return;
        const link = document.createElement('a');
        link.download = `${noteTitle}.jpg`;
        link.href = canvas.toDataURL('image/jpeg', 0.95);
        link.click();
    }

    static async exportPDF(paperElement, noteTitle = 'note', includeGrid = true) {
        const originalBackgroundImage = paperElement.style.backgroundImage || window.getComputedStyle(paperElement).backgroundImage;
        if (!includeGrid) {
            paperElement.style.backgroundImage = 'none';
        }
        window.print();
        if (!includeGrid) {
            setTimeout(() => {
                paperElement.style.backgroundImage = originalBackgroundImage;
            }, 1000);
        }
    }

    static async exportDOCX(paperElement, noteTitle = 'note', includeGrid = true) {
        if (typeof htmlDocx === 'undefined') {
            alert("html-docx-js library is missing.");
            return;
        }

        const canvas = await this.generateCompositeCanvas(paperElement, '#F8F7F2', includeGrid);
        if (!canvas) return;
        const imgData = canvas.toDataURL('image/jpeg', 0.9);
        
        const content = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
            <h1>${noteTitle}</h1>
            <img src="${imgData}" style="width:100%; max-width:800px;"/>
        </body></html>`;

        const converted = htmlDocx.asBlob(content, {orientation: 'portrait'});
        const link = document.createElement('a');
        link.href = URL.createObjectURL(converted);
        link.download = `${noteTitle}.docx`;
        link.click();
    }
}
window.ExportController = ExportController;
