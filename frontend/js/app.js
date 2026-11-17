
"use strict";

const $ = (id) => document.getElementById(id);

const views = [
    "dashboard-view",
    "world-view",
    "quiz-view",
    "results-view"
];

const LETTERS = ["A", "B", "C", "D"];
const LIMIT = 10;

let activeWorld = null;
let activeZone = null;
let questions = [];
let index = 0;
let selected = null;
let revealed = false;
let correctCount = 0;
let xp = 0;
let streak = 0;
let bestStreak = 0;
let missed = [];
let pending = false;
let sessionToken = 0;
let touchStartY = null;


// =========================================
// VIEW NAVIGATION
// =========================================

function showView(id) {
    views.forEach((view) => {
        $(view).hidden = view !== id;
    });

    window.scrollTo({
        top: 0,
        behavior: "instant"
    });
}


function slugify(name) {
    return name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}


function worldIcon(name) {
    const icons = {
        python: "🐍",
        rag: "🧠",
        sql: "🗄️",
        fastapi: "⚡",
        javascript: "🌐",
        docker: "🐳",
        react: "⚛️"
    };

    return icons[name.toLowerCase()] || "✦";
}


function node(tag, className, value) {
    const element = document.createElement(tag);

    if (className) {
        element.className = className;
    }

    if (value !== undefined) {
        element.textContent = value;
    }

    return element;
}


// =========================================
// TECHNOLOGY WORLDS
// =========================================

function openWorld(world) {
    activeWorld = world;

    $("selected-world-name").textContent =
        `${worldIcon(world.name)} ${world.name} World`;

    $("selected-world-description").textContent =
        world.description || "Choose your learning path.";

    showView("world-view");
    sfx("tap");
}


function renderWorlds(worlds) {
    $("worlds-container").replaceChildren();

    $("world-count").textContent =
        `${worlds.length} world${worlds.length === 1 ? "" : "s"}`;

    if (!worlds.length) {
        $("worlds-container").textContent =
            "No technology worlds available yet.";

        return;
    }

    for (const world of worlds) {
        const card = node("article", "world-card");

        const icon = node(
            "div",
            "world-icon",
            worldIcon(world.name)
        );

        const title = node("h3", "", world.name);

        const description = node(
            "p",
            "",
            world.description ||
                "Start your learning adventure."
        );

        const button = node(
            "button",
            "",
            "Enter World →"
        );

        button.type = "button";

        button.addEventListener("click", () => {
            openWorld(world);
        });

        card.append(
            icon,
            title,
            description,
            button
        );

        $("worlds-container").append(card);
    }
}


async function loadWorlds() {
    try {
        const worlds = await technologyAPI.getAll();

        if (!Array.isArray(worlds)) {
            throw new Error(
                "Unexpected technology API response."
            );
        }

        renderWorlds(worlds);

    } catch (error) {
        $("worlds-container").textContent =
            `Unable to load worlds: ${error.message}`;
    }
}


// =========================================
// CREATE WORLD
// =========================================
// Preserved from your existing frontend.
// This requires the backend to permit the
// POST request. If creation is admin-only,
// it should eventually move to /admin.
// =========================================

const createWorldForm = $("create-world-form");

if (createWorldForm) {
    createWorldForm.addEventListener(
        "submit",
        async (event) => {
            event.preventDefault();

            const name = $("world-name").value.trim();

            const description = $(
                "world-description"
            ).value.trim();

            const slug = slugify(name);

            if (!slug) {
                $("form-message").textContent =
                    "Use a name containing letters or numbers.";

                return;
            }

            const button = createWorldForm.querySelector(
                'button[type="submit"]'
            );

            button.disabled = true;

            $("form-message").textContent =
                "Creating world...";

            try {
                await technologyAPI.create({
                    name,
                    slug,
                    description: description || null
                });

                createWorldForm.reset();

                $("form-message").textContent =
                    "World created successfully!";

                await loadWorlds();

            } catch (error) {
                $("form-message").textContent =
                    error.message;

            } finally {
                button.disabled = false;
            }
        }
    );
}


$("back-to-worlds").addEventListener(
    "click",
    () => {
        activeWorld = null;
        showView("dashboard-view");
    }
);


// =========================================
// GAME API
// =========================================
// IMPORTANT FIX:
// This is deliberately named gameApiRequest,
// not apiRequest, to avoid overriding api.js.
// =========================================

