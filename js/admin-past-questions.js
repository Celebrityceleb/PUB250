
import { supabase } from "./config.js";

/* =========================================
   ADMIN PAST QUESTIONS
========================================= */

let pastQuestions = [];
let availableCourses = [];
let availableSessions = [];
let availableSemesters = [];

let selectedQuestionId = null;
let selectedFiles = [];

/* =========================================
   LOAD REQUIRED ACADEMIC DATA
========================================= */

async function loadAcademicData() {

    const [
        coursesResult,
        sessionsResult,
        semestersResult
    ] = await Promise.all([

        supabase
    .from("courses")
    .select(`
        id,
        course_code,
        course_title,
        academic_level_id,
        academic_levels (
            level_number
        )
    `)
    .eq("is_active", true)
    .order("course_code"),

        supabase
            .from("academic_sessions")
            .select("id, session_name")
            .order("session_name", { ascending: false }),

        supabase
            .from("academic_semesters")
            .select("id, semester_name")
            .order("semester_number")

    ]);

    if (coursesResult.error) {
        throw coursesResult.error;
    }

    if (sessionsResult.error) {
        throw sessionsResult.error;
    }

    if (semestersResult.error) {
        throw semestersResult.error;
    }

    availableCourses = coursesResult.data || [];
    availableSessions = sessionsResult.data || [];
    availableSemesters = semestersResult.data || [];

}

/* =========================================
   LOAD PAST QUESTION RECORDS
========================================= */

async function fetchPastQuestions() {

    const { data, error } = await supabase
        .from("past_questions")
        .select(`
            *,
            courses (
    course_code,
    course_title,
    academic_level_id,
    academic_levels (
        level_number
    )
),
            academic_sessions (
                session_name
            ),
            academic_semesters (
                semester_name
            ),
            past_question_images (
                id,
                storage_path,
                file_name,
                file_size,
                page_number
            )
        `)
        .order("created_at", { ascending: false });

    if (error) {
        throw error;
    }

    pastQuestions = data || [];

    return pastQuestions;

}

/* =========================================
   ADMIN DASHBOARD INTERFACE
========================================= */

export async function loadAdminPastQuestions(container) {

    container.innerHTML = `
        <div class="pq-admin-wrapper">

            <div class="pq-admin-heading">
                <div>
                    <span class="admin-section-eyebrow">
                        ACADEMIC MANAGEMENT
                    </span>
                    <h2>Past Questions Manager</h2>
                    <p>
                        Upload, organize and manage examination papers
                        for all four academic levels.
                    </p>
                </div>

                <button class="pq-primary-button" id="pqAddNew">
                    + Add Past Question
                </button>
            </div>

            <div class="pq-admin-stats">

                <div class="pq-admin-stat">
                    <span>Total Records</span>
                    <strong id="pqTotalRecords">0</strong>
                </div>

                <div class="pq-admin-stat">
                    <span>Published</span>
                    <strong id="pqPublishedRecords">0</strong>
                </div>

                <div class="pq-admin-stat">
                    <span>Drafts</span>
                    <strong id="pqDraftRecords">0</strong>
                </div>

                <div class="pq-admin-stat">
                    <span>Image Albums</span>
                    <strong id="pqAlbumRecords">0</strong>
                </div>

            </div>

            <div class="pq-admin-toolbar">

                <input
                    type="search"
                    id="pqSearch"
                    placeholder="Search course code or examination..."
                >

                <select id="pqLevelFilter">
                    <option value="">All Levels</option>
                    <option value="100">100 Level</option>
                    <option value="200">200 Level</option>
                    <option value="300">300 Level</option>
                    <option value="400">400 Level</option>
                </select>

                <select id="pqStatusFilter">
                    <option value="">All Statuses</option>
                    <option value="published">Published</option>
                    <option value="draft">Draft</option>
                </select>

                <select id="pqTypeFilter">
                    <option value="">All Formats</option>
                    <option value="pdf">PDF</option>
                    <option value="image_album">Image Album</option>
                </select>

            </div>

            <div class="pq-admin-records" id="pqRecordsContainer">

                <div class="pq-loading">
                    Loading examination records...
                </div>

            </div>

            <div id="pqModalContainer"></div>

        </div>
    `;

    try {

        await loadAcademicData();
        await fetchPastQuestions();

        updatePastQuestionStats();
        renderPastQuestionRecords();
        attachPastQuestionAdminEvents();

    } catch (error) {

        console.error("Past Questions loading error:", error);

        document.getElementById("pqRecordsContainer").innerHTML = `
            <div class="pq-empty-state">
                <h3>Unable to load past questions</h3>
                <p>${escapePQHTML(error.message)}</p>
                <button class="pq-primary-button" id="pqRetry">
                    Try Again
                </button>
            </div>
        `;

        document.getElementById("pqRetry")
            ?.addEventListener("click", () => {
                loadAdminPastQuestions(container);
            });

    }

}

