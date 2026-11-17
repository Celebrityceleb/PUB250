
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


// Approve a student through the secure Edge Function.
async function approveStudent(studentId, container) {

    const student = registrations.find(item => item.id === studentId);

    if (!student) {
        alert("Student record not found. Refresh the page.");
        return;
    }

    const confirmed = confirm(
        `Approve ${student.full_name} (${student.matric_no})?\n\n` +
        "A unique student access code will be generated."
    );

    if (!confirmed) return;

    const button = container.querySelector(
        `[data-approve-id="${studentId}"]`
    );

    const resultBox = container.querySelector(
        `[data-approval-result="${studentId}"]`
    );

    if (button) {
        button.disabled = true;
        button.textContent = "Approving...";
    }

    if (resultBox) {
        resultBox.innerHTML = "";
    }

    try {

        const { data, error } = await supabase.functions.invoke(
            "approve-student",
            {
                body: {
                    student_id: studentId
                }
            }
        );

        if (error) {

            let errorMessage = error.message;

            if (error.context) {
                try {
                    const response = await error.context.json();
                    errorMessage = response.error || errorMessage;
                } catch {
                    // Retain the original error.
                }
            }

            throw new Error(errorMessage);
        }

        if (!data || !data.access_code || !data.student) {
            throw new Error(
                "The approval function returned an incomplete response."
            );
        }

        const approvedStudent = data.student;

        const studentName =
            approvedStudent.full_name || student.full_name;

        const matricNo =
            approvedStudent.matric_no || student.matric_no;

        const whatsappNumber =
            approvedStudent.whatsapp_number ||
            student.whatsapp_number ||
            student.phone;

        // Prepare WhatsApp delivery.
        let whatsappLink = "";

        if (whatsappNumber) {

            let digits = String(whatsappNumber).replace(/\D/g, "");

            // Convert Nigerian local numbers to international format.
            if (digits.startsWith("0")) {
                digits = "234" + digits.slice(1);
            }

            if (digits.length >= 10) {

                const whatsappMessage =
                    `Hello ${studentName},\n\n` +
                    `Your PUB250 student account has been approved.\n\n` +
                    `Matric Number: ${matricNo}\n` +
                    `Access Code: ${data.access_code}\n\n` +
                    `You can now log in to the PUB250 student portal:\n` +
                    `https://celebrityceleb.github.io/PUB250/login.html\n\n` +
                    `Keep your access code private.`;

                const whatsappURL =
                    "https://wa.me/" + digits +
                    "?text=" + encodeURIComponent(whatsappMessage);

                whatsappLink = `
                    <a
                        href="${escapeHTML(whatsappURL)}"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="admin-action-button"
                        style="
                            display:inline-block;
                            text-decoration:none;
                            margin-top:12px;
                        "
                    >
                        Send via WhatsApp
                    </a>
                `;
            }
        }

        // Display the approval result.
        if (resultBox) {

            resultBox.innerHTML = `
                <div class="admin-panel" style="margin-top:15px;">

                    <h4>Student Approved Successfully</h4>

                    <p>
                        ${escapeHTML(
                            data.message || "The student account has been approved."
                        )}
                    </p>

                    <div style="
                        background:#F3F5F8;
                        padding:15px;
                        border-radius:10px;
                        margin-top:12px;
                    ">

                        <p>
                            <strong>Student:</strong>
                            ${escapeHTML(studentName)}
                        </p>

                        <p>
                            <strong>Matric Number:</strong>
                            ${escapeHTML(matricNo)}
                        </p>

                        <p><strong>Access Code:</strong></p>

                        <strong style="
                            font-size:20px;
                            letter-spacing:2px;
                            color:#101E35;
                            overflow-wrap:anywhere;
                        ">
                            ${escapeHTML(data.access_code)}
                        </strong>

                    </div>

                    ${
                        whatsappLink
                        ? whatsappLink
                        : `
                            <p style="color:#B42318;margin-top:12px;">
                                No valid WhatsApp number was found.
                                The access code must be delivered manually.
                            </p>
                        `
                    }

                    <p style="
                        font-size:12px;
                        color:#8492A6;
                        margin-top:12px;
                    ">
                        WhatsApp will open with a prefilled message.
                        You must press Send inside WhatsApp.
                    </p>

                </div>
            `;
        }

        student.approval_status = "approved";

        if (button) {
            button.textContent = "Approved";
            button.disabled = true;
        }

    } catch (error) {

        console.error("Student approval failed:", error);

        if (resultBox) {
            resultBox.innerHTML = `
                <p style="color:#B42318;margin-top:12px;">
                    Approval failed: ${escapeHTML(error.message)}
                </p>
            `;
        }

        if (button) {
            button.disabled = false;
            button.textContent = "Approve Student";
        }
    }
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
                                    ${escapeHTML(
                                        student.whatsapp_number ||
                                        student.phone ||
                                        "Not provided"
                                    )}
                                </p>

                                <p>
                                    <span>Date Registered</span>
                                    ${student.created_at
                                        ? escapeHTML(
                                            new Date(student.created_at)
                                                .toLocaleDateString()
                                        )
                                        : "Unavailable"}
                                </p>

                            </div>

                            ${
                                student.approval_status === "pending"
                                ? `
                                    <div style="margin-top:15px;">
                                        <button
                                            class="admin-action-button"
                                            data-approve-id="${escapeHTML(student.id)}"
                                        >
                                            Approve Student
                                        </button>
                                    </div>
                                `
                                : ""
                            }

                            <div data-approval-result="${escapeHTML(student.id)}"></div>

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

    // Handle student approval.
    container.querySelectorAll("[data-approve-id]")
        .forEach(button => {

            button.addEventListener("click", () => {
                approveStudent(button.dataset.approveId, container);
            });

        });
                    }
        
