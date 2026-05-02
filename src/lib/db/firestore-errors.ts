/**
 * Map Firestore client errors to user-safe copy. Always log the original in catch.
 */
export function isFirestoreIndexError(msg: string): boolean {
  const m = msg.toLowerCase();
  return m.includes("requires an index") || m.includes("failed-precondition");
}

export function getUserFriendlyFirestoreMessage(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  if (isFirestoreIndexError(msg)) {
    return "Đang cập nhật hệ thống, vui lòng thử lại sau vài phút.";
  }
  return "Không tải được dữ liệu. Vui lòng thử lại.";
}