/* =========================================
   ADMIN STATISTICS
========================================= */

function updatePastQuestionStats() {

    document.getElementById("pqTotalRecords").textContent =
        pastQuestions.length;

    document.getElementById("pqPublishedRecords").textContent =
        pastQuestions.filter(
            item => item.publication_status === "published"
        ).length;

    document.getElementById("pqDraftRecords").textContent =
        pastQuestions.filter(
            item => item.publication_status === "draft"
        ).length;

    document.getElementById("pqAlbumRecords").textContent =
        pastQuestions.filter(
            item => item.file_type === "image_album"
        ).length;

}

/* =========================================
   SAFE HTML TEXT
========================================= */

function escapePQHTML(value) {

    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[character]);

}

/* =========================================
   RENDER EXAMINATION RECORDS
========================================= */

function renderPastQuestionRecords() {

    const container = document.getElementById("pqRecordsContainer");

    if (!container) return;

    const search = document.getElementById("pqSearch").value
        .trim()
        .toLowerCase();

    const level = document.getElementById("pqLevelFilter").value;
    const status = document.getElementById("pqStatusFilter").value;
    const format = document.getElementById("pqTypeFilter").value;

    const filtered = pastQuestions.filter(item => {

        const course = item.courses || {};
        const levelNumber = String(
            course.academic_levels?.level_number || ""
        );

        const searchableText = [
            item.title,
            item.exam_type,
            course.course_code,
            course.course_title,
            item.academic_sessions?.session_name,
            item.academic_semesters?.semester_name
        ].join(" ").toLowerCase();

        return (
            searchableText.includes(search) &&
            (!level || levelNumber === level) &&
            (!status || item.publication_status === status) &&
            (!format || item.file_type === format)
        );

    });

    if (!filtered.length) {

        container.innerHTML = `
            <div class="pq-empty-state">
                <div class="pq-empty-icon">▤</div>
                <h3>No examination records found</h3>
                <p>
                    Try changing your filters or add a new
                    past question record.
                </p>
            </div>
        `;

        return;
    }

    container.innerHTML = filtered.map(item => {

        const course = item.courses || {};

        const levelNumber =
            course.academic_levels?.level_number || "—";

        const isAlbum = item.file_type === "image_album";

        const pageCount = item.past_question_images?.length || 0;

        const formatLabel = isAlbum
            ? `Image Album · ${pageCount} pages`
            : "PDF Document";

        const statusLabel = item.publication_status === "published"
            ? "Published"
            : "Draft";

        return `
            <article class="pq-record-card">

                <div class="pq-record-icon">
                    ${isAlbum ? "▧" : "▤"}
                </div>

                <div class="pq-record-details">

                    <div class="pq-record-title-row">
                        <h3>${escapePQHTML(item.title)}</h3>

                        <span class="pq-status-label ${
                            item.publication_status === "published"
                                ? "published"
                                : "draft"
                        }">
                            ${statusLabel}
                        </span>
                    </div>

                    <p class="pq-record-course">
                        ${escapePQHTML(course.course_code || "Unknown Course")}
                        ·
                        ${escapePQHTML(course.course_title || "")}
                    </p>

                    <div class="pq-record-meta">
                        <span>${levelNumber} Level</span>
                        <span>${escapePQHTML(item.academic_sessions?.session_name || "—")}</span>
                        <span>${escapePQHTML(item.academic_semesters?.semester_name || "—")}</span>
                        <span>${escapePQHTML(item.exam_type)}</span>
                    </div>

                    <div class="pq-record-format">
                        ${formatLabel}
                    </div>

                </div>

                <div class="pq-record-actions">

                    <button
                        class="pq-edit-button"
                        data-pq-edit="${item.id}"
                    >
                        Edit
                    </button>

                    <button
                        class="pq-delete-button"
                        data-pq-delete="${item.id}"
                    >
                        Delete
                    </button>

                </div>

            </article>
        `;

    }).join("");

}

