import type { Device } from "@packages/database";

/**
 * Image metadata for filtering
 */
export interface ImageMetadata {
  width: number;
  height: number;
  filesize: number;
  nsfw: boolean;
}

/**
 * Result of checking if an image is eligible for a device
 */
export interface EligibilityResult {
  eligible: boolean;
  reason?: string;
}

/**
 * Check if an image matches a device's NSFW filter
 */
function checkNsfw(device: Device, imageNsfw: boolean): EligibilityResult {
  // 0 = accept all, 1 = reject nsfw, 2 = nsfw only
  if (device.nsfw === 1 && imageNsfw) {
    return { eligible: false, reason: "Device rejects NSFW content" };
  }
  if (device.nsfw === 2 && !imageNsfw) {
    return { eligible: false, reason: "Device requires NSFW content" };
  }
  return { eligible: true };
}

/**
 * Check if an image's aspect ratio is within the device's tolerance
 */
function checkAspectRatio(device: Device, imageWidth: number, imageHeight: number): EligibilityResult {
  const deviceRatio = device.width / device.height;
  const imageRatio = imageWidth / imageHeight;
  const deviation = Math.abs(deviceRatio - imageRatio);

  if (deviation > device.aspectRatioDeviation) {
    return {
      eligible: false,
      reason: `Aspect ratio ${imageRatio.toFixed(2)} outside tolerance (device: ${deviceRatio.toFixed(2)} ± ${device.aspectRatioDeviation})`,
    };
  }
  return { eligible: true };
}

/**
 * Check if an image's dimensions are within the device's constraints
 */
function checkDimensions(device: Device, imageWidth: number, imageHeight: number): EligibilityResult {
  if (device.minWidth !== null && imageWidth < device.minWidth) {
    return { eligible: false, reason: `Width ${imageWidth} below minimum ${device.minWidth}` };
  }
  if (device.maxWidth !== null && imageWidth > device.maxWidth) {
    return { eligible: false, reason: `Width ${imageWidth} above maximum ${device.maxWidth}` };
  }
  if (device.minHeight !== null && imageHeight < device.minHeight) {
    return { eligible: false, reason: `Height ${imageHeight} below minimum ${device.minHeight}` };
  }
  if (device.maxHeight !== null && imageHeight > device.maxHeight) {
    return { eligible: false, reason: `Height ${imageHeight} above maximum ${device.maxHeight}` };
  }
  return { eligible: true };
}

/**
 * Check if an image's filesize is within the device's constraints
 */
function checkFilesize(device: Device, filesize: number): EligibilityResult {
  if (device.minFilesize !== null && filesize < device.minFilesize) {
    return { eligible: false, reason: `Filesize ${filesize} below minimum ${device.minFilesize}` };
  }
  if (device.maxFilesize !== null && filesize > device.maxFilesize) {
    return { eligible: false, reason: `Filesize ${filesize} above maximum ${device.maxFilesize}` };
  }
  return { eligible: true };
}

/**
 * Check if an image is eligible for a specific device
 */
export function isEligibleForDevice(device: Device, image: ImageMetadata): EligibilityResult {
  // Skip disabled devices
  if (!device.enabled) {
    return { eligible: false, reason: "Device is disabled" };
  }

  // Check NSFW
  const nsfwResult = checkNsfw(device, image.nsfw);
  if (!nsfwResult.eligible) return nsfwResult;

  // Check aspect ratio
  const aspectResult = checkAspectRatio(device, image.width, image.height);
  if (!aspectResult.eligible) return aspectResult;

  // Check dimensions
  const dimResult = checkDimensions(device, image.width, image.height);
  if (!dimResult.eligible) return dimResult;

  // Check filesize
  const filesizeResult = checkFilesize(device, image.filesize);
  if (!filesizeResult.eligible) return filesizeResult;

  return { eligible: true };
}

/**
 * Find all devices that an image is eligible for
 */
export function findEligibleDevices(
  devices: Device[],
  image: ImageMetadata
): { device: Device; result: EligibilityResult }[] {
  return devices.map((device) => ({
    device,
    result: isEligibleForDevice(device, image),
  }));
}

/**
 * Check if an image is eligible for at least one device
 */
export function isEligibleForAnyDevice(devices: Device[], image: ImageMetadata): boolean {
  return devices.some((device) => isEligibleForDevice(device, image).eligible);
}

/**
 * Get all eligible devices for an image
 */
export function getEligibleDevices(devices: Device[], image: ImageMetadata): Device[] {
  return devices.filter((device) => isEligibleForDevice(device, image).eligible);
}
