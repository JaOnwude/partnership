// Shrinks a phone photo in the browser before upload, so it is cheap on mobile data.
// Falls back to the original file if the browser can't decode it (e.g. HEIC).
export async function compressImage(file: File, maxSide = 1600, maxBytes = 500_000): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    for (const quality of [0.8, 0.65, 0.5]) {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      if (blob && (blob.size <= maxBytes || quality === 0.5)) {
        return new File([blob], "receipt.jpg", { type: "image/jpeg" });
      }
    }
  } catch {
    // Keep the original; the server checks type and size.
  }
  return file;
}
