
const API_BASE_URL = "/api";

async function apiRequest(endpoint, options = {}) {
    const response = await fetch(
        `${API_BASE_URL}${endpoint}`,
        {
            ...options,
            headers: {
                "Content-Type": "application/json",
                ...options.headers
            }
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            typeof data.detail === "string"
                ? data.detail
                : `Request failed: ${response.status}`
        );
    }

    return data;
}

const technologyAPI = {
    getAll() {
        return apiRequest("/technologies/");
    },

    create(technology) {
        return apiRequest("/technologies/", {
            method: "POST",
            body: JSON.stringify(technology)
        });
    }
};
