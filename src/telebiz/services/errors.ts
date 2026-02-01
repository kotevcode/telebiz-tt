export const ERRORS = {
  INTEGRATION_NOT_AVAILABLE: 'Integration not available',
  FAILED_TO_FETCH_PROVIDER_ENTITY: 'Failed to fetch provider entity',
};

/**
 * Error thrown when API returns 402 Payment Required
 * Indicates subscription expired or upgrade needed
 */
export class PaymentRequiredError extends Error {
  public subscriptionStatus: string;
  public trialExpired: boolean;
  public upgradeRequired: boolean;

  constructor(data?: {
    subscription_status?: string;
    trial_expired?: boolean;
    upgrade_required?: boolean;
  }) {
    super('Payment required');
    this.name = 'PaymentRequiredError';
    this.subscriptionStatus = data?.subscription_status || 'expired';
    this.trialExpired = data?.trial_expired ?? true;
    this.upgradeRequired = data?.upgrade_required ?? true;
  }
}
