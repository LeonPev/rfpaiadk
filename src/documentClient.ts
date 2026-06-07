export type UploadedDocument = {
  id: string;
  filename: string;
  fileType: string;
  status: 'converting' | 'indexing' | 'indexed' | 'failed';
  chunkCount: number;
  error: string;
  createdAt: string;
  updatedAt: string;
};

async function expectOk(response: Response, message: string) {
  if (response.ok) return;
  const text = await response.text();
  throw new Error(`${message}: ${response.status} ${text}`);
}

function expectDocument(data: { document?: UploadedDocument }, message: string) {
  if (!data.document) throw new Error(message);
  return data.document;
}

export async function fetchDocuments(): Promise<UploadedDocument[]> {
  const response = await fetch('/api/documents');
  await expectOk(response, 'Unable to load uploaded documents');
  const data = (await response.json()) as { documents?: UploadedDocument[] };
  return data.documents ?? [];
}

export async function uploadDocument(file: File): Promise<UploadedDocument> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch('/api/documents', {
    method: 'POST',
    body: formData,
  });
  await expectOk(response, `Unable to upload ${file.name}`);
  const data = (await response.json()) as { document?: UploadedDocument };
  return expectDocument(data, `Upload for ${file.name} did not return document metadata.`);
}

export async function fetchDocumentMarkdown(documentId: string): Promise<string> {
  const response = await fetch(`/api/documents/${documentId}/markdown`);
  await expectOk(response, 'Unable to load converted Markdown');
  return response.text();
}

export async function retryDocument(documentId: string): Promise<UploadedDocument> {
  const response = await fetch(`/api/documents/${documentId}/retry`, {
    method: 'POST',
  });
  await expectOk(response, 'Unable to retry uploaded document');
  const data = (await response.json()) as { document?: UploadedDocument };
  return expectDocument(data, 'Retry did not return document metadata.');
}

export async function deleteDocument(documentId: string): Promise<void> {
  const response = await fetch(`/api/documents/${documentId}`, {
    method: 'DELETE',
  });
  await expectOk(response, 'Unable to remove uploaded document');
}
