import type { PermissionsGroup, PermissionsGroupAttributes } from 'src/types';

export interface ShareFormState {
  userEmail: string;
  permissionsGroupId: string;
  expiresAt: string;
  newGroup: PermissionsGroupAttributes;
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

export interface EditShareFormState {
  shareId: string;
  permissionsGroupId: string;
  expiresAt: string;
  newGroup: PermissionsGroupAttributes;
}

export interface EditShareFormProps {
  t: any;
  editForm: EditShareFormState;
  permissionsGroups: PermissionsGroup[];
  onChange: (next: EditShareFormState) => void;
  onSubmit: (e: React.FormEvent) => void;
  onLoadGroup: LoadGroupHandler;
  onSaveGroup: SaveGroupHandler;
  onCancel: () => void;
}

export interface SharesListProps {
  t: any;
  shares: any[]; // Using any to avoid extending global types in this file
  onDelete: (id: string) => void;
  onEdit: (share: any) => void;
}
