import type { ChangeEvent } from 'react';
import type { FC } from '../../../../lib/teact/teact';
import { memo, useCallback, useEffect, useMemo, useState } from '../../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../../global';

import type {
  CreateOrganizationData, Organization, OrganizationMember, Role, Subscription, TelebizUser,
} from '../../../services/types';
import { TelebizSettingsScreens } from '../types';

import { ORGANIZATION_MEMBER_ROLE, ORGANIZATION_OWNER_ROLE } from '../../../config/constants';
import { getMainUsername } from '../../../../global/helpers/users';
import { selectUser } from '../../../../global/selectors';
import {
  selectTelebizAuthIsLoading,
  selectTelebizCurrentOrgSubscription,
  selectTelebizOrganizationsIsLoading,
  selectTelebizPendingOrganization,
  selectTelebizRoles,
  selectTelebizUser,
} from '../../../global/selectors';

import useFlag from '../../../../hooks/useFlag';
import useLastCallback from '../../../../hooks/useLastCallback';
import { useTelebizLang } from '../../../hooks/useTelebizLang';

import Loading from '../../../../components/ui/Loading';
import { telebizApiClient } from '../../../services/api/TelebizApiClient';
import ConfirmMemberChangesModal from './ConfirmMemberChangesModal';
import TelebizOrganizationsAddMembers from './AddMembers';
import TelebizOrganizationsForm from './Form';
import TelebizOrganizationsPayment from './Payment';

type OwnProps = {
  currentScreen: TelebizSettingsScreens;
};

type StateProps = {
  isLoading: boolean;
  isLoadingOrganizations: boolean;
  pendingOrganization?: Partial<Organization>;
  user?: TelebizUser;
  roles: Role[];
  subscription?: Subscription;
};

