
const worldsContainer = document.getElementById(
    "worlds-container"
);

const worldCount = document.getElementById(
    "world-count"
);

const createWorldForm = document.getElementById(
    "create-world-form"
);

const formMessage = document.getElementById(
    "form-message"
);

function createSlug(name) {
    return name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}

function getWorldIcon(name) {
    const icons = {
        python: "🐍",
        rag: "🧠",
        sql: "🗄️",
        fastapi: "⚡",
        javascript: "🌐",
        docker: "🐳",
        react: "⚛️"
    };

    return icons[name.toLowerCase()] || "✨";
}

function renderWorlds(worlds) {
    worldsContainer.replaceChildren();

    worldCount.textContent =
        `${worlds.length} world${worlds.length === 1 ? "" : "s"}`;

    if (worlds.length === 0) {
        worldsContainer.textContent =
            "No worlds yet. Create your first technology world!";
        return;
    }

    worlds.forEach((world) => {
        const card = document.createElement("article");
        card.className = "world-card";

        const icon = document.createElement("div");
        icon.className = "world-icon";
        icon.textContent = getWorldIcon(world.name);

        const title = document.createElement("h3");
        title.textContent = world.name;

        const description = document.createElement("p");
        description.textContent =
            world.description || "Start your learning adventure.";

        const button = document.createElement("button");
        button.type = "button";
        button.textContent = "Enter World";

        button.addEventListener("click", () => {
            window.alert(
                `${world.name} learning zones are coming next!`
            );
        });

        card.append(icon, title, description, button);
        worldsContainer.appendChild(card);
    });
}

async function loadWorlds() {
    try {
        const worlds = await technologyAPI.getAll();
        renderWorlds(worlds);
    } catch (error) {
        worldsContainer.textContent =
            `Unable to load worlds: ${error.message}`;
    }
}

createWorldForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const name = document.getElementById(
        "world-name"
    ).value.trim();

    const description = document.getElementById(
        "world-description"
    ).value.trim();

    const slug = createSlug(name);

    if (!slug) {
        formMessage.textContent =
            "Please use a technology name containing letters or numbers.";
        return;
    }

    const submitButton = createWorldForm.querySelector(
        'button[type="submit"]'
    );

    submitButton.disabled = true;
    formMessage.textContent = "Creating world...";

    try {
        await technologyAPI.create({
            name,
            slug,
            description: description || null
        });

        createWorldForm.reset();
        formMessage.textContent = "World created successfully!";

        await loadWorlds();
    } catch (error) {
        formMessage.textContent = error.message;
    } finally {
        submitButton.disabled = false;
    }
});

loadWorlds();
