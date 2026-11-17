
import { supabase } from "./config.js";

let courses = [];
let levels = [];
let semesters = [];
let sessions = [];
let selectedSession = "";
let selectedLevel = "";
let selectedSemester = "";
let editingCourseId = null;

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
}

function showError(container, message) {
    container.innerHTML = `
        <div class="admin-panel">
            <h3>Unable to load Courses</h3>
            <p class="admin-placeholder">${escapeHTML(message)}</p>
            <button class="admin-action-button" id="retryCourses">
                Try Again
            </button>
        </div>
    `;

    container.querySelector("#retryCourses")
        ?.addEventListener("click", () => loadCourses(container));
}

export async function loadCourses(container) {

    container.innerHTML = `
        <div class="admin-panel">
            <p>Loading academic courses...</p>
        </div>
    `;

    const [levelResult, semesterResult, sessionResult, courseResult] =
        await Promise.all([

            supabase
                .from("academic_levels")
                .select("*")
                .order("level_number"),

            supabase
                .from("academic_semesters")
                .select("*")
                .order("semester_number"),

            supabase
                .from("academic_sessions")
                .select("*")
                .order("session_name", { ascending: false }),

            supabase
                .from("courses")
                .select(`
                    *,
                    academic_levels (
                        level_name,
                        level_number
                    ),
                    academic_semesters (
                        semester_name,
                        semester_number
                    ),
                    academic_sessions (
                        session_name,
                        is_current
                    )
                `)
                .order("course_code")
        ]);

    const error =
        levelResult.error ||
        semesterResult.error ||
        sessionResult.error ||
        courseResult.error;

    if (error) {
        console.error("Courses loading error:", error);
        showError(container, error.message);
        return;
    }

    levels = levelResult.data || [];
    semesters = semesterResult.data || [];
    sessions = sessionResult.data || [];
    courses = courseResult.data || [];

    const currentSession = sessions.find(item => item.is_current);

    selectedSession = currentSession
        ? String(currentSession.id)
        : sessions.length
            ? String(sessions[0].id)
            : "";

    selectedLevel = "";
    selectedSemester = "";
    editingCourseId = null;

    renderCourses(container);
}


