
"use strict";

const bankTechnology = document.getElementById("bank-technology");
const bankZone = document.getElementById("bank-zone");
const bankSearch = document.getElementById("question-search");
const bankMessage = document.getElementById("bank-message");
const questionsList = document.getElementById("questions-list");

const previousPage = document.getElementById("previous-page");
const nextPage = document.getElementById("next-page");
const pageIndicator = document.getElementById("page-indicator");

const editor = document.getElementById("question-editor");
const editForm = document.getElementById("edit-question-form");
const editMessage = document.getElementById("edit-message");

const BANK_PAGE_SIZE = 10;
const ZONES = ["basics", "interview", "coding"];
const OPTION_LETTERS = ["A", "B", "C", "D"];

let bankPage = 1;
let bankTotal = 0;
let editingQuestionId = null;
let bankRequestVersion = 0;
let searchTimeout = null;


async function bankRequest(path, options = {}) {
    if (!adminKey) {
        throw new Error("Please log in again.");
    }

    const response = await fetch(
        `${API_BASE_URL}${path}`,
        {
            ...options,
            headers: {
                "X-Admin-Key": adminKey,
                ...(options.headers || {})
            },
            cache: "no-store"
        }
    );

    if (response.status === 401) {
        logout();

        throw new Error(
            "Admin authentication failed. Please log in again."
        );
    }

    return parseResponse(response);
}


async function initializeQuestionBank(technologies = null) {
    if (!technologies) {
        const response = await fetch(
            `${API_BASE_URL}/technologies/`,
            { cache: "no-store" }
        );

        technologies = await parseResponse(response);
    }

    bankTechnology.replaceChildren(
        new Option("Select technology", "")
    );

    for (const technology of technologies) {
        bankTechnology.add(
            new Option(technology.name, technology.id)
        );
    }

    if (technologies.length > 0) {
        bankTechnology.value = String(technologies[0].id);
    }

    bankZone.value = "basics";
    bankSearch.value = "";
    bankPage = 1;

    await loadQuestionBank();
}


async function loadQuestionBank() {
    const requestVersion = ++bankRequestVersion;
    const technologyId = bankTechnology.value;
    const zone = bankZone.value;

    questionsList.replaceChildren();
    bankMessage.textContent = "";

    if (!technologyId || !adminKey) {
        bankTotal = 0;
        resetCounts();
        updatePagination();

        if (adminKey) {
            bankMessage.textContent =
                "Select a technology to view questions.";
        }

        return;
    }

    bankMessage.textContent = "Loading MCQ questions...";

    try {
        const params = new URLSearchParams({
            technology_id: technologyId,
            zone,
            search: bankSearch.value.trim(),
            page: String(bankPage),
            page_size: String(BANK_PAGE_SIZE)
        });

        const [result, counts] = await Promise.all([
            bankRequest(`/admin/questions/?${params}`),
            bankRequest(
                `/admin/questions/counts/${technologyId}`
            )
        ]);

        if (
            requestVersion !== bankRequestVersion ||
            !adminKey
        ) {
            return;
        }

        bankTotal = result.total;

        renderCounts(counts);
        renderQuestions(result.questions);
        updatePagination();

        bankMessage.textContent =
            `${bankTotal} matching question(s).`;

    } catch (error) {
        if (requestVersion === bankRequestVersion && adminKey) {
            bankMessage.textContent = error.message;
        }
    }
}


function resetCounts() {
    for (const zone of ZONES) {
        document.getElementById(
            `${zone}-count`
        ).textContent = "0";
    }

    document.getElementById(
        "total-count"
    ).textContent = "0";

    document.getElementById(
        "playable-count"
    ).textContent = "0 playable MCQs";
}


function renderCounts(counts) {
    resetCounts();

    let total = 0;
    let playable = 0;

    for (const item of counts) {
        const element = document.getElementById(
            `${item.zone}-count`
        );

        if (element) {
            element.textContent = String(item.count);
        }

        total += item.count;
        playable += item.playable_count ?? item.count;
    }

    document.getElementById(
        "total-count"
    ).textContent = String(total);

    document.getElementById(
        "playable-count"
    ).textContent = `${playable} playable MCQs`;
}


function createElement(tag, className, text) {
    const element = document.createElement(tag);

    if (className) {
        element.className = className;
    }

    if (text !== undefined && text !== null) {
        element.textContent = String(text);
    }

    return element;
}


