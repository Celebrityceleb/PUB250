
import { supabase } from "./config.js";

/* =========================================
   ADMIN ANNOUNCEMENTS — CORE
========================================= */

let announcementsContainer = null;
let announcementRecords = [];
let editingAnnouncementId = null;

function announcementEscape(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
}

function announcementDate(value) {
    if (!value) return "Not published";

    return new Date(value).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric"
    });
}

function announcementCategoryLabel(category) {
    const labels = {
        general: "General",
        urgent: "Urgent",
        academic: "Academic Updates"
    };

    return labels[category] || "General";
}

function announcementStatusLabel(status) {
    return status === "published" ? "Published" : "Draft";
}


/* =========================================
   LOAD ANNOUNCEMENTS
========================================= */

async function fetchAnnouncements() {

    const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false });

    if (error) {
        throw error;
    }

    announcementRecords = data || [];

}


/* =========================================
   ANNOUNCEMENT STATISTICS
========================================= */

function renderAnnouncementStats() {

    const total = announcementRecords.length;

    const published = announcementRecords.filter(
        item => item.status === "published"
    ).length;

    const drafts = announcementRecords.filter(
        item => item.status === "draft"
    ).length;

    const pinned = announcementRecords.filter(
        item => item.is_pinned
    ).length;

    return `
        <div class="admin-stat-grid">

            <article class="admin-stat-card">
                <span>Total Announcements</span>
                <strong>${total}</strong>
                <small>All announcement records</small>
            </article>

            <article class="admin-stat-card">
                <span>Published</span>
                <strong>${published}</strong>
                <small>Visible to students</small>
            </article>

            <article class="admin-stat-card">
                <span>Drafts</span>
                <strong>${drafts}</strong>
                <small>Not yet published</small>
            </article>

            <article class="admin-stat-card">
                <span>Pinned</span>
                <strong>${pinned}</strong>
                <small>Important announcements</small>
            </article>

        </div>
    `;
}


/* =========================================
   ANNOUNCEMENT FORM
========================================= */

function renderAnnouncementForm() {

    const editing = announcementRecords.find(
        item => item.id === editingAnnouncementId
    );

    return `
        <div class="admin-panel announcement-form-panel">

            <div class="admin-panel-heading">
                <div>
                    <span class="admin-section-eyebrow">
                        ANNOUNCEMENT MANAGEMENT
                    </span>

                    <h3>
                        ${editing ? "Edit Announcement" : "Create Announcement"}
                    </h3>
                </div>
            </div>

            <form id="announcementForm">

                <div class="announcement-form-grid">

                    <label>
                        Announcement Title

                        <input
                            type="text"
                            id="announcementTitle"
                            maxlength="180"
                            placeholder="Enter announcement title"
                            value="${announcementEscape(editing?.title || "")}"
                            required
                        >
                    </label>

                    <label>
                        Category

                        <select id="announcementCategory" required>

                            <option value="general"
                                ${editing?.category === "general" ? "selected" : ""}>
                                General
                            </option>

                            <option value="urgent"
                                ${editing?.category === "urgent" ? "selected" : ""}>
                                Urgent
                            </option>

                            <option value="academic"
                                ${editing?.category === "academic" ? "selected" : ""}>
                                Academic Updates
                            </option>

                        </select>
                    </label>

                </div>

                <label class="announcement-content-label">
                    Announcement Content

                    <textarea
                        id="announcementContent"
                        rows="7"
                        placeholder="Write the full announcement here..."
                        required
                    >${announcementEscape(editing?.content || "")}</textarea>
                </label>

                <label class="announcement-pin-option">
                    <input
                        type="checkbox"
                        id="announcementPinned"
                        ${editing?.is_pinned ? "checked" : ""}
                    >

                    <span>
                        Pin this announcement
                    </span>
                </label>

                <div class="announcement-form-actions">

                    <button
                        type="submit"
                        class="admin-primary-button"
                        id="announcementSubmit"
                    >
                        ${editing ? "Save Changes" : "Save Announcement"}
                    </button>

                    ${
                        editing
                            ? `
                                <button
                                    type="button"
                                    class="admin-secondary-button"
                                    id="cancelAnnouncementEdit"
                                >
                                    Cancel Edit
                                </button>
                            `
                            : ""
                    }

                </div>

            </form>

        </div>
    `;
}

