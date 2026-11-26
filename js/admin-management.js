
import { supabase } from "./config.js";

/* =========================================
   ADMIN MANAGEMENT — CORE
========================================= */

let allAccounts = [];

const FUNCTION_NAME = "admin-management-";

export async function loadAdminManagement(container) {
    container.innerHTML = `
        <div class="admin-management">

            <div class="section-heading">
                <div>
                    <h2>Admin Management</h2>
                    <p>Manage PUB250 accounts, roles and access.</p>
                </div>

                <button id="createAccountButton" class="create-account-button">
                    + Create New Account
                </button>
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

    document.getElementById("createAccountButton")
        .addEventListener("click", showCreateAccountForm);

    document.getElementById("accountSearch")
        .addEventListener("input", renderAccounts);

    document.getElementById("accountRoleFilter")
        .addEventListener("change", renderAccounts);

    document.getElementById("accountStatusFilter")
        .addEventListener("change", renderAccounts);

    await fetchAccounts();
}

/* =========================================
   SUPABASE ACTION HELPER
========================================= */

async function callManagementAction(payload) {
    const { data, error } = await supabase.functions.invoke(
        FUNCTION_NAME,
        {
            body: payload
        }
    );

    if (error) {
        throw new Error(
            data?.error ||
            error.message ||
            "The account operation failed."
        );
    }

    if (!data || !data.success) {
        throw new Error(
            data?.error || "The account operation was unsuccessful."
        );
    }

    return data;
}

/* =========================================
   FETCH ACCOUNTS
========================================= */

async function fetchAccounts() {
    const accountList = document.getElementById("accountList");

    if (!accountList) return;

    accountList.innerHTML = "<p>Loading accounts...</p>";

    try {
        const data = await callManagementAction({
            action: "list_accounts"
        });

        allAccounts = data.accounts || [];

        updateAccountStats();
        renderAccounts();

    } catch (error) {
        console.error("Admin Management error:", error);

        accountList.innerHTML = `
            <div class="management-message error">
                <h3>Unable to load accounts</h3>
                <p>${escapeHTML(error.message)}</p>
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
   ACCOUNT LIST AND FILTERING
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

    accountList.innerHTML = filteredAccounts.map(account => `
        <div class="account-card">

            <div class="account-card-main">

                <div class="account-avatar">
                    ${escapeHTML(getInitials(account.full_name))}
                </div>

                <div class="account-identity">
                    <h3>${escapeHTML(account.full_name || "Unnamed Account")}</h3>

                    <p>${escapeHTML(account.email || "No email registered")}</p>

                    <span class="account-role">
                        ${escapeHTML(getRoleName(account.role))}
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
                        ${escapeHTML(getStatusName(account.approval_status))}
                    </strong>
                </div>

                <div>
                    <span>Invitation</span>
                    <strong>${escapeHTML(getInvitationName(account.invitation_status))}</strong>
                </div>

            </div>

            <div class="account-card-footer">
                <span>Registered: ${escapeHTML(formatDate(account.created_at))}</span>

                <button
                    class="account-details-button"
                    data-account-id="${escapeHTML(account.id)}"
                >
                    View Details
                </button>
            </div>

        </div>
    `).join("");

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
   ACCOUNT DETAILS AND ACTIONS
========================================= */

function showAccountDetails(account) {
    document.getElementById("accountDetailsModal")?.remove();

    const isSuperAdmin = account.role === "super_admin";

    const modal = document.createElement("div");

    modal.id = "accountDetailsModal";
    modal.className = "account-details-modal";

    let actionButtons = "";

    if (!isSuperAdmin) {
        actionButtons = `
            <div class="account-management-actions">

                <button
                    type="button"
                    id="editAccountButton"
                    class="account-action-button"
                >
                    Edit Account
                </button>

                ${
                    account.approval_status === "suspended"
                    ? `
                        <button
                            type="button"
                            id="reactivateAccountButton"
                            class="account-action-button"
                        >
                            Reactivate Account
                        </button>
                    `
                    : account.approval_status === "approved"
                    ? `
                        <button
                            type="button"
                            id="suspendAccountButton"
                            class="account-action-button"
                        >
                            Suspend Account
                        </button>
                    `
                    : ""
                }

                <button
                    type="button"
                    id="revokeAccountButton"
                    class="account-action-button danger"
                >
                    Revoke Access
                </button>

            </div>
        `;
    } else {
        actionButtons = `
            <div class="management-message">
                <p>The Super Administrator account is protected from account-management actions.</p>
            </div>
        `;
    }

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

                ${actionButtons}

                <p id="accountActionMessage"></p>

            </div>

        </div>
    `;

    document.body.appendChild(modal);

    document.getElementById("closeAccountModal")
        .addEventListener("click", () => modal.remove());

    modal.addEventListener("click", event => {
        if (event.target === modal) modal.remove();
    });

    document.getElementById("editAccountButton")
        ?.addEventListener("click", () => showEditAccountForm(account));

    document.getElementById("suspendAccountButton")
        ?.addEventListener("click", () => suspendAccount(account));

    document.getElementById("reactivateAccountButton")
        ?.addEventListener("click", () => reactivateAccount(account));

    document.getElementById("revokeAccountButton")
        ?.addEventListener("click", () => revokeAccount(account));
       }
/* =========================================
   EDIT ACCOUNT FORM
========================================= */

function showEditAccountForm(account) {
    document.getElementById("accountDetailsModal")?.remove();
    document.getElementById("editAccountModal")?.remove();

    const isStudent = account.role === "student";

    const modal = document.createElement("div");

    modal.id = "editAccountModal";
    modal.className = "account-details-modal";

    modal.innerHTML = `
        <div class="account-details-panel create-account-panel">

            <div class="account-modal-header">
                <div>
                    <h2>Edit Account</h2>
                    <p>Update account information.</p>
                </div>

                <button id="closeEditAccount" aria-label="Close">
                    &times;
                </button>
            </div>

            <form id="editAccountForm">

                <div class="create-account-field">
                    <label for="editAccountName">Full Name</label>
                    <input
                        type="text"
                        id="editAccountName"
                        value="${escapeHTML(account.full_name)}"
                        required
                    >
                </div>

                <div class="create-account-field">
                    <label for="editAccountEmail">Email Address</label>
                    <input
                        type="email"
                        id="editAccountEmail"
                        value="${escapeHTML(account.email)}"
                        required
                    >
                </div>

                <div class="create-account-field">
                    <label for="editAccountPhone">Phone Number</label>
                    <input
                        type="tel"
                        id="editAccountPhone"
                        value="${escapeHTML(account.phone)}"
                        required
                    >
                </div>

                ${
                    isStudent
                    ? `
                        <div class="create-account-field">
                            <label for="editAccountMatric">Matric Number</label>
                            <input
                                type="text"
                                id="editAccountMatric"
                                value="${escapeHTML(account.matric_no)}"
                                required
                            >
                        </div>
                    `
                    : ""
                }

                <div class="management-message">
                    <p>Account role cannot be changed from this form.</p>
                </div>

                <div class="create-account-actions">

                    <button type="button" id="cancelEditAccount">
                        Cancel
                    </button>

                    <button type="submit" id="saveAccountChanges">
                        Save Changes
                    </button>

                </div>

                <p id="editAccountMessage"></p>

            </form>

        </div>
    `;

    document.body.appendChild(modal);

    function closeForm() {
        modal.remove();
        showAccountDetails(account);
    }

    document.getElementById("closeEditAccount")
        .addEventListener("click", closeForm);

    document.getElementById("cancelEditAccount")
        .addEventListener("click", closeForm);

    modal.addEventListener("click", event => {
        if (event.target === modal) closeForm();
    });

    document.getElementById("editAccountForm")
        .addEventListener("submit", event => saveAccountChanges(event, account));
}

/* =========================================
   SAVE ACCOUNT CHANGES
========================================= */

async function saveAccountChanges(event, account) {
    event.preventDefault();

    const button = document.getElementById("saveAccountChanges");
    const message = document.getElementById("editAccountMessage");

    const fullName = document.getElementById("editAccountName")
        .value.trim();

    const email = document.getElementById("editAccountEmail")
        .value.trim().toLowerCase();

    const phone = document.getElementById("editAccountPhone")
        .value.trim();

    const matricNo = account.role === "student"
        ? document.getElementById("editAccountMatric").value.trim()
        : null;

    if (!fullName || !email || !phone) {
        message.textContent = "Complete all required fields.";
        return;
    }

    if (account.role === "student" && !matricNo) {
        message.textContent = "Matric number is required.";
        return;
    }

    button.disabled = true;
    button.textContent = "Saving...";

    try {
        await callManagementAction({
            action: "edit_account",
            user_id: account.id,
            target_id: account.id,
            id: account.id,
            full_name: fullName,
            email,
            phone,
            matric_no: matricNo
        });

        alert("Account information updated successfully.");

        document.getElementById("editAccountModal")?.remove();

        await fetchAccounts();

    } catch (error) {
        console.error("Edit account error:", error);

        message.textContent = error.message;

        button.disabled = false;
        button.textContent = "Save Changes";
    }
}

/* =========================================
   SUSPEND ACCOUNT
========================================= */

async function suspendAccount(account) {
    const confirmed = confirm(
        `Suspend ${account.full_name}?\n\nThis will block the account from accessing PUB250. Their records will not be deleted.`
    );

    if (!confirmed) return;

    await performAccountAction(
        account,
        "suspend_account",
        "Account suspended successfully."
    );
}

/* =========================================
   REACTIVATE ACCOUNT
========================================= */

async function reactivateAccount(account) {
    const confirmed = confirm(
        `Reactivate ${account.full_name}?\n\nThis will restore the account's access if it has not been permanently revoked.`
    );

    if (!confirmed) return;

    await performAccountAction(
        account,
        "reactivate_account",
        "Account reactivation successful."
    );
}

