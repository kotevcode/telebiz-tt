import { memo } from '@teact';
import { getActions, withGlobal } from '../../../../global';

import type { Subscription } from '../../../services/types';
import { LeftColumnContent } from '../../../../types';
import { TelebizSettingsScreens } from '../../left/types';

import { selectTelebizSubscriptionData } from '../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';

import useLastCallback from '../../../../hooks/useLastCallback';
import { useTelebizLang } from '../../../hooks/useTelebizLang';

import Icon from '../../../../components/common/icons/Icon';

import styles from './TrialBanner.module.scss';

type StateProps = {
  subscription?: Subscription;
};

const URGENT_DAYS_THRESHOLD = 3;

const TrialBanner = ({ subscription }: StateProps) => {
  const { openLeftColumnContent, openTelebizSettingsScreen } = getActions();
  const lang = useTelebizLang();

  const handleUpgradeClick = useLastCallback(() => {
    openLeftColumnContent({ contentKey: LeftColumnContent.Telebiz });
    openTelebizSettingsScreen({ screen: TelebizSettingsScreens.Billing });
  });

  if (!subscription || subscription.status !== 'trial') {
    return undefined;
  }

  const daysRemaining = subscription.trial_days_remaining ?? 0;
  const isUrgent = daysRemaining <= URGENT_DAYS_THRESHOLD;

  return (
    <div className={buildClassName(styles.banner, isUrgent && styles.urgent)}>
      <div className={styles.content}>
        <Icon name="clock" className={styles.icon} />
        <span className={styles.text}>
          <span className={styles.days}>{daysRemaining}</span>
          {' '}
          {lang('TrialBanner.DaysRemaining')}
        </span>
      </div>
      <button
        type="button"
        className={styles.upgradeButton}
        onClick={handleUpgradeClick}
      >
        {lang('TrialBanner.Upgrade')}
      </button>
    </div>
  );
};

export default memo(withGlobal((global): StateProps => ({
  subscription: selectTelebizSubscriptionData(global),
}))(TrialBanner));
