import { memo, useCallback, useMemo } from '../../../../../lib/teact/teact';

import type { PropertiesByEntityType } from '../../../../services';
import type { FormField } from '../../../common/ProviderEntityForm/forms';

import { type CreateProviderEntityData, ProviderEntityType } from '../../../../services';

import { useTelebizLang } from '../../../../hooks/useTelebizLang';

import FloatingActionButton from '../../../../../components/ui/FloatingActionButton';
import ProviderEntityForm from '../../../common/ProviderEntityForm/ProviderEntityForm';

interface OwnProps {
  initialValue: string;
  entityType: ProviderEntityType.Deal | ProviderEntityType.Contact | ProviderEntityType.Company;
  provider?: string;
  properties: PropertiesByEntityType[];
  onCreate: (createData: Partial<CreateProviderEntityData>) => Promise<void>;
  error?: string;
  integrationId?: number;
  isLoading?: boolean;
}

function getInitialFieldName(entityType: ProviderEntityType): string {
  if (entityType === ProviderEntityType.Deal) {
    return 'title';
  }
  return 'name';
}

const CreateCrmEntityForm = ({
  initialValue,
  entityType,
  onCreate,
  properties,
  provider = 'hubspot',
  isLoading = false,
}: OwnProps) => {
  const lang = useTelebizLang();

  const initialValues = useMemo(() => {
    const fieldName = getInitialFieldName(entityType);
    return { [fieldName]: initialValue };
  }, [entityType, initialValue]);

  const handleSubmit = useCallback(async (form: Record<string, FormField>) => {
    // Convert all form fields to plain values
    const formData = Object.fromEntries(
      Object.entries(form)
        .filter(([, field]) => field.value !== undefined && field.value !== '')
        .map(([key, field]) => {
          // Map frontend field names to API field names
          const apiKey = key === 'pipeline' ? 'pipelineId' : key;
          return [apiKey, field.value];
        }),
    );

    await onCreate(formData as Partial<CreateProviderEntityData>);
  }, [onCreate]);

  return (
    <ProviderEntityForm
      provider={provider}
      entityType={entityType}
      mode="create"
      initialValues={initialValues}
      fieldFilter="minimal"
      onSubmit={handleSubmit}
      isLoading={isLoading}
      properties={properties}
      renderSubmitButton={({ disabled, onSubmit }) => (
        <FloatingActionButton
          isShown
          disabled={disabled}
          ariaLabel={lang('Create')}
          iconName="check"
          isLoading={isLoading}
          onClick={onSubmit}
        />
      )}
    />
  );
};

export default memo(CreateCrmEntityForm);
