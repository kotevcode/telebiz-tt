import { memo, useRef } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { TelebizLangKey } from '../../lang/telebizLangPack';
import { TelebizFeatureSection } from '../../global/types/telebizState';

import buildClassName from '../../../util/buildClassName';

import useLastCallback from '../../../hooks/useLastCallback';
import { useScrollAnimation } from '../../hooks/useScrollAnimation';
import { useTelebizLang } from '../../hooks/useTelebizLang';

import styles from './TelebizLandingFeatures.module.scss';

type Feature = {
  key: string;
  iconClass: string;
  titleKey: TelebizLangKey;
  descriptionKey: TelebizLangKey;
};

const FEATURES: Feature[] = [
  {
    key: 'ai-agent',
    iconClass: 'icon-bots',
    titleKey: 'TelebizFeatureAIAgentTitle',
    descriptionKey: 'TelebizFeatureAIAgentDescription',
  },
  {
    key: 'crm',
    iconClass: 'icon-user-filled',
    titleKey: 'TelebizFeatureCRMTitle',
    descriptionKey: 'TelebizFeatureCRMDescription',
  },
  {
    key: 'bulk-messaging',
    iconClass: 'icon-message',
    titleKey: 'TelebizFeatureBulkMessagingTitle',
    descriptionKey: 'TelebizFeatureBulkMessagingDescription',
  },
  {
    key: 'reminders',
    iconClass: 'icon-clock',
    titleKey: 'TelebizFeatureRemindersTitle',
    descriptionKey: 'TelebizFeatureRemindersDescription',
  },
  {
    key: 'templates',
    iconClass: 'icon-document',
    titleKey: 'TelebizFeatureTemplatesTitle',
    descriptionKey: 'TelebizFeatureTemplatesDescription',
  },
  {
    key: 'multi-org',
    iconClass: 'icon-group',
    titleKey: 'TelebizFeatureMultiOrgTitle',
    descriptionKey: 'TelebizFeatureMultiOrgDescription',
  },
];

const FEATURE_SECTION_MAP: Record<string, TelebizFeatureSection> = {
  'ai-agent': TelebizFeatureSection.AiAgent,
  crm: TelebizFeatureSection.CrmIntegration,
  'bulk-messaging': TelebizFeatureSection.BulkSend,
  reminders: TelebizFeatureSection.MessageReminders,
  templates: TelebizFeatureSection.MessageTemplates,
  'multi-org': TelebizFeatureSection.Organizations,
};

const TelebizLandingFeatures = () => {
  const { telebizOpenFeaturesModal } = getActions();

  const lang = useTelebizLang();
  const featuresRef = useRef<HTMLDivElement>();
  const isVisible = useScrollAnimation(featuresRef);

  const handleFeatureClick = useLastCallback((featureKey: string) => {
    const section = FEATURE_SECTION_MAP[featureKey];
    if (section) {
      telebizOpenFeaturesModal({ section });
    }
  });

  const handleKeyDown = useLastCallback((e: React.KeyboardEvent, featureKey: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleFeatureClick(featureKey);
    }
  });

  return (
    <div ref={featuresRef} className={buildClassName(styles.features, isVisible && styles.isVisible)}>
      {FEATURES.map((feature, index) => (
        <div
          key={feature.key}
          className={styles.featureCard}
          style={`animation-delay: ${index * 0.1}s`}
          role="button"
          tabIndex={0}
          onClick={() => handleFeatureClick(feature.key)}
          onKeyDown={(e) => handleKeyDown(e, feature.key)}
          aria-label={lang(feature.titleKey)}
        >
          <div className={styles.featureIcon}>
            <i className={buildClassName('icon', feature.iconClass)} />
          </div>
          <h3 className={styles.featureTitle}>
            {lang(feature.titleKey)}
          </h3>
          <p className={styles.featureDescription}>
            {lang(feature.descriptionKey)}
          </p>
        </div>
      ))}
    </div>
  );
};

export default memo(TelebizLandingFeatures);
