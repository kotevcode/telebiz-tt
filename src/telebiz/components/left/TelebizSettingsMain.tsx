import { memo, useEffect, useMemo, useState } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { TelebizOrganizationsState } from '../../global/types';
import type {
  Integration, Organization, OrganizationInvitation, OrganizationMember, Subscription, TelebizUser,
} from '../../services/types';
import { TelebizSettingsScreens } from './types';

import {
  ORGANIZATION_MANAGER_ROLES,
  ORGANIZATION_OWNER_ROLE,
  TELEBIZ_CONTACT_URL,
  TELEBIZ_FAQ_URL,
  TELEBIZ_PRIVACY_URL,
} from '../../config/constants';
import {
  selectCurrentTelebizOrganization,
  selectTelebizCurrentOrgSubscription,
  selectTelebizIntegrationsList,
  selectTelebizOrganizations,
  selectTelebizUser,
} from '../../global/selectors';
import { telebizApiClient } from '../../services';

import useLastCallback from '../../../hooks/useLastCallback';
import { useTelebizLang } from '../../hooks/useTelebizLang';

import SubscriptionBanner from '../common/SubscriptionBanner';
import Avatar from '../../../components/common/Avatar';
import Button from '../../../components/ui/Button';
import ListItem from '../../../components/ui/ListItem';
import AgentModeOutline from '../icons/AgentModeOutline';
import ShieldWarningFill from '../icons/ShieldWarningFill';
import Template from '../icons/Template';

import orgStyles from './TelebizOrganizations/TelebizOrganizations.module.scss';
import styles from './TelebizSettings.module.scss';

type OwnProps = {
  isActive?: boolean;
  onReset: () => void;
};

type StateProps = {
  organizations: TelebizOrganizationsState;
  currentOrganization?: Organization;
  currentUser?: TelebizUser;
  subscription?: Subscription;
  integrations: Integration[];
};

