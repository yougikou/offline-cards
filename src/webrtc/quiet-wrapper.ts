export const initQuiet = (onReady: () => void, onError: (err: any) => void) => {
  if (typeof window === 'undefined') {
    onError(new Error("Quiet.js is only supported in browser environments"));
    return;
  }

  if (window.Quiet) {
    onReady();
    return;
  }

  // Create a global callback for when emscripten loads
  (window as any).QuietInit = () => {
    if (window.Quiet) {
      window.Quiet.init({
        profilesPrefix: '/offline-cards/assets/',
        memoryInitializerPrefix: '/offline-cards/assets/',
        libfecPrefix: '/offline-cards/assets/'
      });
      window.Quiet.addReadyCallback(onReady, onError);
    } else {
      onError(new Error("Quiet is not defined after script load"));
    }
  };

  // Inject scripts
  const scriptEmscripten = document.createElement('script');
  scriptEmscripten.src = '/offline-cards/assets/quiet-emscripten.js';

  const scriptQuiet = document.createElement('script');
  scriptQuiet.src = '/offline-cards/assets/quiet.js';

  scriptEmscripten.onload = () => {
    document.body.appendChild(scriptQuiet);
  };

  scriptQuiet.onload = () => {
    (window as any).QuietInit();
  };

  scriptEmscripten.onerror = () => onError(new Error("Failed to load quiet-emscripten.js"));
  scriptQuiet.onerror = () => onError(new Error("Failed to load quiet.js"));

  document.body.appendChild(scriptEmscripten);
};