/* =========================================
   ANNOUNCEMENT LIST
========================================= */

function renderAnnouncementList() {

    if (!announcementRecords.length) {
        return `
            <div class="admin-panel">
                <h3>No Announcements Yet</h3>

                <p class="admin-placeholder">
                    Create your first announcement using the form above.
                </p>
            </div>
        `;
    }

    return `
        <div class="admin-panel announcement-list-panel">

            <div class="admin-panel-heading">
                <div>
                    <span class="admin-section-eyebrow">
                        PUBLISHED CONTENT & DRAFTS
                    </span>

                    <h3>Manage Announcements</h3>
                </div>
            </div>

            <div class="announcement-toolbar">

                <input
                    type="search"
                    id="announcementSearch"
                    placeholder="Search announcements..."
                >

                <select id="announcementStatusFilter">
                    <option value="all">All Statuses</option>
                    <option value="published">Published</option>
                    <option value="draft">Drafts</option>
                </select>

                <select id="announcementCategoryFilter">
                    <option value="all">All Categories</option>
                    <option value="general">General</option>
                    <option value="urgent">Urgent</option>
                    <option value="academic">Academic Updates</option>
                </select>

            </div>

            <div id="announcementRecordsList">
                ${renderAnnouncementRecordCards(announcementRecords)}
            </div>

        </div>
    `;
}


/* =========================================
   ANNOUNCEMENT RECORD CARDS
========================================= */

function renderAnnouncementRecordCards(records) {

    if (!records.length) {
        return `
            <div class="announcement-empty-search">
                No announcements match your search.
            </div>
        `;
    }

    return `
        <div class="announcement-record-list">

            ${records.map(item => `

                <article class="announcement-record-card">

                    <div class="announcement-record-main">

                        <div class="announcement-record-labels">

                            <span class="announcement-category-badge category-${announcementEscape(item.category)}">
                                ${announcementCategoryLabel(item.category)}
                            </span>

                            <span class="announcement-status-badge status-${announcementEscape(item.status)}">
                                ${announcementStatusLabel(item.status)}
                            </span>

                            ${
                                item.is_pinned
                                    ? `<span class="announcement-pinned-badge">📌 Pinned</span>`
                                    : ""
                            }

                        </div>

                        <h4>${announcementEscape(item.title)}</h4>

                        <p>
                            ${announcementEscape(item.content)}
                        </p>

                        <div class="announcement-record-date">

                            Created: ${announcementDate(item.created_at)}

                            ${
                                item.published_at
                                    ? ` · Published: ${announcementDate(item.published_at)}`
                                    : ""
                            }

                        </div>

                    </div>

                    <div class="announcement-record-actions">

                        <button
                            type="button"
                            class="announcement-action-button edit-announcement-button"
                            data-action="edit"
                            data-id="${announcementEscape(item.id)}"
                        >
                            Edit
                        </button>

                        <button
                            type="button"
                            class="announcement-action-button"
                            data-action="toggle-pin"
                            data-id="${announcementEscape(item.id)}"
                        >
                            ${item.is_pinned ? "Unpin" : "Pin"}
                        </button>

                        <button
                            type="button"
                            class="announcement-action-button publish-announcement-button"
                            data-action="toggle-status"
                            data-id="${announcementEscape(item.id)}"
                        >
                            ${item.status === "published" ? "Unpublish" : "Publish"}
                        </button>

                        <button
                            type="button"
                            class="announcement-action-button delete-announcement-button"
                            data-action="delete"
                            data-id="${announcementEscape(item.id)}"
                        >
                            Delete
                        </button>

                    </div>

                </article>

            `).join("")}

        </div>
    `;
}


