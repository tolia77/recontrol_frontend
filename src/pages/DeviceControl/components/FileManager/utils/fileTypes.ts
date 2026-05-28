import type { FileTypeKind } from "src/pages/DeviceControl/components/FileManager/types";

const IMAGE_EXTS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "bmp",
  "webp",
  "svg",
  "ico",
]);

const VIDEO_EXTS = new Set(["mp4", "mov", "mkv", "avi", "webm", "m4v", "wmv"]);

const CODE_EXTS = new Set([
  "ts",
  "tsx",
  "js",
  "jsx",
  "cs",
  "cpp",
  "c",
  "h",
  "hpp",
  "py",
  "rb",
  "go",
  "rs",
  "java",
  "sh",
  "bash",
  "ps1",
  "json",
  "yaml",
  "yml",
  "toml",
  "xml",
  "html",
  "css",
  "scss",
]);

const DOC_EXTS = new Set([
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "odt",
  "ods",
  "odp",
]);

const TEXT_EXTS = new Set(["txt", "md", "rtf", "log"]);

/**
 * Classify a file by its extension. Returns 'other' when the extension is
 * unknown or missing. Name is matched case-insensitively.
 */
export function classify(name: string): FileTypeKind {
  const dot = name.lastIndexOf(".");
  if (dot < 0 || dot === name.length - 1) return "other";
  const ext = name.slice(dot + 1).toLowerCase();
  if (IMAGE_EXTS.has(ext)) return "image";
  if (VIDEO_EXTS.has(ext)) return "video";
  if (CODE_EXTS.has(ext)) return "code";
  if (DOC_EXTS.has(ext)) return "doc";
  if (TEXT_EXTS.has(ext)) return "text";
  return "other";
}
