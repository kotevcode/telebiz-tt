import { memo } from '@teact';
import { getActions, withGlobal } from '../../../../global';

import { LeftColumnContent } from '../../../../types';
import { TelebizSettingsScreens } from '../../left/types';

import { selectTabState } from '../../../../global/selectors';
import SubscriptionBlockedModal from '.';

import useLastCallback from '../../../../hooks/useLastCallback';

type StateProps = {
  isOpen: boolean;
};

const SubscriptionBlockedModalContainer = ({
  isOpen,
}: StateProps) => {
  const {
    closeTelebizSubscriptionBlockedModal,
    openLeftColumnContent,
    openTelebizSettingsScreen,
  } = getActions();

  const handleClose = useLastCallback(() => {
    closeTelebizSubscriptionBlockedModal();
  });

  const handleUpgrade = useLastCallback(() => {
    closeTelebizSubscriptionBlockedModal();
    openLeftColumnContent({ contentKey: LeftColumnContent.Telebiz });
    openTelebizSettingsScreen({ screen: TelebizSettingsScreens.Billing });
  });

  if (!isOpen) {
    return undefined;
  }

  return (
    <SubscriptionBlockedModal
      isOpen={isOpen}
      onClose={handleClose}
      onUpgrade={handleUpgrade}
    />
  );
};

export default memo(withGlobal(
  (global): StateProps => {
    const tabState = selectTabState(global);
    return {
      isOpen: Boolean(tabState.subscriptionBlockedModal?.isOpen),
    };
  },
)(SubscriptionBlockedModalContainer));
