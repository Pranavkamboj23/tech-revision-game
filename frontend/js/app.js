
const dashboardView = document.getElementById(
    "dashboard-view"
);

const worldView = document.getElementById(
    "world-view"
);

const selectedWorldName = document.getElementById(
    "selected-world-name"
);

const selectedWorldDescription = document.getElementById(
    "selected-world-description"
);

const backToWorldsButton = document.getElementById(
    "back-to-worlds"
);

let activeWorld = null;

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


function openWorld(world) {
    activeWorld = world;

    selectedWorldName.textContent =
        `${getWorldIcon(world.name)} ${world.name} World`;

    selectedWorldDescription.textContent =
        world.description || "Choose your learning path.";

    dashboardView.hidden = true;
    worldView.hidden = false;

    window.scrollTo(0, 0);
}

function showDashboard() {
    activeWorld = null;

    worldView.hidden = true;
    dashboardView.hidden = false;

    window.scrollTo(0, 0);
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
            openWorld(world);
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

backToWorldsButton.addEventListener(
    "click",
    showDashboard
);

document.querySelectorAll(
    ".zone-card button"
).forEach((button) => {
    button.addEventListener("click", () => {
        if (!activeWorld) {
            return;
        }

        const zone = button.dataset.zone;

        // Temporary until we build the topic and quiz screens.
        window.alert(
            `Opening ${zone} zone for ${activeWorld.name}`
        );
    });
});