/* =========================================
   REVOKE ACCOUNT ACCESS
========================================= */

async function revokeAccount(account) {
    const confirmed = confirm(
        `PERMANENT ACCESS REVOCATION\n\nYou are about to revoke access for:\n${account.full_name}\n\nThis is different from ordinary suspension. The account and academic records will be retained, but access will be blocked.\n\nContinue?`
    );

    if (!confirmed) return;

    const secondConfirmation = confirm(
        "Are you absolutely sure? This action is intended to be irreversible through ordinary account reactivation."
    );

    if (!secondConfirmation) return;

    await performAccountAction(
        account,
        "revoke_access",
        "Account access has been revoked."
    );
}

/* =========================================
   PERFORM ACCOUNT ACTION
========================================= */

async function performAccountAction(account, action, successMessage) {
    try {
        await callManagementAction({
            action,
            user_id: account.id,
            target_id: account.id,
            id: account.id
        });

        alert(successMessage);

        document.getElementById("accountDetailsModal")?.remove();

        await fetchAccounts();

    } catch (error) {
        console.error("Account management action error:", error);

        alert(
            "The operation could not be completed.\n\n" +
            error.message
        );
    }
}

/* =========================================
   CREATE ACCOUNT FORM
========================================= */

function showCreateAccountForm() {
    document.getElementById("createAccountModal")?.remove();

    const modal = document.createElement("div");

    modal.id = "createAccountModal";
    modal.className = "account-details-modal";

    modal.innerHTML = `
        <div class="account-details-panel create-account-panel">

            <div class="account-modal-header">
                <div>
                    <h2>Create New Account</h2>
                    <p>Create a PUB250 student or administrator account.</p>
                </div>

                <button id="closeCreateAccount" aria-label="Close">
                    &times;
                </button>
            </div>

            <form id="createAccountForm">

                <div class="create-account-field">
                    <label for="newAccountRole">Account Role</label>

                    <select id="newAccountRole" required>
                        <option value="student">Student</option>
                        <option value="course_rep">Course Representative</option>
                        <option value="assistant_course_rep">
                            Assistant Course Representative
                        </option>
                    </select>
                </div>

                <div class="create-account-field">
                    <label for="newAccountName">Full Name</label>
                    <input
                        type="text"
                        id="newAccountName"
                        placeholder="Enter full name"
                        required
                    >
                </div>

                <div class="create-account-field">
                    <label for="newAccountEmail">Email Address</label>
                    <input
                        type="email"
                        id="newAccountEmail"
                        placeholder="Enter email address"
                        required
                    >
                </div>

                <div class="create-account-field">
                    <label for="newAccountPhone">Phone Number</label>
                    <input
                        type="tel"
                        id="newAccountPhone"
                        placeholder="Enter phone number"
                        required
                    >
                </div>

                <div class="create-account-field" id="matricNumberField">
                    <label for="newAccountMatric">Matric Number</label>
                    <input
                        type="text"
                        id="newAccountMatric"
                        placeholder="Enter matric number"
                    >
                </div>

                <div class="create-account-notice">
                    <strong>Account invitation</strong>
                    <p>
                        The account holder will receive an invitation
                        to set their own password.
                    </p>
                </div>

                <div class="create-account-actions">

                    <button type="button" id="cancelCreateAccount">
                        Cancel
                    </button>

                    <button type="submit" id="submitCreateAccount">
                        Create Account
                    </button>

                </div>

                <p id="createAccountMessage"></p>

            </form>

        </div>
    `;

    document.body.appendChild(modal);

    const roleSelect = document.getElementById("newAccountRole");
    const matricField = document.getElementById("matricNumberField");
    const matricInput = document.getElementById("newAccountMatric");

    function updateMatricField() {
        const isStudent = roleSelect.value === "student";

        matricField.style.display = isStudent ? "block" : "none";
        matricInput.required = isStudent;

        if (!isStudent) matricInput.value = "";
    }

    roleSelect.addEventListener("change", updateMatricField);
    updateMatricField();

    function closeForm() {
        modal.remove();
    }

    document.getElementById("closeCreateAccount")
        .addEventListener("click", closeForm);

    document.getElementById("cancelCreateAccount")
        .addEventListener("click", closeForm);

    modal.addEventListener("click", event => {
        if (event.target === modal) closeForm();
    });

    document.getElementById("createAccountForm")
        .addEventListener("submit", handleCreateAccount);
}

