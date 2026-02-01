import { memo, useEffect, useState } from '@teact';
import { getActions, withGlobal } from '../../../../global';

import type { Plan, Subscription } from '../../../services/types';

import {
  selectCanManageOrgSubscription,
  selectCurrentTelebizOrganization,
  selectTelebizBilledSeats,
  selectTelebizCurrentOrgSubscription,
  selectTelebizFreeSeats,
  selectTelebizMaxSeats,
  selectTelebizPaidSeats,
  selectTelebizPlans,
  selectTelebizPlansIsLoading,
  selectTelebizSeatsMismatch,
  selectTelebizSelectedPlanId,
  selectTelebizSubscriptionError,
  selectTelebizSubscriptionIsLoading,
  selectTelebizTotalSeats,
} from '../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';

import useFlag from '../../../../hooks/useFlag';
import useLastCallback from '../../../../hooks/useLastCallback';
import { useTelebizLang } from '../../../hooks/useTelebizLang';

import Icon from '../../../../components/common/icons/Icon';
import Button from '../../../../components/ui/Button';
import ListItem from '../../../../components/ui/ListItem';
import Modal from '../../../../components/ui/Modal';
import Spinner from '../../../../components/ui/Spinner';

import styles from './TelebizBilling.module.scss';

type BillingCycle = 'monthly' | 'annual';

const MAX_VISIBLE_FEATURES = 3;

type OwnProps = {
  refreshKey?: number;
};

type StateProps = {
  currentOrganizationId?: number;
  subscription?: Subscription;
  plans: Plan[];
  selectedPlanId?: string;
  isLoading: boolean;
  isLoadingPlans: boolean;
  error?: string;
  // Per-organization subscription model
  totalSeats: number;
  paidSeats: number;
  freeSeats: number;
  billedSeats: number; // What Paddle is currently billing
  maxSeats: number;
  seatsMismatch: boolean; // True if billedSeats != paidSeats
  canManageSubscription: boolean; // Owner or Admin of current org
};