function renderCourses(container) {

    const filteredCourses = courses.filter(course => {

        const sessionMatch =
            !selectedSession ||
            String(course.academic_session_id) === selectedSession;

        const levelMatch =
            !selectedLevel ||
            String(course.academic_level_id) === selectedLevel;

        const semesterMatch =
            !selectedSemester ||
            String(course.semester_id) === selectedSemester;

        return sessionMatch && levelMatch && semesterMatch;

    });

    container.innerHTML = `

        <div class="admin-welcome">
            <div>
                <span class="admin-section-eyebrow">
                    ACADEMIC MANAGEMENT
                </span>
                <h2>Course Manager</h2>
                <p>
                    Create and organise courses across the four
                    academic levels of the PUB250 set.
                </p>
            </div>
        </div>

        <div class="admin-stat-grid">

            <article class="admin-stat-card">
                <span>Total Courses</span>
                <strong>${courses.length}</strong>
                <small>All academic sessions</small>
            </article>

            <article class="admin-stat-card">
                <span>Active Courses</span>
                <strong>${courses.filter(c => c.is_active).length}</strong>
                <small>Currently available</small>
            </article>

            <article class="admin-stat-card">
                <span>Inactive Courses</span>
                <strong>${courses.filter(c => !c.is_active).length}</strong>
                <small>Deactivated courses</small>
            </article>

        </div>

        <div class="admin-panel">

            <div class="admin-panel-heading">
                <div>
                    <span class="admin-section-eyebrow">
                        COURSE CATALOGUE
                    </span>
                    <h3>Academic Filters</h3>
                </div>
            </div>

            <div class="course-filter-grid">

                <label>
                    Academic Session
                    <select id="courseSessionFilter">
                        ${sessions.map(session => `
                            <option
                                value="${session.id}"
                                ${String(session.id) === selectedSession ? "selected" : ""}
                            >
                                ${escapeHTML(session.session_name)}
                                ${session.is_current ? "(Current)" : ""}
                            </option>
                        `).join("")}
                    </select>
                </label>

                <label>
                    Academic Level
                    <select id="courseLevelFilter">
                        <option value="">All Levels</option>
                        ${levels.map(level => `
                            <option
                                value="${level.id}"
                                ${String(level.id) === selectedLevel ? "selected" : ""}
                            >
                                ${escapeHTML(level.level_name)}
                            </option>
                        `).join("")}
                    </select>
                </label>

                <label>
                    Semester
                    <select id="courseSemesterFilter">
                        <option value="">All Semesters</option>
                        ${semesters.map(semester => `
                            <option
                                value="${semester.id}"
                                ${String(semester.id) === selectedSemester ? "selected" : ""}
                            >
                                ${escapeHTML(semester.semester_name)}
                            </option>
                        `).join("")}
                    </select>
                </label>

            </div>

        </div>

        <div class="admin-panel">

            <div class="admin-panel-heading">
                <div>
                    <span class="admin-section-eyebrow">
                        COURSE MANAGEMENT
                    </span>
                    <h3>${filteredCourses.length} Courses Found</h3>
                </div>

                <button class="admin-action-button" id="addCourseButton">
                    + Add Course
                </button>
            </div>

            <div id="courseFormContainer"></div>

            <div id="courseList">

                ${
                    filteredCourses.length
                    ? filteredCourses.map(course => `
                        <article class="course-management-card">

                            <div class="course-management-info">

                                <strong>
                                    ${escapeHTML(course.course_code)}
                                </strong>

                                <h3>
                                    ${escapeHTML(course.course_title)}
                                </h3>

                                <p>
                                    ${escapeHTML(course.academic_levels?.level_name)}
                                    ·
                                    ${escapeHTML(course.academic_semesters?.semester_name)}
                                    ·
                                    ${escapeHTML(course.academic_sessions?.session_name)}
                                </p>

                                <small>
                                    ${course.credit_units ?? "—"} Credit Units
                                </small>

                                <span class="registration-status ${
                                    course.is_active ? "approved" : "rejected"
                                }">
                                    ${course.is_active ? "Active" : "Inactive"}
                                </span>

                            </div>

                            <div class="course-management-actions">

                                <button
                                    class="admin-action-button"
                                    data-edit-course="${course.id}"
                                >
                                    Edit
                                </button>

                                <button
                                    class="admin-action-button"
                                    data-toggle-course="${course.id}"
                                >
                                    ${course.is_active ? "Deactivate" : "Reactivate"}
                                </button>

                                <button
                                    class="admin-action-button"
                                    data-open-course="${course.id}"
                                >
                                    Manage Topics
                                </button>

                            </div>

                        </article>
                    `).join("")
                    : `
                        <p class="admin-placeholder">
                            No courses found for this selection.
                            Use Add Course to create one.
                        </p>
                    `
                }

            </div>

        </div>
    `;

    document.getElementById("courseSessionFilter")
        ?.addEventListener("change", event => {
            selectedSession = event.target.value;
            renderCourses(container);
        });

    document.getElementById("courseLevelFilter")
        ?.addEventListener("change", event => {
            selectedLevel = event.target.value;
            renderCourses(container);
        });

    document.getElementById("courseSemesterFilter")
        ?.addEventListener("change", event => {
            selectedSemester = event.target.value;
            renderCourses(container);
        });

    document.getElementById("addCourseButton")
        ?.addEventListener("click", () => {
            editingCourseId = null;
            renderCourseForm(container);
        });

    container.querySelectorAll("[data-edit-course]")
        .forEach(button => {
            button.addEventListener("click", () => {
                editingCourseId = button.dataset.editCourse;
                renderCourseForm(container);
            });
        });

    container.querySelectorAll("[data-toggle-course]")
        .forEach(button => {
            button.addEventListener("click", () => {
                toggleCourse(
                    button.dataset.toggleCourse,
                    container
                );
            });
        });

    container.querySelectorAll("[data-open-course]")
        .forEach(button => {
            button.addEventListener("click", () => {
                alert("The Topic Manager will be connected in the next development stage.");
            });
        });

}


