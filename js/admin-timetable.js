
import { supabase } from "./config.js";

/* =========================================
   PUB250 ADMIN TIMETABLE
========================================= */

let timetableContainer = null;
let activeTimetableTab = "lectures";
let timetableCourses = [];
let lectureRecords = [];
let examRecords = [];
let editingLectureId = null;

function timetableEscape(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
}

function timetableDate(date) {
    if (!date) return "—";

    return new Date(date + "T00:00:00").toLocaleDateString(
        "en-GB",
        {
            day: "numeric",
            month: "short",
            year: "numeric"
        }
    );
}

function timetableTime(time) {
    if (!time) return "—";

    const [hours, minutes] = time.split(":");

    return new Date(2000, 0, 1, hours, minutes)
        .toLocaleTimeString("en-GB", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true
        });
}

function timetableMessage(message, type = "success") {
    const element = document.getElementById("timetableMessage");

    if (!element) return;

    element.textContent = message;
    element.className = `timetable-message ${type}`;
    element.hidden = false;
}

function timetableLoading(message = "Loading timetable...") {
    timetableContainer.innerHTML = `
        <div class="timetable-loading">
            ${timetableEscape(message)}
        </div>
    `;
}

/* =========================================
   MAIN ADMIN TIMETABLE PAGE
========================================= */

export async function loadAdminTimetable(container) {

    timetableContainer = container;

    timetableLoading();

    try {

        const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("role, approval_status")
            .eq("id", (await supabase.auth.getUser()).data.user?.id)
            .single();

        if (profileError) throw profileError;

        if (
            profile?.role !== "super_admin" ||
            profile?.approval_status !== "approved"
        ) {
            throw new Error("You are not authorised to manage timetables.");
        }

        await loadTimetableCourses();

        await loadTimetableRecords();

        renderAdminTimetable();

    } catch (error) {

        console.error("Admin timetable error:", error);

        timetableContainer.innerHTML = `
            <div class="timetable-empty">
                <h3>Unable to Load Timetable</h3>
                <p>${timetableEscape(error.message)}</p>
            </div>
        `;
    }
}

/* =========================================
   LOAD COURSES AND TIMETABLE RECORDS
========================================= */

async function loadTimetableCourses() {

    const { data, error } = await supabase
        .from("courses")
        .select("id, course_code, course_title")
        .eq("is_active", true)
        .order("course_code");

    if (error) throw error;

    timetableCourses = data || [];
}

async function loadTimetableRecords() {

    const { data: lectures, error: lectureError } = await supabase
        .from("lecture_timetable")
        .select(`
            *,
            courses (
                course_code,
                course_title
            )
        `)
        .order("lecture_date", { ascending: false });

    if (lectureError) throw lectureError;

    lectureRecords = lectures || [];

    const { data: exams, error: examError } = await supabase
        .from("exam_timetables")
        .select("*")
        .order("created_at", { ascending: false });

    if (examError) throw examError;

    examRecords = exams || [];
}

/* =========================================
   ADMIN TIMETABLE INTERFACE
========================================= */

function renderAdminTimetable() {

    timetableContainer.innerHTML = `
        <div class="admin-timetable-page">

            <div class="admin-timetable-heading">
                <div>
                    <span class="admin-section-eyebrow">
                        ACADEMIC MANAGEMENT
                    </span>

                    <h2>Timetable Management</h2>

                    <p>
                        Manage lecture schedules and examination timetables.
                    </p>
                </div>
            </div>

            <div id="timetableMessage"
                class="timetable-message"
                hidden>
            </div>

            <div class="timetable-tabs">

                <button
                    type="button"
                    class="${activeTimetableTab === "lectures" ? "active" : ""}"
                    data-timetable-tab="lectures">
                    Lecture Timetable
                </button>

                <button
                    type="button"
                    class="${activeTimetableTab === "exams" ? "active" : ""}"
                    data-timetable-tab="exams">
                    Examination Timetable
                </button>

            </div>

            <div id="timetableTabContent"></div>

        </div>
    `;

    document.querySelectorAll("[data-timetable-tab]")
        .forEach(button => {

            button.addEventListener("click", () => {

                activeTimetableTab = button.dataset.timetableTab;

                renderAdminTimetable();

            });

        });

    if (activeTimetableTab === "lectures") {
        renderLectureTimetable();
    } else {
        renderExamTimetable();
    }
}

