
import { supabase } from "./config.js";

/* =========================================
   PUB250 — ADMIN ASSIGNMENTS
   PART 1: FOUNDATION AND DATA LOADING
========================================= */

let assignmentsContainer = null;
let assignmentRecords = [];
let assignmentCourses = [];
let assignmentDocuments = [];

let editingAssignmentId = null;
let selectedAssignmentFiles = [];


/* =========================================
   HELPER FUNCTIONS
========================================= */

function assignmentEscape(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[character]);
}


function assignmentDate(value) {
    if (!value) return "Not set";

    return new Date(value + "T00:00:00").toLocaleDateString(
        "en-GB",
        {
            day: "numeric",
            month: "short",
            year: "numeric"
        }
    );
}


function assignmentDateTime(value) {
    if (!value) return "Not available";

    return new Date(value).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric"
    });
}


function assignmentStatusLabel(status) {
    return status === "published" ? "Published" : "Draft";
}


function assignmentFileSize(bytes) {
    if (!bytes) return "Unknown size";

    if (bytes < 1024) {
        return bytes + " B";
    }

    if (bytes < 1024 * 1024) {
        return (bytes / 1024).toFixed(1) + " KB";
    }

    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}


function assignmentShowError(message) {
    alert(message || "Something went wrong. Please try again.");
}


/* =========================================
   LOAD AVAILABLE COURSES
========================================= */

async function fetchAssignmentCourses() {
    const { data, error } = await supabase
        .from("courses")
        .select("id, course_code, course_title")
        .eq("is_active", true)
        .order("course_code", { ascending: true });

    if (error) {
        throw error;
    }

    assignmentCourses = data || [];

    return assignmentCourses;
}


/* =========================================
   LOAD ALL ASSIGNMENTS
========================================= */

async function fetchAssignments() {
    const { data, error } = await supabase
        .from("assignments")
        .select(`
            *,
            courses (
                id,
                course_code,
                course_title
            )
        `)
        .order("created_at", { ascending: false });

    if (error) {
        throw error;
    }

    assignmentRecords = data || [];

    return assignmentRecords;
}


/* =========================================
   LOAD DOCUMENT RECORDS
========================================= */

async function fetchAssignmentDocuments() {
    const { data, error } = await supabase
        .from("assignment_documents")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        throw error;
    }

    assignmentDocuments = data || [];

    return assignmentDocuments;
}


/* =========================================
   ASSIGNMENT STATISTICS
========================================= */

function renderAssignmentStats() {
    const total = assignmentRecords.length;

    const published = assignmentRecords.filter(
        item => item.status === "published"
    ).length;

    const drafts = assignmentRecords.filter(
        item => item.status === "draft"
    ).length;

    const upcoming = assignmentRecords.filter(
        item =>
            item.status === "published" &&
            item.publication_date > new Date().toISOString().slice(0, 10)
    ).length;

    return `
        <div class="announcement-stats-grid">

            <div class="announcement-stat-card">
                <span>Total Assignments</span>
                <strong>${total}</strong>
            </div>

            <div class="announcement-stat-card">
                <span>Published</span>
                <strong>${published}</strong>
            </div>

            <div class="announcement-stat-card">
                <span>Drafts</span>
                <strong>${drafts}</strong>
            </div>

            <div class="announcement-stat-card">
                <span>Scheduled</span>
                <strong>${upcoming}</strong>
            </div>

        </div>
    `;
}

/* =========================================
   PART 2: ASSIGNMENT FORM
========================================= */


/* =========================================
   RENDER COURSE OPTIONS
========================================= */

function renderAssignmentCourseOptions(selectedId = "") {
    if (!assignmentCourses.length) {
        return `<option value="">No active courses available</option>`;
    }

    return `
        <option value="">Select a course</option>

        ${assignmentCourses.map(course => `
            <option
                value="${assignmentEscape(course.id)}"
                ${course.id === selectedId ? "selected" : ""}
            >
                ${assignmentEscape(course.course_code)}
                — ${assignmentEscape(course.course_title)}
            </option>
        `).join("")}
    `;
}


/* =========================================
   RENDER SELECTED DOCUMENTS
========================================= */

