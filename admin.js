
import { supabase } from "./config.js";

// Escape database values before displaying them as HTML.
function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[character]);
}

let registrations = [];
let activeFilter = "pending";


// Load student registrations from Supabase.
export async function loadRegistrations(container) {

    container.innerHTML = `
        <div class="admin-panel">
            <p class="admin-placeholder">Loading student registrations...</p>
        </div>
    `;

    const { data, error } = await supabase
        .from("profiles")
        .select(`
            id,
            full_name,
            matric_no,
            email,
            phone,
            whatsapp_number,
            approval_status,
            created_at
        `)
        .eq("role", "student")
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Registration loading error:", error);

        container.innerHTML = `
            <div class="admin-panel">
                <h3>Unable to load registrations</h3>
                <p class="admin-placeholder">
                    ${escapeHTML(error.message)}
                </p>
                <button class="admin-action-button" id="retryRegistrations">
                    Try Again
                </button>
            </div>
        `;

        document.getElementById("retryRegistrations")
            ?.addEventListener("click", () => loadRegistrations(container));

        return;
    }

    registrations = data || [];

    renderRegistrationPage(container);
}


// Display the registration management interface.
function renderRegistrationPage(container) {

    const pending = registrations.filter(
        student => student.approval_status === "pending"
    ).length;

    const approved = registrations.filter(
        student => student.approval_status === "approved"
    ).length;

    const rejected = registrations.filter(
        student => student.approval_status === "rejected"
    ).length;

    const filtered = registrations.filter(student =>
        activeFilter === "all"
            ? true
            : student.approval_status === activeFilter
    );

    container.innerHTML = `
        <div class="admin-welcome">
            <div>
                <span class="admin-section-eyebrow">
                    STUDENT ACCOUNT MANAGEMENT
                </span>
                <h2>Registrations</h2>
                <p>Review and manage student access requests.</p>
            </div>

            <button class="admin-action-button" id="refreshRegistrations">
                ↻ Refresh
            </button>
        </div>

        <div class="admin-stat-grid">

            <article class="admin-stat-card">
                <span>Total Registrations</span>
                <strong>${registrations.length}</strong>
                <small>All student accounts</small>
            </article>

            <article class="admin-stat-card">
                <span>Pending</span>
                <strong>${pending}</strong>
                <small>Awaiting review</small>
            </article>

            <article class="admin-stat-card">
                <span>Approved</span>
                <strong>${approved}</strong>
                <small>Approved students</small>
            </article>

            <article class="admin-stat-card">
                <span>Rejected</span>
                <strong>${rejected}</strong>
                <small>Rejected applications</small>
            </article>

        </div>

        <div class="admin-panel">

            <div class="admin-panel-heading">
                <div>
                    <span class="admin-section-eyebrow">
                        REGISTRATION RECORDS
                    </span>
                    <h3>Student Applications</h3>
                </div>
            </div>

            <div class="registration-filters">

                <button class="registration-filter ${activeFilter === "pending" ? "active" : ""}"
                    data-filter="pending">
                    Pending (${pending})
                </button>

                <button class="registration-filter ${activeFilter === "approved" ? "active" : ""}"
                    data-filter="approved">
                    Approved (${approved})
                </button>

                <button class="registration-filter ${activeFilter === "rejected" ? "active" : ""}"
                    data-filter="rejected">
                    Rejected (${rejected})
                </button>

                <button class="registration-filter ${activeFilter === "all" ? "active" : ""}"
                    data-filter="all">
                    All (${registrations.length})
                </button>

            </div>

            <div class="registration-list">

                ${
                    filtered.length === 0
                    ? `
                        <div class="registration-empty">
                            <span>▤</span>
                            <h3>No registrations found</h3>
                            <p>There are no records in this category yet.</p>
                        </div>
                    `
                    : filtered.map(student => `
                        <article class="registration-card">

                            <div class="registration-card-top">

                                <div class="registration-student-avatar">
                                    ${escapeHTML(
                                        (student.full_name || "S")
                                            .charAt(0).toUpperCase()
                                    )}
                                </div>

                                <div class="registration-student-info">
                                    <h4>${escapeHTML(student.full_name)}</h4>
                                    <span>${escapeHTML(student.matric_no)}</span>
                                </div>

                                <span class="registration-status ${escapeHTML(student.approval_status)}">
                                    ${escapeHTML(student.approval_status)}
                                </span>

                            </div>

                            <div class="registration-details">

                                <p>
                                    <span>Email</span>
                                    ${escapeHTML(student.email)}
                                </p>

                                <p>
                                    <span>WhatsApp</span>
                                    ${escapeHTML(student.whatsapp_number || student.phone || "Not provided")}
                                </p>

                                <p>
                                    <span>Date Registered</span>
                                    ${student.created_at
                                        ? escapeHTML(new Date(student.created_at).toLocaleDateString())
                                        : "Unavailable"}
                                </p>

                            </div>

                        </article>
                    `).join("")
                }

            </div>

        </div>
    `;

    // Refresh records.
    document.getElementById("refreshRegistrations")
        ?.addEventListener("click", () => loadRegistrations(container));

    // Switch between registration categories.
    container.querySelectorAll("[data-filter]")
        .forEach(button => {

            button.addEventListener("click", () => {

                activeFilter = button.dataset.filter;
                renderRegistrationPage(container);

            });

        });
}
