export default class FrameWrapper {
   
    constructor(sivStorage) {
        // don't overuse constructor, save for initiate function
    }

    reset() {
        return this;
    }

    initiate() {
        // store in named property in case we want to remove it
        this.onIFrameLoadBoundRef = this.onIFrameLoaded.bind(this);

        // the intial handler will be swapped out later
        this.onIFrameLoadedHandler = this.onInitialIFrameLoaded;

        this.iFrame = document.getElementById('celexFrame');
        this.iFrame.addEventListener('load', this.onIFrameLoadBoundRef);

        // reload frame with original URL
        this.loadCurrentURLIntoFrame();
        return this;
    }

    loadCurrentURLIntoFrame() {
        this.loadIFrame(document.URL)    
    }

    loadIFrame(URL) {
        this.iFrame.src = URL;
    }

    queryElementInFrame(query) {
        return this.iFrame.contentWindow.document.body.querySelector(query);
    }
    queryElementInFrameAll(query) {
        return this.iFrame.contentWindow.document.body.querySelectorAll(query);
    }

    onIFrameLoaded() {
        this.onIFrameLoadedHandler();  
    }

    setFrameLoadedHandler(handler) {
        this.onIFrameLoadedHandler = handler;
    }

    setSource(url) {
        this.iFrame.src = url;
    }

    onInitialIFrameLoaded() {
        // Anthing required for the initial load
        // do here.
    }
};