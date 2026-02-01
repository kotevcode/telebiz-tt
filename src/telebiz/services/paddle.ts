declare global {
  interface Window {
    Paddle?: {
      Environment: {
        set: (env: 'sandbox' | 'production') => void;
      };
      Initialize: (options: {
        token: string;
        eventCallback?: (event: PaddleEvent) => void;
      }) => void;
      Checkout: {
        open: (options: PaddleCheckoutOptions) => void;
        close: () => void;
      };
    };
  }
}

export type PaddleEventName =
  | 'checkout.loaded'
  | 'checkout.closed'
  | 'checkout.completed'
  | 'checkout.error'
  | 'checkout.customer.created'
  | 'checkout.payment.initiated'
  | 'checkout.payment.failed';

export interface PaddleEvent {
  name: PaddleEventName;
  data?: {
    transaction_id?: string;
    status?: string;
    customer?: {
      id?: string;
      email?: string;
    };
    [key: string]: unknown;
  };
}

export interface PaddleCheckoutSettings {
  displayMode?: 'overlay' | 'inline';
  theme?: 'light' | 'dark';
  locale?: string;
  frameTarget?: string;
  frameInitialHeight?: number;
  frameStyle?: string;
  successUrl?: string;
  allowLogout?: boolean;
  showAddDiscounts?: boolean;
  showAddTaxId?: boolean;
}

export interface PaddleCheckoutOptions {
  transactionId: string;
  settings?: PaddleCheckoutSettings;
}

export const PADDLE_CHECKOUT_CONTAINER_ID = 'paddle-checkout-container';

export type PaddleEventHandler = (event: PaddleEvent) => void;

import { IS_PADDLE_SANDBOX, PADDLE_CLIENT_TOKEN } from '../config/constants';

const PADDLE_SCRIPT_URL = 'https://cdn.paddle.com/paddle/v2/paddle.js';
const SCRIPT_LOAD_TIMEOUT = 10000; // 10 seconds

let isScriptLoaded = false;
let isInitialized = false;
let loadPromise: Promise<void> | undefined;
let globalEventHandler: PaddleEventHandler | undefined;

/**
 * Load the Paddle.js script dynamically
 */
export function loadPaddleScript(): Promise<void> {
  // If already loaded, return immediately
  if (isScriptLoaded && window.Paddle) {
    return Promise.resolve();
  }

  // If already loading, return existing promise
  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = new Promise((resolve, reject) => {
    // Set up timeout
    const timeoutId = setTimeout(() => {
      loadPromise = undefined; // Reset so it can be retried
      reject(new Error('Paddle script load timeout'));
    }, SCRIPT_LOAD_TIMEOUT);

    const cleanup = () => {
      clearTimeout(timeoutId);
    };

    // Check if Paddle is already available (script might have been loaded elsewhere)
    if (window.Paddle) {
      cleanup();
      isScriptLoaded = true;
      resolve();
      return;
    }

    // Check if script is already in DOM
    const existingScript = document.querySelector(`script[src="${PADDLE_SCRIPT_URL}"]`) as HTMLScriptElement;
    if (existingScript) {
      // Script tag exists, wait for it to load
      const handleLoad = () => {
        cleanup();
        existingScript.removeEventListener('load', handleLoad);
        existingScript.removeEventListener('error', handleError);
        if (window.Paddle) {
          isScriptLoaded = true;
          resolve();
        } else {
          loadPromise = undefined;
          reject(new Error('Paddle script loaded but Paddle object not found'));
        }
      };

      const handleError = () => {
        cleanup();
        existingScript.removeEventListener('load', handleLoad);
        existingScript.removeEventListener('error', handleError);
        loadPromise = undefined;
        reject(new Error('Failed to load Paddle script (existing script error)'));
      };

      existingScript.addEventListener('load', handleLoad);
      existingScript.addEventListener('error', handleError);
      return;
    }

    // Create and append new script
    const script = document.createElement('script');
    script.src = PADDLE_SCRIPT_URL;
    script.async = true;

    script.onload = () => {
      cleanup();
      // Give Paddle a moment to initialize its global object
      setTimeout(() => {
        if (window.Paddle) {
          isScriptLoaded = true;
          resolve();
        } else {
          loadPromise = undefined;
          reject(new Error('Paddle script loaded but Paddle object not found'));
        }
      }, 100);
    };

    script.onerror = (event) => {
      cleanup();
      loadPromise = undefined;
      // eslint-disable-next-line no-console
      console.error('Paddle script load error:', event);
      reject(new Error('Failed to load Paddle script - check network/CSP'));
    };

    document.head.appendChild(script);
  });

  return loadPromise;
}

