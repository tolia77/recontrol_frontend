import { useState } from "react";
import { useParams, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { LoadingState, EmptyState, ConfirmModal, PageHeader, Button } from "src/components/ui";
import DeviceInfoForm from "./DeviceInfoForm";
import InviteShareForm from "./InviteShareForm";
import SharesList from "./SharesList";
import EditShareForm from "./EditShareForm";
import { useDeviceSettings } from "./useDeviceSettings";
import { useGate } from "src/hooks/useGate";
import UpgradeModal from "src/components/ui/UpgradeModal";

const DeviceSettings = () => {
  const { t } = useTranslation("deviceSettings");
  const { deviceId } = useParams<{ deviceId: string }>();
  const navigate = useNavigate();
  const gate = useGate("device_sharing");
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const {
    device,
    shares,
    permissionsGroups,
    loading,
    deviceForm,
    setDeviceForm,
    shareForm,
    setShareForm,
    showShareForm,
    setShowShareForm,
    editForm,
    setEditForm,
    setEditOriginalGroup,
    handleDeviceUpdate,
    handleLoadGroupIntoEditor,
    handleEditLoadGroupIntoEditor,
    handleSaveCurrentGroup,
    handleShareSubmit,
    handleDeleteShare,
    beginEditShare,
    handleEditSubmit,
    handleDeleteDevice,
  } = useDeviceSettings({ deviceId });

  if (loading) return <LoadingState message={t("loading")} />;
  if (!device)
    return (
      <div className="p-6">
        <EmptyState title={t("notFound")} />
      </div>
    );

  return (
    <div className="mx-auto w-full max-w-4xl p-4 md:p-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <DeviceInfoForm
        t={t}
        deviceForm={deviceForm}
        onChange={setDeviceForm}
        onSubmit={handleDeviceUpdate}
        onCancel={() => navigate("/devices")}
      />

      <div className="space-y-6">
        <div className="bg-surface border-border rounded-md border p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-heading font-semibold">{t("sharing.section")}</h2>
            <Button
              variant="primary"
              onClick={() => {
                if (!gate.allowed) {
                  setShowUpgradeModal(true);
                  return;
                }
                setShowShareForm(!showShareForm);
              }}
            >
              {showShareForm ? t("sharing.cancelInvite") : t("sharing.invite")}
            </Button>
            {showUpgradeModal && (
              <UpgradeModal
                feature="device_sharing"
                requiredPlan={gate.requiredPlan}
                onClose={() => setShowUpgradeModal(false)}
              />
            )}
          </div>

          {showShareForm && (
            <InviteShareForm
              t={t}
              shareForm={shareForm}
              permissionsGroups={permissionsGroups}
              onChange={setShareForm}
              onSubmit={handleShareSubmit}
              onLoadGroup={handleLoadGroupIntoEditor}
              onSaveGroup={handleSaveCurrentGroup}
            />
          )}

          {editForm && (
            <EditShareForm
              t={t}
              editForm={editForm}
              permissionsGroups={permissionsGroups}
              onChange={(next) => setEditForm(next)}
              onSubmit={handleEditSubmit}
              onLoadGroup={handleEditLoadGroupIntoEditor}
              onSaveGroup={handleSaveCurrentGroup}
              onCancel={() => {
                setEditForm(null);
                setEditOriginalGroup(null);
              }}
            />
          )}

          <SharesList
            t={t}
            shares={shares}
            onDelete={handleDeleteShare}
            onEdit={beginEditShare}
          />
        </div>

        <Button variant="danger" onClick={() => setShowDeleteConfirm(true)}>
          {t("info.deleteDevice")}
        </Button>
      </div>

      {showDeleteConfirm && (
        <ConfirmModal
          open={true}
          title={t("info.deleteDevice")}
          body={t("info.deleteConfirm")}
          confirmLabel={t("info.deleteDevice")}
          dangerous={true}
          isBusy={deleting}
          onConfirm={async () => {
            setDeleting(true);
            try {
              await handleDeleteDevice();
            } finally {
              setDeleting(false);
              setShowDeleteConfirm(false);
            }
          }}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  );
};

export default DeviceSettings;
