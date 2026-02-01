import { memo, useRef } from '../../../lib/teact/teact';

import buildClassName from '../../../util/buildClassName';

import { useScrollAnimation } from '../../hooks/useScrollAnimation';
import { useTelebizLang } from '../../hooks/useTelebizLang';

import Button from '../../../components/ui/Button';

import styles from './TelebizLandingCTA.module.scss';

type OwnProps = {
  onStartChat?: () => void;
  onOpenAgent?: () => void;
  onLearnMore?: () => void;
};

const TelebizLandingCTA = ({
  onLearnMore,
}: OwnProps) => {
  const lang = useTelebizLang();
  const ctaRef = useRef<HTMLDivElement>();
  const isVisible = useScrollAnimation(ctaRef);

  return (
    <div ref={ctaRef} className={buildClassName(styles.cta, isVisible && styles.isVisible)}>
      <h2 className={styles.ctaTitle}>
        {lang('TelebizLanding.CTA.Title')}
      </h2>
      <p className={styles.ctaDescription}>
        {lang('TelebizLanding.CTA.Description')}
      </p>
      <div className={styles.ctaButtons}>
        <Button
          isText
          onClick={onLearnMore}
        >
          {lang('TelebizLanding.CTA.LearnMore')}
        </Button>
      </div>
    </div>
  );
};

export default memo(TelebizLandingCTA);
