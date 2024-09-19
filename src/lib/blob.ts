export const base64toBlob = (base64: string, contentType: string) => {
  const bin = atob(base64.replace(/^.*,/, ""));
  const buffer = new Uint8Array(bin.length).map((_, i) => bin.charCodeAt(i));
  return new Blob([buffer.buffer], {
    type: contentType,
  });
};
