import { memo } from '../../../../lib/teact/teact';

import { PRICE_PER_SEAT_MONTHLY } from '../../../config/constants';

import { useTelebizLang } from '../../../hooks/useTelebizLang';

import ConfirmDialog from '../../../../components/ui/ConfirmDialog';

import styles from './TelebizOrganizations.module.scss';

type OwnProps = {
  isOpen: boolean;
  currentSeats: number;
  newSeats: number;
  isTrial?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

// Calculate paid seats (every 5th seat is free)
function getPaidSeats(total: number): number {
  return total - Math.floor(total / 5);
}

const ConfirmMemberChangesModal = ({
  isOpen,
  currentSeats,
  newSeats,
  isTrial,
  onConfirm,
  onClose,
}: OwnProps) => {
  const lang = useTelebizLang();

  const currentPaid = getPaidSeats(currentSeats);
  const newPaid = getPaidSeats(newSeats);
  const difference = newPaid - currentPaid;
  const monthlyCostChange = difference * PRICE_PER_SEAT_MONTHLY;
  const isIncrease = difference > 0;

  return (
    <ConfirmDialog
      isOpen={isOpen}
      title={lang('Organization.ConfirmMemberChanges.Title')}
      confirmLabel={lang('Organization.ConfirmMemberChanges.Confirm')}
      confirmHandler={onConfirm}
      onClose={onClose}
    >
      <div className={styles.confirmModalContent}>
        <p className={styles.confirmModalDescription}>
          {lang('Organization.ConfirmMemberChanges.Description', {
            current: currentSeats,
            new: newSeats,
          })}
        </p>

        {isTrial ? (
          <div className={styles.confirmModalPricing}>
            <p className={styles.confirmModalTrialNote}>
              {lang('Organization.ConfirmMemberChanges.TrialNote')}
            </p>
          </div>
        ) : (
          <div className={styles.confirmModalPricing}>
            <div className={styles.confirmModalPricingRow}>
              <span>{lang('Organization.ConfirmMemberChanges.CurrentSeats')}</span>
              <span>{currentSeats} ({currentPaid} {lang('Organization.ConfirmMemberChanges.Paid')})</span>
            </div>
            <div className={styles.confirmModalPricingRow}>
              <span>{lang('Organization.ConfirmMemberChanges.NewSeats')}</span>
              <span>{newSeats} ({newPaid} {lang('Organization.ConfirmMemberChanges.Paid')})</span>
            </div>
            <div className={styles.confirmModalPricingTotal}>
              <span>{lang('Organization.ConfirmMemberChanges.MonthlyChange')}</span>
              <span className={isIncrease ? styles.priceIncrease : styles.priceDecrease}>
                {isIncrease ? '+' : ''}{monthlyCostChange > 0 ? `$${monthlyCostChange}` : `-$${Math.abs(monthlyCostChange)}`}/mo
              </span>
            </div>
          </div>
        )}

        <p className={styles.confirmModalNote}>
          {isTrial
            ? lang('Organization.ConfirmMemberChanges.BillingNoteTrialNote')
            : lang('Organization.ConfirmMemberChanges.BillingNote')}
        </p>
      </div>
    </ConfirmDialog>
  );
};

export default memo(ConfirmMemberChangesModal);
