export const COMPLAINT_PHOTO_IDS = Object.freeze(["complaint_photo_1", "complaint_photo_2", "complaint_photo_3"]);
export const COMPLAINT_PHOTO_MIME_TYPES = Object.freeze(["image/jpeg", "image/png"]);
export const COMPLAINT_PHOTO_MAX_MB = 3;

export function isComplaintPhotoId(id) {
  return COMPLAINT_PHOTO_IDS.includes(id);
}
