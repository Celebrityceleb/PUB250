
import { supabase } from "./config.js";

/* =========================================
   ADMIN MANAGEMENT — CORE
========================================= */

let allAccounts = [];

export async function loadAdminManagement(container) {
    container.innerHTML = `
        <div class="admin-management">
            <div class="section-heading">
                <div>
                    <h2>Admin Management</h2>
                    <p>Manage PUB250 accounts, roles and access.</p>
                </div>
            </div>

            <div class="admin-management-stats" id="accountStats">
                <div class="management-stat">
                    <span>Total Accounts</span>
                    <strong>...</strong>
                </div>
                <div class="management-stat">
                    <span>Students</span>
                    <strong>...</strong>
                </div>
                <div class="management-stat">
                    <span>Administrators</span>
                    <strong>...</strong>
                </div>
                <div class="management-stat">
                    <span>Pending Invitations</span>
                    <strong>...</strong>
                </div>
            </div>

            <div class="management-toolbar">
                <input
                    type="search"
                    id="accountSearch"
                    placeholder="Search by name, email or matric number..."
                >

                <select id="accountRoleFilter">
                    <option value="all">All Roles</option>
                    <option value="super_admin">Super Administrator</option>
                    <option value="course_rep">Course Representative</option>
                    <option value="assistant_course_rep">Assistant Course Representative</option>
                    <option value="student">Student</option>
                </select>

                <select id="accountStatusFilter">
                    <option value="all">All Statuses</option>
                    <option value="approved">Active</option>
                    <option value="suspended">Suspended</option>
                    <option value="pending">Pending</option>
                    <option value="rejected">Rejected</option>
                </select>
            </div>

            <div id="accountList" class="account-list">
                <p>Loading accounts...</p>
            </div>
        </div>
    `;

    await fetchAccounts();

    document.getElementById("accountSearch")
        .addEventListener("input", renderAccounts);

    document.getElementById("accountRoleFilter")
        .addEventListener("change", renderAccounts);

    document.getElementById("accountStatusFilter")
        .addEventListener("change", renderAccounts);
}

/* =========================================
   FETCH ACCOUNTS FROM SUPABASE
========================================= */

async function fetchAccounts() {
    const accountList = document.getElementById("accountList");

    try {
        const { data, error } = await supabase.functions.invoke(
            "admin-management-",
            {
                body: {
                    action: "list_accounts"
                }
            }
        );

        if (error) throw error;

        if (!data || !data.success) {
            throw new Error(data?.error || "Unable to load accounts.");
        }

        allAccounts = data.accounts || [];

        updateAccountStats();
        renderAccounts();

    } catch (error) {
        console.error("Admin Management error:", error);

        accountList.innerHTML = `
            <div class="management-message error">
                <h3>Unable to load accounts</h3>
                <p>${escapeHTML(error.message || "An unexpected error occurred.")}</p>
                <button id="retryAccounts">Try Again</button>
            </div>
        `;

        document.getElementById("retryAccounts")
            ?.addEventListener("click", fetchAccounts);
    }
}

/* =========================================
   ACCOUNT STATISTICS
========================================= */

function updateAccountStats() {
    const total = allAccounts.length;

    const students = allAccounts.filter(
        account => account.role === "student"
    ).length;

    const administrators = allAccounts.filter(
        account => [
            "super_admin",
            "course_rep",
            "assistant_course_rep"
        ].includes(account.role)
    ).length;

    const invitations = allAccounts.filter(
        account => account.invitation_status === "pending"
    ).length;

    document.getElementById("accountStats").innerHTML = `
        <div class="management-stat">
            <span>Total Accounts</span>
            <strong>${total}</strong>
        </div>

        <div class="management-stat">
            <span>Students</span>
            <strong>${students}</strong>
        </div>

        <div class="management-stat">
            <span>Administrators</span>
            <strong>${administrators}</strong>
        </div>

        <div class="management-stat">
            <span>Pending Invitations</span>
            <strong>${invitations}</strong>
        </div>
    `;
}

/* =========================================
   SAFE TEXT HANDLING
========================================= */

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[character]);
}

/* =========================================
   ACCOUNT LIST & FILTERING
========================================= */

