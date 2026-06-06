import axios from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";

// Remove baseURL from the configuration to prevent Axios from mangling the paths
const apiClient = axios.create({
    timeout: 60000, // Important: 60 seconds for Gemini inference
});

export const documentApi = {
    // Post the document directly and wait for the final JSON
    processDocument: async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        
        try {
            const response = await apiClient.post(`${API_BASE_URL}/process`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            return response.data;
        } catch (error) {
            console.error("Document processing failed:", error);
            throw error;
        }
    },

    // Process subsequent pages of a multi-page document
    processNextPage: async (page, filename, taskId) => {
        try {
            const response = await apiClient.post(`${API_BASE_URL}/process?page=${page}&filename=${filename}&task_id=${taskId}`);
            return response.data;
        } catch (error) {
            console.error("Next page processing failed:", error);
            throw error;
        }
    },
    
    // Download the separated Excel sheets
    downloadExcel: async () => {
        window.open(`${API_BASE_URL}/export`, '_blank');
    },

    getAllDocuments: async () => {
        try {
            const response = await apiClient.get(`${API_BASE_URL}/`);
            return response.data;
        } catch (error) {
            console.error("Failed to fetch documents:", error);
            throw error;
        }
    },

    exportDocuments: async () => {
        try {
            const response = await apiClient.get(`${API_BASE_URL}/export`, {
                responseType: 'blob'
            });
            return response.data;
        } catch (error) {
            console.error("Failed to export documents:", error);
            throw error;
        }
    }
};