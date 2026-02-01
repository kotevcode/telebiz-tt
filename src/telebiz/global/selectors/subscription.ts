import type { GlobalState } from '../../../global/types';
import type { Plan, Subscription } from '../../services/types';
import type { TelebizSubscriptionState } from '../types';

import { ORGANIZATION_MANAGER_ROLES } from '../../config/constants';
import { INITIAL_TELEBIZ_STATE } from '../initialState';
import { selectTelebizUser } from './auth';
import { selectCurrentTelebizOrganization } from './organizations';

export function selectTelebizSubscription(global: GlobalState): TelebizSubscriptionState {
  return global.telebiz?.subscription || INITIAL_TELEBIZ_STATE.subscription;
}

// Get subscription for a specific organization
export function selectTelebizOrgSubscription(global: GlobalState, organizationId: number): Subscription | undefined {
  return selectTelebizSubscription(global).subscriptionsByOrgId?.[organizationId];
}

// Get subscription for the CURRENT active organization
export function selectTelebizCurrentOrgSubscription(global: GlobalState): Subscription | undefined {
  const currentOrg = selectCurrentTelebizOrganization(global);
  if (!currentOrg) return undefined;
  return selectTelebizOrgSubscription(global, currentOrg.id);
}

// Deprecated: Use selectTelebizCurrentOrgSubscription instead
export function selectTelebizSubscriptionData(global: GlobalState): Subscription | undefined {
  return selectTelebizCurrentOrgSubscription(global);
}

export function selectTelebizPlans(global: GlobalState): Plan[] {
  return selectTelebizSubscription(global).plans;
}

export function selectTelebizSelectedPlanId(global: GlobalState): string | undefined {
  return selectTelebizSubscription(global).selectedPlanId;
}

export function selectTelebizSelectedPlan(global: GlobalState): Plan | undefined {
  const plans = selectTelebizPlans(global);
  const selectedPlanId = selectTelebizSelectedPlanId(global);
  return plans.find((plan) => plan.id === selectedPlanId);
}

export function selectTelebizPlanById(global: GlobalState, planId: string): Plan | undefined {
  const plans = selectTelebizPlans(global);
  return plans.find((plan) => plan.id === planId);
}

export function selectTelebizSubscriptionIsLoading(global: GlobalState): boolean {
  return selectTelebizSubscription(global).isLoading;
}

export function selectTelebizPlansIsLoading(global: GlobalState): boolean {
  return selectTelebizSubscription(global).isLoadingPlans;
}

export function selectTelebizSubscriptionError(global: GlobalState): string | undefined {
  return selectTelebizSubscription(global).error;
}

export function selectTelebizIsTrialActive(global: GlobalState): boolean {
  const subscription = selectTelebizCurrentOrgSubscription(global);
  return subscription?.status === 'trial';
}

export function selectTelebizTrialDaysRemaining(global: GlobalState): number | undefined {
  const subscription = selectTelebizCurrentOrgSubscription(global);
  if (subscription?.status !== 'trial') return undefined;
  return subscription.trial_days_remaining;
}

export function selectTelebizIsSubscriptionActive(global: GlobalState): boolean {
  const subscription = selectTelebizCurrentOrgSubscription(global);
  return subscription?.is_active ?? false;
}

export function selectTelebizSubscriptionStatus(global: GlobalState): string | undefined {
  return selectTelebizCurrentOrgSubscription(global)?.status;
}

// Per-organization subscription seat selectors
export function selectTelebizTotalSeats(global: GlobalState): number {
  return selectTelebizCurrentOrgSubscription(global)?.total_seats ?? 0;
}

export function selectTelebizPaidSeats(global: GlobalState): number {
  return selectTelebizCurrentOrgSubscription(global)?.paid_seats ?? 0;
}

export function selectTelebizFreeSeats(global: GlobalState): number {
  return selectTelebizCurrentOrgSubscription(global)?.free_seats ?? 0;
}

export function selectTelebizMaxSeats(global: GlobalState): number {
  return selectTelebizCurrentOrgSubscription(global)?.max_seats ?? 0;
}

export function selectTelebizBilledSeats(global: GlobalState): number {
  return selectTelebizCurrentOrgSubscription(global)?.billed_seats ?? 0;
}

export function selectTelebizSeatsMismatch(global: GlobalState): boolean {
  return selectTelebizCurrentOrgSubscription(global)?.seats_mismatch ?? false;
}

export function selectTelebizCanAddMoreSeats(global: GlobalState): boolean {
  const subscription = selectTelebizCurrentOrgSubscription(global);
  if (!subscription) return false;
  // -1 means unlimited
  if (subscription.max_seats === -1) return true;
  return subscription.total_seats < subscription.max_seats;
}

export function selectTelebizRemainingSeats(global: GlobalState): number {
  const subscription = selectTelebizCurrentOrgSubscription(global);
  if (!subscription) return 0;
  // -1 means unlimited
  if (subscription.max_seats === -1) return Infinity;
  return Math.max(0, subscription.max_seats - subscription.total_seats);
}

// Check if user can manage subscription (owner or admin of current org)
export function selectCanManageOrgSubscription(global: GlobalState): boolean {
  const currentOrg = selectCurrentTelebizOrganization(global);
  const user = selectTelebizUser(global);
  if (!currentOrg || !user) return false;

  // Check membership role (owner or admin can manage subscription)
  const membership = currentOrg.members?.find((m) => m.user_id === user.id);
  return Boolean(membership?.role_name && ORGANIZATION_MANAGER_ROLES.includes(membership.role_name));
}
