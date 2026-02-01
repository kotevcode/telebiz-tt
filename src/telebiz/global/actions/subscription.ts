import { addActionHandler, getActions, getGlobal, setGlobal } from '../../../global';

import type { ActionReturnType } from '../../../global/types';

import { updateTabState } from '../../../global/reducers/tabs';
import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { telebizApiClient } from '../../services';
import {
  closePaddleCheckout,
  openPaddleCheckout,
  removePaddleEventHandler,
  setPaddleEventHandler,
} from '../../services/paddle';
import {
  setTelebizOrgSubscription,
  setTelebizPlans,
  setTelebizPlansLoading,
  setTelebizSelectedPlan,
  setTelebizSubscriptionError,
  setTelebizSubscriptionLoading,
  updateTelebizSubscription,
} from '../reducers';
import { selectCurrentTelebizOrganization, selectIsTelebizAuthenticated } from '../selectors';

/**
 * Load subscription for a specific organization
 */
addActionHandler('loadTelebizOrgSubscription', async (global, actions, payload: { organizationId: number }): Promise<void> => {
  if (!selectIsTelebizAuthenticated(global)) return;

  const { organizationId } = payload;

  global = setTelebizSubscriptionLoading(global, true);
  setGlobal(global);

  try {
    const subscription = await telebizApiClient.subscription.getSubscription(organizationId);

    global = getGlobal();
    global = setTelebizOrgSubscription(global, organizationId, subscription);
    setGlobal(global);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to load subscription';
    global = getGlobal();
    global = setTelebizSubscriptionError(global, errorMessage);
    setGlobal(global);
  }
});

/**
 * Load subscription for the current active organization
 * Convenience wrapper for loadTelebizOrgSubscription
 */
addActionHandler('loadTelebizSubscription', async (global): Promise<void> => {
  if (!selectIsTelebizAuthenticated(global)) return;

  const currentOrg = selectCurrentTelebizOrganization(global);
  if (!currentOrg) return;

  const { loadTelebizOrgSubscription } = getActions();
  loadTelebizOrgSubscription({ organizationId: currentOrg.id });
});

addActionHandler('loadTelebizPlans', async (global): Promise<void> => {
  // Plans endpoint is public, no auth check needed
  global = setTelebizPlansLoading(global, true);
  setGlobal(global);

  try {
    const plans = await telebizApiClient.subscription.getPlans();

    global = getGlobal();
    global = setTelebizPlans(global, plans);
    setGlobal(global);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to load plans';
    global = getGlobal();
    global = setTelebizSubscriptionError(global, errorMessage);
    setGlobal(global);
  }
});

addActionHandler('setTelebizSelectedPlan', (global, actions, payload): ActionReturnType => {
  const { planId } = payload;
  return setTelebizSelectedPlan(global, planId);
});

/**
 * Create checkout session for a specific organization
 */
addActionHandler('createTelebizCheckout', async (global, actions, payload): Promise<void> => {
  if (!selectIsTelebizAuthenticated(global)) return;

  const { organizationId, ...checkoutData } = payload;

  global = setTelebizSubscriptionLoading(global, true);
  setGlobal(global);

  // Set up event handler to refresh subscription when checkout completes
  let pollSubscription: ReturnType<typeof setInterval> | undefined;
  let didCompleteCheckout = false;

  const clearPolling = () => {
    if (!pollSubscription) return;
    clearInterval(pollSubscription);
    pollSubscription = undefined;
  };

  setPaddleEventHandler((event) => {
    if (event.name === 'checkout.completed') {
      didCompleteCheckout = true;
      // Checkout completed - close overlay after brief delay to show success
      setTimeout(() => {
        closePaddleCheckout();
      }, 1500);

      // Poll for subscription update - webhook may take a moment to process
      const { loadTelebizOrgSubscription } = getActions();
      let pollCount = 0;
      const maxPolls = 10;

      clearPolling();
      pollSubscription = setInterval(() => {
        pollCount++;
        loadTelebizOrgSubscription({ organizationId });

        if (pollCount >= maxPolls) {
          clearPolling();
          // Reset loading state after polling ends
          let g = getGlobal();
          g = setTelebizSubscriptionLoading(g, false);
          setGlobal(g);

          // Clean up event handler after polling completes
          removePaddleEventHandler();
        }
      }, 2000);
    } else if (event.name === 'checkout.closed') {
      // User closed checkout - just clean up
      clearPolling();
      removePaddleEventHandler();

      if (!didCompleteCheckout) {
        // Reset loading state if checkout didn't complete
        global = getGlobal();
        global = setTelebizSubscriptionLoading(global, false);
        setGlobal(global);
      }
    }
  });

  try {
    const { transaction_id } = await telebizApiClient.subscription.createCheckout(organizationId, checkoutData);

    // Open Paddle checkout overlay directly (no success URL needed)
    await openPaddleCheckout(transaction_id, {
      theme: 'light',
      successUrl: undefined, // Don't redirect, we handle via events
    });
  } catch (err) {
    // Clean up event handler on error
    removePaddleEventHandler();

    global = getGlobal();
    global = setTelebizSubscriptionLoading(global, false);
    setGlobal(global);

    const errorMessage = err instanceof Error ? err.message : 'Failed to create checkout session';
    global = getGlobal();
    global = setTelebizSubscriptionError(global, errorMessage);
    setGlobal(global);
  }
});