function renderSelectedAssignmentFiles() {
    const container = document.getElementById(
        "assignmentSelectedFiles"
    );

    if (!container) return;

    if (!selectedAssignmentFiles.length) {
        container.innerHTML = `
            <p class="assignment-no-files">
                No new documents selected.
            </p>
        `;
        return;
    }

    container.innerHTML = selectedAssignmentFiles.map((file, index) => `
        <div class="assignment-selected-file">

            <div>
                <strong>${assignmentEscape(file.name)}</strong>
                <span>${assignmentFileSize(file.size)}</span>
            </div>

            <button
                type="button"
                class="assignment-remove-file"
                data-file-index="${index}"
                aria-label="Remove ${assignmentEscape(file.name)}"
            >
                Remove
            </button>

        </div>
    `).join("");
}


/* =========================================
   RENDER ASSIGNMENT FORM
========================================= */

function renderAssignmentForm(item = null) {
    const isEditing = Boolean(item);

    const existingDocuments = isEditing
        ? assignmentDocuments.filter(
            doc => doc.assignment_id === item.id
        )
        : [];

    return `
        <section class="announcement-form-panel">

            <div class="announcement-panel-heading">
                <div>
                    <h2>
                        ${isEditing ? "Edit Assignment" : "Create Assignment"}
                    </h2>

                    <p>
                        Select a course and provide the assignment details.
                    </p>
                </div>
            </div>

            <form id="adminAssignmentForm">

                <div class="announcement-form-grid">

                    <div class="announcement-form-field">
                        <label for="assignmentCourse">
                            Course *
                        </label>

                        <select
                            id="assignmentCourse"
                            name="course_id"
                            required
                        >
                            ${renderAssignmentCourseOptions(
                                item?.course_id || ""
                            )}
                        </select>
                    </div>


                    <div class="announcement-form-field">
                        <label for="assignmentPublicationDate">
                            Publication Date *
                        </label>

                        <input
                            type="date"
                            id="assignmentPublicationDate"
                            name="publication_date"
                            value="${assignmentEscape(
                                item?.publication_date || ""
                            )}"
                            required
                        >
                    </div>


                    <div class="announcement-form-field">
                        <label for="assignmentSubmissionDate">
                            Submission Date *
                        </label>

                        <input
                            type="date"
                            id="assignmentSubmissionDate"
                            name="submission_date"
                            value="${assignmentEscape(
                                item?.submission_date || ""
                            )}"
                            required
                        >
                    </div>


                    <div class="announcement-form-field full-width">
                        <label for="assignmentText">
                            Assignment *
                        </label>

                        <textarea
                            id="assignmentText"
                            name="assignment_text"
                            rows="9"
                            placeholder="Enter the assignment questions and instructions here..."
                            required
                        >${assignmentEscape(
                            item?.assignment_text || ""
                        )}</textarea>

                        <small>
                            You can enter multiple questions and instructions.
                        </small>
                    </div>


                    <div class="announcement-form-field full-width">

                        <label for="assignmentDocuments">
                            Available Documents (Optional)
                        </label>

                        <input
                            type="file"
                            id="assignmentDocuments"
                            multiple
                            accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.jpg,.jpeg,.png"
                        >

                        <small>
                            Attach PDF, Word, PowerPoint, Excel, text or image files.
                        </small>

                        <div id="assignmentSelectedFiles">
                            <p class="assignment-no-files">
                                No new documents selected.
                            </p>
                        </div>

                    </div>

                </div>


                ${existingDocuments.length ? `
                    <div class="assignment-existing-documents">

                        <h3>Previously Attached Documents</h3>

                        ${existingDocuments.map(doc => `
                            <div class="assignment-existing-file">
                                <span>
                                    📎 ${assignmentEscape(doc.file_name)}
                                </span>

                                <button
                                    type="button"
                                    class="assignment-delete-document"
                                    data-document-id="${assignmentEscape(doc.id)}"
                                >
                                    Remove
                                </button>
                            </div>
                        `).join("")}

                    </div>
                ` : ""}


                <div class="announcement-form-actions">

                    <button
                        type="submit"
                        class="admin-primary-button"
                        id="saveAssignmentButton"
                    >
                        ${isEditing ? "Save Changes" : "Save Assignment"}
                    </button>

                    ${isEditing ? `
                        <button
                            type="button"
                            class="admin-secondary-button"
                            id="cancelAssignmentEdit"
                        >
                            Cancel Edit
                        </button>
                    ` : ""}

                </div>

            </form>

        </section>
    `;
}

