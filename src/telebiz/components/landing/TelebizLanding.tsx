import { memo } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import useLastCallback from '../../../hooks/useLastCallback';

import TelebizLandingCTA from './TelebizLandingCTA';
import TelebizLandingFeatures from './TelebizLandingFeatures';
import TelebizLandingHero from './TelebizLandingHero';
import TelebizLandingSkeleton from './TelebizLandingSkeleton';

import styles from './TelebizLanding.module.scss';

type StateProps = {
  isTelebizEnabled?: boolean;
  isAuthenticated?: boolean;
  isLoading?: boolean;
};

const TelebizLanding = ({
  isTelebizEnabled,
  isAuthenticated,
  isLoading,
}: StateProps) => {
  const { telebizOpenFeaturesModal } = getActions();

  const handleLearnMore = useLastCallback(() => {
    telebizOpenFeaturesModal();
  });

  if (!isTelebizEnabled || !isAuthenticated) {
    return undefined;
  }

  if (isLoading) {
    return (
      <div className={styles.landing}>
        <div className={styles.content}>
          <TelebizLandingSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.landing}>
      <div className={styles.content}>
        <TelebizLandingHero />
        <TelebizLandingFeatures />
        <TelebizLandingCTA
          onLearnMore={handleLearnMore}
        />
      </div>
    </div>
  );
};

export default memo(
  withGlobal<Record<string, never>>((global): Complete<StateProps> => {
    const telebiz = global.telebiz;
    return {
      isTelebizEnabled: Boolean(telebiz),
      isAuthenticated: Boolean(telebiz?.auth?.isAuthenticated),
      isLoading: Boolean(telebiz?.auth?.isLoading),
    };
  })(TelebizLanding),
);
