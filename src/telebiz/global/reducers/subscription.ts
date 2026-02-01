import type { GlobalState } from '../../../global/types';
import type { Plan, Subscription } from '../../services/types';
import type { TelebizSubscriptionState } from '../types';

import { INITIAL_TELEBIZ_STATE } from '../initialState';

export function updateTelebizSubscription<T extends GlobalState>(
  global: T,
  update: Partial<TelebizSubscriptionState>,
): T {
  const currentSubscription = global.telebiz?.subscription || INITIAL_TELEBIZ_STATE.subscription;
  return {
    ...global,
    telebiz: {
      ...(global.telebiz || INITIAL_TELEBIZ_STATE),
      subscription: {
        ...currentSubscription,
        ...update,
      },
    },
  };
}

// Set subscription for a specific organization
export function setTelebizOrgSubscription<T extends GlobalState>(
  global: T,
  organizationId: number,
  subscription: Subscription,
): T {
  const currentSubscription = global.telebiz?.subscription || INITIAL_TELEBIZ_STATE.subscription;
  return {
    ...global,
    telebiz: {
      ...(global.telebiz || INITIAL_TELEBIZ_STATE),
      subscription: {
        ...currentSubscription,
        subscriptionsByOrgId: {
          ...currentSubscription.subscriptionsByOrgId,
          [organizationId]: subscription,
        },
        isLoading: false,
        error: undefined,
      },
    },
  };
}

export function setTelebizPlans<T extends GlobalState>(
  global: T,
  plans: Plan[],
): T {
  return updateTelebizSubscription(global, {
    plans,
    isLoadingPlans: false,
    error: undefined,
  });
}

export function setTelebizSelectedPlan<T extends GlobalState>(
  global: T,
  planId: string | undefined,
): T {
  return updateTelebizSubscription(global, {
    selectedPlanId: planId,
  });
}

export function setTelebizSubscriptionLoading<T extends GlobalState>(
  global: T,
  isLoading: boolean,
): T {
  return updateTelebizSubscription(global, {
    isLoading,
    error: isLoading ? undefined : global.telebiz?.subscription?.error,
  });
}

export function setTelebizPlansLoading<T extends GlobalState>(
  global: T,
  isLoadingPlans: boolean,
): T {
  return updateTelebizSubscription(global, {
    isLoadingPlans,
    error: isLoadingPlans ? undefined : global.telebiz?.subscription?.error,
  });
}

export function setTelebizSubscriptionError<T extends GlobalState>(
  global: T,
  error: string,
): T {
  return updateTelebizSubscription(global, {
    isLoading: false,
    isLoadingPlans: false,
    error,
  });
}
