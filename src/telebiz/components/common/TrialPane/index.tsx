import { memo } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { Subscription } from '../../../services/types';
import { LeftColumnContent } from '../../../../types';
import { TelebizSettingsScreens } from '../../left/types';

import {
  selectCanManageOrgSubscription,
  selectCurrentTelebizOrganization,
  selectTelebizCurrentOrgSubscription,
} from '../../../global/selectors';

import useHeaderPane, { type PaneState } from '../../../../components/middle/hooks/useHeaderPane';
import useLastCallback from '../../../../hooks/useLastCallback';
import { useTelebizLang } from '../../../hooks/useTelebizLang';

import styles from './TrialPane.module.scss';

type OwnProps = {
  onPaneStateChange: (state: PaneState) => void;
};

type StateProps = {
  subscription?: Subscription;
  hasActiveOrg: boolean;
  canManageSubscription: boolean;
};

const URGENT_DAYS_THRESHOLD = 3;

const TrialPane = ({ subscription, hasActiveOrg, canManageSubscription, onPaneStateChange }: OwnProps & StateProps) => {
  const { openLeftColumnContent, openTelebizSettingsScreen } = getActions();
  const lang = useTelebizLang();

  const isOnTrial = subscription?.status === 'trial';
  const isExpired = subscription && !subscription.is_active;
  const daysRemaining = subscription?.trial_days_remaining ?? 0;
  const isUrgent = isOnTrial && daysRemaining <= URGENT_DAYS_THRESHOLD;
  const shouldShowPane = hasActiveOrg && (isOnTrial || isExpired);

  const { ref, shouldRender } = useHeaderPane({
    isOpen: shouldShowPane,
    onStateChange: onPaneStateChange,
    withResizeObserver: true,
  });

  const handleClick = useLastCallback(() => {
    if (!canManageSubscription) return;
    openLeftColumnContent({ contentKey: LeftColumnContent.Telebiz });
    openTelebizSettingsScreen({ screen: TelebizSettingsScreens.Billing });
  });

  if (!shouldRender || !shouldShowPane) return undefined;

  let title: string;
  let subtitle: string;

  if (isExpired) {
    title = lang('TrialPane.Expired');
    subtitle = canManageSubscription
      ? lang('TrialPane.SubscribeToKeepUsing')
      : lang('TrialPane.ContactOwner');
  } else {
    title = isUrgent
      ? lang('TrialPane.TitleUrgent')
      : lang('TrialPane.Title');
    subtitle = daysRemaining > 0
      ? lang('TrialPane.DaysRemaining', { count: daysRemaining })
      : lang('TrialPane.SubscribeToKeepUsing');
  }

  return (
    <div
      ref={ref}
      className={styles.root}
      role={canManageSubscription ? 'button' : undefined}
      tabIndex={canManageSubscription ? 0 : undefined}
      onClick={handleClick}
    >
      <div className={styles.title}>{title}</div>
      <div className={styles.subtitle}>{subtitle}</div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => ({
    subscription: selectTelebizCurrentOrgSubscription(global),
    hasActiveOrg: Boolean(selectCurrentTelebizOrganization(global)),
    canManageSubscription: selectCanManageOrgSubscription(global),
  }),
)(TrialPane));