/* =========================================
   LECTURE TIMETABLE INTERFACE
========================================= */

function renderLectureTimetable() {

    const target = document.getElementById("timetableTabContent");

    if (!target) return;

    target.innerHTML = `

        <div class="timetable-section">

            <div class="timetable-section-heading">
                <div>
                    <h3>Lecture Schedule</h3>
                    <p>
                        Add and manage individual lecture sessions.
                    </p>
                </div>

                <button
                    type="button"
                    class="timetable-primary-button"
                    id="showLectureForm">
                    + Add Lecture
                </button>
            </div>


            <div id="lectureFormContainer"></div>


            <div class="timetable-record-heading">
                <h3>Lecture Records</h3>

                <span>
                    ${lectureRecords.length} total entries
                </span>
            </div>


            <div class="timetable-record-list">

                ${
                    lectureRecords.length
                        ? lectureRecords.map(renderLectureCard).join("")
                        : `
                            <div class="timetable-empty">
                                <h3>No Lecture Records</h3>
                                <p>
                                    Your lecture schedules will appear here.
                                </p>
                            </div>
                        `
                }

            </div>

        </div>
    `;

    document.getElementById("showLectureForm")
        .addEventListener("click", () => {
            renderLectureForm();
        });

    attachLectureCardEvents();
}


/* =========================================
   LECTURE FORM
========================================= */

function renderLectureForm(lecture = null) {

    editingLectureId = lecture?.id || null;

    const target = document.getElementById("lectureFormContainer");

    if (!target) return;

    target.innerHTML = `

        <div class="timetable-form-panel">

            <div class="timetable-form-heading">

                <div>
                    <h3>
                        ${lecture ? "Edit Lecture" : "Add New Lecture"}
                    </h3>

                    <p>
                        Enter the lecture details below.
                    </p>
                </div>

                <button
                    type="button"
                    class="timetable-close-button"
                    id="closeLectureForm">
                    ×
                </button>

            </div>


            <form id="lectureForm">

                <div class="timetable-form-grid">

                    <div class="timetable-field full-width">

                        <label for="lectureCourse">
                            Course *
                        </label>

                        <select id="lectureCourse" required>

                            <option value="">
                                Select course
                            </option>

                            ${
                                timetableCourses.map(course => `
                                    <option
                                        value="${timetableEscape(course.id)}"
                                        ${lecture?.course_id === course.id ? "selected" : ""}>
                                        ${timetableEscape(course.course_code)}
                                        — ${timetableEscape(course.course_title)}
                                    </option>
                                `).join("")
                            }

                        </select>

                    </div>


                    <div class="timetable-field">

                        <label for="lectureDate">
                            Lecture Date *
                        </label>

                        <input
                            type="date"
                            id="lectureDate"
                            value="${lecture?.lecture_date || ""}"
                            required>

                    </div>


                    <div class="timetable-field">

                        <label for="lectureVenue">
                            Venue *
                        </label>

                        <input
                            type="text"
                            id="lectureVenue"
                            placeholder="e.g. Faculty Lecture Hall"
                            value="${timetableEscape(lecture?.venue || "")}"
                            required>

                    </div>


                    <div class="timetable-field">

                        <label for="lectureStart">
                            Starting Time *
                        </label>

                        <input
                            type="time"
                            id="lectureStart"
                            value="${lecture?.start_time?.slice(0, 5) || ""}"
                            required>

                    </div>


                    <div class="timetable-field">

                        <label for="lectureEnd">
                            Ending Time *
                        </label>

                        <input
                            type="time"
                            id="lectureEnd"
                            value="${lecture?.end_time?.slice(0, 5) || ""}"
                            required>

                    </div>


                    <div class="timetable-field full-width">

                        <label for="lectureLecturer">
                            Lecturer's Name (Optional)
                        </label>

                        <input
                            type="text"
                            id="lectureLecturer"
                            placeholder="Enter lecturer's name"
                            value="${timetableEscape(lecture?.lecturer_name || "")}">

                    </div>


                    <div class="timetable-field full-width">

                        <label for="lectureInformation">
                            Additional Information (Optional)
                        </label>

                        <textarea
                            id="lectureInformation"
                            rows="3"
                            placeholder="Enter any additional details">${timetableEscape(lecture?.additional_information || "")}</textarea>

                    </div>


                    <div class="timetable-field full-width">

                        <label for="lectureStatus">
                            Publication Status
                        </label>

                        <select id="lectureStatus">

                            <option
                                value="draft"
                                ${lecture?.status !== "published" && lecture?.status !== "cancelled" ? "selected" : ""}>
                                Save as Draft
                            </option>

                            <option
                                value="published"
                                ${lecture?.status === "published" ? "selected" : ""}>
                                Publish Lecture
                            </option>

                        </select>

                    </div>

                </div>


                <div class="timetable-form-actions">

                    <button
                        type="button"
                        class="timetable-secondary-button"
                        id="cancelLectureForm">
                        Cancel
                    </button>

                    <button
                        type="submit"
                        class="timetable-primary-button">
                        ${lecture ? "Save Changes" : "Save Lecture"}
                    </button>

                </div>

            </form>

        </div>

    `;


    document.getElementById("closeLectureForm")
        .addEventListener("click", closeLectureForm);

    document.getElementById("cancelLectureForm")
        .addEventListener("click", closeLectureForm);

    document.getElementById("lectureForm")
        .addEventListener("submit", saveLecture);
}