/* =========================================
   FILTER ANNOUNCEMENTS
========================================= */

function filterAnnouncementRecords() {

    const search = document
        .getElementById("announcementSearch")
        ?.value.trim().toLowerCase() || "";

    const status = document
        .getElementById("announcementStatusFilter")
        ?.value || "all";

    const category = document
        .getElementById("announcementCategoryFilter")
        ?.value || "all";

    const filtered = announcementRecords.filter(item => {

        const matchesSearch =
            item.title.toLowerCase().includes(search) ||
            item.content.toLowerCase().includes(search);

        const matchesStatus =
            status === "all" || item.status === status;

        const matchesCategory =
            category === "all" || item.category === category;

        return matchesSearch && matchesStatus && matchesCategory;

    });

    const list = document.getElementById("announcementRecordsList");

    if (list) {
        list.innerHTML = renderAnnouncementRecordCards(filtered);
    }

}


/* =========================================
   SAVE ANNOUNCEMENT
========================================= */

async function saveAnnouncement(event) {

    event.preventDefault();

    const title = document
        .getElementById("announcementTitle")
        .value.trim();

    const content = document
        .getElementById("announcementContent")
        .value.trim();

    const category = document
        .getElementById("announcementCategory")
        .value;

    const isPinned = document
        .getElementById("announcementPinned")
        .checked;

    if (!title || !content) {
        alert("Please complete the announcement title and content.");
        return;
    }

    const submitButton = document.getElementById("announcementSubmit");

    submitButton.disabled = true;
    submitButton.textContent = "Saving...";

    try {

        const {
            data: { user },
            error: userError
        } = await supabase.auth.getUser();

        if (userError) throw userError;

        if (!user) {
            throw new Error("Your administrator session has expired. Please sign in again.");
        }

        const announcementData = {
            title,
            content,
            category,
            is_pinned: isPinned
        };

        let result;

        if (editingAnnouncementId) {

            result = await supabase
                .from("announcements")
                .update(announcementData)
                .eq("id", editingAnnouncementId);

        } else {

            result = await supabase
                .from("announcements")
                .insert({
                    ...announcementData,
                    created_by: user.id,
                    status: "draft"
                });

        }

        if (result.error) {
            throw result.error;
        }

        editingAnnouncementId = null;

        await refreshAnnouncementManager();

        alert("Announcement saved successfully.");

    } catch (error) {

        console.error("Announcement save failed:", error);

        alert(error.message || "Could not save announcement.");

        submitButton.disabled = false;
        submitButton.textContent = editingAnnouncementId
            ? "Save Changes"
            : "Save Announcement";

    }

}

/* =========================================
   REFRESH ANNOUNCEMENT MANAGER
========================================= */

async function refreshAnnouncementManager() {

    await fetchAnnouncements();

    if (!announcementsContainer) return;

    announcementsContainer.innerHTML = `
        <div class="admin-welcome">
            <div>
                <span class="admin-section-eyebrow">
                    ACADEMIC COMMUNICATION
                </span>

                <h2>Announcements</h2>

                <p>Create and manage official PUB250 announcements.</p>
            </div>
        </div>

        ${renderAnnouncementStats()}

        ${renderAnnouncementForm()}

        ${renderAnnouncementList()}
    `;

    attachAnnouncementFormEvents();
    attachAnnouncementFilterEvents();
}


/* =========================================
   FORM EVENTS
========================================= */

function attachAnnouncementFormEvents() {

    const form = document.getElementById("announcementForm");

    if (form) {
        form.addEventListener("submit", saveAnnouncement);
    }

    const cancelButton = document.getElementById(
        "cancelAnnouncementEdit"
    );

    if (cancelButton) {

        cancelButton.addEventListener("click", async () => {

            editingAnnouncementId = null;

            await refreshAnnouncementManager();

        });

    }

}


