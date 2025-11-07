import React from 'react';
import type { SharesListProps } from './types';

export const SharesList: React.FC<SharesListProps> = ({ t, shares, onDelete, onEdit }) => {
  return (
    <div className="space-y-3">
      {shares.length === 0 ? (
        <p className="text-gray-500 text-center py-4">{t('sharing.noShares')}</p>
      ) : (
        shares.map((share: any) => (
          <div key={share.id} className="flex justify-between items-center p-3 border border-gray-200 rounded-lg">
            <div>
              <p className="font-medium">{share.user?.username || share.user?.email}</p>
              <p className="text-sm text-gray-500">
                {t('sharing.permissions')}: {share.permissions_group?.name || t('sharing.defaultGroup')}
                {share.expires_at && ` • ${t('sharing.expires')}: ${new Date(share.expires_at).toLocaleDateString()}`}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => onEdit(share)}
                className="px-3 py-1 text-blue-600 hover:bg-blue-50 rounded-md"
              >
                {t('sharing.edit')}
              </button>
              <button
                onClick={() => onDelete(share.id)}
                className="px-3 py-1 text-red-600 hover:bg-red-50 rounded-md"
              >
                {t('sharing.remove')}
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
};
