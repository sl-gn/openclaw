import type { ChatAttachment } from "../chat-attachments.js";

export type RpcAttachmentInput = {
  type?: unknown;
  mimeType?: unknown;
  fileName?: unknown;
  content?: unknown;
  /** URL for remote video (alternative to content base64). */
  url?: unknown;
};

export function normalizeRpcAttachmentsToChatAttachments(
  attachments: RpcAttachmentInput[] | undefined,
): ChatAttachment[] {
  return (
    attachments
      ?.map((a) => {
        let content =
          typeof a?.content === "string"
            ? a.content
            : ArrayBuffer.isView(a?.content)
              ? Buffer.from(a.content.buffer, a.content.byteOffset, a.content.byteLength).toString(
                  "base64",
                )
              : a?.content instanceof ArrayBuffer
                ? Buffer.from(a.content).toString("base64")
                : undefined;
        if (content === "undefined" || (typeof content === "string" && !content.trim())) {
          content = undefined;
        }
        const url = typeof a?.url === "string" && a.url.trim() ? a.url.trim() : undefined;
        return {
          type: typeof a?.type === "string" ? a.type : undefined,
          mimeType: typeof a?.mimeType === "string" ? a.mimeType : undefined,
          fileName: typeof a?.fileName === "string" ? a.fileName : undefined,
          content,
          url,
        };
      })
      .filter((a) => a.content || a.url) ?? []
  );
}
