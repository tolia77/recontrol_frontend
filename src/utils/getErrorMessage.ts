/** Extract a user-readable error string from an axios error or unknown throw. */
export function getErrorMessage(err: unknown): string {
  const axiosErr = err as { response?: { data?: unknown } } | undefined;
  const data = axiosErr?.response?.data;

  if (data && typeof data === "object") {
    // Shape 1: { error: "message" } — all non-422 backend errors
    const rec = data as Record<string, unknown>;
    if (typeof rec.error === "string") return rec.error;

    // Shape 2: { fieldName: ["msg1", "msg2"], ... } — Rails 422 @model.errors
    const msgs: string[] = [];
    Object.entries(rec).forEach(([key, value]) => {
      const cap = key.charAt(0).toUpperCase() + key.slice(1);
      if (Array.isArray(value)) {
        value.forEach((v) => msgs.push(`${cap} ${String(v)}`));
      } else {
        msgs.push(`${cap} ${String(value)}`);
      }
    });
    if (msgs.length) return msgs.join(", ");
  }

  return "An unexpected error occurred";
}