/* =========================================
   CLOSE LECTURE FORM
========================================= */

function closeLectureForm() {

    editingLectureId = null;

    const target = document.getElementById("lectureFormContainer");

    if (target) target.innerHTML = "";
}

/* =========================================
   SAVE LECTURE
========================================= */

async function saveLecture(event) {

    event.preventDefault();

    const form = event.currentTarget;

    const submitButton = form.querySelector(
        'button[type="submit"]'
    );

    const courseId =
        document.getElementById("lectureCourse").value;

    const lectureDate =
        document.getElementById("lectureDate").value;

    const startTime =
        document.getElementById("lectureStart").value;

    const endTime =
        document.getElementById("lectureEnd").value;

    const venue =
        document.getElementById("lectureVenue").value.trim();

    const lecturer =
        document.getElementById("lectureLecturer").value.trim();

    const information =
        document.getElementById("lectureInformation").value.trim();

    const status =
        document.getElementById("lectureStatus").value;


    if (endTime <= startTime) {
        alert("The ending time must be later than the starting time.");
        return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "Saving...";

    try {

        const {
            data: { user },
            error: userError
        } = await supabase.auth.getUser();

        if (userError) throw userError;

        if (!user) {
            throw new Error("Your session has expired. Please log in again.");
        }

        const lectureData = {
            course_id: courseId,
            lecture_date: lectureDate,
            start_time: startTime,
            end_time: endTime,
            venue,
            lecturer_name: lecturer || null,
            additional_information: information || null,
            status,
            updated_at: new Date().toISOString()
        };

        let error;

        if (editingLectureId) {

            ({ error } = await supabase
                .from("lecture_timetable")
                .update(lectureData)
                .eq("id", editingLectureId));

        } else {

            lectureData.created_by = user.id;

            ({ error } = await supabase
                .from("lecture_timetable")
                .insert(lectureData));
        }

        if (error) throw error;

        const wasEditing = Boolean(editingLectureId);

        editingLectureId = null;

        await loadTimetableRecords();

        renderAdminTimetable();

        timetableMessage(
            wasEditing
                ? "Lecture updated successfully."
                : "Lecture saved successfully."
        );

    } catch (error) {

        console.error("Save lecture error:", error);

        alert(error.message || "Unable to save lecture.");

        submitButton.disabled = false;
        submitButton.textContent = "Try Again";
    }
}


/* =========================================
   LECTURE RECORD CARD
========================================= */

function renderLectureCard(lecture) {

    const course = lecture.courses || {};

    let statusLabel = lecture.status;

    return `
        <article class="timetable-record-card">

            <div class="timetable-record-top">

                <div>
                    <span class="timetable-course-code">
                        ${timetableEscape(course.course_code || "Course")}
                    </span>

                    <h4>
                        ${timetableEscape(course.course_title || "Untitled Course")}
                    </h4>
                </div>

                <span class="timetable-status ${timetableEscape(lecture.status)}">
                    ${timetableEscape(statusLabel)}
                </span>

            </div>


            <div class="timetable-record-details">

                <div>
                    <small>Date</small>
                    <strong>
                        ${timetableDate(lecture.lecture_date)}
                    </strong>
                </div>

                <div>
                    <small>Time</small>
                    <strong>
                        ${timetableTime(lecture.start_time)}
                        –
                        ${timetableTime(lecture.end_time)}
                    </strong>
                </div>

                <div>
                    <small>Venue</small>
                    <strong>
                        ${timetableEscape(lecture.venue)}
                    </strong>
                </div>

                ${
                    lecture.lecturer_name
                        ? `
                            <div>
                                <small>Lecturer</small>
                                <strong>
                                    ${timetableEscape(lecture.lecturer_name)}
                                </strong>
                            </div>
                        `
                        : ""
                }

            </div>


            ${
                lecture.additional_information
                    ? `
                        <p class="timetable-record-note">
                            ${timetableEscape(lecture.additional_information)}
                        </p>
                    `
                    : ""
            }


            <div class="timetable-record-actions">

                <button
                    type="button"
                    class="timetable-secondary-button"
                    data-lecture-edit="${lecture.id}">
                    Edit
                </button>

                ${
                    lecture.status === "cancelled"
                        ? `
                            <button
                                type="button"
                                class="timetable-primary-button"
                                data-lecture-restore="${lecture.id}">
                                Restore as Draft
                            </button>
                        `
                        : `
                            <button
                                type="button"
                                class="timetable-secondary-button"
                                data-lecture-cancel="${lecture.id}">
                                Cancel Lecture
                            </button>
                        `
                }

                <button
                    type="button"
                    class="timetable-danger-button"
                    data-lecture-delete="${lecture.id}">
                    Delete
                </button>

            </div>

        </article>
    `;
}


/* =========================================
   LECTURE RECORD ACTIONS
========================================= */

function attachLectureCardEvents() {

    document.querySelectorAll("[data-lecture-edit]")
        .forEach(button => {

            button.addEventListener("click", () => {

                const lecture = lectureRecords.find(
                    item => item.id === button.dataset.lectureEdit
                );

                if (lecture) renderLectureForm(lecture);

            });

        });


    document.querySelectorAll("[data-lecture-cancel]")
        .forEach(button => {

            button.addEventListener("click", async () => {

                const confirmed = confirm(
                    "Cancel this lecture? Students will see its cancelled status."
                );

                if (!confirmed) return;

                await updateLectureStatus(
                    button.dataset.lectureCancel,
                    "cancelled"
                );

            });

        });


    document.querySelectorAll("[data-lecture-restore]")
        .forEach(button => {

            button.addEventListener("click", async () => {

                const confirmed = confirm(
                    "Restore this lecture as a draft?"
                );

                if (!confirmed) return;

                await updateLectureStatus(
                    button.dataset.lectureRestore,
                    "draft"
                );

            });

        });


    document.querySelectorAll("[data-lecture-delete]")
        .forEach(button => {

            button.addEventListener("click", async () => {

                const confirmed = confirm(
                    "Permanently delete this lecture record?"
                );

                if (!confirmed) return;

                await deleteLecture(button.dataset.lectureDelete);

            });

        });
}


/* =========================================
   UPDATE LECTURE STATUS
========================================= */

async function updateLectureStatus(id, status) {

    try {

        const { error } = await supabase
            .from("lecture_timetable")
            .update({
                status,
                updated_at: new Date().toISOString()
            })
            .eq("id", id);

        if (error) throw error;

        await loadTimetableRecords();

        renderAdminTimetable();

        timetableMessage(
            status === "cancelled"
                ? "Lecture cancelled."
                : "Lecture restored as draft."
        );

    } catch (error) {

        console.error("Lecture status error:", error);

        alert(error.message || "Unable to update lecture.");
    }
}


/* =========================================
   DELETE LECTURE
========================================= */

async function deleteLecture(id) {

    try {

        const { error } = await supabase
            .from("lecture_timetable")
            .delete()
            .eq("id", id);

        if (error) throw error;

        await loadTimetableRecords();

        renderAdminTimetable();

        timetableMessage("Lecture deleted successfully.");

    } catch (error) {

        console.error("Delete lecture error:", error);

        alert(error.message || "Unable to delete lecture.");
    }
}

/* =========================================
   EXAMINATION TIMETABLE
========================================= */

function renderExamTimetable() {

    const content = document.getElementById(
        "timetableTabContent"
    );

    if (!content) return;

    content.innerHTML = `
        <div class="exam-timetable-section">

            <div class="timetable-section-heading">
                <div>
                    <h3>Examination Timetables</h3>
                    <p>
                        Upload, publish and manage examination schedules.
                    </p>
                </div>
            </div>

            <form id="examUploadForm" class="timetable-form">

                <h4>Upload Examination Timetable</h4>

                <div class="timetable-form-grid">

                    <div class="timetable-form-group">
                        <label for="examTitle">Timetable Title</label>
                        <input
                            type="text"
                            id="examTitle"
                            placeholder="e.g. First Semester Examination"
                            required>
                    </div>

                    <div class="timetable-form-group">
                        <label for="examSession">Academic Session</label>
                        <input
                            type="text"
                            id="examSession"
                            placeholder="e.g. 2026/2027"
                            required>
                    </div>

                    <div class="timetable-form-group">
                        <label for="examSemester">Semester</label>
                        <select id="examSemester" required>
                            <option value="">Select semester</option>
                            <option value="First Semester">First Semester</option>
                            <option value="Second Semester">Second Semester</option>
                        </select>
                    </div>

                    <div class="timetable-form-group">
                        <label for="examFile">Timetable PDF</label>
                        <input
                            type="file"
                            id="examFile"
                            accept=".pdf,application/pdf"
                            required>
                        <small>PDF files only.</small>
                    </div>

                </div>

                <button
                    type="submit"
                    id="examUploadButton"
                    class="timetable-primary-button">
                    Upload Timetable
                </button>

            </form>


            <div class="exam-records-heading">
                <h3>Uploaded Examination Timetables</h3>
                <span>${examRecords.length} records</span>
            </div>

            <div class="exam-records-list">

                ${
                    examRecords.length
                        ? examRecords.map(renderExamCard).join("")
                        : `
                            <div class="timetable-empty">
                                <h4>No Examination Timetable Yet</h4>
                                <p>
                                    Uploaded examination timetables will appear here.
                                </p>
                            </div>
                        `
                }

            </div>

        </div>
    `;

    document.getElementById("examUploadForm")
        .addEventListener("submit", uploadExamTimetable);

    attachExamCardEvents();
}


/* =========================================
   EXAMINATION RECORD CARD
========================================= */

function renderExamCard(exam) {

    return `
        <article class="timetable-record-card">

            <div class="timetable-record-top">

                <div>
                    <span class="timetable-course-code">
                        ${timetableEscape(exam.academic_session)}
                    </span>

                    <h4>${timetableEscape(exam.title)}</h4>

                    <p>
                        ${timetableEscape(exam.semester)}
                    </p>
                </div>

                <span class="timetable-status ${timetableEscape(exam.status)}">
                    ${timetableEscape(exam.status)}
                </span>

            </div>

            <div class="exam-file-information">
                <span>
                    ${timetableEscape(exam.file_name)}
                </span>

                <small>
                    Version ${exam.version_number}
                </small>
            </div>

            <div class="timetable-record-actions">

                <button
                    type="button"
                    class="timetable-secondary-button"
                    data-exam-download="${exam.id}">
                    Download / View
                </button>

                ${
                    exam.status === "draft"
                        ? `
                            <button
                                type="button"
                                class="timetable-primary-button"
                                data-exam-publish="${exam.id}">
                                Publish
                            </button>
                        `
                        : ""
                }

                ${
                    exam.status === "published"
                        ? `
                            <button
                                type="button"
                                class="timetable-danger-button"
                                data-exam-archive="${exam.id}">
                                Archive
                            </button>
                        `
                        : ""
                }

            </div>

        </article>
    `;
}


/* =========================================
   UPLOAD EXAMINATION TIMETABLE
========================================= */

async function uploadExamTimetable(event) {

    event.preventDefault();

    const form = event.currentTarget;

    const button = document.getElementById(
        "examUploadButton"
    );

    const title = document.getElementById(
        "examTitle"
    ).value.trim();

    const session = document.getElementById(
        "examSession"
    ).value.trim();

    const semester = document.getElementById(
        "examSemester"
    ).value;

    const file = document.getElementById(
        "examFile"
    ).files[0];

    if (!file) {
        alert("Select an examination timetable PDF.");
        return;
    }

    if (
        file.type !== "application/pdf" &&
        !file.name.toLowerCase().endsWith(".pdf")
    ) {
        alert("Only PDF files are allowed.");
        return;
    }

    if (file.size > 20 * 1024 * 1024) {
        alert("The PDF must not exceed 20 MB.");
        return;
    }

    button.disabled = true;
    button.textContent = "Uploading...";

    let uploadedPath = null;

    try {

        const {
            data: { user },
            error: userError
        } = await supabase.auth.getUser();

        if (userError) throw userError;

        if (!user) {
            throw new Error("Please log in again.");
        }

        const matchingVersions = examRecords.filter(exam =>
            exam.academic_session.toLowerCase() === session.toLowerCase() &&
            exam.semester === semester
        );

        const nextVersion = matchingVersions.length
            ? Math.max(...matchingVersions.map(exam =>
                Number(exam.version_number) || 1
            )) + 1
            : 1;

        const safeFileName = file.name
            .replace(/[^a-zA-Z0-9._-]/g, "_");

        const uniqueFolder = crypto.randomUUID();

        uploadedPath = `${uniqueFolder}/${Date.now()}-${safeFileName}`;

        const { error: uploadError } = await supabase
            .storage
            .from("exam-timetables")
            .upload(uploadedPath, file, {
                contentType: "application/pdf",
                upsert: false
            });

        if (uploadError) throw uploadError;

        const { error: insertError } = await supabase
            .from("exam_timetables")
            .insert({
                title,
                academic_session: session,
                semester,
                file_name: file.name,
                file_path: uploadedPath,
                file_size: file.size,
                file_type: "application/pdf",
                version_number: nextVersion,
                status: "draft",
                uploaded_by: user.id
            });

        if (insertError) throw insertError;

        await loadTimetableRecords();

        renderAdminTimetable();

        timetableMessage(
            "Examination timetable uploaded as a draft. Publish it when ready."
        );

    } catch (error) {

        console.error("Exam upload error:", error);

        if (uploadedPath) {
            await supabase.storage
                .from("exam-timetables")
                .remove([uploadedPath]);
        }

        alert(error.message || "Unable to upload examination timetable.");

        button.disabled = false;
        button.textContent = "Try Again";
    }
}


/* =========================================
   EXAMINATION RECORD ACTIONS
========================================= */

function attachExamCardEvents() {

    document.querySelectorAll("[data-exam-download]")
        .forEach(button => {

            button.addEventListener("click", async () => {

                const exam = examRecords.find(
                    item => item.id === button.dataset.examDownload
                );

                if (exam) await downloadExamFile(exam);

            });

        });


    document.querySelectorAll("[data-exam-publish]")
        .forEach(button => {

            button.addEventListener("click", async () => {

                const exam = examRecords.find(
                    item => item.id === button.dataset.examPublish
                );

                if (!exam) return;

                const confirmed = confirm(
                    `Publish this timetable for ${exam.academic_session}, ${exam.semester}? Any previously published version for this session and semester will be archived.`
                );

                if (!confirmed) return;

                await publishExamTimetable(exam);

            });

        });


    document.querySelectorAll("[data-exam-archive]")
        .forEach(button => {

            button.addEventListener("click", async () => {

                const confirmed = confirm(
                    "Archive this examination timetable?"
                );

                if (!confirmed) return;

                await archiveExamTimetable(
                    button.dataset.examArchive
                );

            });

        });
}


/* =========================================
   PUBLISH EXAMINATION TIMETABLE
========================================= */

async function publishExamTimetable(exam) {

    try {

        const previousPublished = examRecords.filter(item =>
            item.id !== exam.id &&
            item.status === "published" &&
            item.academic_session.toLowerCase() ===
                exam.academic_session.toLowerCase() &&
            item.semester === exam.semester
        );

        const previousIds = previousPublished.map(item => item.id);

        if (previousIds.length) {

            const { error: archiveError } = await supabase
                .from("exam_timetables")
                .update({
                    status: "archived",
                    updated_at: new Date().toISOString()
                })
                .in("id", previousIds);

            if (archiveError) throw archiveError;
        }

        const { error: publishError } = await supabase
            .from("exam_timetables")
            .update({
                status: "published",
                updated_at: new Date().toISOString()
            })
            .eq("id", exam.id);

        if (publishError) {

            if (previousIds.length) {
                await supabase
                    .from("exam_timetables")
                    .update({
                        status: "published",
                        updated_at: new Date().toISOString()
                    })
                    .in("id", previousIds);
            }

            throw publishError;
        }

        await loadTimetableRecords();

        renderAdminTimetable();

        timetableMessage("Examination timetable published successfully.");

    } catch (error) {

        console.error("Exam publishing error:", error);

        alert(error.message || "Unable to publish timetable.");
    }
}


/* =========================================
   ARCHIVE EXAMINATION TIMETABLE
========================================= */

async function archiveExamTimetable(id) {

    try {

        const { error } = await supabase
            .from("exam_timetables")
            .update({
                status: "archived",
                updated_at: new Date().toISOString()
            })
            .eq("id", id);

        if (error) throw error;

        await loadTimetableRecords();

        renderAdminTimetable();

        timetableMessage("Examination timetable archived.");

    } catch (error) {

        console.error("Exam archive error:", error);

        alert(error.message || "Unable to archive timetable.");
    }
}


/* =========================================
   SECURE EXAMINATION FILE DOWNLOAD
========================================= */

async function downloadExamFile(exam) {

    try {

        const { data, error } = await supabase
            .storage
            .from("exam-timetables")
            .createSignedUrl(exam.file_path, 300);

        if (error) throw error;

        if (!data?.signedUrl) {
            throw new Error("Unable to generate a secure download link.");
        }

        window.open(data.signedUrl, "_blank", "noopener,noreferrer");

    } catch (error) {

        console.error("Exam download error:", error);

        alert(error.message || "Unable to open examination timetable.");
    }
}
