import type { DeviceWithBunkerInfo } from '../../types/api';

type FirmwareVersionProps = {
  version: DeviceWithBunkerInfo['firmware_version'] | null | undefined;
};

export default function FirmwareVersion({ version }: FirmwareVersionProps) {
  const displayVersion = version && version.trim().length > 0 ? version : 'Unknown';
  const isUnknown = displayVersion === 'Unknown';

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        isUnknown ? 'bg-gray-100 text-gray-600' : 'bg-blue-100 text-blue-700'
      }`}
    >
      {isUnknown ? 'Unknown' : `v${displayVersion}`}
    </span>
  );
}
