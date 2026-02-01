import { memo } from '@teact';
import { getActions, withGlobal } from '../../../../global';

import { LeftColumnContent } from '../../../../types';
import { TelebizSettingsScreens } from '../../left/types';

import { selectCanManageOrgSubscription, selectTelebizIsSubscriptionActive } from '../../../global/selectors';

import useLastCallback from '../../../../hooks/useLastCallback';
import { useTelebizLang } from '../../../hooks/useTelebizLang';

import Icon from '../../../../components/common/icons/Icon';
import Button from '../../../../components/ui/Button';

import styles from './SubscriptionBanner.module.scss';

type StateProps = {
  isSubscriptionActive: boolean;
  canManageSubscription: boolean;
};

const SubscriptionBanner = ({ isSubscriptionActive, canManageSubscription }: StateProps) => {
  const { openLeftColumnContent, openTelebizSettingsScreen } = getActions();
  const lang = useTelebizLang();

  const handleChoosePlan = useLastCallback(() => {
    openLeftColumnContent({ contentKey: LeftColumnContent.Telebiz });
    openTelebizSettingsScreen({ screen: TelebizSettingsScreens.Billing });
  });

  if (isSubscriptionActive) {
    return undefined;
  }

  return (
    <div className={styles.banner}>
      <div className={styles.content}>
        <Icon name="lock" className={styles.icon} />
        <span className={styles.text}>
          {lang(canManageSubscription ? 'SubscriptionBanner.Message' : 'SubscriptionBanner.ContactOwner')}
        </span>
      </div>
      {canManageSubscription && (
        <Button
          size="tiny"
          fluid
          color="danger"
          onClick={handleChoosePlan}
        >
          {lang('SubscriptionBanner.Action')}
        </Button>
      )}
    </div>
  );
};

export default memo(withGlobal((global): StateProps => ({
  isSubscriptionActive: selectTelebizIsSubscriptionActive(global),
  canManageSubscription: selectCanManageOrgSubscription(global),
}))(SubscriptionBanner));