const TelebizSettingsMain = ({
  isActive,
  onReset,
  organizations,
  currentOrganization,
  currentUser,
  subscription,
  integrations,
}: OwnProps & StateProps) => {
  const {
    openTelebizSettingsScreen,
    openUrl,
    setPendingTelebizOrganization,
    resetPendingTelebizOrganization,
    acceptTelebizOrganizationInvitation,
    telebizOpenFeaturesModal,
  } = getActions();

  const lang = useTelebizLang();
  const [invitations, setInvitations] = useState<OrganizationInvitation[]>([]);

  // Fetch invitations
  useEffect(() => {
    if (currentUser) {
      telebizApiClient.organizations.getMyInvitations().then((inv) => {
        setInvitations(inv);
      });
    }
  }, [currentUser]);

  // Check if current user is a manager/owner of the current organization
  const { isManager, isOwner } = useMemo(() => {
    if (!currentOrganization || !currentUser) return { isManager: false, isOwner: false };
    const member = currentOrganization.members?.find(
      (m: Partial<OrganizationMember>) => m.user_id === currentUser.id,
    );
    return {
      isManager: Boolean(member?.role_name && ORGANIZATION_MANAGER_ROLES.includes(member.role_name)),
      isOwner: member?.role_name === ORGANIZATION_OWNER_ROLE,
    };
  }, [currentOrganization, currentUser]);

  // Notification states
  const needToPay = subscription
    && (subscription.paid_seats ?? 0) < (subscription.total_seats ?? 0);
  const hasNoSubscription = isOwner && needToPay;
  const hasNoIntegrations = integrations.length === 0;

  const hasOrganizations = organizations.organizations.length > 0;

  const handleEditOrganization = useLastCallback(() => {
    if (!currentOrganization) return;
    setPendingTelebizOrganization({ key: currentOrganization });
    openTelebizSettingsScreen({ screen: TelebizSettingsScreens.OrganizationsEdit });
  });

  const handleCreateOrganization = useLastCallback(() => {
    resetPendingTelebizOrganization();
    openTelebizSettingsScreen({ screen: TelebizSettingsScreens.OrganizationsCreate });
  });

  const handleAcceptInvitation = useLastCallback((invitationId: number) => {
    acceptTelebizOrganizationInvitation({ invitationId });
    setInvitations(invitations.filter((i) => i.id !== invitationId));
  });

  const renderNoOrganizations = () => {
    return (
      <>
        <div className="settings-item pt-3">
          <div className={orgStyles.empty}>
            <div className={orgStyles.emptyIcon}>
              <img src="/organization-ph.svg" alt="Organization placeholder" />
            </div>
            <div className={orgStyles.emptyContent}>
              <h3>{lang('Settings.NoOrganizations')}</h3>
              <p>{lang('Settings.NoOrganizationsDescription')}</p>
            </div>
          </div>
        </div>
        <div className="settings-item pt-3">
          <div className={orgStyles.createOrganization}>
            <Button
              className="settings-button with-icon"
              color="primary"
              pill
              fluid
              onClick={handleCreateOrganization}
              iconName="add"
            >
              {lang('Settings.CreateOrganization')}
            </Button>
            <div className={orgStyles.hint}>
              <div className={orgStyles.hintIcon}>
                <ShieldWarningFill />
              </div>
              <div className={orgStyles.hintText}>
                {lang('Settings.PrivacyHint')}
              </div>
            </div>
          </div>
        </div>
      </>
    );
  };

  const OrganizationItem = ({ organization }: { organization: Organization }) => (
    <div className={orgStyles.organizationInfo}>
      <Avatar
        previewUrl={organization?.logo_url}
        text={organization?.name}
      />
      <div className={orgStyles.organizationInfoDetails}>
        <div>{organization?.name}</div>
        <div className={orgStyles.organizationInfoDetailsDescription}>
          {organization?.description}
        </div>
      </div>
    </div>
  );

  const renderInvitations = () => {
    if (!invitations.length) return undefined;

    return (
      <div className="settings-item pt-3">
        <h4 className="settings-item-header mb-3">{lang('Settings.PendingInvitations')}</h4>
        <div className={orgStyles.invitations}>
          {invitations.map((invitation) => (
            <ListItem
              key={invitation.id}
              narrow
              allowSelection={false}
              isStatic
            >
              <OrganizationItem organization={invitation.organization} />
              <Button
                className={orgStyles.invitationButton}
                color="primary"
                pill
                fluid
                size="smaller"
                onClick={() => handleAcceptInvitation(invitation.id)}
              >
                {lang('Settings.AcceptInvitation')}
              </Button>
            </ListItem>
          ))}
        </div>
      </div>
    );
  };

  const renderSupportLinks = () => (
    <div className="settings-item pr-2">
      <ListItem
        icon="info"
        narrow
        onClick={() => telebizOpenFeaturesModal({})}
      >
        {lang('TelebizFeatures.LearnMoreShort')}
      </ListItem>
      <ListItem
        icon="ask-support"
        narrow
        onClick={() => openUrl({ url: TELEBIZ_CONTACT_URL })}
      >
        {lang('Settings.Menu.AskAQuestion')}
      </ListItem>
      <ListItem
        icon="help"
        narrow
        onClick={() => openUrl({ url: TELEBIZ_FAQ_URL })}
      >
        {lang('Settings.Menu.Faq')}
      </ListItem>
      <ListItem
        icon="privacy-policy"
        narrow
        onClick={() => openUrl({ url: TELEBIZ_PRIVACY_URL })}
      >
        {lang('Settings.Menu.PrivacyPolicy')}
      </ListItem>
    </div>
  );

  // Show empty state with create button if no organizations
  if (!hasOrganizations) {
    return (
      <div className="settings-fab-wrapper">
        {renderNoOrganizations()}
        {renderInvitations()}
        {renderSupportLinks()}
      </div>
    );
  }

  return (
    <div className="settings-fab-wrapper">
      <SubscriptionBanner />
      {/* Organization Header */}
      <div className="settings-main-menu">
        <div className="settings-content-header">
          <div className="mb-3">
            <Avatar
              previewUrl={currentOrganization?.logo_url}
              text={currentOrganization?.name}
            />
          </div>
          <div className="settings-item-description">
            <h3>{currentOrganization?.name}</h3>
            <p>{currentOrganization?.description}</p>
          </div>
        </div>
      </div>

      {/* Pending Invitations */}
      {renderInvitations()}

      {/* Settings Section - scoped to selected organization */}
      <div className="settings-main-menu pr-2">
        <ListItem
          icon="link"
          narrow
          onClick={() => openTelebizSettingsScreen({ screen: TelebizSettingsScreens.Integrations })}
          disabled={!currentOrganization}
          rightElement={hasNoIntegrations ? <span className={styles.notificationDot} /> : undefined}
        >
          {lang('Settings.Menu.Integrations')}
        </ListItem>
        <ListItem
          leftElement={<AgentModeOutline />}
          narrow
          buttonClassName={styles.customIconButton}
          onClick={() => openTelebizSettingsScreen({ screen: TelebizSettingsScreens.AIIntegrations })}
        >
          {lang('Settings.Menu.AI')}
        </ListItem>
        <ListItem
          icon="noise-suppression"
          narrow
          onClick={() => openTelebizSettingsScreen({ screen: TelebizSettingsScreens.Activities })}
          disabled={!currentOrganization}
        >
          {lang('Settings.Menu.Activities')}
        </ListItem>
        <ListItem
          leftElement={<Template size={24} />}
          narrow
          buttonClassName={styles.customIconButton}
          onClick={() => openTelebizSettingsScreen({ screen: TelebizSettingsScreens.TemplatesChats })}
          disabled={!currentOrganization}
        >
          {lang('Settings.Menu.TemplatesChats')}
        </ListItem>
        <ListItem
          icon="schedule"
          narrow
          onClick={() => openTelebizSettingsScreen({ screen: TelebizSettingsScreens.PendingReminders })}
        >
          {lang('Settings.Menu.PendingReminders')}
        </ListItem>
      </div>

      {isManager && (
        <div className="settings-main-menu pr-2">
          <ListItem
            icon="card"
            narrow
            onClick={() => openTelebizSettingsScreen({ screen: TelebizSettingsScreens.Billing })}
            disabled={!currentOrganization}
            rightElement={hasNoSubscription ? <span className={styles.notificationDot} /> : undefined}
          >
            {lang('Settings.Menu.Billing')}
          </ListItem>
          <ListItem
            icon="edit"
            narrow
            onClick={handleEditOrganization}
          >
            {lang('Settings.Menu.OrganizationSettings')}
          </ListItem>
        </div>
      )}

      {renderSupportLinks()}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    return {
      organizations: selectTelebizOrganizations(global),
      currentOrganization: selectCurrentTelebizOrganization(global),
      currentUser: selectTelebizUser(global),
      subscription: selectTelebizCurrentOrgSubscription(global),
      integrations: selectTelebizIntegrationsList(global),
    };
  },
)(TelebizSettingsMain));