async function gameApiRequest(url, options = {}) {
    const apiUrl = url.startsWith("/api/")
        ? url
        : `/api${url.startsWith("/") ? "" : "/"}${url}`;

    const response = await fetch(apiUrl, {
        cache: "no-store",
        ...options
    });

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


// =========================================
// SESSION STATE
// =========================================

function resetSession() {
    questions = [];
    index = 0;
    selected = null;
    revealed = false;

    correctCount = 0;
    xp = 0;
    streak = 0;
    bestStreak = 0;
    missed = [];

    pending = false;
}


// =========================================
// START QUIZ
// =========================================

async function startQuiz(zone) {
    if (!activeWorld) {
        return;
    }

    const token = ++sessionToken;

    activeZone = zone;
    resetSession();

    $("quiz-realm").textContent =
        activeWorld.name.toUpperCase();

    $("quiz-zone").textContent =
        zone.toUpperCase();

    $("quiz-message").textContent =
        "Loading your challenge...";

    $("question-stage").hidden = true;
    $("check-answer").hidden = true;
    $("next-question").hidden = true;

    showView("quiz-view");

    try {
        const result = await gameApiRequest(
            `/api/questions/technologies/` +
            `${encodeURIComponent(activeWorld.id)}/` +
            `${encodeURIComponent(zone)}?limit=${LIMIT}`
        );

        if (token !== sessionToken) {
            return;
        }

        if (!Array.isArray(result)) {
            throw new Error(
                "Unexpected questions response."
            );
        }

        if (!result.length) {
            $("quiz-message").textContent =
                "No MCQs in this zone yet. " +
                "Upload questions in the Admin Panel " +
                "and return here.";

            return;
        }

        questions = result;

        renderQuestion();

    } catch (error) {
        if (token === sessionToken) {
            $("quiz-message").textContent =
                error.message;
        }
    }
}


// =========================================
// RENDER QUESTION
// =========================================

function renderQuestion() {
    const question = questions[index];

    selected = null;
    revealed = false;

    $("quiz-message").textContent = "";
    $("question-stage").hidden = false;

    // Restart the entrance animation.
    $("question-stage").classList.remove(
        "stage-enter"
    );

    void $("question-stage").offsetWidth;

    $("question-stage").classList.add(
        "stage-enter"
    );

    $("quiz-position").textContent =
        `QUESTION ${index + 1} / ${questions.length}`;

    $("quiz-xp").textContent =
        `✦ ${xp} XP`;

    $("quiz-streak").textContent =
        `🔥 ${streak} streak`;

    $("quiz-progress").style.width =
        `${(index / questions.length) * 100}%`;

    $("question-text").textContent =
        question.question_text;

    // Alternate the dummy artwork's animation.
    $("question-art").classList.toggle(
        "art-alternate",
        index % 2 === 1
    );

    $("answer-options").replaceChildren();

    for (const letter of LETTERS) {
        const button = node(
            "button",
            "answer-option"
        );

        button.type = "button";
        button.dataset.letter = letter;
        button.setAttribute("aria-pressed", "false");

        const mark = node(
            "span",
            "answer-letter",
            letter
        );

        const value = node(
            "span",
            "answer-value",
            question[
                `option_${letter.toLowerCase()}`
            ] || ""
        );

        button.append(mark, value);

        button.addEventListener("click", () => {
            selectAnswer(letter);
        });

        $("answer-options").append(button);
    }

    $("answer-feedback").hidden = true;

    $("check-answer").hidden = false;
    $("check-answer").disabled = true;
    $("check-answer").textContent =
        "Reveal Answer ✦";

    $("next-question").hidden = true;
}


// =========================================
// SELECT ANSWER
// =========================================

function selectAnswer(letter) {
    if (revealed || pending) {
        return;
    }

    selected = letter;

    $("answer-options")
        .querySelectorAll(".answer-option")
        .forEach((button) => {
            const isSelected =
                button.dataset.letter === letter;

            button.classList.toggle(
                "selected",
                isSelected
            );

            button.setAttribute(
                "aria-pressed",
                String(isSelected)
            );
        });

    $("check-answer").disabled = false;

    sfx("tap");
}


// =========================================
// REVEAL ANSWER
// =========================================

async function revealAnswer() {
    if (
        !selected ||
        revealed ||
        pending ||
        !questions.length
    ) {
        return;
    }

    pending = true;

    const token = sessionToken;
    const questionIndex = index;

    $("check-answer").disabled = true;

    $("quiz-message").textContent =
        "Checking answer...";

    try {
        const question = questions[index];

        const result = await gameApiRequest(
            `/api/questions/${encodeURIComponent(question.id)}/answer`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    selected_answer: selected
                })
            }
        );

        if (
            token !== sessionToken ||
            questionIndex !== index
        ) {
            return;
        }

        revealed = true;

        if (result.is_correct) {
            correctCount++;
            streak++;

            bestStreak = Math.max(
                bestStreak,
                streak
            );

            xp += 20;

            if (streak % 3 === 0) {
                xp += 10;
            }

            sfx("correct");

        } else {
            streak = 0;

            missed.push({
                text: question.question_text,
                correct: result.correct_answer
            });

            sfx("wrong");
        }

        $("answer-options")
            .querySelectorAll(".answer-option")
            .forEach((button) => {
                button.disabled = true;

                button.classList.toggle(
                    "correct",
                    button.dataset.letter ===
                        result.correct_answer
                );

                button.classList.toggle(
                    "incorrect",
                    button.dataset.letter === selected &&
                        !result.is_correct
                );
            });

        $("feedback-title").textContent =
            result.is_correct
                ? "✦ Correct! Knowledge unlocked."
                : `Keep learning · Correct answer: ${result.correct_answer}`;

        $("feedback-explanation").textContent =
            result.explanation ||
            "No explanation available.";

        $("answer-feedback").hidden = false;

        $("quiz-xp").textContent =
            `✦ ${xp} XP`;

        $("quiz-streak").textContent =
            `🔥 ${streak} streak`;

        $("quiz-progress").style.width =
            `${((index + 1) / questions.length) * 100}%`;

        $("quiz-message").textContent = "";

        $("check-answer").hidden = true;
        $("next-question").hidden = false;

        $("next-question").textContent =
            index + 1 === questions.length
                ? "View Results ✦"
                : "Continue ↑";

    } catch (error) {
        if (token === sessionToken) {
            $("quiz-message").textContent =
                error.message;

            $("check-answer").disabled = false;
        }

    } finally {
        if (token === sessionToken) {
            pending = false;
        }
    }
}


