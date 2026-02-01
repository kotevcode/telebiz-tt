import type {
  ApiResponse,
  CheckoutData,
  CheckoutResponse,
  Plan,
  PortalResponse,
  SeatsResponse,
  Subscription,
} from '../types';

import { BaseApiClient } from './BaseApiClient';

/**
 * Telebiz Subscription API Client
 * Handles per-organization subscription management, plans, and payment operations
 *
 * Per-organization subscription model:
 * - Subscriptions belong to organizations (not users)
 * - Seats = active members within that organization
 * - Every 5th seat is free: paid_seats = total - floor(total / 5)
 * - New orgs get automatic 14-day trial
 * - Only owners and admins can manage subscriptions
 */
export class SubscriptionApiClient extends BaseApiClient {
  /**
   * Get subscription status for an organization
   */
  async getSubscription(organizationId: number): Promise<Subscription> {
    const response = await this.request<ApiResponse<{ subscription: Subscription }>>(
      `/subscriptions/orgs/${organizationId}`,
    );

    if (response.status !== 'success' || !response.data?.subscription) {
      throw new Error('Failed to fetch subscription');
    }

    return response.data.subscription;
  }

  /**
   * Get available subscription plans (public endpoint)
   */
  async getPlans(): Promise<Plan[]> {
    const response = await this.request<ApiResponse<{ plans: Plan[] }>>(
      '/subscriptions/plans',
      { skipAuth: true },
    );

    if (response.status !== 'success' || !response.data.plans) {
      throw new Error('Failed to fetch plans');
    }

    return response.data.plans;
  }

  /**
   * Create a checkout session for upgrading to a paid plan
   */
  async createCheckout(organizationId: number, data: CheckoutData): Promise<CheckoutResponse> {
    const response = await this.request<ApiResponse<CheckoutResponse>>(
      `/subscriptions/orgs/${organizationId}/checkout`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
    );

    if (response.status !== 'success' || !response.data) {
      throw new Error('Failed to create checkout session');
    }

    return response.data;
  }

  /**
   * Get customer portal URL for managing subscription
   */
  async getPortalUrl(organizationId: number): Promise<PortalResponse> {
    const response = await this.request<ApiResponse<PortalResponse>>(
      `/subscriptions/orgs/${organizationId}/portal`,
    );

    if (response.status !== 'success' || !response.data) {
      throw new Error('Failed to get portal URL');
    }

    return response.data;
  }

  /**
   * Cancel subscription (will end at period end)
   */
  async cancelSubscription(organizationId: number): Promise<void> {
    const response = await this.request<ApiResponse<void>>(
      `/subscriptions/orgs/${organizationId}/cancel`,
      {
        method: 'POST',
      },
    );

    if (response.status !== 'success') {
      throw new Error('Failed to cancel subscription');
    }
  }

  /**
   * Resume a cancelled subscription (if period hasn't ended)
   */
  async resumeSubscription(organizationId: number): Promise<void> {
    const response = await this.request<ApiResponse<void>>(
      `/subscriptions/orgs/${organizationId}/resume`,
      {
        method: 'POST',
      },
    );

    if (response.status !== 'success') {
      throw new Error('Failed to resume subscription');
    }
  }

  /**
   * Sync seat count with payment gateway
   * Returns updated subscription with recalculated seats
   */
  async syncSeats(organizationId: number): Promise<Subscription> {
    const response = await this.request<ApiResponse<Subscription>>(
      `/subscriptions/orgs/${organizationId}/sync-seats`,
      {
        method: 'POST',
      },
    );

    if (response.status !== 'success' || !response.data) {
      throw new Error('Failed to sync seats');
    }

    return response.data;
  }

  /**
   * Get detailed seat breakdown for an organization
   */
  async getSeats(organizationId: number): Promise<SeatsResponse> {
    const response = await this.request<ApiResponse<SeatsResponse>>(
      `/subscriptions/orgs/${organizationId}/seats`,
    );

    if (response.status !== 'success' || !response.data) {
      throw new Error('Failed to get seat breakdown');
    }

    return response.data;
  }

  /**
   * Upgrade subscription to a new plan
   */
  async upgradeSubscription(organizationId: number, data: { plan_type: string }): Promise<Subscription> {
    const response = await this.request<ApiResponse<Subscription>>(
      `/subscriptions/orgs/${organizationId}/upgrade`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
    );

    if (response.status !== 'success' || !response.data) {
      throw new Error('Failed to upgrade subscription');
    }

    return response.data;
  }
}
