/* global pdfjsLib, pdfjsViewer */

export default class BrowserContext {
  static loadPdfDoc(url, workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

    const pdfViewer = new pdfjsViewer.PDFViewer({
      container: document.getElementById('viewerContainer'),
      textLayerFactory: new pdfjsViewer.DefaultTextLayerFactory(),
    });

    const loadingTask = pdfjsLib.getDocument({ url });
    loadingTask.promise.then((pdfDocument) => {
      window.onDocEvent('pagecount', pdfDocument.numPages);
      pdfViewer.setDocument(pdfDocument);
    });
  }

  static injectPdfViewer() {
    document.addEventListener('textlayerrendered', (event) => {
      window.onDocEvent('textlayerrendered', event.detail.pageNumber);
    });

    // don't need existing body, replace it with the PdfViewer
    document.body.innerHTML = '';
    const pdfContainer = document.createElement('div');
    const viewer = document.createElement('div');
    document.body.appendChild(pdfContainer);
    pdfContainer.appendChild(viewer);
    pdfContainer.style = 'overflow: auto;position: absolute;width: 100%;height: 100%';
    pdfContainer.id = 'viewerContainer';

    viewer.id = 'viewer';
    viewer.className = 'pdfViewer';
  }

  static scrollPageIntoView(curPage) {
    const loadingIconTag = document.querySelector(`.page[data-page-number="${curPage}"] > .loadingIcon`);
    if (loadingIconTag) {
      loadingIconTag.scrollIntoView();
    }
  }
}