function renderCourseForm(container) {

    const course = courses.find(
        item => item.id === editingCourseId
    );

    const formContainer =
        container.querySelector("#courseFormContainer");

    if (!formContainer) return;

    formContainer.innerHTML = `

        <div class="course-editor-box">

            <h3>
                ${course ? "Edit Course" : "Create New Course"}
            </h3>

            <form id="courseForm">

                <label>
                    Academic Session
                    <select name="academic_session_id" required>
                        ${sessions.map(session => `
                            <option
                                value="${session.id}"
                                ${String(session.id) === String(
                                    course?.academic_session_id || selectedSession
                                ) ? "selected" : ""}
                            >
                                ${escapeHTML(session.session_name)}
                            </option>
                        `).join("")}
                    </select>
                </label>

                <label>
                    Academic Level
                    <select name="academic_level_id" required>
                        ${levels.map(level => `
                            <option
                                value="${level.id}"
                                ${String(level.id) === String(
                                    course?.academic_level_id || selectedLevel || levels[0]?.id
                                ) ? "selected" : ""}
                            >
                                ${escapeHTML(level.level_name)}
                            </option>
                        `).join("")}
                    </select>
                </label>

                <label>
                    Semester
                    <select name="semester_id" required>
                        ${semesters.map(semester => `
                            <option
                                value="${semester.id}"
                                ${String(semester.id) === String(
                                    course?.semester_id || selectedSemester || semesters[0]?.id
                                ) ? "selected" : ""}
                            >
                                ${escapeHTML(semester.semester_name)}
                            </option>
                        `).join("")}
                    </select>
                </label>

                <label>
                    Course Code
                    <input
                        type="text"
                        name="course_code"
                        placeholder="e.g. POL 201"
                        value="${escapeHTML(course?.course_code || "")}"
                        required
                    >
                </label>

                <label>
                    Course Title
                    <input
                        type="text"
                        name="course_title"
                        placeholder="Enter course title"
                        value="${escapeHTML(course?.course_title || "")}"
                        required
                    >
                </label>

                <label>
                    Credit Units
                    <input
                        type="number"
                        name="credit_units"
                        min="1"
                        max="20"
                        value="${course?.credit_units ?? ""}"
                        placeholder="e.g. 3"
                    >
                </label>

                <label>
                    Course Description
                    <textarea
                        name="course_description"
                        placeholder="Optional course description"
                        rows="4"
                    >${escapeHTML(course?.course_description || "")}</textarea>
                </label>

                <div class="course-form-actions">

                    <button type="submit" class="admin-action-button">
                        ${course ? "Save Changes" : "Create Course"}
                    </button>

                    <button
                        type="button"
                        class="admin-action-button"
                        id="cancelCourseForm"
                    >
                        Cancel
                    </button>

                </div>

                <p id="courseFormMessage"></p>

            </form>

        </div>
    `;

    formContainer.querySelector("#cancelCourseForm")
        .addEventListener("click", () => {
            editingCourseId = null;
            formContainer.innerHTML = "";
        });

    formContainer.querySelector("#courseForm")
        .addEventListener("submit", async event => {

            event.preventDefault();

            const form = event.target;
            const message = form.querySelector("#courseFormMessage");
            const submitButton = form.querySelector('[type="submit"]');

            const formData = new FormData(form);

            const creditValue = formData.get("credit_units");

            const courseData = {
                academic_session_id: Number(formData.get("academic_session_id")),
                academic_level_id: Number(formData.get("academic_level_id")),
                semester_id: Number(formData.get("semester_id")),
                course_code: String(formData.get("course_code")).trim().toUpperCase(),
                course_title: String(formData.get("course_title")).trim(),
                credit_units: creditValue ? Number(creditValue) : null,
                course_description: String(formData.get("course_description")).trim(),
                updated_at: new Date().toISOString()
            };

            submitButton.disabled = true;
            message.textContent = "Saving course...";

            let result;

            if (editingCourseId) {

                result = await supabase
                    .from("courses")
                    .update(courseData)
                    .eq("id", editingCourseId);

            } else {

                result = await supabase
                    .from("courses")
                    .insert(courseData);

            }

            if (result.error) {

                console.error(result.error);

                message.textContent =
                    "Error: " + result.error.message;

                submitButton.disabled = false;
                return;

            }

            alert(
                editingCourseId
                    ? "Course updated successfully."
                    : "Course created successfully."
            );

            editingCourseId = null;

            await loadCourses(container);

        });

}


async function toggleCourse(courseId, container) {

    const course = courses.find(item => item.id === courseId);

    if (!course) return;

    const action = course.is_active ? "deactivate" : "reactivate";

    const confirmed = confirm(
        `Are you sure you want to ${action} ${course.course_code}?`
    );

    if (!confirmed) return;

    const { error } = await supabase
        .from("courses")
        .update({
            is_active: !course.is_active,
            updated_at: new Date().toISOString()
        })
        .eq("id", courseId);

    if (error) {
        alert("Unable to update course: " + error.message);
        return;
    }

    await loadCourses(container);

}