/* =========================================
   FILTER EVENTS
========================================= */

function attachAnnouncementFilterEvents() {

    const search = document.getElementById("announcementSearch");

    const status = document.getElementById(
        "announcementStatusFilter"
    );

    const category = document.getElementById(
        "announcementCategoryFilter"
    );

    if (search) {
        search.addEventListener("input", filterAnnouncementRecords);
    }

    if (status) {
        status.addEventListener("change", filterAnnouncementRecords);
    }

    if (category) {
        category.addEventListener("change", filterAnnouncementRecords);
    }

}


/* =========================================
   ANNOUNCEMENT ACTIONS
========================================= */

async function handleAnnouncementAction(action, id) {

    const announcement = announcementRecords.find(
        item => item.id === id
    );

    if (!announcement) return;

    try {

        if (action === "edit") {

            editingAnnouncementId = id;

            await refreshAnnouncementManager();

            announcementsContainer
                .querySelector(".announcement-form-panel")
                ?.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });

            return;
        }


        if (action === "delete") {

            const confirmed = confirm(
                `Are you sure you want to delete "${announcement.title}"? This action cannot be undone.`
            );

            if (!confirmed) return;

            const { error } = await supabase
                .from("announcements")
                .delete()
                .eq("id", id);

            if (error) throw error;

            editingAnnouncementId = null;

            await refreshAnnouncementManager();

            alert("Announcement deleted successfully.");

            return;
        }


        if (action === "toggle-pin") {

            const { error } = await supabase
                .from("announcements")
                .update({
                    is_pinned: !announcement.is_pinned
                })
                .eq("id", id);

            if (error) throw error;

            await refreshAnnouncementManager();

            return;
        }


        if (action === "toggle-status") {

            const publishing = announcement.status !== "published";

            const updateData = publishing
                ? {
                    status: "published",
                    published_at: new Date().toISOString()
                }
                : {
                    status: "draft",
                    published_at: null
                };

            const { error } = await supabase
                .from("announcements")
                .update(updateData)
                .eq("id", id);

            if (error) throw error;

            await refreshAnnouncementManager();

            alert(
                publishing
                    ? "Announcement published successfully."
                    : "Announcement moved back to drafts."
            );

            return;
        }

    } catch (error) {

        console.error("Announcement action failed:", error);

        alert(
            error.message || "The requested action could not be completed."
        );

    }

}


/* =========================================
   ANNOUNCEMENT BUTTON EVENTS
========================================= */

function attachAnnouncementActionEvents() {

    if (!announcementsContainer) return;

    announcementsContainer.addEventListener("click", event => {

        const button = event.target.closest(
            "[data-action]"
        );

        if (!button) return;

        const action = button.dataset.action;
        const id = button.dataset.id;

        if (!action || !id) return;

        handleAnnouncementAction(action, id);

    });

}


/* =========================================
   LOAD ADMIN ANNOUNCEMENTS
========================================= */

export async function loadAdminAnnouncements(container) {

    announcementsContainer = container;
    editingAnnouncementId = null;

    announcementsContainer.innerHTML = `
        <div class="admin-panel">
            <p class="admin-placeholder">
                Loading announcements...
            </p>
        </div>
    `;

    try {

        await fetchAnnouncements();

        attachAnnouncementActionEvents();

        await refreshAnnouncementManager();

    } catch (error) {

        console.error("Could not load announcements:", error);

        announcementsContainer.innerHTML = `
            <div class="admin-panel">

                <h3>Unable to Load Announcements</h3>

                <p class="admin-placeholder">
                    ${announcementEscape(error.message)}
                </p>

                <button
                    type="button"
                    class="admin-primary-button"
                    id="retryAnnouncements"
                >
                    Try Again
                </button>

            </div>
        `;

        document.getElementById("retryAnnouncements")
            ?.addEventListener("click", () => {
                loadAdminAnnouncements(container);
            });

    }

}
