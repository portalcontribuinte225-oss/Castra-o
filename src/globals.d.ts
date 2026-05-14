export {};

declare global {
  interface Window {
    google?: any;
    gm_authFailure?: () => void;
  }
}
