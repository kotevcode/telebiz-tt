import { memo, useCallback, useEffect, useMemo, useState } from '../../../../../lib/teact/teact';

import type { PropertiesByEntityType } from '../../../../services';
import type { FormField } from '../../../common/ProviderEntityForm/forms';

import { convertFormFieldsToNotionProperties } from '../../../../util/notion';
import { type CreateProviderEntityData, ProviderEntityType } from '../../../../services';

import { useTelebizLang } from '../../../../hooks/useTelebizLang';

import FloatingActionButton from '../../../../../components/ui/FloatingActionButton';
import LabelList from '../../../common/LabelList';
import ProviderEntityForm from '../../../common/ProviderEntityForm/ProviderEntityForm';

import styles from '../TelebizAddRelationship.module.scss';

interface OwnProps {
  initialTitle: string;
  provider?: string;
  properties: PropertiesByEntityType[];
  onCreate: (createData: Partial<CreateProviderEntityData>) => Promise<void>;
  isLoading?: boolean;
}

const CreatePageForm = ({
  initialTitle,
  onCreate,
  properties,
  provider,
  isLoading: externalIsLoading = false,
}: OwnProps) => {
  const [selectedDatabase, setSelectedDatabase] = useState<PropertiesByEntityType | undefined>();
  const lang = useTelebizLang();

  useEffect(() => {
    if (properties.length > 0 && !selectedDatabase) {
      setSelectedDatabase(properties[0]);
    }
  }, [properties, selectedDatabase]);

  const entityProperties = useMemo(() => {
    return properties.find((e) => e.id === selectedDatabase?.id)?.properties || [];
  }, [selectedDatabase?.id, properties]);

  const initialValues = useMemo(() => {
    const titleProperty = entityProperties.find((p) => p.fieldType === 'title');
    if (!titleProperty) return {};
    return {
      [titleProperty.name]: initialTitle,
    };
  }, [entityProperties, initialTitle]);

  const handleCreate = useCallback(async (form: Record<string, FormField>) => {
    if (!entityProperties.length) return;
    const entityData = convertFormFieldsToNotionProperties(form, entityProperties);
    const createData: Partial<CreateProviderEntityData> = {
      properties: entityData,
      databaseId: selectedDatabase?.id,
    };

    await onCreate(createData);
  }, [entityProperties, selectedDatabase?.id, onCreate]);

  return (
    <>
      {properties.length > 0 && (
        <LabelList
          labels={properties.map((database) => ({
            id: database.id,
            title: database.label || '',
            isActive: selectedDatabase?.id === database.id,
          }))}
          activeLabel={properties.findIndex((p) => p.id === selectedDatabase?.id)}
          onSwitchLabel={(index) => setSelectedDatabase(properties[index])}
          className={styles.databaseSelection}
          activeClassName={styles.databaseSelectionActive}
          labelClassName={styles.entityTypeButton}
        />
      )}
      {selectedDatabase && (
        <ProviderEntityForm
          provider="notion"
          entityType={ProviderEntityType.Page}
          mode="create"
          initialValues={initialValues}
          fieldFilter="all"
          databaseId={selectedDatabase.id}
          onSubmit={handleCreate}
          isLoading={externalIsLoading}
          renderSubmitButton={({ disabled, onSubmit }) => (
            <FloatingActionButton
              isShown
              disabled={disabled}
              ariaLabel={lang('Create')}
              iconName="check"
              isLoading={externalIsLoading}
              onClick={onSubmit}
            />
          )}
          properties={properties}
        />
      )}
    </>
  );
};

export default memo(CreatePageForm);