function renderAccounts() {
    const accountList = document.getElementById("accountList");

    if (!accountList) return;

    const search = document.getElementById("accountSearch")
        .value.toLowerCase().trim();

    const roleFilter = document.getElementById("accountRoleFilter").value;

    const statusFilter = document.getElementById("accountStatusFilter").value;

    const filteredAccounts = allAccounts.filter(account => {
        const searchableText = [
            account.full_name,
            account.email,
            account.matric_no,
            account.phone
        ].join(" ").toLowerCase();

        const matchesSearch = searchableText.includes(search);

        const matchesRole =
            roleFilter === "all" || account.role === roleFilter;

        const matchesStatus =
            statusFilter === "all" ||
            account.approval_status === statusFilter;

        return matchesSearch && matchesRole && matchesStatus;
    });

    if (filteredAccounts.length === 0) {
        accountList.innerHTML = `
            <div class="management-empty">
                <h3>No accounts found</h3>
                <p>Try changing your search or filter.</p>
            </div>
        `;
        return;
    }

    accountList.innerHTML = filteredAccounts.map(account => {
        const roleName = getRoleName(account.role);
        const statusName = getStatusName(account.approval_status);

        const invitationName = getInvitationName(
            account.invitation_status
        );

        const initials = getInitials(account.full_name);

        return `
            <div class="account-card">

                <div class="account-card-main">

                    <div class="account-avatar">
                        ${escapeHTML(initials)}
                    </div>

                    <div class="account-identity">
                        <h3>${escapeHTML(account.full_name || "Unnamed Account")}</h3>

                        <p>${escapeHTML(account.email || "No email registered")}</p>

                        <span class="account-role">
                            ${escapeHTML(roleName)}
                        </span>
                    </div>

                </div>

                <div class="account-details">

                    <div>
                        <span>Matric Number</span>
                        <strong>${escapeHTML(account.matric_no || "Not assigned")}</strong>
                    </div>

                    <div>
                        <span>Phone Number</span>
                        <strong>${escapeHTML(account.phone || "Not provided")}</strong>
                    </div>

                    <div>
                        <span>Account Status</span>
                        <strong class="status-${escapeHTML(account.approval_status)}">
                            ${escapeHTML(statusName)}
                        </strong>
                    </div>

                    <div>
                        <span>Invitation</span>
                        <strong>${escapeHTML(invitationName)}</strong>
                    </div>

                </div>

                <div class="account-card-footer">
                    <span>Registered: ${formatDate(account.created_at)}</span>
                    <button
                        class="account-details-button"
                        data-account-id="${escapeHTML(account.id)}"
                    >
                        View Details
                    </button>
                </div>

            </div>
        `;
    }).join("");

    document.querySelectorAll(".account-details-button")
        .forEach(button => {
            button.addEventListener("click", () => {
                const account = allAccounts.find(
                    item => item.id === button.dataset.accountId
                );

                if (account) showAccountDetails(account);
            });
        });
}

/* =========================================
   ACCOUNT LABEL HELPERS
========================================= */

function getRoleName(role) {
    const roles = {
        super_admin: "Super Administrator",
        course_rep: "Course Representative",
        assistant_course_rep: "Assistant Course Representative",
        student: "Student"
    };

    return roles[role] || "Unknown Role";
}

function getStatusName(status) {
    const statuses = {
        approved: "Active",
        suspended: "Suspended",
        pending: "Pending",
        rejected: "Rejected"
    };

    return statuses[status] || "Unknown";
}

function getInvitationName(status) {
    const invitations = {
        pending: "Invitation Sent",
        accepted: "Accepted",
        expired: "Expired",
        cancelled: "Cancelled"
    };

    return invitations[status] || "Not Invited";
}

function getInitials(name) {
    if (!name) return "NA";

    return name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(word => word[0])
        .join("")
        .toUpperCase();
}

function formatDate(date) {
    if (!date) return "Unknown";

    return new Date(date).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric"
    });
}

/* =========================================
   ACCOUNT DETAILS
========================================= */

function showAccountDetails(account) {
    const existingModal = document.getElementById("accountDetailsModal");

    if (existingModal) existingModal.remove();

    const modal = document.createElement("div");

    modal.id = "accountDetailsModal";
    modal.className = "account-details-modal";

    modal.innerHTML = `
        <div class="account-details-panel">

            <div class="account-modal-header">
                <div>
                    <h2>Account Details</h2>
                    <p>Complete account information</p>
                </div>

                <button id="closeAccountModal" aria-label="Close">
                    &times;
                </button>
            </div>

            <div class="account-modal-body">

                <div class="account-modal-avatar">
                    ${escapeHTML(getInitials(account.full_name))}
                </div>

                <h3>${escapeHTML(account.full_name || "Unnamed Account")}</h3>

                <span class="account-role">
                    ${escapeHTML(getRoleName(account.role))}
                </span>

                <div class="account-detail-row">
                    <span>Email Address</span>
                    <strong>${escapeHTML(account.email || "Not provided")}</strong>
                </div>

                <div class="account-detail-row">
                    <span>Matric Number</span>
                    <strong>${escapeHTML(account.matric_no || "Not assigned")}</strong>
                </div>

                <div class="account-detail-row">
                    <span>Phone Number</span>
                    <strong>${escapeHTML(account.phone || "Not provided")}</strong>
                </div>

                <div class="account-detail-row">
                    <span>Account Status</span>
                    <strong>${escapeHTML(getStatusName(account.approval_status))}</strong>
                </div>

                <div class="account-detail-row">
                    <span>Invitation Status</span>
                    <strong>${escapeHTML(getInvitationName(account.invitation_status))}</strong>
                </div>

                <div class="account-detail-row">
                    <span>Account Created</span>
                    <strong>${escapeHTML(formatDate(account.created_at))}</strong>
                </div>

                <div class="account-detail-row">
                    <span>Last Updated</span>
                    <strong>${escapeHTML(formatDate(account.updated_at))}</strong>
                </div>

            </div>

        </div>
    `;

    document.body.appendChild(modal);

    document.getElementById("closeAccountModal")
        .addEventListener("click", () => modal.remove());

    modal.addEventListener("click", event => {
        if (event.target === modal) modal.remove();
    });
}
