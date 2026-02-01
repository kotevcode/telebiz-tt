import { memo, useEffect, useState } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { Plan } from '../../../services/types';
import type { OrganizationMember } from '../../../services/types';

import { TELEBIZ_TERMS_URL, TRIAL_PERIOD_DAYS } from '../../../config/constants';
import { selectTelebizPlans, selectTelebizPlansIsLoading } from '../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';

import useOldLang from '../../../../hooks/useOldLang';
import { useTelebizLang } from '../../../hooks/useTelebizLang';

import Avatar from '../../../../components/common/Avatar';
import Icon from '../../../../components/common/icons/Icon';
import SafeLink from '../../../../components/common/SafeLink';
import Button from '../../../../components/ui/Button';
import Checkbox from '../../../../components/ui/Checkbox';
import FloatingActionButton from '../../../../components/ui/FloatingActionButton';

import styles from './TelebizOrganizations.module.scss';

const ERROR_TERMS_AND_CONDITIONS = 'Please accept the terms and conditions';
const DEFAULT_PLAN_ID = 'pro';

type BillingCycle = 'monthly' | 'annual';

type OwnProps = {
  isLoading: boolean;
  logoUrl: string;
  name: string;
  description: string;
  members: Partial<OrganizationMember>[];
  handleOrganizationSave: () => void;
};

type StateProps = {
  plans: Plan[];
  isLoadingPlans: boolean;
};

