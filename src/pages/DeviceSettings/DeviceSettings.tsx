import { useParams, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { LoadingState, EmptyState } from "src/components/ui";
import DeviceInfoForm from "./DeviceInfoForm";
import InviteShareForm from "./InviteShareForm";
import SharesList from "./SharesList";
import EditShareForm from "./EditShareForm";
import { useDeviceSettings } from "./useDeviceSettings";

const DeviceSettings = () => {
  const { t } = useTranslation("deviceSettings");
  const { deviceId } = useParams<{ deviceId: string }>();
  const navigate = useNavigate();

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
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-6">
        <h1 className="text-text text-2xl font-bold">{t("title")}</h1>
        <p className="text-gray-600">{t("subtitle")}</p>
      </div>

      <DeviceInfoForm
        t={t}
        deviceForm={deviceForm}
        onChange={setDeviceForm}
        onSubmit={handleDeviceUpdate}
        onCancel={() => navigate("/devices")}
      />

      <div className="space-y-6">
        <div className="bg-background border-lightgray rounded-lg border p-6 shadow">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">{t("sharing.section")}</h2>
            <button
              onClick={() => setShowShareForm(!showShareForm)}
              className="bg-primary rounded-md px-4 py-2 text-white transition-opacity hover:opacity-90"
            >
              {showShareForm ? t("sharing.cancelInvite") : t("sharing.invite")}
            </button>
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

        <button
          onClick={handleDeleteDevice}
          className="bg-error rounded-lg px-4 py-2 text-white transition-opacity hover:opacity-90"
        >
          {t("info.deleteDevice")}
        </button>
      </div>
    </div>
  );
};

export default DeviceSettings;
