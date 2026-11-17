"use strict";

const API_BASE_URL = "/api";
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const loginView = document.getElementById("login-view");
const dashboard = document.getElementById("admin-dashboard");
const loginForm = document.getElementById("login-form");
const loginMessage = document.getElementById("login-message");

const createWorldForm = document.getElementById("create-world-form");
const worldMessage = document.getElementById("world-message");
const uploadForm = document.getElementById("upload-form");
const uploadMessage = document.getElementById("upload-message");
const technologySelect = document.getElementById("technology-select");
const uploadResults = document.getElementById("upload-results");
const logoutButton = document.getElementById("logout-button");

let adminKey = null;

async function parseResponse(response) {
    if (response.status === 204) return null;
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        let message = `Request failed (${response.status})`;
        if (typeof data.detail === "string") {
            message = data.detail;
        } else if (Array.isArray(data.detail)) {
            message = data.detail.map((item) => {
                const location = Array.isArray(item.loc) ? item.loc.join(".") : "Field";
                return `${location}: ${item.msg}`;
            }).join("; ");
        }
        throw new Error(message);
    }
    return data;
}

async function loadTechnologies() {
    const response = await fetch(`${API_BASE_URL}/technologies/`, { cache: "no-store" });
    const technologies = await parseResponse(response);
    const previouslySelected = technologySelect.value;
    technologySelect.replaceChildren(new Option("Select technology", ""));
    for (const technology of technologies) {
        technologySelect.add(new Option(technology.name, technology.id));
    }
    if (technologies.some((technology) => String(technology.id) === previouslySelected)) {
        technologySelect.value = previouslySelected;
    }
    return technologies;
}

function slugify(name) {
    return name.toLowerCase().trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}

function logout() {
    adminKey = null;
    loginForm.reset();
    createWorldForm.reset();
    uploadForm.reset();
    dashboard.hidden = true;
    loginView.hidden = false;
    uploadResults.hidden = true;
    loginMessage.textContent = "";
    worldMessage.textContent = "";
    uploadMessage.textContent = "";
    if (typeof window.clearQuestionBank === "function") {
        window.clearQuestionBank();
    }
}

loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const key = document.getElementById("admin-key").value.trim();
    const button = loginForm.querySelector('button[type="submit"]');
    button.disabled = true;
    loginMessage.textContent = "Authenticating...";
    try {
        const response = await fetch(`${API_BASE_URL}/admin/verify`, {
            method: "GET",
            headers: { "X-Admin-Key": key },
            cache: "no-store"
        });
        await parseResponse(response);
        adminKey = key;
        const technologies = await loadTechnologies();
        if (typeof window.initializeQuestionBank !== "function") {
            throw new Error("Question Bank script did not load. Check question-bank.js.");
        }
        await window.initializeQuestionBank(technologies);
        loginForm.reset();
        loginMessage.textContent = "";
        loginView.hidden = true;
        dashboard.hidden = false;
    } catch (error) {
        adminKey = null;
        loginMessage.textContent = error.message;
    } finally {
        button.disabled = false;
    }
});

createWorldForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!adminKey) {
        logout();
        return;
    }
    const name = document.getElementById("world-name").value.trim();
    const description = document.getElementById("world-description").value.trim();
    const slug = slugify(name);
    if (!slug) {
        worldMessage.textContent = "Use a technology name containing Latin letters or numbers.";
        return;
    }
    const button = createWorldForm.querySelector('button[type="submit"]');
    button.disabled = true;
    worldMessage.textContent = "Creating world...";
    try {
        const response = await fetch(`${API_BASE_URL}/technologies/`, {
            method: "POST",
            headers: {
                "X-Admin-Key": adminKey,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ name, slug, description: description || null })
        });
        if (response.status === 401) {
            logout();
            loginMessage.textContent = "Admin authentication failed. Please log in again.";
            return;
        }
        const created = await parseResponse(response);
        createWorldForm.reset();
        worldMessage.textContent = `World “${created.name || name}” created successfully!`;
        const technologies = await loadTechnologies();
        if (created.id != null) {
            technologySelect.value = String(created.id);
        }
        // Reinitialize the existing question bank so its technology filter is updated.
        if (typeof window.initializeQuestionBank === "function") {
            await window.initializeQuestionBank(technologies);
        }
    } catch (error) {
        worldMessage.textContent = error.message;
    } finally {
        button.disabled = false;
    }
});

uploadForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!adminKey) {
        logout();
        return;
    }
    const technologyId = technologySelect.value;
    const zone = document.getElementById("zone-select").value;
    const fileInput = document.getElementById("question-file");
    const file = fileInput.files[0];
    if (!technologyId || !file) {
        uploadMessage.textContent = "Please select a technology and MCQ file.";
        return;
    }
    if (file.size > MAX_FILE_SIZE) {
        uploadMessage.textContent = "Maximum file size is 5 MB.";
        return;
    }
    const extension = file.name.split(".").pop().toLowerCase();
    if (!["json", "csv"].includes(extension)) {
        uploadMessage.textContent = "Only JSON and CSV files are supported.";
        return;
    }
    const formData = new FormData();
    formData.append("file", file);
    const button = uploadForm.querySelector('button[type="submit"]');
    button.disabled = true;
    uploadResults.hidden = true;
    uploadMessage.textContent = "Uploading MCQs...";
    try {
        const response = await fetch(
            `${API_BASE_URL}/imports/technologies/${technologyId}/${zone}`,
            { method: "POST", headers: { "X-Admin-Key": adminKey }, body: formData }
        );
        if (response.status === 401) {
            logout();
            loginMessage.textContent = "Admin authentication failed. Please log in again.";
            return;
        }
        const result = await parseResponse(response);
        document.getElementById("added-count").textContent = result.added;
        document.getElementById("skipped-count").textContent = result.skipped_duplicates;
        uploadResults.hidden = false;
        uploadMessage.textContent = `Import completed: ${result.technology} — ${result.zone}.`;
        fileInput.value = "";
        if (typeof window.refreshQuestionBank === "function") {
            await window.refreshQuestionBank(technologyId, zone);
        }
    } catch (error) {
        uploadMessage.textContent = error.message;
    } finally {
        button.disabled = false;
    }
});

logoutButton.addEventListener("click", logout);