function isMCQ(question) {
    return (
        OPTION_LETTERS.every((letter) => {
            const value = question[
                `option_${letter.toLowerCase()}`
            ];

            return (
                typeof value === "string" &&
                value.trim().length > 0
            );
        }) &&
        OPTION_LETTERS.includes(question.correct_answer) &&
        typeof question.explanation === "string" &&
        question.explanation.trim().length > 0
    );
}


function renderQuestions(questions) {
    questionsList.replaceChildren();

    if (!questions.length) {
        questionsList.appendChild(
            createElement(
                "p",
                "empty-bank",
                "No questions found in this zone."
            )
        );

        return;
    }

    for (const question of questions) {
        const card = createElement(
            "article",
            "question-card mcq-question-card"
        );

        const heading = createElement(
            "h3",
            "mcq-question-title",
            question.question_text
        );

        const status = createElement(
            "span",
            isMCQ(question)
                ? "mcq-status mcq-status-ready"
                : "mcq-status mcq-status-incomplete",
            isMCQ(question)
                ? "Ready to play"
                : "Incomplete MCQ"
        );

        card.append(heading, status);

        if (isMCQ(question)) {
            const options = createElement(
                "div",
                "mcq-options-list"
            );

            for (const letter of OPTION_LETTERS) {
                const optionText = question[
                    `option_${letter.toLowerCase()}`
                ];

                const isCorrect =
                    letter === question.correct_answer;

                const option = createElement(
                    "div",
                    isCorrect
                        ? "mcq-option mcq-option-correct"
                        : "mcq-option"
                );

                const letterLabel = createElement(
                    "strong",
                    "mcq-option-letter",
                    `${letter}.`
                );

                const value = createElement(
                    "span",
                    "mcq-option-text",
                    optionText
                );

                option.append(letterLabel, value);

                if (isCorrect) {
                    option.appendChild(
                        createElement(
                            "span",
                            "mcq-correct-label",
                            "✓ Correct"
                        )
                    );
                }

                options.appendChild(option);
            }

            card.appendChild(options);

            const explanation = createElement(
                "div",
                "mcq-explanation"
            );

            explanation.append(
                createElement(
                    "strong",
                    "",
                    "Explanation"
                ),
                createElement(
                    "p",
                    "",
                    question.explanation
                )
            );

            card.appendChild(explanation);

        } else {
            card.appendChild(
                createElement(
                    "p",
                    "mcq-help-text",
                    "This question needs four options, a correct " +
                    "answer, and an explanation before it can be played."
                )
            );

            if (question.answer_text) {
                card.appendChild(
                    createElement(
                        "p",
                        "question-answer",
                        `Previous answer: ${question.answer_text}`
                    )
                );
            }
        }

        const actions = createElement(
            "div",
            "question-actions"
        );

        const editButton = createElement(
            "button",
            "",
            "Edit MCQ"
        );

        editButton.type = "button";

        editButton.addEventListener("click", () => {
            openQuestionEditor(question);
        });

        const deleteButton = createElement(
            "button",
            "delete-button",
            "Delete"
        );

        deleteButton.type = "button";

        deleteButton.addEventListener("click", () => {
            deleteQuestion(question);
        });

        actions.append(editButton, deleteButton);
        card.appendChild(actions);

        questionsList.appendChild(card);
    }
}


function updatePagination() {
    const totalPages = Math.max(
        1,
        Math.ceil(bankTotal / BANK_PAGE_SIZE)
    );

    pageIndicator.textContent =
        `Page ${bankPage} of ${totalPages}`;

    previousPage.disabled = bankPage <= 1;
    nextPage.disabled = bankPage >= totalPages;
}


function openQuestionEditor(question) {
    editingQuestionId = question.id;

    document.getElementById(
        "edit-question-text"
    ).value = question.question_text || "";

    for (const letter of OPTION_LETTERS) {
        document.getElementById(
            `edit-option-${letter.toLowerCase()}`
        ).value = question[
            `option_${letter.toLowerCase()}`
        ] || "";
    }

    document.getElementById(
        "edit-correct-answer"
    ).value = question.correct_answer || "A";

    document.getElementById(
        "edit-explanation"
    ).value = question.explanation || "";

    editMessage.textContent = "";

    if (!editor.open) {
        editor.showModal();
    }
}


editForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (editingQuestionId === null) {
        return;
    }

    const payload = {
        question_text: document.getElementById(
            "edit-question-text"
        ).value.trim(),

        option_a: document.getElementById(
            "edit-option-a"
        ).value.trim(),

        option_b: document.getElementById(
            "edit-option-b"
        ).value.trim(),

        option_c: document.getElementById(
            "edit-option-c"
        ).value.trim(),

        option_d: document.getElementById(
            "edit-option-d"
        ).value.trim(),

        correct_answer: document.getElementById(
            "edit-correct-answer"
        ).value,

        explanation: document.getElementById(
            "edit-explanation"
        ).value.trim()
    };

    const fields = [
        payload.question_text,
        payload.option_a,
        payload.option_b,
        payload.option_c,
        payload.option_d,
        payload.explanation
    ];

    if (fields.some((value) => !value)) {
        editMessage.textContent =
            "All fields are required.";
        return;
    }

    const uniqueOptions = new Set(
        [
            payload.option_a,
            payload.option_b,
            payload.option_c,
            payload.option_d
        ].map((value) =>
            value.toLowerCase().replace(/\s+/g, " ").trim()
        )
    );

    if (uniqueOptions.size !== 4) {
        editMessage.textContent =
            "All four options must be different.";
        return;
    }

    const saveButton = document.getElementById(
        "save-question"
    );

    saveButton.disabled = true;
    editMessage.textContent = "Saving MCQ...";

    try {
        await bankRequest(
            `/admin/questions/${editingQuestionId}`,
            {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            }
        );

        editor.close();
        editingQuestionId = null;

        await loadQuestionBank();

    } catch (error) {
        editMessage.textContent = error.message;
    } finally {
        saveButton.disabled = false;
    }
});


document.getElementById(
    "cancel-edit"
).addEventListener("click", () => {
    editor.close();
    editingQuestionId = null;
});


editor.addEventListener("close", () => {
    editingQuestionId = null;
});


async function deleteQuestion(question) {
    const confirmed = window.confirm(
        "Permanently delete this MCQ?\n\n" +
        question.question_text
    );

    if (!confirmed) {
        return;
    }

    try {
        await bankRequest(
            `/admin/questions/${question.id}`,
            { method: "DELETE" }
        );

        if (
            bankPage > 1 &&
            bankTotal % BANK_PAGE_SIZE === 1
        ) {
            bankPage--;
        }

        await loadQuestionBank();

    } catch (error) {
        if (adminKey) {
            bankMessage.textContent = error.message;
        }
    }
}


async function refreshQuestionBank(technologyId, zone) {
    if (technologyId) {
        bankTechnology.value = String(technologyId);
    }

    if (zone) {
        bankZone.value = zone;
    }

    bankPage = 1;
    bankSearch.value = "";

    await loadQuestionBank();
}


function clearQuestionBank() {
    bankRequestVersion++;
    clearTimeout(searchTimeout);

    bankPage = 1;
    bankTotal = 0;
    editingQuestionId = null;

    questionsList.replaceChildren();
    bankTechnology.replaceChildren();
    bankSearch.value = "";

    resetCounts();
    updatePagination();

    bankMessage.textContent = "";
    editMessage.textContent = "";

    if (editor.open) {
        editor.close();
    }
}


bankTechnology.addEventListener("change", () => {
    bankPage = 1;
    loadQuestionBank();
});


bankZone.addEventListener("change", () => {
    bankPage = 1;
    loadQuestionBank();
});


bankSearch.addEventListener("input", () => {
    clearTimeout(searchTimeout);

    searchTimeout = setTimeout(() => {
        bankPage = 1;
        loadQuestionBank();
    }, 300);
});


previousPage.addEventListener("click", () => {
    if (bankPage > 1) {
        bankPage--;
        loadQuestionBank();
    }
});


nextPage.addEventListener("click", () => {
    if (bankPage * BANK_PAGE_SIZE < bankTotal) {
        bankPage++;
        loadQuestionBank();
    }
});


document.getElementById(
    "refresh-questions"
).addEventListener("click", () => {
    loadQuestionBank();
});


window.initializeQuestionBank = initializeQuestionBank;
window.refreshQuestionBank = refreshQuestionBank;
window.clearQuestionBank = clearQuestionBank;
