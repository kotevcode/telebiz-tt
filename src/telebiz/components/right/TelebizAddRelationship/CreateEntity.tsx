import type { FC } from '../../../../lib/teact/teact';
import { memo, useEffect, useState } from '../../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../../global';

import type { Integration, Organization, PropertiesByEntityType } from '../../../services/types';
import { TelebizPanelScreens } from '../types';

import { DEBUG } from '../../../../config';
import { selectUser } from '../../../../global/selectors';
import {
  selectCurrentTelebizOrganization,
  selectTelebizProperties,
  selectTelebizSelectedIntegration,
  selectTelebizSelectedIntegrationId,
} from '../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import { type CreateProviderEntityData, ProviderEntityType } from '../../../services';
import { telebizApiClient } from '../../../services';

import useLastCallback from '../../../../hooks/useLastCallback';

import CreateCrmEntityForm from './CreateEntityForm/CreateCrmEntityForm';
import CreatePageForm from './CreateEntityForm/CreatePageForm';
import RelationshipLinkView from './RelationshipLinkView';

import styles from './TelebizAddRelationship.module.scss';

interface OwnProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  chatId: string;
  entityType: ProviderEntityType;
}

type StateProps = {
  currentOrganization?: Organization;
  selectedIntegrationId?: number;
  selectedIntegration?: Integration;
  provider?: string;
  properties: PropertiesByEntityType[];
};

const CreateEntity: FC<OwnProps & StateProps> = ({
  searchQuery,
  setSearchQuery,
  chatId,
  entityType,
  currentOrganization,
  selectedIntegrationId,
  selectedIntegration,
  provider,
  properties,
}) => {
  const {
    openTelebizPanelScreen,
    setTelebizIsAddingRelationship,
    addTelebizRelationship,
  } = getActions();

  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!selectedIntegrationId || !chatId) {
      openTelebizPanelScreen({ screen: TelebizPanelScreens.Main });
    }
  }, [selectedIntegrationId, openTelebizPanelScreen, chatId]);

  const handleCreate = useLastCallback(async (formData: Partial<CreateProviderEntityData>) => {
    const global = getGlobal();
    const user = chatId ? selectUser(global, chatId) : undefined;
    const telegramHandle = user?.usernames?.find((x) => x.isActive)?.username;

    const createData: CreateProviderEntityData = {
      ...formData,
      telegramHandle,
      entityType,
      integrationId: selectedIntegrationId!,
      telegramId: chatId,
      organizationId: currentOrganization?.id,
    };

    setIsCreating(true);
    try {
      // Create the entity
      const entity = await telebizApiClient.integrations.createProviderEntity(createData);
      if (!entity || !selectedIntegrationId) {
        return;
      }

      // Add sync timestamp
      entity.lastSyncAt = Date.now();

      // Link entity to chat
      const relationship = await telebizApiClient.integrations.linkEntity({
        integrationId: selectedIntegrationId,
        telegramId: chatId,
        telegramHandle,
        entityType,
        entityId: entity.id,
        organizationId: currentOrganization?.id,
      });

      // Add relationship AND entity to state
      addTelebizRelationship({ relationship, entity });

      setTelebizIsAddingRelationship({ isAdding: false });
      setSearchQuery('');
      openTelebizPanelScreen({ screen: TelebizPanelScreens.Main });
    } catch (error) {
      // Error will be shown by global error handler
      // Log for debugging purposes
      if (DEBUG) {
        // eslint-disable-next-line no-console
        console.error('Failed to create entity:', error);
      }
    } finally {
      setIsCreating(false);
    }
  });

  const renderForm = useLastCallback(() => {
    switch (entityType) {
      case ProviderEntityType.Page:
        return (
          <CreatePageForm
            initialTitle={searchQuery}
            provider={provider}
            properties={properties}
            onCreate={handleCreate}
            isLoading={isCreating}
          />
        );
      case ProviderEntityType.Deal:
      case ProviderEntityType.Contact:
      case ProviderEntityType.Company:
        return (
          <CreateCrmEntityForm
            initialValue={searchQuery}
            entityType={entityType}
            provider={provider}
            properties={properties}
            onCreate={handleCreate}
            isLoading={isCreating}
          />
        );
      default:
        return undefined;
    }
  });

  return (
    <div className={styles.container}>
      <div className={buildClassName(styles.content, 'custom-scroll')}>
        <RelationshipLinkView chatId={chatId} integration={selectedIntegration}>
          {renderForm()}
        </RelationshipLinkView>
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const selectedIntegration = selectTelebizSelectedIntegration(global);
    const selectedIntegrationId = selectTelebizSelectedIntegrationId(global);

    return {
      currentOrganization: selectCurrentTelebizOrganization(global),
      selectedIntegrationId,
      selectedIntegration,
      provider: selectedIntegration?.provider.type,
      properties: selectedIntegrationId ? selectTelebizProperties(global, selectedIntegrationId) : [],
    };
  },
)(CreateEntity));
