import type { TeactNode } from '@teact';
import { memo, useMemo } from '@teact';
import { getActions, withGlobal } from '../../../../global';

import type { TelebizOrganizationsState } from '../../../global/types';
import type { Organization } from '../../../services';
import { LeftColumnContent } from '../../../../types';
import { TelebizSettingsScreens } from '../types';

import { selectCurrentTelebizOrganization, selectTelebizOrganizations } from '../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';

import useLastCallback from '../../../../hooks/useLastCallback';

import Avatar from '../../../../components/common/Avatar';
import Icon from '../../../../components/common/icons/Icon';
import DropdownMenu from '../../../../components/ui/DropdownMenu';
import MenuItem from '../../../../components/ui/MenuItem';
import MenuSeparator from '../../../../components/ui/MenuSeparator';

import styles from './TelebizDrawer.module.scss';

type OwnProps = {
  positionX?: 'left' | 'right';
  positionY?: 'top' | 'bottom';
};

type StateProps = {
  organizations: TelebizOrganizationsState;
  currentOrganization?: Organization;
};

const OrganizationSwitcher = ({
  organizations,
  currentOrganization,
  positionX = 'left',
  positionY = 'bottom',
}: OwnProps & StateProps) => {
  const {
    switchTelebizOrganization,
    openLeftColumnContent,
    openTelebizSettingsScreen,
    resetPendingTelebizOrganization,
  } = getActions();
  const handleOrganizationSwitch = useLastCallback((organization: Organization) => {
    switchTelebizOrganization({ organization });
  });

  const OrganizationMenuButton = useMemo(() => {
    return ({ onTrigger, isOpen }: { onTrigger: () => void; isOpen?: boolean }): TeactNode => (
      <div
        className={buildClassName(styles.organizationSwitcher, isOpen && styles.organizationSwitcherOpen)}
        onClick={onTrigger}
      >
        <Avatar
          size="small"
          previewUrl={currentOrganization?.logo_url}
          text={currentOrganization?.name}
        />
      </div>
    );
  }, [currentOrganization]);
  return (
    <DropdownMenu
      trigger={OrganizationMenuButton}
      positionX={positionX}
      positionY={positionY}
    >
      {organizations.organizations.map((organization) => (
        <MenuItem
          key={organization.id}
          onClick={() => handleOrganizationSwitch(organization)}
          className={buildClassName(
            styles.organizationMenuItem,
            organization.id === currentOrganization?.id && styles.organizationMenuItemActive,
          )}
        >
          <Avatar
            size="mini"
            previewUrl={organization.logo_url}
            text={organization.name}
          />
          <span>{organization.name}</span>
          {
            organization.id === currentOrganization?.id && <Icon name="check" className="submenu-icon" />
          }
        </MenuItem>
      ))}
      <MenuSeparator />
      <MenuItem
        onClick={() => {
          openLeftColumnContent({ contentKey: LeftColumnContent.Telebiz });
          resetPendingTelebizOrganization();
          openTelebizSettingsScreen({ screen: TelebizSettingsScreens.OrganizationsCreate });
        }}
        icon="add"
      >
        <span>Create</span>
      </MenuItem>
    </DropdownMenu>
  );
};

export default memo(withGlobal<OwnProps>((global): StateProps => {
  return {
    organizations: selectTelebizOrganizations(global),
    currentOrganization: selectCurrentTelebizOrganization(global),
  };
})(OrganizationSwitcher));
