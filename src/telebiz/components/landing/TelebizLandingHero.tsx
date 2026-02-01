import { memo, useRef } from '../../../lib/teact/teact';

import buildClassName from '../../../util/buildClassName';

import { useScrollAnimation } from '../../hooks/useScrollAnimation';
import { useTelebizLang } from '../../hooks/useTelebizLang';

import styles from './TelebizLandingHero.module.scss';

const TelebizLandingHero = () => {
  const lang = useTelebizLang();
  const heroRef = useRef<HTMLDivElement>();
  const isVisible = useScrollAnimation(heroRef);

  return (
    <div ref={heroRef} className={buildClassName(styles.hero, isVisible && styles.isVisible)}>
      <h1 className={styles.title}>
        {lang('TelebizLanding.Title')}
      </h1>
      <p className={styles.description}>
        {lang('TelebizLanding.Description')}
      </p>
    </div>
  );
};

export default memo(TelebizLandingHero);
