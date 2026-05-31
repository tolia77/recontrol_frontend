import DeviceRow from "src/pages/Devices/DeviceRow";
import type { Device } from "src/types";
import { useTranslation } from "react-i18next";

interface DeviceTableProps {
  devices: Device[];
}

function DevicesTable({ devices }: DeviceTableProps) {
  const { t } = useTranslation("devices");

  return (
    <div className="border-lightgray overflow-x-auto rounded-xl border bg-white shadow-sm">
      <table className="w-full min-w-[700px] table-auto border-collapse md:min-w-0">
        <thead>
          <tr>
            <th className="border-lightgray text-text border-b p-4 text-left text-xl leading-7 font-medium">
              {t("table.name")}
            </th>
            <th className="border-lightgray text-text border-b p-4 text-left text-xl leading-7 font-medium">
              {t("table.status")}
            </th>
            <th className="border-lightgray text-text border-b p-4 text-left text-xl leading-7 font-medium">
              {t("table.lastSeen")}
            </th>
            <th className="border-lightgray text-text border-b p-4 text-left text-xl leading-7 font-medium">
              {t("table.owner")}
            </th>
            <th className="border-lightgray text-text border-b p-4 text-left text-xl leading-7 font-medium">
              {t("table.actions")}
            </th>
          </tr>
        </thead>
        <tbody>
          {devices.map((device) => (
            <DeviceRow key={device.id} device={device} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default DevicesTable;
