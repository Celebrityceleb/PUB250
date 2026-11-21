
import { supabase } from "./config.js";

/* =========================================
   STUDENT ANNOUNCEMENTS
========================================= */

let studentAnnouncementsContainer = null;
let studentAnnouncementRecords = [];


/* =========================================
   HTML ESCAPE
========================================= */

function studentAnnouncementEscape(value) {

    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);

}


/* =========================================
   DATE FORMAT
========================================= */

function studentAnnouncementDate(value) {

    if (!value) return "Date unavailable";

    return new Date(value).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric"
    });

}


/* =========================================
   CATEGORY LABEL
========================================= */

function studentAnnouncementCategory(category) {

    const categories = {
        general: "General",
        urgent: "Urgent",
        academic: "Academic Updates"
    };

    return categories[category] || "General";

}


/* =========================================
   LOAD PUBLISHED ANNOUNCEMENTS
========================================= */

async function fetchStudentAnnouncements() {

    const { data, error } = await supabase
        .from("announcements")
        .select(`
            id,
            title,
            content,
            category,
            is_pinned,
            created_at,
            published_at
        `)
        .eq("status", "published")
        .order("is_pinned", { ascending: false })
        .order("published_at", { ascending: false });

    if (error) throw error;

    studentAnnouncementRecords = data || [];

}


/* =========================================
   ANNOUNCEMENT PAGE HEADER
========================================= */

function renderStudentAnnouncementHeader() {

    return `
        <div class="admin-welcome">
            <div>

                <span class="admin-section-eyebrow">
                    OFFICIAL CLASS INFORMATION
                </span>

                <h2>Announcements</h2>

                <p>
                    Stay updated with important PUB250 notices,
                    academic information and class updates.
                </p>

            </div>
        </div>
    `;

}


/* =========================================
   ANNOUNCEMENT COUNT
========================================= */

function renderStudentAnnouncementCount() {

    const total = studentAnnouncementRecords.length;

    return `
        <div class="student-announcement-summary">

            <div>
                <span>Published Announcements</span>
                <strong>${total}</strong>
            </div>

            <span class="student-announcement-summary-icon">
                ◉
            </span>

        </div>
    `;

}


/* =========================================
   ANNOUNCEMENT CARDS
========================================= */

function renderStudentAnnouncementCards() {

    if (!studentAnnouncementRecords.length) {

        return `
            <div class="admin-panel student-announcement-empty">

                <div class="student-announcement-empty-icon">
                    ◉
                </div>

                <h3>No Announcements Yet</h3>

                <p class="admin-placeholder">
                    There are currently no published announcements.
                    Check again later for updates.
                </p>

            </div>
        `;

    }

    return `
        <div class="student-announcement-list">

            ${studentAnnouncementRecords.map(item => `

                <article class="student-announcement-card">

                    ${
                        item.is_pinned
                            ? `
                                <div class="student-announcement-pinned">
                                    📌 IMPORTANT ANNOUNCEMENT
                                </div>
                            `
                            : ""
                    }

                    <div class="student-announcement-card-header">

                        <span class="student-announcement-category category-${studentAnnouncementEscape(item.category)}">
                            ${studentAnnouncementCategory(item.category)}
                        </span>

                        <span class="student-announcement-date">
                            ${studentAnnouncementDate(item.published_at || item.created_at)}
                        </span>

                    </div>

                    <h3>
                        ${studentAnnouncementEscape(item.title)}
                    </h3>

                    <p class="student-announcement-content">
                        ${studentAnnouncementEscape(item.content)}
                    </p>

                </article>

            `).join("")}

        </div>
    `;

}

/* =========================================
   RENDER STUDENT ANNOUNCEMENTS
========================================= */

function renderStudentAnnouncements() {

    if (!studentAnnouncementsContainer) return;

    studentAnnouncementsContainer.innerHTML = `

        ${renderStudentAnnouncementHeader()}

        ${renderStudentAnnouncementCount()}

        ${renderStudentAnnouncementCards()}

    `;

}


/* =========================================
   LOAD STUDENT ANNOUNCEMENTS
========================================= */

export async function loadStudentAnnouncements(container) {

    studentAnnouncementsContainer = container;

    studentAnnouncementsContainer.innerHTML = `
        <div class="admin-panel">
            <p class="admin-placeholder">
                Loading announcements...
            </p>
        </div>
    `;

    try {

        await fetchStudentAnnouncements();

        renderStudentAnnouncements();

    } catch (error) {

        console.error(
            "Student announcements failed to load:",
            error
        );

        studentAnnouncementsContainer.innerHTML = `

            <div class="admin-panel">

                <h3>Unable to Load Announcements</h3>

                <p class="admin-placeholder">
                    ${studentAnnouncementEscape(error.message)}
                </p>

                <button
                    type="button"
                    class="admin-primary-button"
                    id="retryStudentAnnouncements"
                >
                    Try Again
                </button>

            </div>

        `;

        document
            .getElementById("retryStudentAnnouncements")
            ?.addEventListener("click", () => {
                loadStudentAnnouncements(container);
            });

    }

}
