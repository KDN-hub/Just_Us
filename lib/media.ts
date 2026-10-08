import { supabase } from "@/lib/supabase";

/**
 * Resolves a media URL to ensure private Supabase Storage buckets
 * can be accessed using a signed URL if required.
 */
export async function resolveMediaUrl(rawUrl: string): Promise<string> {
  if (!rawUrl) return "";

  // Check if URL points to Supabase storage
  // Format: .../storage/v1/object/(public|sign)/<bucket>/<path>
  const supabaseStorageMatch = rawUrl.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+?)(?:\?.*)?$/);
  if (supabaseStorageMatch) {
    const bucket = supabaseStorageMatch[1];
    const path = decodeURIComponent(supabaseStorageMatch[2]);
    try {
      // Create a signed URL valid for 2 hours (7200s) for secure viewing
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 7200);
      if (!error && data?.signedUrl) {
        return data.signedUrl;
      }
    } catch {
      // If signed URL generation fails (e.g. anon session or public bucket), fallback to raw URL
    }
  }

  return rawUrl;
}

/**
 * Downloads an image or video file directly using blob retrieval
 * so mobile and desktop browsers prompt a real file download
 * rather than simply navigating to the URL.
 */
export async function downloadMediaFile(
  url: string,
  suggestedFilename?: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const cleanUrl = url.replace("VIDEO_URL:", "").trim();
    const resolvedUrl = await resolveMediaUrl(cleanUrl);

    // Determine appropriate extension & name
    const isVideo =
      cleanUrl.includes(".mp4") ||
      cleanUrl.includes(".webm") ||
      cleanUrl.includes("VIDEO_URL:") ||
      cleanUrl.includes("video");

    const dateStr = new Date().toISOString().slice(0, 10);
    const fallbackExt = isVideo ? "mp4" : "jpg";
    const filename =
      suggestedFilename ||
      `just-us-${isVideo ? "video" : "image"}-${dateStr}.${fallbackExt}`;

    try {
      const response = await fetch(resolvedUrl, { mode: "cors" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setTimeout(() => URL.revokeObjectURL(blobUrl), 3000);
      return { ok: true };
    } catch (fetchErr) {
      console.warn("[media] Blob download fallback to anchor:", fetchErr);
      // Fallback: direct anchor download trigger
      const a = document.createElement("a");
      a.href = resolvedUrl;
      a.download = filename;
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return { ok: true };
    }
  } catch (err: any) {
    console.error("[media] Download error:", err);
    return { ok: false, error: err?.message || "Failed to download media." };
  }
}
