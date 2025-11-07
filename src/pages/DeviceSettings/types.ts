import type { PermissionsGroup } from 'src/types/global';

export interface ShareFormState {
  userEmail: string;
  permissionsGroupId: string;
  expiresAt: string;
  newGroup: {
    name: string;
    see_screen: boolean;
    see_system_info: boolean;
    access_mouse: boolean;
    access_keyboard: boolean;
    access_terminal: boolean;
    manage_power: boolean;
  };
}

export interface DeviceInfoFormState {
  name: string;
}

export type LoadGroupHandler = () => void;
export type SaveGroupHandler = () => void;

export interface InviteShareFormProps {
  t: any; // i18next TFunction
  shareForm: ShareFormState;
  permissionsGroups: PermissionsGroup[];
  onChange: (next: ShareFormState) => void;
  onSubmit: (e: React.FormEvent) => void;
  onLoadGroup: LoadGroupHandler;
  onSaveGroup: SaveGroupHandler;
}

export interface DeviceInfoFormProps {
  t: any;
  deviceForm: DeviceInfoFormState;
  onChange: (next: DeviceInfoFormState) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

export interface SharesListProps {
  t: any;
  shares: any[]; // Using any to avoid extending global types in this file
  onDelete: (id: string) => void;
}

