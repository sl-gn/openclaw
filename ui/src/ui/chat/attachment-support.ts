export const CHAT_ATTACHMENT_ACCEPT = "image/*,video/mp4,video/webm,video/quicktime,video/mpeg";

export function isSupportedChatAttachmentMimeType(mimeType: string | null | undefined): boolean {
  return (
    typeof mimeType === "string" && (mimeType.startsWith("image/") || mimeType.startsWith("video/"))
  );
}

export function isVideoMimeType(mimeType: string | null | undefined): boolean {
  return typeof mimeType === "string" && mimeType.startsWith("video/");
}
