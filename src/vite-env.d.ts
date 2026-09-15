/// <reference types="vite/client" />

declare global {
  interface Window {
    bootstrap: typeof import('bootstrap');
  }
}
export {};
