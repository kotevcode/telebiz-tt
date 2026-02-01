import type { FC } from '../../../../lib/teact/teact';
import { memo, useCallback } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { Integration, Organization } from '../../../services/types';
import { LeftColumnContent } from '../../../../types';
import { TelebizSettingsScreens } from '../../left/types';

import {
  selectCurrentTelebizOrganization,
  selectTelebizIntegrationsList,
} from '../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';

import { useTelebizLang } from '../../../hooks/useTelebizLang';

import Icon from '../../../../components/common/icons/Icon';

import styles from './TelebizAddRelationship.module.scss';

type StepConfig = {
  number: number;
  checked: boolean;
  disabled: boolean;
  title: string;
  screen: TelebizSettingsScreens;
  screenName: string;
};

type OwnProps = {
  selectedIntegrationId?: number;
  steps?: StepConfig[];
};

type StateProps = {
  currentOrganization?: Organization;
  integrations: Integration[];
};

const CompleteSteps: FC<OwnProps & StateProps> = ({
  selectedIntegrationId,
  currentOrganization,
  integrations,
  steps: customSteps,
}) => {
  const lang = useTelebizLang();
  const selectedIntegration = integrations.find((it) => it.id === selectedIntegrationId);

  const { openTelebizSettingsScreen, openLeftColumnContent } = getActions();

  const openTelebizSettings = useCallback((screen: TelebizSettingsScreens) => {
    openLeftColumnContent({
      contentKey: LeftColumnContent.Telebiz,
    });
    openTelebizSettingsScreen({
      screen,
    });
  }, [openLeftColumnContent, openTelebizSettingsScreen]);

  const Step: FC<{
    number: number;
    checked: boolean;
    disabled: boolean;
    title: string;
    screen: TelebizSettingsScreens;
    screenName: string;
  }> = memo(({
    number,
    checked,
    disabled,
    title,
    screen,
    screenName,
  }) => {
    return (
      <div className={buildClassName(
        styles.completeStepsWarningStep, (checked || disabled) && styles.completeStepsWarningStepInactive,
      )}
      >
        <div className={buildClassName(
          styles.completeStepsWarningStepIcon, checked && styles.completeStepsWarningStepIconCheck,
        )}
        >
          {checked ? <Icon name="check" /> : number}
        </div>
        <div>
          {title}
          {' '}
          <span
            className={styles.link}
            onClick={() => {
              openTelebizSettings(TelebizSettingsScreens.Main);
            }}
          >
            {lang('CompleteSteps.TelebizSettings')}
          </span>
          {' '}
          →
          {' '}
          <span
            className={buildClassName(styles.link, styles.linkActive)}
            onClick={() => {
              openTelebizSettings(screen);
            }}
          >
            {screenName}
          </span>
        </div>
      </div>
    );
  });

  const resolvedSteps = customSteps || [
    {
      number: 1,
      disabled: false,
      checked: Boolean(currentOrganization),
      title: lang('CompleteSteps.JoinWorkspace'),
      screen: TelebizSettingsScreens.Main,
      screenName: lang('CompleteSteps.Workspaces'),
    },
    {
      number: 2,
      disabled: !currentOrganization,
      checked: Boolean(selectedIntegration),
      title: lang('CompleteSteps.ConnectProvider'),
      screen: TelebizSettingsScreens.Integrations,
      screenName: lang('CompleteSteps.Integrations'),
    },
  ];

  return (
    <div className={styles.completeStepsWarning}>
      <div className={styles.completeStepsWarningMessage}>
        {lang('CompleteSteps.Description')}
      </div>
      <div className={styles.completeStepsWarningSteps}>
        {resolvedSteps.map((step) => (
          <Step
            key={step.number}
            number={step.number}
            disabled={step.disabled}
            checked={step.checked}
            title={step.title}
            screen={step.screen}
            screenName={step.screenName}
          />
        ))}
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => ({
    currentOrganization: selectCurrentTelebizOrganization(global),
    integrations: selectTelebizIntegrationsList(global),
  }),
)(CompleteSteps));