/* =========================================
   PART 3: ASSIGNMENT LIST AND MANAGEMENT
========================================= */


/* =========================================
   RENDER ASSIGNMENT LIST
========================================= */

function renderAssignmentList() {
    return `
        <section class="announcement-list-panel">

            <div class="announcement-panel-heading">
                <div>
                    <h2>Manage Assignments</h2>
                    <p>View and manage all course assignments.</p>
                </div>
            </div>

            <div class="announcement-toolbar">

                <input
                    type="search"
                    id="assignmentSearch"
                    placeholder="Search assignments or courses..."
                >

                <select id="assignmentStatusFilter">
                    <option value="all">All Assignments</option>
                    <option value="published">Published</option>
                    <option value="draft">Drafts</option>
                </select>

            </div>

            <div id="assignmentRecordsList">
                ${renderAssignmentRecordCards(assignmentRecords)}
            </div>

        </section>
    `;
}


/* =========================================
   RENDER ASSIGNMENT RECORD CARDS
========================================= */

function renderAssignmentRecordCards(records) {
    if (!records.length) {
        return `
            <div class="announcement-empty-state">
                <h3>No Assignments Found</h3>
                <p>Created assignments will appear here.</p>
            </div>
        `;
    }

    return `
        <div class="announcement-record-list">

            ${records.map(item => {
                const course = item.courses || {};

                const documents = assignmentDocuments.filter(
                    doc => doc.assignment_id === item.id
                );

                const isPublished = item.status === "published";

                return `
                    <article
                        class="announcement-record-card assignment-record-card"
                    >

                        <div class="announcement-record-main">

                            <div class="announcement-record-badges">

                                <span class="announcement-category-badge category-academic">
                                    ${assignmentEscape(course.course_code || "Course")}
                                </span>

                                <span class="announcement-status-badge ${
                                    isPublished
                                        ? "status-published"
                                        : "status-draft"
                                }">
                                    ${assignmentStatusLabel(item.status)}
                                </span>

                            </div>

                            <h3>
                                ${assignmentEscape(
                                    course.course_title || "Unknown Course"
                                )}
                            </h3>

                            <p class="assignment-record-text">
                                ${assignmentEscape(item.assignment_text)}
                            </p>

                            <div class="assignment-record-dates">

                                <span>
                                    <strong>Published:</strong>
                                    ${assignmentDate(item.publication_date)}
                                </span>

                                <span>
                                    <strong>Deadline:</strong>
                                    ${assignmentDate(item.submission_date)}
                                </span>

                            </div>

                            <p class="assignment-document-count">
                                📎 ${documents.length}
                                ${documents.length === 1 ? "document" : "documents"}
                            </p>

                        </div>


                        <div class="announcement-record-actions">

                            <button
                                type="button"
                                class="announcement-action-button edit-announcement"
                                data-assignment-action="edit"
                                data-assignment-id="${assignmentEscape(item.id)}"
                            >
                                Edit
                            </button>

                            <button
                                type="button"
                                class="announcement-action-button"
                                data-assignment-action="toggle-status"
                                data-assignment-id="${assignmentEscape(item.id)}"
                            >
                                ${isPublished ? "Unpublish" : "Publish"}
                            </button>

                            <button
                                type="button"
                                class="announcement-action-button delete-announcement"
                                data-assignment-action="delete"
                                data-assignment-id="${assignmentEscape(item.id)}"
                            >
                                Delete
                            </button>

                        </div>

                    </article>
                `;
            }).join("")}

        </div>
    `;
}


/* =========================================
   FILTER ASSIGNMENTS
========================================= */

function filterAssignmentRecords() {
    const searchInput = document.getElementById(
        "assignmentSearch"
    );

    const statusFilter = document.getElementById(
        "assignmentStatusFilter"
    );

    const search = (searchInput?.value || "")
        .trim()
        .toLowerCase();

    const status = statusFilter?.value || "all";

    const filtered = assignmentRecords.filter(item => {
        const course = item.courses || {};

        const courseCode = (course.course_code || "").toLowerCase();

        const courseTitle = (course.course_title || "").toLowerCase();

        const assignmentText = (
            item.assignment_text || ""
        ).toLowerCase();

        const matchesSearch =
            courseCode.includes(search) ||
            courseTitle.includes(search) ||
            assignmentText.includes(search);

        const matchesStatus =
            status === "all" || item.status === status;

        return matchesSearch && matchesStatus;
    });

    const list = document.getElementById(
        "assignmentRecordsList"
    );

    if (list) {
        list.innerHTML = renderAssignmentRecordCards(filtered);
    }
}