/* =========================================
   ADMIN EVENT LISTENERS
========================================= */

function attachPastQuestionAdminEvents() {

    document.getElementById("pqAddNew")
        ?.addEventListener("click", () => {
            openPastQuestionForm();
        });

    [
        "pqSearch",
        "pqLevelFilter",
        "pqStatusFilter",
        "pqTypeFilter"
    ].forEach(id => {

        document.getElementById(id)
            ?.addEventListener("input", renderPastQuestionRecords);

        document.getElementById(id)
            ?.addEventListener("change", renderPastQuestionRecords);

    });

    document.getElementById("pqRecordsContainer")
        ?.addEventListener("click", event => {

            const editButton = event.target.closest("[data-pq-edit]");
            const deleteButton = event.target.closest("[data-pq-delete]");

            if (editButton) {

                const id = editButton.dataset.pqEdit;

                openPastQuestionForm(id);

            }

            if (deleteButton) {

                const id = deleteButton.dataset.pqDelete;

                deletePastQuestion(id);

            }

        });

}

/* =========================================
   PAST QUESTION FORM
========================================= */

function openPastQuestionForm(id = null) {

    selectedQuestionId = id;

    const existing = id
        ? pastQuestions.find(item => item.id === id)
        : null;

    const modal = document.getElementById("pqModalContainer");

    if (!modal) return;

    const courseOptions = availableCourses.map(course => {

        const level = course.academic_levels?.level_number || "Unknown";

        return `
            <option value="${course.id}"
                ${existing?.course_id === course.id ? "selected" : ""}>
                ${escapePQHTML(course.course_code)}
                - ${escapePQHTML(course.course_title)}
                (Level ID: ${level})
            </option>
        `;

    }).join("");

    const sessionOptions = availableSessions.map(session => `
        <option value="${session.id}"
            ${String(existing?.academic_session_id) === String(session.id) ? "selected" : ""}>
            ${escapePQHTML(session.session_name)}
        </option>
    `).join("");

    const semesterOptions = availableSemesters.map(semester => `
        <option value="${semester.id}"
            ${String(existing?.semester_id) === String(semester.id) ? "selected" : ""}>
            ${escapePQHTML(semester.semester_name)}
        </option>
    `).join("");

    const currentImages = existing?.past_question_images || [];

    modal.innerHTML = `
        <div class="pq-modal-overlay" id="pqModalOverlay">

            <div class="pq-modal">

                <div class="pq-modal-heading">
                    <div>
                        <span class="admin-section-eyebrow">
                            EXAMINATION LIBRARY
                        </span>
                        <h2>${existing ? "Edit Past Question" : "Add Past Question"}</h2>
                    </div>

                    <button type="button" id="pqCloseModal">✕</button>
                </div>

                <form id="pqRecordForm">

                    <label>Examination Title</label>
                    <input
                        type="text"
                        id="pqTitle"
                        required
                        maxlength="180"
                        value="${escapePQHTML(existing?.title || "")}"
                        placeholder="e.g. 2024/2025 First Semester Examination"
                    >

                    <label>Course</label>
                    <select id="pqCourse" required>
                        <option value="">Select Course</option>
                        ${courseOptions}
                    </select>

                    <label>Academic Session</label>
                    <select id="pqSession" required>
                        <option value="">Select Academic Session</option>
                        ${sessionOptions}
                    </select>

                    <label>Semester</label>
                    <select id="pqSemester" required>
                        <option value="">Select Semester</option>
                        ${semesterOptions}
                    </select>

                    <label>Examination Type</label>
                    <input
                        type="text"
                        id="pqExamType"
                        required
                        maxlength="80"
                        value="${escapePQHTML(existing?.exam_type || "")}"
                        placeholder="e.g. Examination, Test, Mock"
                    >

                    <label>File Format</label>
                    <select id="pqFileType" required
                        ${existing ? "disabled" : ""}>
                        <option value="pdf"
                            ${existing?.file_type === "pdf" ? "selected" : ""}>
                            PDF Document
                        </option>
                        <option value="image_album"
                            ${existing?.file_type === "image_album" ? "selected" : ""}>
                            Image Album
                        </option>
                    </select>

                    <div id="pqPdfUploadArea"
                        style="display:${!existing || existing.file_type === "pdf" ? "block" : "none"}">

                        <label>PDF File ${existing ? "(Optional: select replacement)" : ""}</label>

                        <input
                            type="file"
                            id="pqPdfFile"
                            accept="application/pdf,.pdf"
                            ${existing ? "" : "required"}
                        >

                        ${existing?.file_type === "pdf" ? `
                            <small>Current file: ${escapePQHTML(existing.pdf_file_name)}</small>
                        ` : ""}
                    </div>

                    <div id="pqImageUploadArea"
                        style="display:${existing?.file_type === "image_album" ? "block" : "none"}">

                        <label>
                            Image Pages
                            ${existing ? "(Optional: select a complete replacement album)" : ""}
                        </label>

                        <input
                            type="file"
                            id="pqImageFiles"
                            accept="image/jpeg,image/png,image/webp"
                            multiple
                            ${existing ? "" : "required"}
                        >

                        <small>
                            Select all pages together. Their selection order
                            will determine their page numbers.
                        </small>

                        ${existing?.file_type === "image_album" ? `
                            <p>Current album: ${currentImages.length} pages</p>
                        ` : ""}
                    </div>

                    <label>Publication Status</label>
                    <select id="pqPublicationStatus" required>
                        <option value="draft"
                            ${existing?.publication_status === "draft" ? "selected" : ""}>
                            Save as Draft
                        </option>
                        <option value="published"
                            ${existing?.publication_status === "published" ? "selected" : ""}>
                            Publish for Students
                        </option>
                    </select>

                    <div class="pq-form-actions">

                        <button type="button" class="pq-cancel-button"
                            id="pqCancelForm">
                            Cancel
                        </button>

                        <button type="submit" class="pq-primary-button"
                            id="pqSaveRecord">
                            ${existing ? "Save Changes" : "Save Past Question"}
                        </button>

                    </div>

                    <p id="pqFormMessage" class="pq-form-message"></p>

                </form>

            </div>

        </div>
    `;

    const closeModal = () => {
        modal.innerHTML = "";
        selectedQuestionId = null;
    };

    document.getElementById("pqCloseModal")
        .addEventListener("click", closeModal);

    document.getElementById("pqCancelForm")
        .addEventListener("click", closeModal);

    document.getElementById("pqModalOverlay")
        .addEventListener("click", event => {
            if (event.target.id === "pqModalOverlay") {
                closeModal();
            }
        });

    document.getElementById("pqFileType")
        .addEventListener("change", event => {

            const isPDF = event.target.value === "pdf";

            document.getElementById("pqPdfUploadArea").style.display =
                isPDF ? "block" : "none";

            document.getElementById("pqImageUploadArea").style.display =
                isPDF ? "none" : "block";

            document.getElementById("pqPdfFile").required =
                isPDF && !existing;

            document.getElementById("pqImageFiles").required =
                !isPDF && !existing;

        });

    document.getElementById("pqRecordForm")
        .addEventListener("submit", savePastQuestion);

}