/**
 * Initialize Paddle with client token and event handler
 */
export function initializePaddle(): void {
  if (!window.Paddle) {
    throw new Error('Paddle script not loaded');
  }

  if (isInitialized) {
    return;
  }

  // Set environment (sandbox for testing, production for live)
  if (IS_PADDLE_SANDBOX) {
    window.Paddle.Environment.set('sandbox');
  }

  // Initialize with client-side token and event callback
  window.Paddle.Initialize({
    token: PADDLE_CLIENT_TOKEN,
    eventCallback: (event: PaddleEvent) => {
      // eslint-disable-next-line no-console
      console.log('Paddle event:', event.name, event.data);

      // Call the global event handler if set
      if (globalEventHandler) {
        globalEventHandler(event);
      }
    },
  });

  isInitialized = true;
}

/**
 * Set global event handler for Paddle events
 */
export function setPaddleEventHandler(handler: PaddleEventHandler): void {
  globalEventHandler = handler;
}

/**
 * Remove global event handler
 */
export function removePaddleEventHandler(): void {
  globalEventHandler = undefined;
}

/**
 * Load and initialize Paddle
 */
export async function setupPaddle(): Promise<void> {
  await loadPaddleScript();
  initializePaddle();
}

/**
 * Open Paddle checkout overlay with a transaction ID
 */
export async function openPaddleCheckout(
  transactionId: string,
  options?: PaddleCheckoutSettings,
): Promise<void> {
  await setupPaddle();

  if (!window.Paddle) {
    throw new Error('Paddle not available');
  }

  window.Paddle.Checkout.open({
    transactionId,
    settings: {
      displayMode: 'overlay',
      theme: 'dark',
      allowLogout: false,
      showAddDiscounts: true,
      ...options,
    },
  });
}

/**
 * Close Paddle checkout overlay
 */
export function closePaddleCheckout(): void {
  if (window.Paddle) {
    window.Paddle.Checkout.close();
  }
}

/**
 * Wait for an element to exist in the DOM
 */
function waitForElement(id: string, maxAttempts = 20, interval = 100): Promise<HTMLElement> {
  return new Promise((resolve, reject) => {
    let attempts = 0;

    const check = () => {
      const element = document.getElementById(id);
      if (element) {
        resolve(element);
        return;
      }

      attempts++;
      if (attempts >= maxAttempts) {
        reject(new Error(`Element #${id} not found after ${maxAttempts} attempts`));
        return;
      }

      setTimeout(check, interval);
    };

    check();
  });
}

/**
 * Check if Paddle is ready
 */
export function isPaddleReady(): boolean {
  return isScriptLoaded && isInitialized && Boolean(window.Paddle);
}

/**
 * Debug function to check Paddle loading state
 */
export function debugPaddleState(): Record<string, unknown> {
  return {
    isScriptLoaded,
    isInitialized,
    hasPaddleObject: Boolean(window.Paddle),
    hasLoadPromise: Boolean(loadPromise),
    scriptInDom: Boolean(document.querySelector(`script[src="${PADDLE_SCRIPT_URL}"]`)),
  };
}