/* =========================================
   PART 4: DATABASE OPERATIONS AND FUNCTIONALITY
========================================= */


/* =========================================
   UPLOAD ASSIGNMENT DOCUMENTS
========================================= */

async function uploadAssignmentDocuments(assignmentId) {
    const failedFiles = [];

    for (const file of selectedAssignmentFiles) {
        try {
            const safeName = file.name.replace(
                /[^\w.\-() ]/g,
                "_"
            );

            const filePath =
                assignmentId + "/" +
                Date.now() + "-" +
                safeName;

            const { error: uploadError } = await supabase
                .storage
                .from("assignment-documents")
                .upload(filePath, file, {
                    upsert: false,
                    contentType: file.type || "application/octet-stream"
                });

            if (uploadError) {
                throw uploadError;
            }

            const { data: userData } = await supabase.auth.getUser();

            const { error: recordError } = await supabase
                .from("assignment_documents")
                .insert({
                    assignment_id: assignmentId,
                    file_name: file.name,
                    file_path: filePath,
                    file_size: file.size,
                    file_type: file.type,
                    uploaded_by: userData.user.id
                });

            if (recordError) {
                await supabase.storage
                    .from("assignment-documents")
                    .remove([filePath]);

                throw recordError;
            }

        } catch (error) {
            console.error("Document upload failed:", error);
            failedFiles.push(file);
        }
    }

    selectedAssignmentFiles = failedFiles;

    return failedFiles;
}


/* =========================================
   SAVE OR UPDATE ASSIGNMENT
========================================= */

async function saveAssignment(event) {
    event.preventDefault();

    const form = event.currentTarget;

    const saveButton = document.getElementById(
        "saveAssignmentButton"
    );

    const courseId = form.course_id.value;
    const assignmentText = form.assignment_text.value.trim();
    const publicationDate = form.publication_date.value;
    const submissionDate = form.submission_date.value;

    if (!courseId || !assignmentText || !publicationDate || !submissionDate) {
        assignmentShowError("Please complete all required fields.");
        return;
    }

    if (submissionDate < publicationDate) {
        assignmentShowError(
            "The submission date cannot be earlier than the publication date."
        );
        return;
    }

    const selectedFiles = selectedAssignmentFiles;

    for (const file of selectedFiles) {
        if (file.size > 20 * 1024 * 1024) {
            assignmentShowError(
                "Each document must be 20 MB or smaller: " + file.name
            );
            return;
        }
    }

    const allowedExtensions = [
        "pdf", "doc", "docx", "ppt", "pptx",
        "xls", "xlsx", "txt", "jpg", "jpeg", "png"
    ];

    for (const file of selectedFiles) {
        const extension = file.name.split(".").pop().toLowerCase();

        if (!allowedExtensions.includes(extension)) {
            assignmentShowError(
                "This file type is not supported: " + file.name
            );
            return;
        }
    }

    if (saveButton) {
        saveButton.disabled = true;
        saveButton.textContent = "Saving...";
    }

    try {
        const { data: userData, error: userError } =
            await supabase.auth.getUser();

        if (userError || !userData.user) {
            throw new Error("Your session has expired. Please log in again.");
        }

        const assignmentData = {
            course_id: courseId,
            assignment_text: assignmentText,
            publication_date: publicationDate,
            submission_date: submissionDate,
            updated_at: new Date().toISOString()
        };

        let assignmentId = editingAssignmentId;

        if (editingAssignmentId) {
            const { error } = await supabase
                .from("assignments")
                .update(assignmentData)
                .eq("id", editingAssignmentId);

            if (error) throw error;

        } else {
            const { data, error } = await supabase
                .from("assignments")
                .insert({
                    ...assignmentData,
                    status: "draft",
                    created_by: userData.user.id
                })
                .select("id")
                .single();

            if (error) throw error;

            assignmentId = data.id;
        }

        const failedFiles = await uploadAssignmentDocuments(
            assignmentId
        );

        const wasEditing = Boolean(editingAssignmentId);

editingAssignmentId = null;

await refreshAssignmentManager();

if (failedFiles.length) {
            alert(
                "The assignment was saved, but " +
                failedFiles.length +
                " document(s) could not be uploaded. " +
                "You can try attaching them again."
            );
        } else {
            alert(
                wasEditing
    ? "Assignment updated successfully."
    : "Assignment saved successfully."
            );
        }

    } catch (error) {
        console.error("Assignment save error:", error);
        assignmentShowError(error.message);

        if (saveButton) {
            saveButton.disabled = false;
            saveButton.textContent = "Save Assignment";
        }
    }
}