const TelebizBilling = ({
  refreshKey,
  currentOrganizationId,
  subscription,
  plans,
  selectedPlanId,
  isLoading,
  isLoadingPlans,
  error,
  totalSeats,
  paidSeats,
  freeSeats,
  billedSeats,
  maxSeats,
  seatsMismatch,
  canManageSubscription,
}: OwnProps & StateProps) => {
  const {
    loadTelebizPlans,
    loadTelebizSubscription,
    setTelebizSelectedPlan,
    createTelebizCheckout,
    openTelebizPortal,
    syncTelebizSubscriptionSeats,
  } = getActions();

  const lang = useTelebizLang();

  const [billingCycle, setBillingCycle] = useState<BillingCycle>('annual');
  const [detailsPlan, setDetailsPlan] = useState<Plan | undefined>();
  const [isDetailsModalOpen, openDetailsModal, closeDetailsModal] = useFlag();

  useEffect(() => {
    if (plans.length > 0 && !selectedPlanId) {
      const defaultPlan = plans.find((p) => p.popular) || plans.find((p) => p.monthly);
      if (defaultPlan) {
        setTelebizSelectedPlan({ planId: defaultPlan.id });
      }
    }
  }, [plans, selectedPlanId, setTelebizSelectedPlan]);

  useEffect(() => {
    if (!currentOrganizationId) return;
    loadTelebizPlans();
    loadTelebizSubscription();

    // Check for success/cancelled query params from Paddle checkout redirect
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('success') === 'true') {
      // Reload subscription after successful payment - webhook may take a moment
      const reloadInterval = setInterval(() => {
        loadTelebizSubscription();
      }, 2000);

      // Stop reloading after 10 seconds
      setTimeout(() => clearInterval(reloadInterval), 10000);

      // Clean up the URL
      window.history.replaceState({}, '', window.location.pathname);

      return () => clearInterval(reloadInterval);
    }

    return undefined;
  }, [refreshKey, currentOrganizationId, loadTelebizPlans, loadTelebizSubscription]);

  const handleViewPlanDetails = useLastCallback((plan: Plan) => {
    setDetailsPlan(plan);
    openDetailsModal();
  });

  const handleBillingCycleChange = useLastCallback((cycle: BillingCycle) => {
    setBillingCycle(cycle);
  });

  // Calculate annual savings percentage
  const getAnnualSavingsPercent = () => {
    const firstPlanWithBothPrices = plans.find((p) => p.monthly && p.annual);
    if (!firstPlanWithBothPrices) return 0;

    const monthlyPrice = firstPlanWithBothPrices.monthly!.price_per_user;
    const annualMonthlyPrice = firstPlanWithBothPrices.annual!.price_per_user;
    return Math.round(((monthlyPrice - annualMonthlyPrice) / monthlyPrice) * 100);
  };

  // Check if current seat count qualifies for volume pricing (use totalSeats from subscription API)
  const isVolumeTier = totalSeats >= 5;

  const getDisplayPrice = (plan: Plan) => {
    // Use volume pricing if available and member count >= 5
    const useVolumePricing = isVolumeTier && plan.volume_pricing;

    if (billingCycle === 'annual') {
      if (useVolumePricing) {
        return {
          current: plan.volume_pricing!.annual.price_per_user,
          original: plan.annual?.price_per_user,
          hasDiscount: true,
          isVolume: true,
        };
      }
      return {
        current: plan.annual?.price_per_user,
        original: undefined,
        hasDiscount: false,
        isVolume: false,
      };
    }

    if (useVolumePricing) {
      return {
        current: plan.volume_pricing!.monthly.price_per_user,
        original: plan.monthly?.price_per_user,
        hasDiscount: true,
        isVolume: true,
      };
    }
    return {
      current: plan.monthly?.price_per_user,
      original: undefined,
      hasDiscount: false,
      isVolume: false,
    };
  };

  const annualSavingsPercent = getAnnualSavingsPercent();

  const handlePlanSelect = useLastCallback((planId: string) => {
    if (!canManageSubscription) return;
    const plan = plans.find((p) => p.id === planId);
    if (plan && !plan.monthly) return; // TBA plan

    setTelebizSelectedPlan({ planId });
  });

  const handleUpgrade = useLastCallback(() => {
    if (!selectedPlanId || !canManageSubscription || !currentOrganizationId) return;

    // Use totalSeats from subscription API (freshly loaded), minimum 1 for checkout
    const seatsToCharge = Math.max(totalSeats, 1);

    createTelebizCheckout({
      organizationId: currentOrganizationId,
      plan_type: selectedPlanId,
      billing_cycle: billingCycle,
      seats: seatsToCharge,
    });
  });

  const handleManageSubscription = useLastCallback(() => {
    if (!currentOrganizationId) return;
    openTelebizPortal({ organizationId: currentOrganizationId });
  });

  const handleSyncSeats = useLastCallback(() => {
    if (!currentOrganizationId) return;
    syncTelebizSubscriptionSeats({ organizationId: currentOrganizationId });
  });

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'trial': return lang('Billing.Status.trial');
      case 'active': return lang('Billing.Status.active');
      case 'past_due': return lang('Billing.Status.past_due');
      case 'cancelled': return lang('Billing.Status.cancelled');
      case 'expired': return lang('Billing.Status.expired');
      default: return status;
    }
  };

  const renderStatusBadge = (status: string) => {
    const badgeClass = buildClassName(
      styles.currentPlanBadge,
      status === 'trial' && styles.trial,
      status === 'active' && styles.active,
      (status === 'cancelled' || status === 'expired') && styles.cancelled,
    );

    return (
      <span className={badgeClass}>
        {getStatusLabel(status)}
      </span>
    );
  };

  const renderBillingCycleToggle = () => {
    return (
      <div className={styles.billingCycleToggle}>
        <Button
          size="tiny"
          color="translucent-bordered"
          pill
          badge
          fluid
          onClick={() => handleBillingCycleChange('annual')}
          className={buildClassName(
            styles.billingCycleOption,
            billingCycle === 'annual' && 'active',
          )}
        >
          {lang('Billing.Annual')}
          {annualSavingsPercent > 0 && (
            <span className={styles.savingsBadge}>
              {lang('Billing.SavePercent', { percent: String(annualSavingsPercent) })}
            </span>
          )}
        </Button>
        <Button
          size="tiny"
          color="translucent-bordered"
          pill
          badge
          fluid
          onClick={() => handleBillingCycleChange('monthly')}
          className={buildClassName(
            styles.billingCycleOption,
            billingCycle === 'monthly' && 'active',
          )}
        >
          {lang('Billing.Monthly')}
        </Button>
      </div>
    );
  };

  const renderSeatsInfo = () => {
    const maxSeatsDisplay = maxSeats === -1 ? '∞' : maxSeats;
    const isActive = subscription?.status === 'active';

    return (
      <div className={styles.seatsSection}>
        <div className={styles.seatsCompact}>
          <div className={styles.seatsStat}>
            <span className={styles.seatsStatValue}>{totalSeats}</span>
            <span className={styles.seatsStatLabel}>{lang('Billing.TotalSeats')}</span>
          </div>
          <div className={styles.seatsStat}>
            <span className={styles.seatsStatValue}>{paidSeats}</span>
            <span className={styles.seatsStatLabel}>{lang('Billing.PaidSeats')}</span>
          </div>
          {isActive && (
            <div className={styles.seatsStat}>
              <span className={styles.seatsStatValue}>{billedSeats}</span>
              <span className={styles.seatsStatLabel}>{lang('Billing.BilledSeats')}</span>
            </div>
          )}
          <div className={styles.seatsStat}>
            <span className={styles.seatsStatValue}>{maxSeatsDisplay}</span>
            <span className={styles.seatsStatLabel}>{lang('Billing.MaxSeats')}</span>
          </div>
        </div>
        {seatsMismatch && isActive && (
          <div className={styles.seatsMismatchWarning}>
            <Icon name="warning" />
            <span>{lang('Billing.SeatsMismatch', { billed: String(billedSeats), actual: String(paidSeats) })}</span>
            <Button
              size="tiny"
              onClick={handleSyncSeats}
              isLoading={isLoading}
            >
              {lang('Billing.SyncSeats')}
            </Button>
          </div>
        )}
      </div>
    );
  };

  const renderPlanCard = (plan: Plan) => {
    const isSelected = selectedPlanId === plan.id;
    const isCurrent = subscription?.plan_type === plan.id;
    const hasPricing = billingCycle === 'annual' ? plan.annual : plan.monthly;
    const isDisabled = !hasPricing || !canManageSubscription;
    const priceInfo = getDisplayPrice(plan);
    const visibleFeatures = plan.features.slice(0, MAX_VISIBLE_FEATURES);
    const hasMoreFeatures = plan.features.length > MAX_VISIBLE_FEATURES;

    const cardClass = buildClassName(
      styles.planCard,
      isSelected && styles.selected,
      plan.popular && styles.popular,
      isDisabled && styles.disabled,
    );

    const handleDetailsClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      handleViewPlanDetails(plan);
    };

    const handleRadioChange = () => {
      if (!isDisabled) {
        handlePlanSelect(plan.id);
      }
    };

    return (
      <label key={plan.id} className={cardClass}>
        <input
          type="radio"
          name="plan"
          value={plan.id}
          checked={isSelected}
          disabled={isDisabled}
          onChange={handleRadioChange}
          className={styles.planRadio}
        />

        {isSelected && (
          <div className={styles.selectedIndicator}>
            <Icon name="check" />
          </div>
        )}

        <div className={styles.planHeader}>
          <div className={styles.planNameRow}>
            <span className={styles.planName}>{plan.name}</span>
            <div className={styles.planBadges}>
              {plan.popular && (
                <span className={buildClassName(styles.planBadge, styles.popular)}>
                  {lang('Billing.Plan.Popular')}
                </span>
              )}
              {isDisabled && !hasPricing && (
                <span className={buildClassName(styles.planBadge, styles.tba)}>
                  {lang('Billing.Plan.TBA')}
                </span>
              )}
              {isCurrent && (
                <span className={buildClassName(styles.planBadge, styles.current)}>
                  {lang('Billing.Plan.Current')}
                </span>
              )}
            </div>
          </div>

          <div className={styles.priceRow}>
            {priceInfo.current !== undefined ? (
              <>
                {priceInfo.hasDiscount && priceInfo.original !== undefined && (
                  <span className={styles.priceOriginal}>
                    $
                    {priceInfo.original}
                  </span>
                )}
                <span className={styles.priceCurrent}>
                  $
                  {priceInfo.current}
                </span>
                <span className={styles.planPriceUnit}>
                  /
                  {lang('Billing.Plan.PerSeatMonth')}
                </span>
                {priceInfo.isVolume && (
                  <span className={styles.volumeBadge}>
                    {lang('Billing.VolumeDiscount')}
                  </span>
                )}
              </>
            ) : (
              <span className={styles.priceContact}>
                {lang('Billing.Plan.ContactSales')}
              </span>
            )}
          </div>
        </div>

        <p className={styles.planDescription}>{plan.description}</p>

        {/* Show volume pricing info if not yet at volume tier */}
        {!isVolumeTier && plan.volume_pricing && (
          <div className={styles.volumeInfo}>
            <Icon name="gift" className={styles.volumeInfoIcon} />
            <span>
              {lang('Billing.VolumeInfo', {
                threshold: String(plan.volume_threshold || 5),
                price: String(billingCycle === 'annual'
                  ? plan.volume_pricing.annual.price_per_user
                  : plan.volume_pricing.monthly.price_per_user),
              })}
            </span>
          </div>
        )}

        <div className={styles.featuresCompact}>
          {visibleFeatures.map((feature) => (
            <span key={feature} className={styles.featureChip}>
              <Icon name="check" className={styles.featureIcon} />
              {feature}
            </span>
          ))}
          {hasMoreFeatures && (
            <button
              type="button"
              className={styles.viewMoreLink}
              onClick={handleDetailsClick}
            >
              +
              {plan.features.length - MAX_VISIBLE_FEATURES}
              {' '}
              {lang('Billing.MoreFeatures')}
            </button>
          )}
        </div>
      </label>
    );
  };

  const renderPlanDetailsModal = () => {
    if (!detailsPlan) return undefined;

    const priceInfo = getDisplayPrice(detailsPlan);

    return (
      <Modal
        isOpen={isDetailsModalOpen}
        onClose={closeDetailsModal}
        title={detailsPlan.name}
        className={styles.detailsModal}
      >
        <div className={styles.detailsContent}>
          <div className={styles.detailsHeader}>
            <div className={styles.detailsPriceRow}>
              {priceInfo.current !== undefined ? (
                <>
                  {priceInfo.hasDiscount && priceInfo.original !== undefined && (
                    <span className={styles.priceOriginal}>
                      $
                      {priceInfo.original}
                    </span>
                  )}
                  <span className={styles.detailsPrice}>
                    $
                    {priceInfo.current}
                  </span>
                  <span className={styles.detailsPriceUnit}>
                    /
                    {lang('Billing.Plan.PerSeatMonth')}
                  </span>
                  {priceInfo.hasDiscount && (
                    <span className={styles.launchOfferBadge}>
                      {lang('Billing.LaunchOffer')}
                    </span>
                  )}
                </>
              ) : (
                <span className={styles.detailsPrice}>
                  {lang('Billing.Plan.ContactSales')}
                </span>
              )}
            </div>
            <p className={styles.detailsDescription}>{detailsPlan.description}</p>
          </div>

          <div className={styles.detailsFeatures}>
            <h4 className="settings-item-header">
              {lang('Billing.IncludedFeatures')}
            </h4>
            <div className={styles.detailsFeaturesList}>
              {detailsPlan.features.map((feature) => (
                <ListItem
                  key={feature}
                  icon="check"
                  iconClassName={styles.featureIcon}
                  narrow
                  inactive
                >
                  {feature}
                </ListItem>
              ))}
            </div>
          </div>

          <div className={styles.detailsActions}>
            <Button
              onClick={() => {
                closeDetailsModal();
                handlePlanSelect(detailsPlan.id);
              }}
              withPremiumGradient={detailsPlan.popular}
            >
              {lang('Billing.SelectPlan')}
            </Button>
          </div>
        </div>
      </Modal>
    );
  };

  if (isLoadingPlans) {
    return (
      <div className="settings-content custom-scroll">
        <div className={styles.loading}>
          <Spinner />
        </div>
      </div>
    );
  }

  return (
    <div className="settings-content custom-scroll">
      <div className={buildClassName('settings-item', styles.container)}>
        {error && (
          <div className={styles.error}>{error}</div>
        )}

        {/* Non-owner notice */}
        {!canManageSubscription && (
          <div className={styles.nonOwnerNotice}>
            <Icon name="info" className={styles.noticeIcon} />
            <span>{lang('Billing.NonOwnerNotice')}</span>
          </div>
        )}

        {/* Current Plan Section - Compact */}
        {subscription && (
          <div className={styles.currentPlanCompact}>
            <div className={styles.currentPlanRow}>
              <div className={styles.currentPlanInfo}>
                <span className={styles.currentPlanLabel}>
                  {lang('Billing.CurrentPlan')}
                </span>
                <span className={styles.currentPlanName}>
                  {plans.find((p) => p.id === subscription.plan_type)?.name || subscription.plan_type}
                </span>
              </div>
              {renderStatusBadge(subscription.status)}
            </div>

            {renderSeatsInfo()}

            {(subscription.status === 'trial' || subscription.cancel_at_period_end) && (
              <div className={styles.currentPlanNotice}>
                {subscription.status === 'trial' && subscription.trial_days_remaining !== undefined && (
                  <span className={styles.trialNotice}>
                    {subscription.trial_days_remaining}
                    {' '}
                    {lang('Billing.DaysRemaining')}
                  </span>
                )}
                {subscription.cancel_at_period_end && (
                  <span className={styles.cancelNotice}>
                    {lang('Billing.CancellingAtPeriodEnd')}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Plans Section - Only show for trial/expired, not for active subscribers */}
        {canManageSubscription && subscription?.status !== 'active' && (
          <div className={styles.plansSection}>
            <div className={styles.plansSectionHeader}>
              <h4 className="settings-item-header">
                {lang('Billing.AvailablePlans')}
              </h4>
              {renderBillingCycleToggle()}
            </div>
            <div className={styles.plansList}>
              {plans.map(renderPlanCard)}
            </div>
          </div>
        )}

        {/* Sticky Actions - Show when plan selected AND not active subscriber */}
        {canManageSubscription && selectedPlanId && subscription?.status !== 'active' && (
          <div className={styles.stickyActions}>
            <Button
              onClick={handleUpgrade}
              isLoading={isLoading}
              withPremiumGradient
              isShiny
              className={styles.upgradeButton}
            >
              {lang('Billing.Subscribe')}
            </Button>
          </div>
        )}

        {/* Manage Subscription Link */}
        {canManageSubscription && subscription?.status === 'active' && (
          <div className={styles.stickyActions}>
            <Button
              type="button"
              onClick={handleManageSubscription}
            >
              {lang('Billing.ManageSubscription')}
            </Button>
          </div>
        )}
      </div>

      {renderPlanDetailsModal()}
    </div>
  );
};

export default memo(withGlobal<OwnProps>((global): Complete<StateProps> => {
  const currentOrg = selectCurrentTelebizOrganization(global);
  return {
    currentOrganizationId: currentOrg?.id,
    subscription: selectTelebizCurrentOrgSubscription(global),
    plans: selectTelebizPlans(global),
    selectedPlanId: selectTelebizSelectedPlanId(global),
    isLoading: selectTelebizSubscriptionIsLoading(global),
    isLoadingPlans: selectTelebizPlansIsLoading(global),
    error: selectTelebizSubscriptionError(global),
    // Per-organization subscription model
    totalSeats: selectTelebizTotalSeats(global),
    paidSeats: selectTelebizPaidSeats(global),
    freeSeats: selectTelebizFreeSeats(global),
    billedSeats: selectTelebizBilledSeats(global),
    maxSeats: selectTelebizMaxSeats(global),
    seatsMismatch: selectTelebizSeatsMismatch(global),
    canManageSubscription: selectCanManageOrgSubscription(global),
  };
})(TelebizBilling));
