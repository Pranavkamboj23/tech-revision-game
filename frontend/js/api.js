
"use strict";

// Shared API helper for technology worlds.
// Use a unique name to avoid conflicts with game-specific requests.

const API_BASE_URL = "/api";

async function technologyApiRequest(endpoint, options = {}) {
    const path = endpoint.startsWith("/")
        ? endpoint
        : `/${endpoint}`;

    const response = await fetch(
        `${API_BASE_URL}${path}`,
        {
            cache: "no-store",
            ...options,
            headers: {
                "Content-Type": "application/json",
                ...(options.headers || {})
            }
        }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        let message = `Request failed (${response.status})`;

        if (typeof data.detail === "string") {
            message = data.detail;
        } else if (Array.isArray(data.detail)) {
            message = data.detail
                .map((item) => item.msg || "Validation error")
                .join("; ");
        }

        throw new Error(message);
    }

    return data;
}

const technologyAPI = {
    getAll() {
        return technologyApiRequest("/technologies/");
    },

    create(technology) {
        return technologyApiRequest("/technologies/", {
            method: "POST",
            body: JSON.stringify(technology)
        });
    }
};