/* =========================================
   REMOVE AN ATTACHED DOCUMENT
========================================= */

async function deleteAssignmentDocument(documentId) {
    const document = assignmentDocuments.find(
        item => item.id === documentId
    );

    if (!document) return;

    if (!confirm("Remove this attached document?")) {
        return;
    }

    try {
        const { error: storageError } = await supabase
            .storage
            .from("assignment-documents")
            .remove([document.file_path]);

        if (storageError) throw storageError;

        const { error: recordError } = await supabase
            .from("assignment_documents")
            .delete()
            .eq("id", documentId);

        if (recordError) throw recordError;

        await refreshAssignmentManager();

        alert("Document removed successfully.");

    } catch (error) {
        console.error("Document deletion error:", error);
        assignmentShowError(error.message);
    }
}


/* =========================================
   DELETE ASSIGNMENT
========================================= */

async function deleteAssignment(assignmentId) {
    if (!confirm(
        "Are you sure you want to delete this assignment? " +
        "Its attached documents will also be deleted."
    )) {
        return;
    }

    try {
        const documents = assignmentDocuments.filter(
            item => item.assignment_id === assignmentId
        );

        if (documents.length) {
            const filePaths = documents.map(
                item => item.file_path
            );

            const { error: storageError } = await supabase
                .storage
                .from("assignment-documents")
                .remove(filePaths);

            if (storageError) throw storageError;
        }

        const { error } = await supabase
            .from("assignments")
            .delete()
            .eq("id", assignmentId);

        if (error) throw error;

        await refreshAssignmentManager();

        alert("Assignment deleted successfully.");

    } catch (error) {
        console.error("Assignment deletion error:", error);
        assignmentShowError(error.message);
    }
}


/* =========================================
   PUBLISH / UNPUBLISH ASSIGNMENT
========================================= */

async function toggleAssignmentStatus(assignmentId) {
    const item = assignmentRecords.find(
        record => record.id === assignmentId
    );

    if (!item) return;

    const newStatus = item.status === "published"
        ? "draft"
        : "published";

    const message = newStatus === "published"
        ? "Publish this assignment?"
        : "Unpublish this assignment?";

    if (!confirm(message)) return;

    try {
        const { error } = await supabase
            .from("assignments")
            .update({
                status: newStatus,
                updated_at: new Date().toISOString()
            })
            .eq("id", assignmentId);

        if (error) throw error;

        await refreshAssignmentManager();

    } catch (error) {
        console.error("Assignment status error:", error);
        assignmentShowError(error.message);
    }
}


/* =========================================
   EDIT ASSIGNMENT
========================================= */

function editAssignment(assignmentId) {
    const item = assignmentRecords.find(
        record => record.id === assignmentId
    );

    if (!item) return;

    editingAssignmentId = assignmentId;
    selectedAssignmentFiles = [];

    refreshAssignmentManager().then(() => {
        document.getElementById(
            "adminAssignmentForm"
        )?.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    });
}


/* =========================================
   ATTACH FORM EVENTS
========================================= */

