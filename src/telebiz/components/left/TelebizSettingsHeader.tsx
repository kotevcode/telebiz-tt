import { memo, useCallback, useMemo, useState } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { Organization, OrganizationMember, Provider, TelebizUser } from '../../services/types';
import { TelebizSettingsScreens } from './types';

import { ORGANIZATION_OWNER_ROLE } from '../../config/constants';
import {
  selectTelebizPendingOrganization,
  selectTelebizProviders,
  selectTelebizSelectedProviderName,
  selectTelebizUser,
} from '../../global/selectors';

import Button from '../../../components/ui/Button';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import DropdownMenu from '../../../components/ui/DropdownMenu';
import MenuItem from '../../../components/ui/MenuItem';
import HeaderMenuButton from '../common/HeaderMenuButton';
import OrganizationSwitcher from './TelebizDrawer/OrganizationSwitcher';
import TelebizNotificationsHeader from './TelebizNotifications/TelebizNotificationsHeader';

type OwnProps = {
  currentScreen: TelebizSettingsScreens;
  onReset: () => void;
};

type StateProps = {
  pendingOrganization?: Partial<Organization>;
  providers: Provider[];
  selectedProviderName?: string;
  user?: TelebizUser;
};

const TelebizSettingsHeader = ({
  currentScreen,
  onReset,
  pendingOrganization,
  providers,
  selectedProviderName,
  user,
}: OwnProps & StateProps) => {
  const {
    openTelebizSettingsScreen,
    deleteTelebizOrganization,
  } = getActions();

  const [isDeleteOrganizationModalOpen, setIsDeleteOrganizationModalOpen] = useState<boolean>(false);

  const selectedProvider = providers.find((p) => p.name === selectedProviderName);

  const isCurrentUserOwner = useMemo(() => {
    const currentUserMember = pendingOrganization?.members?.find(
      (m: Partial<OrganizationMember>) => m.telegram_id === user?.telegram_id,
    );
    return currentUserMember?.role_name === ORGANIZATION_OWNER_ROLE;
  }, [pendingOrganization?.members, user?.telegram_id]);

  const openDeleteOrganizationConfirmation = useCallback(() => {
    setIsDeleteOrganizationModalOpen(true);
  }, []);

  const closeDeleteOrganizationConfirmation = useCallback(() => {
    setIsDeleteOrganizationModalOpen(false);
  }, []);

  const handleDeleteOrganization = useCallback(() => {
    if (!pendingOrganization?.id) return;
    deleteTelebizOrganization({ organizationId: pendingOrganization.id });
    closeDeleteOrganizationConfirmation();
    openTelebizSettingsScreen({ screen: TelebizSettingsScreens.Main });
  }, [closeDeleteOrganizationConfirmation, pendingOrganization, deleteTelebizOrganization, openTelebizSettingsScreen]);

  function renderHeaderContent() {
    switch (currentScreen) {
      case TelebizSettingsScreens.Main:
        return (
          <div className="settings-main-header">
            <h3>Telebiz</h3>
            <OrganizationSwitcher positionX="right" positionY="top" />
          </div>
        );
      case TelebizSettingsScreens.Integrations:
        return <h3>Integrations</h3>;
      case TelebizSettingsScreens.AIIntegrations:
        return <h3>AI</h3>;
      case TelebizSettingsScreens.CustomSkills:
        return <h3>Custom Skills</h3>;
      case TelebizSettingsScreens.Activities:
        return <h3>Activities</h3>;
      case TelebizSettingsScreens.IntegrationDetails:
        return <h3>{selectedProvider?.display_name || 'Integration'}</h3>;
      case TelebizSettingsScreens.OpenRouterIntegration:
        return <h3>OpenRouter</h3>;
      case TelebizSettingsScreens.ClaudeIntegration:
        return <h3>Claude</h3>;
      case TelebizSettingsScreens.OpenAIIntegration:
        return <h3>OpenAI</h3>;
      case TelebizSettingsScreens.GeminiIntegration:
        return <h3>Google Gemini</h3>;
      case TelebizSettingsScreens.McpIntegration:
        return <h3>Local MCP</h3>;
      case TelebizSettingsScreens.Organizations:
        return <h3>Workspaces</h3>;
      case TelebizSettingsScreens.OrganizationsCreate:
        return <h3>Create Workspace</h3>;
      case TelebizSettingsScreens.OrganizationsEdit:
        return (
          <div className="settings-main-header">
            <h3>Edit Workspace</h3>
            {isCurrentUserOwner && (
              <DropdownMenu
                className="settings-more-menu"
                trigger={HeaderMenuButton}
                positionX="right"
              >
                <MenuItem icon="delete" destructive onClick={openDeleteOrganizationConfirmation}>
                  Delete
                </MenuItem>
              </DropdownMenu>
            )}
          </div>
        );
      case TelebizSettingsScreens.OrganizationsAddMembers:
        return <h3>Add Members</h3>;
      case TelebizSettingsScreens.OrganizationsPayment:
        return <h3>Create Workspace</h3>;
      case TelebizSettingsScreens.TemplatesChats:
        return <h3>Templates</h3>;
      case TelebizSettingsScreens.ManageTemplatesChats:
        return <h3>Manage Chats</h3>;
      case TelebizSettingsScreens.Notifications:
        return <TelebizNotificationsHeader />;
      case TelebizSettingsScreens.FocusMode:
        return <h3>Tasks Mode</h3>;
      case TelebizSettingsScreens.Billing:
        return <h3>Billing</h3>;
      case TelebizSettingsScreens.PendingReminders:
        return <h3>Pending Reminders</h3>;
      default:
        return <h3>Telebiz Settings</h3>;
    }
  }

  return (
    <div className="left-header">
      <Button
        round
        size="smaller"
        color="translucent"
        onClick={onReset}
        iconName="arrow-left"
      />
      {renderHeaderContent()}
      <ConfirmDialog
        isOpen={isDeleteOrganizationModalOpen}
        onClose={closeDeleteOrganizationConfirmation}
        confirmIsDestructive
        confirmHandler={handleDeleteOrganization}
        text="Are you sure you want to delete this organization?"
        confirmLabel="Delete"
      />
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => ({
    pendingOrganization: selectTelebizPendingOrganization(global),
    providers: selectTelebizProviders(global),
    selectedProviderName: selectTelebizSelectedProviderName(global),
    user: selectTelebizUser(global),
  }),
)(TelebizSettingsHeader));