/* =========================================
   STORAGE UPLOAD
========================================= */

async function uploadPastQuestionFile(file, path) {

    const { error } = await supabase.storage
        .from("past-questions")
        .upload(path, file, {
            cacheControl: "3600",
            upsert: false
        });

    if (error) throw error;

    return path;

}

/* =========================================
   SAVE OR UPDATE RECORD
========================================= */

async function savePastQuestion(event) {

    event.preventDefault();

    const button = document.getElementById("pqSaveRecord");
    const message = document.getElementById("pqFormMessage");

    const existing = selectedQuestionId
        ? pastQuestions.find(item => item.id === selectedQuestionId)
        : null;

    const fileType = existing
        ? existing.file_type
        : document.getElementById("pqFileType").value;

    const pdfFile = document.getElementById("pqPdfFile").files[0];

    const imageFiles = Array.from(
        document.getElementById("pqImageFiles").files
    );

    const title = document.getElementById("pqTitle").value.trim();
    const examType = document.getElementById("pqExamType").value.trim();

    const oldImages = existing?.past_question_images || [];

    const desiredStatus =
        document.getElementById("pqPublicationStatus").value;

    if (!title || !examType) {
        message.textContent = "Complete all required fields.";
        return;
    }

    if (fileType === "pdf" && !existing && !pdfFile) {
        message.textContent = "Select a PDF file.";
        return;
    }

    if (fileType === "image_album" && !existing && !imageFiles.length) {
        message.textContent = "Select at least one image page.";
        return;
    }

    if (
        fileType === "image_album" &&
        !imageFiles.length &&
        !oldImages.length
    ) {
        message.textContent = "An image album must contain at least one page.";
        return;
    }

    if (
        fileType === "pdf" &&
        pdfFile &&
        pdfFile.type !== "application/pdf"
    ) {
        message.textContent = "Only PDF files are allowed.";
        return;
    }

    if (pdfFile && pdfFile.size > 20 * 1024 * 1024) {
        message.textContent = "PDF exceeds the 20 MB limit.";
        return;
    }

    if (imageFiles.length > 100) {
        message.textContent = "An album cannot exceed 100 pages.";
        return;
    }

    for (const file of imageFiles) {

        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
            message.textContent = "Use JPG, PNG or WebP images only.";
            return;
        }

        if (file.size > 20 * 1024 * 1024) {
            message.textContent = `${file.name} exceeds the 20 MB limit.`;
            return;
        }

    }

    button.disabled = true;
    button.textContent = "Saving...";
    message.textContent = "Processing examination files...";

    const recordId = existing?.id || crypto.randomUUID();

    const uploadedPaths = [];

    let newRecordCreated = false;
    let oldImagesDeleted = false;

    const baseRecord = {

        course_id: document.getElementById("pqCourse").value,

        academic_session_id: Number(
            document.getElementById("pqSession").value
        ),

        semester_id: Number(
            document.getElementById("pqSemester").value
        ),

        title,
        exam_type: examType,
        file_type: fileType,
        updated_at: new Date().toISOString()

    };

    try {

        /* =================================
           PDF PROCESSING
        ================================= */

        if (fileType === "pdf") {

            let pdfDetails = {};

            if (pdfFile) {

                message.textContent = "Uploading PDF...";

                const safeName = pdfFile.name.replace(
                    /[^a-zA-Z0-9._-]/g,
                    "_"
                );

                const path =
                    `${recordId}/${Date.now()}-${safeName}`;

                await uploadPastQuestionFile(pdfFile, path);

                uploadedPaths.push(path);

                pdfDetails = {
                    pdf_storage_path: path,
                    pdf_file_name: pdfFile.name,
                    pdf_file_size: pdfFile.size
                };

            }

            const record = {
                ...baseRecord,
                ...pdfDetails,
                publication_status: desiredStatus
            };

            if (existing) {

                const { error } = await supabase
                    .from("past_questions")
                    .update(record)
                    .eq("id", recordId);

                if (error) throw error;

            } else {

                const { error } = await supabase
                    .from("past_questions")
                    .insert({
                        ...record,
                        id: recordId,
                        created_by: (await supabase.auth.getUser()).data.user?.id
                    });

                if (error) throw error;

                newRecordCreated = true;

            }

            if (pdfFile && existing?.pdf_storage_path) {

                await supabase.storage
                    .from("past-questions")
                    .remove([existing.pdf_storage_path]);

            }

        }

        /* =================================
           IMAGE ALBUM PROCESSING
        ================================= */

        if (fileType === "image_album") {

            if (!existing) {

                const { error } = await supabase
                    .from("past_questions")
                    .insert({
                        ...baseRecord,
                        id: recordId,
                        publication_status: "draft",
                        created_by: (await supabase.auth.getUser()).data.user?.id
                    });

                if (error) throw error;

                newRecordCreated = true;

            }

            if (imageFiles.length) {

                message.textContent = "Uploading image pages...";

                const newImageRows = [];

                for (let index = 0; index < imageFiles.length; index++) {

                    const file = imageFiles[index];

                    const safeName = file.name.replace(
                        /[^a-zA-Z0-9._-]/g,
                        "_"
                    );

                    const path =
                        `${recordId}/${Date.now()}-${index + 1}-${safeName}`;

                    await uploadPastQuestionFile(file, path);

                    uploadedPaths.push(path);

                    newImageRows.push({

                        past_question_id: recordId,
                        storage_path: path,
                        file_name: file.name,
                        file_size: file.size,
                        page_number: index + 1

                    });

                }

                if (oldImages.length) {

                    const { error } = await supabase
                        .from("past_question_images")
                        .delete()
                        .eq("past_question_id", recordId);

                    if (error) throw error;

                    oldImagesDeleted = true;

                }

                const { error } = await supabase
                    .from("past_question_images")
                    .insert(newImageRows);

                if (error) throw error;

                if (oldImages.length) {

                    await supabase.storage
                        .from("past-questions")
                        .remove(
                            oldImages.map(image => image.storage_path)
                        );

                }

            }

            const { error } = await supabase
                .from("past_questions")
                .update({
                    ...baseRecord,
                    publication_status: desiredStatus
                })
                .eq("id", recordId);

            if (error) throw error;

        }

        message.textContent = "Refreshing examination records...";

        await fetchPastQuestions();

        updatePastQuestionStats();
        renderPastQuestionRecords();

        document.getElementById("pqModalContainer").innerHTML = "";

        selectedQuestionId = null;

        alert(
            existing
                ? "Past question updated successfully."
                : "Past question saved successfully."
        );

    } catch (error) {

        console.error("Past Question save error:", error);

        /* Restore old image records if replacement failed. */

        if (oldImagesDeleted && oldImages.length) {

            const restoredImages = oldImages.map(image => ({

                id: image.id,
                past_question_id: recordId,
                storage_path: image.storage_path,
                file_name: image.file_name,
                file_size: image.file_size,
                page_number: image.page_number

            }));

            await supabase
                .from("past_question_images")
                .insert(restoredImages);

        }

        /* Remove newly uploaded files. */

        if (uploadedPaths.length) {

            await supabase.storage
                .from("past-questions")
                .remove(uploadedPaths);

        }

        /* Remove a newly created incomplete record. */

        if (newRecordCreated) {

            await supabase
                .from("past_questions")
                .delete()
                .eq("id", recordId);

        }

        message.textContent =
            error.message || "Unable to save examination record.";

        button.disabled = false;

        button.textContent = existing
            ? "Save Changes"
            : "Save Past Question";

    }

}

/* =========================================
   DELETE EXAMINATION RECORD
========================================= */

async function deletePastQuestion(id) {

    const record = pastQuestions.find(item => item.id === id);

    if (!record) return;

    const confirmed = confirm(
        `Delete "${record.title}"?\n\nThis will permanently delete its examination files and image pages.`
    );

    if (!confirmed) return;

    try {

        const paths = [];

        if (record.pdf_storage_path) {
            paths.push(record.pdf_storage_path);
        }

        (record.past_question_images || []).forEach(image => {
            paths.push(image.storage_path);
        });

        if (paths.length) {

            const { error: storageError } = await supabase.storage
                .from("past-questions")
                .remove(paths);

            if (storageError) throw storageError;

        }

        const { error } = await supabase
            .from("past_questions")
            .delete()
            .eq("id", id);

        if (error) throw error;

        await fetchPastQuestions();

        updatePastQuestionStats();
        renderPastQuestionRecords();

        alert("Past question deleted successfully.");

    } catch (error) {

        console.error("Past Question delete error:", error);

        alert("Deletion failed: " + error.message);

    }

}