function attachAssignmentFormEvents() {
    const form = document.getElementById(
        "adminAssignmentForm"
    );

    if (form) {
        form.addEventListener("submit", saveAssignment);
    }

    const fileInput = document.getElementById(
        "assignmentDocuments"
    );

    if (fileInput) {
        fileInput.addEventListener("change", event => {
            selectedAssignmentFiles = [
                ...selectedAssignmentFiles,
                ...Array.from(event.target.files || [])
            ];

            event.target.value = "";

            renderSelectedAssignmentFiles();
        });
    }

    const cancelButton = document.getElementById(
        "cancelAssignmentEdit"
    );

    if (cancelButton) {
        cancelButton.addEventListener("click", () => {
            editingAssignmentId = null;
            selectedAssignmentFiles = [];

            refreshAssignmentManager();
        });
    }

    const selectedFilesContainer = document.getElementById(
        "assignmentSelectedFiles"
    );

    if (selectedFilesContainer) {
        selectedFilesContainer.addEventListener("click", event => {
            const button = event.target.closest(
                "[data-file-index]"
            );

            if (!button) return;

            const index = Number(button.dataset.fileIndex);

            selectedAssignmentFiles.splice(index, 1);

            renderSelectedAssignmentFiles();
        });
    }

    const formContainer = document.getElementById(
        "adminAssignmentForm"
    );

    const parent = formContainer?.parentElement;

    if (parent) {
        parent.addEventListener("click", event => {
            const button = event.target.closest(
                "[data-document-id]"
            );

            if (!button) return;

            deleteAssignmentDocument(
                button.dataset.documentId
            );
        });
    }
}


/* =========================================
   ATTACH FILTER EVENTS
========================================= */

function attachAssignmentFilterEvents() {
    const search = document.getElementById(
        "assignmentSearch"
    );

    const status = document.getElementById(
        "assignmentStatusFilter"
    );

    if (search) {
        search.addEventListener(
            "input",
            filterAssignmentRecords
        );
    }

    if (status) {
        status.addEventListener(
            "change",
            filterAssignmentRecords
        );
    }
}


/* =========================================
   ATTACH MANAGEMENT ACTION EVENTS
========================================= */

let assignmentActionListenerContainer = null;

function attachAssignmentActionEvents() {
    if (
        !assignmentsContainer ||
        assignmentActionListenerContainer === assignmentsContainer
    ) {
        return;
    }

    assignmentActionListenerContainer = assignmentsContainer;

    assignmentsContainer.addEventListener("click", event => {
        const button = event.target.closest(
            "[data-assignment-action]"
        );

        if (!button) return;

        const action = button.dataset.assignmentAction;
        const id = button.dataset.assignmentId;

        if (!id) return;

        if (action === "edit") {
            editAssignment(id);
        }

        if (action === "delete") {
            deleteAssignment(id);
        }

        if (action === "toggle-status") {
            toggleAssignmentStatus(id);
        }
    });
}


/* =========================================
   REFRESH ASSIGNMENT MANAGER
========================================= */

async function refreshAssignmentManager() {
    await Promise.all([
        fetchAssignmentCourses(),
        fetchAssignments(),
        fetchAssignmentDocuments()
    ]);

    assignmentsContainer.innerHTML = `

        <div class="admin-announcements-page">

            <div class="announcement-page-header">
                <div>
                    <h1>Assignments</h1>
                    <p>
                        Create and manage course assignments for students.
                    </p>
                </div>
            </div>

            ${renderAssignmentStats()}

            ${renderAssignmentForm(
                editingAssignmentId
                    ? assignmentRecords.find(
                        item => item.id === editingAssignmentId
                    )
                    : null
            )}

            ${renderAssignmentList()}

        </div>
    `;

    attachAssignmentFormEvents();
    attachAssignmentFilterEvents();
    attachAssignmentActionEvents();
}


/* =========================================
   LOAD ADMIN ASSIGNMENTS
========================================= */

export async function loadAdminAssignments(container) {
    assignmentsContainer = container;

    selectedAssignmentFiles = [];
    editingAssignmentId = null;

    assignmentsContainer.innerHTML = `
        <div class="announcement-loading">
            Loading assignments...
        </div>
    `;

    try {
        await refreshAssignmentManager();

    } catch (error) {
        console.error("Assignment loading error:", error);

        assignmentsContainer.innerHTML = `
            <div class="announcement-empty-state">
                <h3>Unable to Load Assignments</h3>

                <p>
                    ${assignmentEscape(error.message)}
                </p>

                <button
                    type="button"
                    class="admin-primary-button"
                    id="retryAssignmentLoading"
                >
                    Try Again
                </button>
            </div>
        `;

        document.getElementById(
            "retryAssignmentLoading"
        )?.addEventListener("click", () => {
            loadAdminAssignments(container);
        });
    }
}