// =========================================
// NEXT QUESTION
// =========================================

function nextQuestion() {
    if (!revealed || pending) {
        return;
    }

    sfx("swipe");

    if (index + 1 === questions.length) {
        showResults();
        return;
    }

    index++;

    renderQuestion();

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}


// =========================================
// RESULTS
// =========================================

function showResults() {
    $("result-score").textContent =
        `${correctCount}/${questions.length}`;

    $("result-percent").textContent =
        `${Math.round(
            (correctCount / questions.length) * 100
        )}% accuracy`;

    $("result-xp").textContent =
        String(xp);

    $("result-streak").textContent =
        String(bestStreak);

    $("result-subtitle").textContent =
        `${activeWorld.name} · ${activeZone} mission completed`;

    $("review-panel").hidden =
        missed.length === 0;

    $("review-list").replaceChildren();

    missed.forEach((item) => {
        $("review-list").appendChild(
            node(
                "li",
                "",
                `${item.text} (answer: ${item.correct})`
            )
        );
    });

    showView("results-view");
    sfx("complete");
}


// =========================================
// EXIT QUIZ
// =========================================

function exitQuiz() {
    ++sessionToken;

    resetSession();

    showView("world-view");
}


$("exit-quiz").addEventListener(
    "click",
    exitQuiz
);

$("check-answer").addEventListener(
    "click",
    revealAnswer
);

$("next-question").addEventListener(
    "click",
    nextQuestion
);

$("play-again").addEventListener(
    "click",
    () => startQuiz(activeZone)
);

$("back-to-zones").addEventListener(
    "click",
    exitQuiz
);


document.querySelectorAll(
    ".zone-card button"
).forEach((button) => {
    button.addEventListener("click", () => {
        startQuiz(button.dataset.zone);
    });
});


// =========================================
// MOBILE SWIPE NAVIGATION
// =========================================

$("quiz-view").addEventListener(
    "touchstart",
    (event) => {
        if (event.touches.length === 1) {
            touchStartY =
                event.touches[0].clientY;
        }
    },
    { passive: true }
);


