import axios from 'axios';

import { apiClient } from '@/shared/lib/api-client';

export interface CourseMaterialDto {
  id: string;
  courseId: string;
  lessonId: string | null;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: string | null;
  createdAt: string;
}

interface Envelope<T> {
  data: T;
}

export const materialsApi = {
  async list(courseId: string): Promise<CourseMaterialDto[]> {
    const { data } = await apiClient.get<Envelope<CourseMaterialDto[]>>(
      `/courses/${courseId}/materials`,
    );
    return data.data;
  },

  async upload(courseId: string, file: File, lessonId?: string): Promise<CourseMaterialDto> {
    const fd = new FormData();
    fd.append('file', file);
    const url = `/courses/${courseId}/materials${lessonId ? `?lessonId=${lessonId}` : ''}`;
    // MUHIM: Content-Type header'ni **o'rnatmaslik** kerak — brauzer o'zi
    // multipart boundary bilan to'g'ri header qo'yadi. Aks holda backend
    // request body'ni pars qila olmaydi.
    const { data } = await apiClient.post<Envelope<CourseMaterialDto>>(url, fd);
    return data.data;
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/materials/${id}`);
  },

  async download(id: string): Promise<void> {
    const { data } = await apiClient.get<Envelope<{ url: string; fileName: string }>>(
      `/materials/${id}/download`,
    );
    // MinIO signed URL — force the browser to hit the file directly.
    const a = document.createElement('a');
    a.href = data.data.url;
    a.download = data.data.fileName;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  },
};

// re-export for typing
export type { AxiosRequestConfig } from 'axios';
export { axios };
