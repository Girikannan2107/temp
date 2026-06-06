import axios from 'axios';

// Ensure this is just the host/port part
const HOST = import.meta.env.VITE_API_HOST || "http://localhost:8000";
const API_PREFIX = "/api/v1";

const apiClient = axios.create({
    baseURL: HOST, // Set base here
    timeout: 60000,
});

export const documentApi = {
    processDocument: async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        
        // Clean path joining
        return await apiClient.post(`${API_PREFIX}/process`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        }).then(res => res.data);
    },

    processNextPage: async (page, filename, taskId) => {
        // Use params to automatically encode special characters in filename
        return await apiClient.post(`${API_PREFIX}/process`, null, {
            params: { page, filename, task_id: taskId }
        }).then(res => res.data);
    },

    getAllDocuments: async () => {
        return await apiClient.get(`${API_PREFIX}/`).then(res => res.data);
    },

    exportDocuments: async () => {
        return await apiClient.get(`${API_PREFIX}/export`, { responseType: 'blob' }).then(res => res.data);
    }
};