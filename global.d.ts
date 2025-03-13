declare global {
    interface Window {
      fullpage_api?: {
        moveSlideRight: () => void;
        moveSlideLeft: () => void;
      };
    }
  }
  export {};
  