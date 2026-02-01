import { memo, useEffect, useMemo, useRef, useState } from '@teact';

import type { ProviderEntity } from '../../../services';
import type { PropertiesByEntityType, ProviderPage } from '../../../services/types';
import type { FormField } from './forms';

import { convertNotionPropertiesToFormFields, decodeEntityId } from '../../../util/notion';
import { ProviderEntityType } from '../../../services';
import { buildFormFieldsFromProperties, forms, getFieldNamesForProvider, hasDynamicFields } from './forms';

import useLastCallback from '../../../../hooks/useLastCallback';
import { useProviderProperty } from '../../../hooks/useProviderProperty';

import EntityFormFields from './ProviderEntityFormFields';

import styles from './ProviderEntityForm.module.scss';

interface OwnProps {
  provider: string;
  entityType: ProviderEntityType;
  entity?: Partial<ProviderEntity>;
  onSubmit: (form: Record<string, FormField>) => Promise<void>;
  isLoading: boolean;
  renderSubmitButton: (
    props: {
      disabled: boolean;
      onSubmit: () => void;
    }) => React.ReactNode;
  properties: PropertiesByEntityType[];
  mode?: 'create' | 'edit';
  initialValues?: Record<string, any>;
  fieldFilter?: 'all' | 'minimal';
  databaseId?: string;
}

const EntityForm = ({
  provider,
  entityType,
  entity,
  onSubmit,
  renderSubmitButton,
  isLoading,
  properties,
  mode = 'edit',
  initialValues = {},
  fieldFilter = 'all',
  databaseId,
}: OwnProps) => {
  const firstInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | undefined>(undefined);
  const props = useMemo(
    () => properties.find((e) => e.id as ProviderEntityType === entityType)?.properties || [],
    [properties, entityType],
  );

  const { getPropertyLabel, getPropertyOptions } = useProviderProperty(props);
  const [initialized, setInitialized] = useState(false);

  const formFields = useMemo(() => {
    // Notion pages have special handling
    if (entityType === ProviderEntityType.Page) {
      const pageEntity = entity as ProviderPage | undefined;
      const dbId = pageEntity ? decodeEntityId(pageEntity.id)[1] : databaseId;
      const entityProperties = properties.find((e) => e.id === dbId)?.properties;
      if (entityProperties?.length) {
        return convertNotionPropertiesToFormFields(entityProperties, pageEntity?.properties || {});
      }
    }

    // Use dynamic fields for supported providers (hubspot, pipedrive)
    if (hasDynamicFields(provider, entityType)) {
      const fieldNames = getFieldNamesForProvider(provider, entityType);
      return buildFormFieldsFromProperties(fieldNames, props, provider);
    }

    // Use static forms for unsupported providers or other entity types
    const baseFields = forms[entityType];
    if (!baseFields) return [];

    // Enrich select fields with options from properties
    return baseFields.map((field) => {
      const updatedField = { ...field, providerLabel: getPropertyLabel(field.name) };
      if ((field.type === 'select' || field.type === 'multiselect')) {
        const options = getPropertyOptions(field.name);
        if (Array.isArray(options) && options.length > 0) {
          return { ...updatedField, options };
        }
      }
      return updatedField;
    }).filter((field) => {
      // Hide select/multiselect fields with no options
      if (field.type === 'select' || field.type === 'multiselect') {
        return field.options && Array.isArray(field.options) && field.options.length > 0;
      }
      return true;
    });
  }, [entityType, entity, properties, provider, props, getPropertyLabel, getPropertyOptions]);

  const [form, setForm] = useState<Record<string, FormField>>({});

  useEffect(() => {
    if (!formFields) return;

    setInitialized(true);

    if (entity && entityType !== ProviderEntityType.Page) {
      setForm(formFields.reduce((acc, field) => {
        const entityValue = (entity as Record<string, any>)[field.name];
        acc[field.name] = { ...field, value: entityValue !== undefined ? entityValue : field.value };
        return acc;
      }, {} as Record<string, FormField>));
      return;
    }
    // Create mode: use initialValues if provided
    setForm(formFields.reduce((acc, field) => {
      const initialValue = initialValues[field.name];
      acc[field.name] = {
        ...field,
        value: initialValue !== undefined ? initialValue : field.value,
      };
      return acc;
    }, {} as Record<string, FormField>));
  }, [entityType, entity, formFields]);

  useEffect(() => {
    if (initialized && firstInputRef.current) {
      firstInputRef.current.focus();
    }
  }, [initialized, firstInputRef]);

  const handleChange = useLastCallback((key: string, value: string | string[]) => {
    const updatedForm = { ...form, [key]: { ...form[key], value } };

    // Reset dependent fields when parent field changes
    if (formFields) {
      formFields.forEach((field) => {
        if (field.dependsOn !== key) return;
        if (field.type !== 'select' && field.type !== 'multiselect') return;

        let resetValue: string | string[] = field.type === 'multiselect' ? [] : '';

        // For dependent fields, options is Record<string, FormFieldOption[]>
        if (field.options && !Array.isArray(field.options)) {
          const newOptions = field.options[value as string];
          const firstOptionValue = newOptions?.[0]?.value || '';

          resetValue = field.type === 'multiselect'
            ? (firstOptionValue ? [firstOptionValue] : [])
            : firstOptionValue;
        }

        updatedForm[field.name] = { ...updatedForm[field.name], value: resetValue };
      });
    }

    setForm(updatedForm);
  });

  const clearForm = useLastCallback(() => {
    setForm({});
    setInitialized(false);
  });

  const isFormValid = () => {
    return formFields?.some((field) => {
      const value = form[field.name]?.value;
      return value !== undefined && value !== '';
    }) || false;
  };

  const handleSubmit = useLastCallback(async () => {
    if (!isFormValid()) {
      return;
    }
    await onSubmit(form);
    clearForm();
  });

  return initialized && (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
    >
      <div className={styles.form}>
        <div className={styles.formField}>
          <EntityFormFields formFields={formFields || []} handleChange={handleChange} form={form} />
          {renderSubmitButton({
            disabled: isLoading || !isFormValid(),
            onSubmit: handleSubmit,
          })}
        </div>
      </div>
    </form>
  );
};

export default memo(EntityForm);
