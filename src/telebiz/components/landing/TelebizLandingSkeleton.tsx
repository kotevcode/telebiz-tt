import { memo } from '../../../lib/teact/teact';

import styles from './TelebizLandingSkeleton.module.scss';

const TelebizLandingSkeleton = () => {
  return (
    <div className={styles.skeleton}>
      <div className={styles.skeletonHero}>
        <div className={styles.skeletonIcon} />
        <div className={styles.skeletonTitle} />
        <div className={styles.skeletonDescription} />
      </div>
      <div className={styles.skeletonFeatures}>
        {Array(6).fill(0).map((_, i) => (
          <div key={i} className={styles.skeletonCard} />
        ))}
      </div>
    </div>
  );
};

export default memo(TelebizLandingSkeleton);