/**
 * Open Paddle customer portal for an organization
 */
addActionHandler('openTelebizPortal', async (global, actions, payload: { organizationId: number }): Promise<void> => {
  if (!selectIsTelebizAuthenticated(global)) return;

  const { organizationId } = payload;

  global = setTelebizSubscriptionLoading(global, true);
  setGlobal(global);

  try {
    const { portal_url } = await telebizApiClient.subscription.getPortalUrl(organizationId);

    // Open Paddle customer portal in new tab
    window.open(portal_url, '_blank', 'noopener,noreferrer');

    global = getGlobal();
    global = setTelebizSubscriptionLoading(global, false);
    setGlobal(global);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to open subscription portal';
    global = getGlobal();
    global = setTelebizSubscriptionError(global, errorMessage);
    setGlobal(global);
  }
});

/**
 * Cancel subscription for an organization
 */
addActionHandler('cancelTelebizSubscription', async (global, actions, payload: { organizationId: number }): Promise<void> => {
  if (!selectIsTelebizAuthenticated(global)) return;

  const { organizationId } = payload;

  global = setTelebizSubscriptionLoading(global, true);
  setGlobal(global);

  try {
    await telebizApiClient.subscription.cancelSubscription(organizationId);

    // Reload subscription to get updated status
    const subscription = await telebizApiClient.subscription.getSubscription(organizationId);

    global = getGlobal();
    global = setTelebizOrgSubscription(global, organizationId, subscription);
    setGlobal(global);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to cancel subscription';
    global = getGlobal();
    global = setTelebizSubscriptionError(global, errorMessage);
    setGlobal(global);
  }
});

/**
 * Resume a cancelled subscription for an organization
 */
addActionHandler('resumeTelebizSubscription', async (global, actions, payload: { organizationId: number }): Promise<void> => {
  if (!selectIsTelebizAuthenticated(global)) return;

  const { organizationId } = payload;

  global = setTelebizSubscriptionLoading(global, true);
  setGlobal(global);

  try {
    await telebizApiClient.subscription.resumeSubscription(organizationId);

    // Reload subscription to get updated status
    const subscription = await telebizApiClient.subscription.getSubscription(organizationId);

    global = getGlobal();
    global = setTelebizOrgSubscription(global, organizationId, subscription);
    setGlobal(global);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to resume subscription';
    global = getGlobal();
    global = setTelebizSubscriptionError(global, errorMessage);
    setGlobal(global);
  }
});

/**
 * Sync seat count for an organization
 */
addActionHandler('syncTelebizSubscriptionSeats', async (global, actions, payload: { organizationId: number }): Promise<void> => {
  if (!selectIsTelebizAuthenticated(global)) return;

  const { organizationId } = payload;

  global = setTelebizSubscriptionLoading(global, true);
  setGlobal(global);

  try {
    const subscription = await telebizApiClient.subscription.syncSeats(organizationId);

    global = getGlobal();
    global = setTelebizOrgSubscription(global, organizationId, subscription);
    setGlobal(global);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to sync seats';
    global = getGlobal();
    global = setTelebizSubscriptionError(global, errorMessage);
    setGlobal(global);
  }
});

/**
 * Upgrade subscription for an organization
 */
addActionHandler('upgradeTelebizSubscription', async (global, actions, payload): Promise<void> => {
  if (!selectIsTelebizAuthenticated(global)) return;

  const { organizationId, planType } = payload;

  global = setTelebizSubscriptionLoading(global, true);
  setGlobal(global);

  try {
    const subscription = await telebizApiClient.subscription.upgradeSubscription(organizationId, {
      plan_type: planType,
    });

    global = getGlobal();
    global = setTelebizOrgSubscription(global, organizationId, subscription);
    setGlobal(global);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to upgrade subscription';
    global = getGlobal();
    global = setTelebizSubscriptionError(global, errorMessage);
    setGlobal(global);
  }
});

addActionHandler('openTelebizSubscriptionBlockedModal', (global): ActionReturnType => {
  const tabId = getCurrentTabId();

  return updateTabState(global, {
    subscriptionBlockedModal: {
      isOpen: true,
    },
  }, tabId);
});

addActionHandler('closeTelebizSubscriptionBlockedModal', (global): ActionReturnType => {
  const tabId = getCurrentTabId();

  return updateTabState(global, {
    subscriptionBlockedModal: undefined,
  }, tabId);
});

addActionHandler('clearTelebizSubscriptionError', (global): ActionReturnType => {
  return updateTelebizSubscription(global, { error: undefined });
});
