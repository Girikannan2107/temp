import axios from 'axios';

// Ensure this points to the root of your FastAPI server
const HOST = import.meta.env.VITE_API_HOST || "http://localhost:8000";

const apiClient = axios.create({
    baseURL: HOST, // Base URL is just the server address
    timeout: 60000,
});

// Explicitly define the full path including the version prefix for every endpoint
const API_PREFIX = "/api/v1";

export const documentApi = {
    processDocument: async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        
        return await apiClient.post(`${API_PREFIX}/process`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        }).then(res => res.data);
    },

    processNextPage: async (page, filename, taskId) => {
        // Use params to automatically encode special characters in filename
        return await apiClient.post('/api/v1/process', null, {
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