/* =========================================
   CREATE ACCOUNT — SUPABASE ACTION
========================================= */

async function handleCreateAccount(event) {
    event.preventDefault();

    const submitButton = document.getElementById("submitCreateAccount");
    const message = document.getElementById("createAccountMessage");

    const fullName = document.getElementById("newAccountName")
        .value.trim();

    const email = document.getElementById("newAccountEmail")
        .value.trim().toLowerCase();

    const phone = document.getElementById("newAccountPhone")
        .value.trim();

    const role = document.getElementById("newAccountRole").value;

    const matricNo = document.getElementById("newAccountMatric")
        .value.trim();

    if (!fullName || !email || !role || !phone) {
        message.textContent = "Please complete all required fields.";
        return;
    }

    if (role === "student" && !matricNo) {
        message.textContent = "Student matric number is required.";
        return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "Creating Account...";

    message.textContent = "Processing account invitation...";

    try {
        await callManagementAction({
            action: "invite",
            full_name: fullName,
            email,
            role,
            phone,
            matric_no: role === "student" ? matricNo : null
        });

        message.textContent =
            "Account created successfully. Invitation status: Pending.";

        submitButton.textContent = "Created Successfully";

        await fetchAccounts();

        setTimeout(() => {
            document.getElementById("createAccountModal")?.remove();
        }, 1800);

    } catch (error) {
        console.error("Account creation error:", error);

        message.textContent = error.message;

        submitButton.disabled = false;
        submitButton.textContent = "Create Account";
    }
}
