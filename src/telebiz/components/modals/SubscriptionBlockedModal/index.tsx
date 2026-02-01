import { memo } from '@teact';

import { useTelebizLang } from '../../../hooks/useTelebizLang';

import Icon from '../../../../components/common/icons/Icon';
import Button from '../../../../components/ui/Button';
import Modal from '../../../../components/ui/Modal';

import styles from './SubscriptionBlockedModal.module.scss';

interface SubscriptionBlockedModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpgrade: () => void;
}

const SubscriptionBlockedModal = ({
  isOpen,
  onClose,
  onUpgrade,
}: SubscriptionBlockedModalProps) => {
  const lang = useTelebizLang();

  return (
    <Modal
      className={styles.modal}
      isOpen={isOpen}
      onClose={onClose}
    >
      <div className={styles.content}>
        <div className={styles.icon}>
          <Icon name="lock" />
        </div>
        <h2 className={styles.title}>
          {lang('SubscriptionBlocked.Title')}
        </h2>
        <p className={styles.description}>
          {lang('SubscriptionBlocked.Description')}
        </p>
        <div className={styles.actions}>
          <Button
            onClick={onUpgrade}
          >
            {lang('SubscriptionBlocked.ChoosePlan')}
          </Button>
          <Button
            color="translucent"
            onClick={onClose}
          >
            {lang('SubscriptionBlocked.Later')}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default memo(SubscriptionBlockedModal);
