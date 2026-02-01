import { getActions, getGlobal } from '../../../global';

import { selectTelebizIsSubscriptionActive } from '../selectors';

export function checkSubscriptionGate(): boolean {
  const global = getGlobal();
  const isActive = selectTelebizIsSubscriptionActive(global);
  if (!isActive) {
    getActions().openTelebizSubscriptionBlockedModal();
    return false;
  }
  return true;
}
