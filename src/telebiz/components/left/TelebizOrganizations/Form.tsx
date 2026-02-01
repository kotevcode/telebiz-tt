import type { ChangeEvent } from 'react';
import { memo, useState } from '../../../../lib/teact/teact';

import type { OrganizationMember } from '../../../services/types';

import buildClassName from '../../../../util/buildClassName';
import { disableDirectTextInput, enableDirectTextInput } from '../../../../util/directInputManager';

import useOldLang from '../../../../hooks/useOldLang';
import { useTelebizLang } from '../../../hooks/useTelebizLang';

import AvatarEditable from '../../../../components/ui/AvatarEditable';
import FloatingActionButton from '../../../../components/ui/FloatingActionButton';
import InputText from '../../../../components/ui/InputText';
import ListItem from '../../../../components/ui/ListItem';
import TextArea from '../../../../components/ui/TextArea';
import MembersList from './MembersList';

import styles from './TelebizOrganizations.module.scss';

const ERROR_ORGANIZATION_NAME_MISSING = 'Please provide your organization name';
const ERROR_NO_MEMBERS = 'Please add at least one member to your organization';

const TelebizOrganizationsForm = ({
  id,
  isCreating,
  isLoading,
  logoUrl,
  handleLogoUrlChange,
  name,
  handleNameChange,
  description,
  handleDescriptionChange,
  members,
  handleAddMembersClick,
  isSaveButtonShown,
  handleSubmit,
}: {
  id: number;
  isCreating: boolean;
  isLoading: boolean;
  logoUrl: string;
  handleLogoUrlChange: (file: File) => void;
  name: string;
  handleNameChange: (e: ChangeEvent<HTMLInputElement>) => void;
  description: string;
  handleDescriptionChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  members: Partial<OrganizationMember>[];
  handleAddMembersClick: () => void;
  isSaveButtonShown: boolean;
  handleSubmit: () => void;
}) => {
  const lang = useTelebizLang();
  const tgLang = useOldLang();
  const [error, setError] = useState<string | undefined>();

  return (
    <div className="settings-fab-wrapper">
      <div className={buildClassName('custom-scroll', styles.form)}>
        <div className="settings-item">
          <div
            className="settings-input"
            onFocus={() => disableDirectTextInput()}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                enableDirectTextInput();
              }
            }}
          >
            <AvatarEditable
              currentAvatarBlobUrl={logoUrl}
              onChange={handleLogoUrlChange}
              title="Edit your workspace logo"
              disabled={isLoading}
            />
            <InputText
              id="org-name-input"
              value={name}
              onChange={handleNameChange}
              label={lang('Workspace Name (required)')}
              disabled={isLoading}
              error={error === ERROR_ORGANIZATION_NAME_MISSING ? error : undefined}
              teactExperimentControlled
            />
            <TextArea
              id="org-description-input"
              label={lang('Description (optional)')}
              value={description || ''}
              onChange={handleDescriptionChange}
              disabled={isLoading}
              noReplaceNewlines
              maxLength={200}
              maxLengthIndicator={(200 - (description?.length || 0)).toString()}
            />
          </div>

          <p className="settings-item-description" dir={tgLang.isRtl ? 'rtl' : undefined}>
            {lang('You can provide an optional description for your workspace.')}
          </p>
        </div>
        <div className="settings-item">
          {error === ERROR_NO_MEMBERS && (
            <p className="settings-item-description color-danger mb-2" dir={tgLang.isRtl ? 'rtl' : undefined}>
              {lang(error)}
            </p>
          )}

          <h4 className="settings-item-header mb-3" dir={tgLang.isRtl ? 'rtl' : undefined}>{lang('Members')}</h4>

          <div className="members-list">
            <MembersList members={members} />
          </div>

          <ListItem
            withPrimaryColor
            icon="add-user"
            narrow
            onClick={handleAddMembersClick}
          >
            {lang('Manage Members')}
          </ListItem>

        </div>

      </div>
      <FloatingActionButton
        isShown={isSaveButtonShown}
        onClick={handleSubmit}
        disabled={isLoading}
        ariaLabel={tgLang('Save')}
        iconName={isCreating ? 'arrow-right' : 'check'}
        isLoading={isLoading}
      />
    </div>
  );
};

export default memo(TelebizOrganizationsForm);