$("quiz-view").addEventListener(
    "touchend",
    (event) => {
        if (
            touchStartY === null ||
            event.changedTouches.length !== 1
        ) {
            return;
        }

        const distance =
            touchStartY -
            event.changedTouches[0].clientY;

        touchStartY = null;

        if (
            distance > 90 &&
            revealed &&
            !event.target.closest("button")
        ) {
            nextQuestion();
        }
    },
    { passive: true }
);


// =========================================
// AMBIENT MUSIC
// =========================================
// Original synthesized ambient music.
// No external audio files are required.
// Audio starts only after user interaction.
// =========================================

let audioContext = null;
let masterGain = null;
let oscillators = [];
let musicOn = false;


function stopMusic() {
    if (masterGain && audioContext) {
        masterGain.gain.setTargetAtTime(
            0,
            audioContext.currentTime,
            0.15
        );
    }

    const oldOscillators = oscillators;
    oscillators = [];

    window.setTimeout(() => {
        oldOscillators.forEach((oscillator) => {
            try {
                oscillator.stop();
            } catch (_) {
                // Already stopped.
            }
        });

        if (masterGain) {
            try {
                masterGain.disconnect();
            } catch (_) {
                // Already disconnected.
            }
        }
    }, 600);

    musicOn = false;

    $("music-toggle").setAttribute(
        "aria-pressed",
        "false"
    );

    $("music-toggle").setAttribute(
        "aria-label",
        "Enable ambient music"
    );

    $("music-label").textContent = "Off";
}


async function toggleMusic() {
    if (musicOn) {
        stopMusic();
        return;
    }

    const AudioCtor =
        window.AudioContext ||
        window.webkitAudioContext;

    if (!AudioCtor) {
        $("music-label").textContent =
            "Unavailable";

        return;
    }

    try {
        if (!audioContext) {
            audioContext = new AudioCtor();
        }

        await audioContext.resume();

        masterGain = audioContext.createGain();
        masterGain.gain.value = 0;

        masterGain.connect(
            audioContext.destination
        );

        // Original quiet D-minor ambient chord.
        const frequencies = [
            146.83,
            174.61,
            220,
            293.66
        ];

        frequencies.forEach((frequency, i) => {
            const oscillator =
                audioContext.createOscillator();

            const gain =
                audioContext.createGain();

            oscillator.type = "sine";
            oscillator.frequency.value =
                frequency;

            gain.gain.value =
                i === 0 ? 0.23 : 0.12;

            oscillator.connect(gain);
            gain.connect(masterGain);

            oscillator.start();
            oscillators.push(oscillator);
        });

        masterGain.gain.setTargetAtTime(
            0.07,
            audioContext.currentTime,
            0.6
        );

        musicOn = true;

        $("music-toggle").setAttribute(
            "aria-pressed",
            "true"
        );

        $("music-toggle").setAttribute(
            "aria-label",
            "Mute ambient music"
        );

        $("music-label").textContent = "On";

    } catch (error) {
        $("music-label").textContent =
            "Unavailable";
    }
}


// =========================================
// INTERACTION SOUND EFFECTS
// =========================================

function sfx(kind) {
    if (!musicOn || !audioContext) {
        return;
    }

    const now = audioContext.currentTime;

    const oscillator =
        audioContext.createOscillator();

    const gain =
        audioContext.createGain();

    oscillator.type = "sine";

    oscillator.frequency.setValueAtTime(
        kind === "wrong" ? 220 : 440,
        now
    );

    oscillator.frequency.exponentialRampToValueAtTime(
        kind === "correct" || kind === "complete"
            ? 660
            : 330,
        now + 0.14
    );

    gain.gain.setValueAtTime(
        0.0001,
        now
    );

    gain.gain.exponentialRampToValueAtTime(
        0.022,
        now + 0.015
    );

    gain.gain.exponentialRampToValueAtTime(
        0.0001,
        now + 0.23
    );

    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    oscillator.start(now);
    oscillator.stop(now + 0.24);
}


// =========================================
// MUSIC CONTROLS
// =========================================

$("music-toggle").addEventListener(
    "click",
    toggleMusic
);


document.addEventListener(
    "visibilitychange",
    () => {
        if (document.hidden && musicOn) {
            stopMusic();
        }
    }
);


// =========================================
// INITIALIZE
// =========================================

loadWorlds();
