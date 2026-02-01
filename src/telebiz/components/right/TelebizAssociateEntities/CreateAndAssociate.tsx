import { memo, useCallback, useEffect, useState } from '../../../../lib/teact/teact';
import { getActions, getPromiseActions, withGlobal } from '../../../../global';

import type {
  Organization,
  PropertiesByEntityType,
  ProviderEntity,
  ProviderEntityParent,
  ProviderRelationship,
} from '../../../services/types';
import { TelebizPanelScreens } from '../types';

import { selectCurrentMessageList } from '../../../../global/selectors';
import {
  selectCurrentTelebizOrganization,
  selectTelebizEntity,
  selectTelebizProperties,
  selectTelebizSelectedRelationship,
} from '../../../global/selectors';
import { isJsonString, parseJsonMessage } from '../../../util/general';
import { type CreateProviderEntityData, ProviderEntityType } from '../../../services';

import CreateCrmEntityForm from '../TelebizAddRelationship/CreateEntityForm/CreateCrmEntityForm';
import RelationshipLinkView from '../TelebizAddRelationship/RelationshipLinkView';

import styles from '../TelebizAddRelationship/TelebizAddRelationship.module.scss';

interface OwnProps {
  searchQuery: string;
  chatId: string;
  setSearchQuery: (query: string) => void;
  entityType: ProviderEntityType;
}

type StateProps = {
  selectedRelationship?: ProviderRelationship;
  parentEntity?: ProviderEntity;
  currentOrganization?: Organization;
  provider?: string;
  properties: PropertiesByEntityType[];
};

const CreateAndAssociateEntity = ({
  searchQuery,
  chatId,
  setSearchQuery,
  entityType,
  selectedRelationship,
  parentEntity,
  currentOrganization,
  provider,
  properties,
}: OwnProps & StateProps) => {
  const { openTelebizPanelScreen } = getActions();

  const [createError, setCreateError] = useState<string | undefined>(undefined);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!selectedRelationship || !chatId) {
      openTelebizPanelScreen({ screen: TelebizPanelScreens.Main });
    }
  }, [selectedRelationship, openTelebizPanelScreen, chatId]);

  const handleCreate = useCallback(async (formData: Partial<CreateProviderEntityData>): Promise<void> => {
    if (!selectedRelationship) return;
    const createData: CreateProviderEntityData = {
      ...formData,
      entityType,
      integrationId: selectedRelationship.integration_id,
      telegramId: chatId,
      organizationId: currentOrganization?.id,
      parentEntityId: selectedRelationship.entity_id,
      parentEntityType: selectedRelationship.entity_type,
    };

    setIsCreating(true);
    try {
      await getPromiseActions().createTelebizAssociation({
        data: createData,
        parentEntity: {
          entityType: selectedRelationship.entity_type,
          entityId: selectedRelationship.entity_id,
        } as ProviderEntityParent,
      });
      setSearchQuery('');
      openTelebizPanelScreen({ screen: TelebizPanelScreens.Main });
      setCreateError(undefined);
    } catch (error) {
      setIsCreating(false);
      if (typeof error === 'object' && error && 'message' in error && error.message
        && typeof error.message === 'string' && isJsonString(error.message)) {
        const parsedMessage = JSON.parse(error.message).message;
        const errorData = parseJsonMessage(parsedMessage);
        if (errorData && errorData.length > 0) {
          setCreateError(errorData.map((item: any) => item.message).join(', '));
        } else {
          setCreateError(parsedMessage);
        }
      }
      throw error;
    }
  }, [
    selectedRelationship,
    entityType,
    chatId,
    currentOrganization?.id,
    setCreateError,
    setSearchQuery,
    openTelebizPanelScreen,
  ]);

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <RelationshipLinkView parentEntity={parentEntity} parentEntityType={selectedRelationship?.entity_type}>
          {(entityType === ProviderEntityType.Deal
            || entityType === ProviderEntityType.Contact
            || entityType === ProviderEntityType.Company) && (
            <CreateCrmEntityForm
              initialValue={searchQuery}
              entityType={entityType}
              provider={provider}
              properties={properties}
              onCreate={handleCreate}
              error={createError}
              integrationId={selectedRelationship?.integration_id}
              isLoading={isCreating}
            />
          )}
        </RelationshipLinkView>
      </div>
    </div>

  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const { chatId } = selectCurrentMessageList(global) || {};
    const selectedRelationship = chatId ? selectTelebizSelectedRelationship(global, chatId) : undefined;

    let parentEntity: ProviderEntity | undefined;
    if (selectedRelationship) {
      parentEntity = selectTelebizEntity(
        global,
        selectedRelationship.integration_id,
        selectedRelationship.entity_type,
        selectedRelationship.entity_id,
      );
    }

    const integrationId = selectedRelationship?.integration_id;

    return {
      selectedRelationship,
      parentEntity,
      currentOrganization: selectCurrentTelebizOrganization(global),
      provider: parentEntity?.provider,
      properties: integrationId ? selectTelebizProperties(global, integrationId) : [],
    };
  },
)(CreateAndAssociateEntity));
