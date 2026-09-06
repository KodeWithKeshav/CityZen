/**
 * FormData helper for React Native 0.86+ (Expo SDK 57).
 *
 * In RN 0.86 the internal FormData implementation changed and no longer
 * accepts the legacy `{ uri, type, name }` plain-object shorthand for file
 * parts.  Instead we must first convert the local `file://` URI to a Blob
 * via `fetch()` and then append that Blob with an explicit filename.
 *
 * Usage:
 *   const formData = new FormData();
 *   await appendFileToFormData(formData, 'file', localUri, 'photo.jpg', 'image/jpeg');
 *   formData.append('upload_preset', 'damage');
 *   await fetch(uploadUrl, { method: 'POST', body: formData });
 */

/**
 * Append a local file (identified by its `file://…` URI) to a FormData
 * instance as a proper Blob so that RN 0.86's stricter FormData
 * implementation accepts it.
 *
 * @param {FormData}  formData   The FormData instance to append to.
 * @param {string}    fieldName  The multipart field name (e.g. 'file', 'audio').
 * @param {string}    fileUri    A local file URI (file://…) or content:// URI.
 * @param {string}    fileName   The filename to send (e.g. 'photo.jpg').
 * @param {string}    mimeType   MIME type (e.g. 'image/jpeg', 'audio/wav').
 */
export async function appendFileToFormData(formData, fieldName, fileUri, fileName, mimeType) {
  try {
    // fetch() in RN can read local file:// URIs and returns a proper Response
    // whose .blob() method yields a Blob the FormData implementation accepts.
    const response = await fetch(fileUri);
    const blob = await response.blob();
    formData.append(fieldName, blob, fileName);
  } catch (error) {
    // Fallback: if blob conversion fails (e.g. on older RN versions or some
    // Android content:// URIs), try the legacy plain-object approach.
    console.warn('appendFileToFormData: blob conversion failed, falling back to legacy object', error.message);
    formData.append(fieldName, {
      uri: fileUri,
      type: mimeType,
      name: fileName,
    });
  }
}