const TelebizOrganizationsManage: FC<OwnProps & StateProps> = ({
  currentScreen,
  isLoading,
  isLoadingOrganizations,
  pendingOrganization,
  user,
  roles,
  subscription,
}) => {
  const {
    openTelebizSettingsScreen,
    setGlobalSearchQuery,
    createTelebizOrganization,
    updateTelebizOrganizationData,
    setPendingTelebizOrganization,
    showNotification,
  } = getActions();

  const lang = useTelebizLang();

  const isCreating = !pendingOrganization?.id;

  // Track original member count for confirmation modal
  const [originalMemberCount, setOriginalMemberCount] = useState<number | undefined>(undefined);
  const [isConfirmModalOpen, openConfirmModal, closeConfirmModal] = useFlag();

  // Set original member count when entering edit mode (only once when data is first available)
  useEffect(() => {
    if (!isCreating && pendingOrganization?.members && originalMemberCount === undefined) {
      setOriginalMemberCount(pendingOrganization.members.length);
    }
  }, [isCreating, pendingOrganization?.members, originalMemberCount]);

  const orgRoles = useMemo(() => roles.filter((role) => role.scope === 'organization'), [roles]);
  const defaultRoleName = useMemo(
    () => orgRoles.find((role) => role.name === ORGANIZATION_MEMBER_ROLE)?.name || orgRoles[0]?.name,
    [orgRoles],
  );

  // Get current user's role
  const currentUserMember = useMemo(() => (
    pendingOrganization?.members?.find(
      (m: Partial<OrganizationMember>) => m.telegram_id === user?.telegram_id,
    )
  ), [pendingOrganization?.members, user?.telegram_id]);

  const isCurrentUserOwner = currentUserMember?.role_name === ORGANIZATION_OWNER_ROLE;

  // Lock current user (can't remove yourself) + if admin, also lock all owners
  const lockedMemberIds = useMemo(() => {
    const locked: string[] = user?.telegram_id ? [user.telegram_id] : [];

    // If current user is not owner (e.g., admin), lock all owners so they can't be removed
    if (!isCurrentUserOwner) {
      (pendingOrganization?.members || []).forEach((m: Partial<OrganizationMember>) => {
        if (m.role_name === ORGANIZATION_OWNER_ROLE && m.telegram_id) {
          locked.push(m.telegram_id);
        }
      });
    }

    return [...new Set(locked)]; // Remove duplicates
  }, [user?.telegram_id, isCurrentUserOwner, pendingOrganization?.members]);

  const changeSelectedMemberIdsHandler = useLastCallback((ids: string[]) => {
    const isSelection = ids.length > (pendingOrganization?.members?.length || 0);
    const global = getGlobal();

    const newMembers = ids.map((telegramId) => {
      const existingMember = pendingOrganization?.members?.find(
        (m: Partial<OrganizationMember>) => m.telegram_id === telegramId,
      );
      const telegramUser = selectUser(global, telegramId);
      const username = telegramUser ? getMainUsername(telegramUser) : existingMember?.username;

      return {
        telegram_id: telegramId,
        role_name: existingMember?.role_name || defaultRoleName,
        username,
      };
    });

    // Ensure current user is always included (can't remove yourself)
    if (currentUserMember?.telegram_id && !newMembers.some((m) => m.telegram_id === currentUserMember.telegram_id)) {
      const currentTelegramUser = selectUser(global, currentUserMember.telegram_id);
      const currentUsername = currentTelegramUser
        ? getMainUsername(currentTelegramUser)
        : currentUserMember.username;

      newMembers.push({
        telegram_id: currentUserMember.telegram_id,
        role_name: currentUserMember.role_name!,
        username: currentUsername,
      });
    }

    setPendingTelebizOrganization({ key: 'members', value: newMembers });

    if (isSelection) {
      setGlobalSearchQuery({ query: '' });
    }
  });

  const selectedMemberIds = useMemo(() => (
    (pendingOrganization?.members || [])
      .map((m: Partial<OrganizationMember>) => (typeof m === 'string' ? m : m?.telegram_id))
      .filter((id: string | undefined) => Boolean(id))
  ), [pendingOrganization?.members]);

  const isSaveButtonShown = useMemo(() => {
    return Boolean(pendingOrganization?.name);
  }, [pendingOrganization?.name]);

  const handleNameChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setPendingTelebizOrganization({ key: 'name', value: e.target.value });
  }, [setPendingTelebizOrganization]);

  const handleDescriptionChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    setPendingTelebizOrganization({ key: 'description', value: e.target.value });
  }, [setPendingTelebizOrganization]);

  const handleLogoUrlChange = useCallback((file: File) => {
    if (file) {
      telebizApiClient.files.uploadFile(file).then((url) => {
        setPendingTelebizOrganization({ key: 'logo_url', value: url });
      });
    }
  }, [setPendingTelebizOrganization]);

  const handleAddMembersClick = useCallback(() => {
    openTelebizSettingsScreen({ screen: TelebizSettingsScreens.OrganizationsAddMembers });
  }, [openTelebizSettingsScreen]);

  const handleOrganizationPay = useCallback(() => {
    openTelebizSettingsScreen({ screen: TelebizSettingsScreens.OrganizationsPayment });
  }, [openTelebizSettingsScreen]);

  const handleOrganizationSave = useCallback(() => {
    if (!pendingOrganization?.name || !pendingOrganization?.members?.length) {
      return;
    }

    if (pendingOrganization.id) {
      updateTelebizOrganizationData({
        organizationId: pendingOrganization.id,
        data: pendingOrganization as CreateOrganizationData,
      });
    } else {
      createTelebizOrganization({ data: pendingOrganization as CreateOrganizationData });
    }

    openTelebizSettingsScreen({ screen: TelebizSettingsScreens.Main });
  }, [
    pendingOrganization,
    openTelebizSettingsScreen,
    createTelebizOrganization,
    updateTelebizOrganizationData,
  ]);

  const handleDirectSave = useLastCallback(() => {
    if (!pendingOrganization?.name || !pendingOrganization?.members?.length || !pendingOrganization?.id) {
      return;
    }

    updateTelebizOrganizationData({
      organizationId: pendingOrganization.id,
      data: pendingOrganization as CreateOrganizationData,
    });

    openTelebizSettingsScreen({ screen: TelebizSettingsScreens.Main });
  });

  const handleSaveWithConfirmation = useLastCallback(() => {
    const newCount = pendingOrganization?.members?.length || 0;
    const maxSeats = subscription?.max_seats ?? -1;

    // Check if new member count exceeds plan limit (-1 means unlimited)
    if (maxSeats !== -1 && newCount > maxSeats) {
      showNotification({
        message: lang('Organization.MaxSeatsExceeded', { max: maxSeats }),
      });
      return;
    }

    // Show confirmation when member count changed
    // originalMemberCount being undefined means data wasn't loaded yet, skip confirmation
    if (originalMemberCount !== undefined && originalMemberCount !== newCount) {
      openConfirmModal();
    } else {
      handleDirectSave();
    }
  });

  const handleConfirmSave = useLastCallback(() => {
    closeConfirmModal();
    handleDirectSave();
  });

  if (isLoading || isLoadingOrganizations) {
    return <Loading />;
  }

  switch (currentScreen) {
    case TelebizSettingsScreens.OrganizationsCreate:
    case TelebizSettingsScreens.OrganizationsEdit:
      return (
        <>
          <TelebizOrganizationsForm
            id={pendingOrganization?.id || 0}
            isCreating={isCreating}
            isLoading={isLoading || isLoadingOrganizations}
            logoUrl={pendingOrganization?.logo_url || ''}
            handleLogoUrlChange={handleLogoUrlChange}
            name={pendingOrganization?.name || ''}
            handleNameChange={handleNameChange}
            description={pendingOrganization?.description || ''}
            handleDescriptionChange={handleDescriptionChange}
            members={pendingOrganization?.members || []}
            handleAddMembersClick={handleAddMembersClick}
            isSaveButtonShown={isSaveButtonShown}
            handleSubmit={isCreating ? handleOrganizationPay : handleSaveWithConfirmation}
          />
          <ConfirmMemberChangesModal
            isOpen={isConfirmModalOpen}
            currentSeats={originalMemberCount || 0}
            newSeats={pendingOrganization?.members?.length || 0}
            isTrial={subscription?.status === 'trial'}
            onConfirm={handleConfirmSave}
            onClose={closeConfirmModal}
          />
        </>
      );
    case TelebizSettingsScreens.OrganizationsAddMembers:
      return (
        <TelebizOrganizationsAddMembers
          isActive={currentScreen === TelebizSettingsScreens.OrganizationsAddMembers}
          selectedMemberIds={selectedMemberIds}
          lockedMemberIds={lockedMemberIds}
          onSelectedMemberIdsChange={changeSelectedMemberIdsHandler}
          onNextStep={() => openTelebizSettingsScreen({
            screen: isCreating ? TelebizSettingsScreens.OrganizationsCreate : TelebizSettingsScreens.OrganizationsEdit,
          })}
          onReset={() => openTelebizSettingsScreen({
            screen: isCreating ? TelebizSettingsScreens.OrganizationsCreate : TelebizSettingsScreens.OrganizationsEdit,
          })}
        />
      );
    case TelebizSettingsScreens.OrganizationsPayment:
      return (
        <TelebizOrganizationsPayment
          isLoading={isLoading || isLoadingOrganizations}
          logoUrl={pendingOrganization?.logo_url || ''}
          name={pendingOrganization?.name || ''}
          description={pendingOrganization?.description || ''}
          members={pendingOrganization?.members || []}
          handleOrganizationSave={handleOrganizationSave}
        />
      );
    default:
      return undefined;
  }
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => ({
    isLoading: selectTelebizAuthIsLoading(global),
    isLoadingOrganizations: selectTelebizOrganizationsIsLoading(global),
    pendingOrganization: selectTelebizPendingOrganization(global),
    user: selectTelebizUser(global),
    roles: selectTelebizRoles(global),
    subscription: selectTelebizCurrentOrgSubscription(global),
  }),
)(TelebizOrganizationsManage));