const TelebizOrganizationsPayment = ({
  isLoading,
  logoUrl,
  name,
  description,
  members,
  plans,
  isLoadingPlans,
  handleOrganizationSave,
}: OwnProps & StateProps) => {
  const { loadTelebizPlans } = getActions();
  const lang = useTelebizLang();
  const tgLang = useOldLang();

  const [billingCycle, setBillingCycle] = useState<BillingCycle>('annual');
  const [isTosAccepted, setIsTosAccepted] = useState(false);
  const [error, setError] = useState<string | undefined>();

  // Load plans if not already loaded
  useEffect(() => {
    if (!plans.length && !isLoadingPlans) {
      loadTelebizPlans();
    }
  }, [plans.length, isLoadingPlans, loadTelebizPlans]);

  // Get the default plan (pro)
  const selectedPlan = plans.find((p) => p.id === DEFAULT_PLAN_ID) || plans[0];

  // Calculate pricing
  const memberCount = members.length;
  const isVolumeTier = memberCount >= 5;

  const getDisplayPrice = (plan: Plan | undefined) => {
    if (!plan) return { pricePerSeat: 0, hasDiscount: false };

    const useVolumePricing = isVolumeTier && plan.volume_pricing;

    if (billingCycle === 'annual') {
      if (useVolumePricing) {
        return {
          pricePerSeat: plan.volume_pricing!.annual.price_per_user,
          originalPrice: plan.annual?.price_per_user,
          hasDiscount: true,
        };
      }
      return {
        pricePerSeat: plan.annual?.price_per_user || 0,
        originalPrice: undefined,
        hasDiscount: false,
      };
    }

    if (useVolumePricing) {
      return {
        pricePerSeat: plan.volume_pricing!.monthly.price_per_user,
        originalPrice: plan.monthly?.price_per_user,
        hasDiscount: true,
      };
    }
    return {
      pricePerSeat: plan.monthly?.price_per_user || 0,
      originalPrice: undefined,
      hasDiscount: false,
    };
  };

  const priceInfo = getDisplayPrice(selectedPlan);
  const totalMonthlyPrice = priceInfo.pricePerSeat * memberCount;

  // Calculate annual savings
  const getAnnualSavingsPercent = () => {
    const planWithBothPrices = selectedPlan;
    if (!planWithBothPrices?.monthly || !planWithBothPrices?.annual) return 0;

    const monthlyPrice = planWithBothPrices.monthly.price_per_user;
    const annualMonthlyPrice = planWithBothPrices.annual.price_per_user;
    return Math.round(((monthlyPrice - annualMonthlyPrice) / monthlyPrice) * 100);
  };

  const annualSavingsPercent = getAnnualSavingsPercent();

  const handleBillingCycleChange = (cycle: BillingCycle) => {
    setBillingCycle(cycle);
  };

  return (
    <div className="settings-fab-wrapper">
      <div className={buildClassName('custom-scroll', styles.form)}>
        {/* Organization Info */}
        <div className="settings-item">
          <div className="settings-input">
            <div className={styles.organizationInfo}>
              <Avatar
                previewUrl={logoUrl}
                text={name}
              />
              <div className={styles.organizationInfoDetails}>
                <div>
                  {name}
                </div>
                <div className={styles.organizationInfoDetailsDescription}>
                  {description}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Pricing Summary */}
        <div className="settings-item">
          <h4 className="settings-item-header" dir={tgLang.isRtl ? 'rtl' : undefined}>
            {lang('Payment.PricingSummary')}
          </h4>
          <div className={styles.pricingSummary}>

            {/* Billing Cycle Toggle */}
            <div className={styles.billingCycleToggle}>
              <Button
                size="tiny"
                color="translucent-bordered"
                pill
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

            {/* Price per seat */}
            <div className={styles.pricingRow}>
              <span>{lang('Payment.PricePerSeat')}</span>
              <span>
                {priceInfo.hasDiscount && priceInfo.originalPrice !== undefined && (
                  <span className={styles.pricingOriginal}>
                    $
                    {priceInfo.originalPrice}
                  </span>
                )}
                $
                {priceInfo.pricePerSeat}
                {' '}
                /
                {lang('Payment.Month')}
              </span>
            </div>

            {/* Members count */}
            <div className={styles.pricingRow}>
              <span>{lang('Payment.Members', { count: String(memberCount) })}</span>
              <span>
                {memberCount}
                {' '}
                ×
                {' '}
                $
                {priceInfo.pricePerSeat}
              </span>
            </div>

            {/* Volume discount info */}
            {isVolumeTier && priceInfo.hasDiscount && (
              <div className={styles.pricingDiscount}>
                <Icon name="gift" className={styles.pricingDiscountIcon} />
                <span>{lang('Billing.VolumeDiscount')}</span>
              </div>
            )}

            {/* Divider */}
            <div className={styles.pricingDivider} />

            {/* After trial price */}
            <div className={buildClassName(styles.pricingRow, styles.pricingAfterTrial)}>
              <span>{lang('Payment.AfterTrial')}</span>
              <span>
                $
                {totalMonthlyPrice.toFixed(2)}
                {' '}
                /
                {lang('Payment.Month')}
              </span>
            </div>

            {/* Due today - $0 */}
            <div className={buildClassName(styles.pricingRow, styles.pricingTotal)}>
              <span>{lang('Payment.DueToday')}</span>
              <span className={styles.pricingFree}>
                $0.00
              </span>
            </div>

            {/* Trial note */}
            <div className={styles.pricingNote}>
              <Icon name="info" className={styles.pricingNoteIcon} />
              <span>{lang('Payment.NoCreditCardRequired')}</span>
            </div>

            <div className={styles.pricingNote}>
              <Icon name="calendar" className={styles.pricingNoteIcon} />
              <span>{lang('Payment.AddPaymentLater')}</span>
            </div>
          </div>
        </div>

        {/* Trial Info Box */}
        <div className="settings-item">
          <div className={styles.trialInfoBox}>
            <Icon name="gift" className={styles.trialInfoBoxIcon} />
            <div className={styles.trialInfoBoxContent}>
              <div className={styles.trialInfoBoxTitle}>
                {lang('Payment.TrialTitle', { days: String(TRIAL_PERIOD_DAYS) })}
              </div>
              <div className={styles.trialInfoBoxDescription}>
                {lang('Payment.TrialDescription')}
              </div>
            </div>
          </div>
        </div>

        {/* Terms and Conditions */}
        <div className="settings-item">
          <h4 className="settings-item-header" dir={tgLang.isRtl ? 'rtl' : undefined}>
            {lang('Payment.TermsAndConditions')}
          </h4>
          {error === ERROR_TERMS_AND_CONDITIONS && (
            <p className="settings-item-description color-danger mb-2" dir={tgLang.isRtl ? 'rtl' : undefined}>
              {lang('Payment.PleaseAcceptTerms')}
            </p>
          )}
          <Checkbox
            label={(
              <>
                {lang('Payment.IAcceptThe')}
                {' '}
                <SafeLink
                  url={TELEBIZ_TERMS_URL}
                  text={lang('Payment.TermsOfService')}
                />
                {' '}
                {lang('Payment.Of')}
                {' '}
                Telebiz.
              </>
            )}
            name="organization_tos"
            checked={Boolean(isTosAccepted)}
            className={styles.tosCheckbox}
            tabIndex={0}
            onCheck={(isChecked) => {
              if (isChecked) {
                setError(undefined);
              }
              setIsTosAccepted(isChecked);
            }}
          />
        </div>
      </div>

      {error && error !== ERROR_TERMS_AND_CONDITIONS && (
        <div className={styles.error} dir={tgLang.isRtl ? 'rtl' : undefined}>
          {error}
        </div>
      )}

      <FloatingActionButton
        isShown
        onClick={() => {
          if (isTosAccepted) {
            handleOrganizationSave();
          } else {
            setError(ERROR_TERMS_AND_CONDITIONS);
          }
        }}
        disabled={isLoading}
        ariaLabel={tgLang('Save')}
        iconName="check"
        isLoading={isLoading}
      />
    </div>
  );
};

export default memo(withGlobal<OwnProps>((global): StateProps => ({
  plans: selectTelebizPlans(global),
  isLoadingPlans: selectTelebizPlansIsLoading(global),
}))(TelebizOrganizationsPayment));
