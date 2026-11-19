import { supabase } from "./config.js";

/* =========================================
   COURSE MANAGER — SHARED DATA
========================================= */

let courses = [];
let levels = [];
let semesters = [];
let sessions = [];

let chapters = [];
let topics = [];

let activeCourse = null;
let activeChapter = null;

let editingCourseId = null;
let editingChapterId = null;
let editingTopicId = null;

let courseFilters = {
    session: "",
    level: "",
    semester: ""
};

let dashboardContainer = null;

/* =========================================
   GENERAL HELPERS
========================================= */

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
}

function showLoading(container, message = "Loading...") {
    container.innerHTML = `
        <div class="admin-panel">
            <p>${escapeHTML(message)}</p>
        </div>
    `;
}

function showError(container, title, message) {
    container.innerHTML = `
        <div class="admin-panel">
            <h3>${escapeHTML(title)}</h3>
            <p>${escapeHTML(message)}</p>
            <button type="button" data-action="reload-courses">
                Try Again
            </button>
        </div>
    `;
}

function notify(message) {
    alert(message);
}

function getErrorMessage(error) {
    return error?.message || "An unexpected error occurred.";
}

function formatLevel(level) {
    return level?.level_name || "Unknown Level";
}

function formatSemester(semester) {
    return semester?.semester_name || "Unknown Semester";
}

function formatSession(session) {
    return session?.session_name || "Unknown Session";
}

function getCourseDetails(course) {
    const level = levels.find(
        item => item.id === course.academic_level_id
    );

    const semester = semesters.find(
        item => item.id === course.semester_id
    );

    const session = sessions.find(
        item => item.id === course.academic_session_id
    );

    return {
        level: formatLevel(level),
        semester: formatSemester(semester),
        session: formatSession(session)
    };
}

/* =========================================
   LOAD COURSE MANAGER
========================================= */

export async function loadCourses(container) {
    dashboardContainer = container;

    showLoading(container, "Loading course manager...");

    const [
        levelsResult,
        semestersResult,
        sessionsResult,
        coursesResult
    ] = await Promise.all([
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
            .select("*")
            .order("course_code")
    ]);

    const error =
        levelsResult.error ||
        semestersResult.error ||
        sessionsResult.error ||
        coursesResult.error;

    if (error) {
        showError(
            container,
            "Unable to load courses",
            getErrorMessage(error)
        );
        return;
    }

    levels = levelsResult.data || [];
    semesters = semestersResult.data || [];
    sessions = sessionsResult.data || [];
    courses = coursesResult.data || [];

    renderCourses(container);
}

/* =========================================
   COURSE MANAGER DISPLAY
========================================= */

function renderCourses(container) {
    dashboardContainer = container;

    const filteredCourses = courses.filter(course => {
        const matchesSession =
            !courseFilters.session ||
            String(course.academic_session_id) ===
            String(courseFilters.session);

        const matchesLevel =
            !courseFilters.level ||
            String(course.academic_level_id) ===
            String(courseFilters.level);

        const matchesSemester =
            !courseFilters.semester ||
            String(course.semester_id) ===
            String(courseFilters.semester);

        return matchesSession && matchesLevel && matchesSemester;
    });

    container.innerHTML = `
        <div class="admin-panel">

            <div class="admin-panel-header">
                <div>
                    <h2>Course Manager</h2>
                    <p>
                        Manage academic courses, chapters,
                        topics and lecture notes.
                    </p>
                </div>

                <button type="button" data-action="add-course">
                    + Add Course
                </button>
            </div>

            <div class="course-filters">

                <select data-filter="session">
                    <option value="">All Academic Sessions</option>

                    ${sessions.map(session => `
                        <option
                            value="${session.id}"
                            ${String(courseFilters.session) === String(session.id) ? "selected" : ""}
                        >
                            ${escapeHTML(session.session_name)}
                            ${session.is_current ? "(Current)" : ""}
                        </option>
                    `).join("")}
                </select>

                <select data-filter="level">
                    <option value="">All Levels</option>

                    ${levels.map(level => `
                        <option
                            value="${level.id}"
                            ${String(courseFilters.level) === String(level.id) ? "selected" : ""}
                        >
                            ${escapeHTML(level.level_name)}
                        </option>
                    `).join("")}
                </select>

                <select data-filter="semester">
                    <option value="">All Semesters</option>

                    ${semesters.map(semester => `
                        <option
                            value="${semester.id}"
                            ${String(courseFilters.semester) === String(semester.id) ? "selected" : ""}
                        >
                            ${escapeHTML(semester.semester_name)}
                        </option>
                    `).join("")}
                </select>

            </div>

            <div class="course-list">

                ${
                    filteredCourses.length
                    ? filteredCourses.map(course => {
                        const details = getCourseDetails(course);

                        return `
                            <div class="course-card">

                                <div class="course-card-info">
                                    <h3>
                                        ${escapeHTML(course.course_code)}
                                        — ${escapeHTML(course.course_title)}
                                    </h3>

                                    <p>
                                        ${escapeHTML(details.level)}
                                        · ${escapeHTML(details.semester)}
                                        · ${escapeHTML(details.session)}
                                    </p>

                                    <p>
                                        ${course.credit_units ?? 0} Credit Units
                                    </p>

                                    <span class="course-status">
                                        ${course.is_active ? "Active" : "Inactive"}
                                    </span>
                                </div>

                                <div class="course-card-actions">

                                    <button
                                        type="button"
                                        data-action="manage-chapters"
                                        data-id="${course.id}"
                                    >
                                        Manage Chapters
                                    </button>
                                    <button
    type="button"
    data-action="manage-course-materials"
    data-id="${course.id}"
>
    Manage PDFs
</button>

                                    <button
                                        type="button"
                                        data-action="edit-course"
                                        data-id="${course.id}"
                                    >
                                        Edit
                                    </button>

                                    <button
                                        type="button"
                                        data-action="toggle-course"
                                        data-id="${course.id}"
                                    >
                                        ${course.is_active ? "Deactivate" : "Reactivate"}
                                    </button>

                                </div>

                            </div>
                        `;
                    }).join("")
                    : `
                        <div class="empty-state">
                            <h3>No courses found</h3>
                            <p>
                                Add a course or change the filters.
                            </p>
                        </div>
                    `
                }

            </div>
        </div>
    `;

    attachCourseEvents(container);
}

/* =========================================
   COURSE FORM
========================================= */

function renderCourseForm(container, course = null) {
    editingCourseId = course?.id || null;

    container.innerHTML = `
        <div class="admin-panel">

            <div class="admin-panel-header">
                <div>
                    <h2>${course ? "Edit Course" : "Add New Course"}</h2>
                    <p>Enter the course information below.</p>
                </div>
            </div>

            <form id="courseForm">

                <label>Academic Session</label>
                <select name="academic_session_id" required>
                    <option value="">Select Session</option>

                    ${sessions.map(session => `
                        <option
                            value="${session.id}"
                            ${String(course?.academic_session_id) === String(session.id) ? "selected" : ""}
                        >
                            ${escapeHTML(session.session_name)}
                        </option>
                    `).join("")}
                </select>

                <label>Academic Level</label>
                <select name="academic_level_id" required>
                    <option value="">Select Level</option>

                    ${levels.map(level => `
                        <option
                            value="${level.id}"
                            ${String(course?.academic_level_id) === String(level.id) ? "selected" : ""}
                        >
                            ${escapeHTML(level.level_name)}
                        </option>
                    `).join("")}
                </select>

                <label>Semester</label>
                <select name="semester_id" required>
                    <option value="">Select Semester</option>

                    ${semesters.map(semester => `
                        <option
                            value="${semester.id}"
                            ${String(course?.semester_id) === String(semester.id) ? "selected" : ""}
                        >
                            ${escapeHTML(semester.semester_name)}
                        </option>
                    `).join("")}
                </select>

                <label>Course Code</label>
                <input
                    type="text"
                    name="course_code"
                    value="${escapeHTML(course?.course_code || "")}"
                    placeholder="e.g. POL250"
                    required
                >

                <label>Course Title / Textbook Title</label>
                <input
                    type="text"
                    name="course_title"
                    value="${escapeHTML(course?.course_title || "")}"
                    placeholder="Enter course title"
                    required
                >

                <label>Credit Units</label>
                <input
                    type="number"
                    name="credit_units"
                    min="0"
                    value="${course?.credit_units ?? ""}"
                >

                <label>Course Description</label>
                <textarea
                    name="course_description"
                    rows="4"
                    placeholder="Optional course description"
                >${escapeHTML(course?.course_description || "")}</textarea>

                <div class="form-actions">

                    <button type="submit">
                        ${course ? "Save Changes" : "Create Course"}
                    </button>

                    <button
                        type="button"
                        data-action="back-to-courses"
                    >
                        Cancel
                    </button>

                </div>

            </form>
        </div>
    `;

    const form = container.querySelector("#courseForm");

    form.addEventListener("submit", saveCourse);
}

/* =========================================
   SAVE COURSE
========================================= */

async function saveCourse(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);

    const courseData = {
        academic_session_id: Number(formData.get("academic_session_id")),
        academic_level_id: Number(formData.get("academic_level_id")),
        semester_id: Number(formData.get("semester_id")),
        course_code: String(formData.get("course_code")).trim().toUpperCase(),
        course_title: String(formData.get("course_title")).trim(),
        credit_units: Number(formData.get("credit_units")) || 0,
        course_description: String(
            formData.get("course_description") || ""
        ).trim(),
        updated_at: new Date().toISOString()
    };

    if (
        !courseData.academic_session_id ||
        !courseData.academic_level_id ||
        !courseData.semester_id ||
        !courseData.course_code ||
        !courseData.course_title
    ) {
        notify("Complete all required course fields.");
        return;
    }

    const submitButton = form.querySelector(
        'button[type="submit"]'
    );

    submitButton.disabled = true;
    submitButton.textContent = "Saving...";

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
        submitButton.disabled = false;
        submitButton.textContent = editingCourseId
            ? "Save Changes"
            : "Create Course";

        notify(getErrorMessage(result.error));
        return;
    }

    editingCourseId = null;

    notify("Course saved successfully.");

    await loadCourses(dashboardContainer);
}

/* =========================================
   EDIT / ACTIVATE / DEACTIVATE COURSE
========================================= */

async function toggleCourse(courseId) {
    const course = courses.find(item => item.id === courseId);

    if (!course) return;

    const action = course.is_active ? "deactivate" : "reactivate";

    if (!confirm(`Are you sure you want to ${action} this course?`)) {
        return;
    }

    const { error } = await supabase
        .from("courses")
        .update({
            is_active: !course.is_active,
            updated_at: new Date().toISOString()
        })
        .eq("id", courseId);

    if (error) {
        notify(getErrorMessage(error));
        return;
    }

    notify(`Course ${action}d successfully.`);

    await loadCourses(dashboardContainer);
}

/* =========================================
   COURSE EVENT HANDLERS
========================================= */

function attachCourseEvents(container) {
    container.onclick = async event => {
        const button = event.target.closest("[data-action]");

        if (!button) return;

        const action = button.dataset.action;
        const id = button.dataset.id;

        if (action === "add-course") {
            renderCourseForm(container);
        }

        if (action === "edit-course") {
            const course = courses.find(item => item.id === id);

            if (course) {
                renderCourseForm(container, course);
            }
        }

        if (action === "toggle-course") {
            await toggleCourse(id);
        }

        if (action === "manage-chapters") {
            await openChapterManager(id, container);
        }
      if (action === "manage-course-materials") {
    activeCourse = courses.find(item => item.id === id);

    await openMaterialManager(
        id,
        null,
        container
    );
      }

        if (action === "back-to-courses") {
            await loadCourses(container);
        }

        if (action === "reload-courses") {
            await loadCourses(container);
        }
    };

    container.onchange = event => {
        const filter = event.target.dataset.filter;

        if (!filter) return;

        courseFilters[filter] = event.target.value;

        renderCourses(container);
    };
}

/* =================================
   CHAPTER MANAGER
================================= */
/* =========================================
   OPEN CHAPTER MANAGER
========================================= */

async function openChapterManager(courseId, container) {
    dashboardContainer = container;

    activeCourse = courses.find(item => item.id === courseId);

    if (!activeCourse) {
        notify("Course could not be found.");
        return;
    }

    showLoading(container, "Loading course chapters...");

    const { data, error } = await supabase
        .from("course_chapters")
        .select("*")
        .eq("course_id", courseId)
        .order("chapter_number");

    if (error) {
        showError(
            container,
            "Unable to load chapters",
            getErrorMessage(error)
        );
        return;
    }

    chapters = data || [];

    renderChapters(container);
}

/* =========================================
   RENDER CHAPTERS
========================================= */

function renderChapters(container) {
    if (!activeCourse) return;

    container.innerHTML = `
        <div class="admin-panel">

            <div class="admin-panel-header">
                <div>
                    <h2>Chapter Manager</h2>

                    <p>
                        ${escapeHTML(activeCourse.course_code)}
                        — ${escapeHTML(activeCourse.course_title)}
                    </p>

                    <p>
                        Create and arrange the chapters
                        that make up this course.
                    </p>
                </div>

                <button
                    type="button"
                    data-action="add-chapter"
                >
                    + Add Chapter
                </button>
            </div>

            <div class="chapter-list">

                ${
                    chapters.length
                    ? chapters.map((chapter, index) => `
                        <div class="chapter-card">

                            <div class="chapter-card-info">

                                <h3>
                                    Chapter ${index + 1}:
                                    ${escapeHTML(chapter.chapter_title)}
                                </h3>

                                <p>
                                    Chapter ${index + 1}
                                </p>

                            </div>

                            <div class="chapter-card-actions">

                                <button
                                    type="button"
                                    data-action="manage-topics"
                                    data-id="${chapter.id}"
                                >
                                    Manage Topics
                                </button>

                                <button
                                    type="button"
                                    data-action="edit-chapter"
                                    data-id="${chapter.id}"
                                >
                                    Edit
                                </button>

                                <button
                                    type="button"
                                    data-action="move-chapter-up"
                                    data-id="${chapter.id}"
                                    ${index === 0 ? "disabled" : ""}
                                >
                                    ↑
                                </button>

                                <button
                                    type="button"
                                    data-action="move-chapter-down"
                                    data-id="${chapter.id}"
                                    ${index === chapters.length - 1 ? "disabled" : ""}
                                >
                                    ↓
                                </button>

                                <button
                                    type="button"
                                    data-action="delete-chapter"
                                    data-id="${chapter.id}"
                                >
                                    Delete
                                </button>

                            </div>

                        </div>
                    `).join("")
                    : `
                        <div class="empty-state">
                            <h3>No chapters yet</h3>
                            <p>
                                Add the first chapter for this course.
                            </p>
                        </div>
                    `
                }

            </div>

            <div class="form-actions">
                <button
                    type="button"
                    data-action="back-to-courses"
                >
                    ← Back to Courses
                </button>
            </div>

        </div>
    `;

    attachChapterEvents(container);
}

/* =========================================
   CHAPTER FORM
========================================= */

function renderChapterForm(container, chapter = null) {
    editingChapterId = chapter?.id || null;

    container.innerHTML = `
        <div class="admin-panel">

            <h2>${chapter ? "Edit Chapter" : "Add Chapter"}</h2>

            <p>
                Course:
                ${escapeHTML(activeCourse?.course_code || "")}
                — ${escapeHTML(activeCourse?.course_title || "")}
            </p>

            <form id="chapterForm">

                <label>Chapter Title</label>

                <input
                    type="text"
                    name="chapter_title"
                    value="${escapeHTML(chapter?.chapter_title || "")}"
                    placeholder="e.g. Introduction to Public Administration"
                    required
                >

                <div class="form-actions">

                    <button type="submit">
                        ${chapter ? "Save Changes" : "Create Chapter"}
                    </button>

                    <button
                        type="button"
                        data-action="back-to-chapters"
                    >
                        Cancel
                    </button>

                </div>

            </form>

        </div>
    `;

    container.querySelector("#chapterForm")
        .addEventListener("submit", saveChapter);
}

/* =========================================
   SAVE CHAPTER
========================================= */

async function saveChapter(event) {
    event.preventDefault();

    if (!activeCourse) return;

    const form = event.currentTarget;
    const title = String(
        new FormData(form).get("chapter_title") || ""
    ).trim();

    if (!title) {
        notify("Enter a chapter title.");
        return;
    }

    const submitButton = form.querySelector(
        'button[type="submit"]'
    );

    submitButton.disabled = true;
    submitButton.textContent = "Saving...";

    let result;

    if (editingChapterId) {
        result = await supabase
            .from("course_chapters")
            .update({
                chapter_title: title,
                updated_at: new Date().toISOString()
            })
            .eq("id", editingChapterId)
            .eq("course_id", activeCourse.id);
    } else {
        const nextNumber = chapters.length
            ? Math.max(...chapters.map(item => item.chapter_number)) + 1
            : 1;

        result = await supabase
            .from("course_chapters")
            .insert({
                course_id: activeCourse.id,
                chapter_number: nextNumber,
                chapter_title: title
            });
    }

    if (result.error) {
        submitButton.disabled = false;
        notify(getErrorMessage(result.error));
        return;
    }

    editingChapterId = null;

    notify("Chapter saved successfully.");

    await openChapterManager(
        activeCourse.id,
        dashboardContainer
    );
}

/* =========================================
   REORDER CHAPTERS
========================================= */

async function reorderChapters(chapterId, direction) {
    const currentIndex = chapters.findIndex(
        item => item.id === chapterId
    );

    if (currentIndex === -1) return;

    const targetIndex = currentIndex + direction;

    if (targetIndex < 0 || targetIndex >= chapters.length) {
        return;
    }

    const reordered = [...chapters];

    const [selected] = reordered.splice(currentIndex, 1);

    reordered.splice(targetIndex, 0, selected);

    const updates = reordered.map((chapter, index) => ({
        id: chapter.id,
        chapter_number: index + 1
    }));

    /*
       Temporary numbers prevent unique-constraint conflicts
       when two chapters exchange positions.
    */

    const temporaryStart =
        Math.max(0, ...chapters.map(item => item.chapter_number)) +
        chapters.length + 10;

    for (let i = 0; i < updates.length; i++) {
        const { error } = await supabase
            .from("course_chapters")
            .update({
                chapter_number: temporaryStart + i
            })
            .eq("id", updates[i].id);

        if (error) {
            notify(
                "Could not prepare chapter ordering: " +
                getErrorMessage(error)
            );

            await openChapterManager(
                activeCourse.id,
                dashboardContainer
            );

            return;
        }
    }

    for (const update of updates) {
        const { error } = await supabase
            .from("course_chapters")
            .update({
                chapter_number: update.chapter_number,
                updated_at: new Date().toISOString()
            })
            .eq("id", update.id);

        if (error) {
            notify(
                "Chapter ordering was not completed: " +
                getErrorMessage(error)
            );

            await openChapterManager(
                activeCourse.id,
                dashboardContainer
            );

            return;
        }
    }

    await openChapterManager(
        activeCourse.id,
        dashboardContainer
    );
}

/* =========================================
   DELETE CHAPTER
========================================= */

async function deleteChapter(chapterId) {
    const chapter = chapters.find(
        item => item.id === chapterId
    );

    if (!chapter) return;

    const confirmed = confirm(
        `Delete "${chapter.chapter_title}" and all its topics? This cannot be undone.`
    );

    if (!confirmed) return;

    const { error } = await supabase
        .from("course_chapters")
        .delete()
        .eq("id", chapterId)
        .eq("course_id", activeCourse.id);

    if (error) {
        notify(getErrorMessage(error));
        return;
    }

    notify("Chapter deleted.");

    await openChapterManager(
        activeCourse.id,
        dashboardContainer
    );
}

/* =========================================
   CHAPTER EVENT HANDLERS
========================================= */

function attachChapterEvents(container) {
    container.onclick = async event => {
        const button = event.target.closest("[data-action]");

        if (!button) return;

        const action = button.dataset.action;
        const id = button.dataset.id;

        if (action === "add-chapter") {
            renderChapterForm(container);
        }

        if (action === "edit-chapter") {
            const chapter = chapters.find(item => item.id === id);

            if (chapter) {
                renderChapterForm(container, chapter);
            }
        }

        if (action === "manage-topics") {
            await openTopicManager(id, container);
        }

        if (action === "move-chapter-up") {
            await reorderChapters(id, -1);
        }

        if (action === "move-chapter-down") {
            await reorderChapters(id, 1);
        }

        if (action === "delete-chapter") {
            await deleteChapter(id);
        }

        if (action === "back-to-chapters") {
            await openChapterManager(
                activeCourse.id,
                container
            );
        }

        if (action === "back-to-courses") {
            await loadCourses(container);
        }
    };
}
/* =========================================
   OPEN TOPIC MANAGER
========================================= */

async function openTopicManager(chapterId, container) {
    dashboardContainer = container;

    activeChapter = chapters.find(
        item => item.id === chapterId
    );

    if (!activeChapter || !activeCourse) {
        notify("Chapter information could not be found.");
        return;
    }

    showLoading(container, "Loading chapter topics...");

    const { data, error } = await supabase
        .from("course_topics")
        .select("*")
        .eq("course_id", activeCourse.id)
        .eq("chapter_id", chapterId)
        .order("topic_number");

    if (error) {
        showError(
            container,
            "Unable to load topics",
            getErrorMessage(error)
        );
        return;
    }

    topics = data || [];

    renderTopics(container);
}

/* =========================================
   AUTOMATIC TOPIC NUMBERING
========================================= */

function getChapterPosition() {
    const index = chapters.findIndex(
        item => item.id === activeChapter?.id
    );

    return index === -1 ? 1 : index + 1;
}

function getTopicLabel(topic, index) {
    const chapterNumber = getChapterPosition();

    return `${chapterNumber}.${index + 1}`;
}

/* =========================================
   RENDER TOPICS
========================================= */

function renderTopics(container) {
    if (!activeChapter || !activeCourse) return;

    const chapterNumber = getChapterPosition();

    container.innerHTML = `
        <div class="admin-panel">

            <div class="admin-panel-header">
                <div>
                    <h2>Topic Manager</h2>

                    <p>
                        ${escapeHTML(activeCourse.course_code)}
                        — ${escapeHTML(activeCourse.course_title)}
                    </p>

                    <p>
                        Chapter ${chapterNumber}:
                        ${escapeHTML(activeChapter.chapter_title)}
                    </p>
                </div>

                <button
                    type="button"
                    data-action="add-topic"
                >
                    + Add Topic
                </button>
            </div>

            <div class="topic-list">

                ${
                    topics.length
                    ? topics.map((topic, index) => `
                        <div class="topic-card">

                            <div class="topic-card-info">

                                <h3>
                                    ${getTopicLabel(topic, index)}
                                    — ${escapeHTML(topic.topic_title)}
                                </h3>

                                <p>
                                    Status:
                                    ${topic.publication_status === "published"
                                        ? "Published"
                                        : "Draft"}
                                </p>

                            </div>

                            <div class="topic-card-actions">

                                <button
                                    type="button"
                                    data-action="edit-topic"
                                    data-id="${topic.id}"
                                >
                                    Edit Topic
                                </button>

                                <button
                                    type="button"
                                    data-action="edit-notes"
                                    data-id="${topic.id}"
                                >
                                    ${topic.content?.html
                                        ? "Edit Notes"
                                        : "Write Notes"}
                                </button>
                                <button
    type="button"
    data-action="manage-topic-materials"
    data-id="${topic.id}"
>
    Manage PDFs
</button>

                                <button
                                    type="button"
                                    data-action="toggle-topic"
                                    data-id="${topic.id}"
                                >
                                    ${topic.publication_status === "published"
                                        ? "Unpublish"
                                        : "Publish"}
                                </button>

                                <button
                                    type="button"
                                    data-action="move-topic-up"
                                    data-id="${topic.id}"
                                    ${index === 0 ? "disabled" : ""}
                                >
                                    ↑
                                </button>

                                <button
                                    type="button"
                                    data-action="move-topic-down"
                                    data-id="${topic.id}"
                                    ${index === topics.length - 1 ? "disabled" : ""}
                                >
                                    ↓
                                </button>

                                <button
                                    type="button"
                                    data-action="delete-topic"
                                    data-id="${topic.id}"
                                >
                                    Delete
                                </button>

                            </div>

                        </div>
                    `).join("")
                    : `
                        <div class="empty-state">
                            <h3>No topics yet</h3>
                            <p>
                                Create the first topic in this chapter.
                            </p>
                        </div>
                    `
                }

            </div>

            <div class="form-actions">

                <button
                    type="button"
                    data-action="back-to-chapters"
                >
                    ← Back to Chapters
                </button>

            </div>

        </div>
    `;

    attachTopicEvents(container);
}

/* =========================================
   TOPIC FORM
========================================= */

function renderTopicForm(container, topic = null) {
    editingTopicId = topic?.id || null;

    container.innerHTML = `
        <div class="admin-panel">

            <h2>${topic ? "Edit Topic" : "Add New Topic"}</h2>

            <p>
                Chapter ${getChapterPosition()}:
                ${escapeHTML(activeChapter?.chapter_title || "")}
            </p>

            <form id="topicForm">

                <label>Topic Title</label>

                <input
                    type="text"
                    name="topic_title"
                    value="${escapeHTML(topic?.topic_title || "")}"
                    placeholder="Enter topic title"
                    required
                >

                <div class="form-actions">

                    <button type="submit">
                        ${topic ? "Save Changes" : "Create Topic"}
                    </button>

                    <button
                        type="button"
                        data-action="back-to-topics"
                    >
                        Cancel
                    </button>

                </div>

            </form>

        </div>
    `;

    container.querySelector("#topicForm")
        .addEventListener("submit", saveTopic);
}

/* =========================================
   SAVE TOPIC
========================================= */

async function saveTopic(event) {
    event.preventDefault();

    if (!activeCourse || !activeChapter) return;

    const form = event.currentTarget;

    const title = String(
        new FormData(form).get("topic_title") || ""
    ).trim();

    if (!title) {
        notify("Enter a topic title.");
        return;
    }

    const submitButton = form.querySelector(
        'button[type="submit"]'
    );

    submitButton.disabled = true;
    submitButton.textContent = "Saving...";

    let result;

    if (editingTopicId) {
        result = await supabase
            .from("course_topics")
            .update({
                topic_title: title,
                updated_at: new Date().toISOString()
            })
            .eq("id", editingTopicId)
            .eq("course_id", activeCourse.id)
            .eq("chapter_id", activeChapter.id);
    } else {
        const nextNumber = topics.length
            ? Math.max(...topics.map(item => item.topic_number)) + 1
            : 1;

        result = await supabase
            .from("course_topics")
            .insert({
                course_id: activeCourse.id,
                chapter_id: activeChapter.id,
                topic_title: title,
                topic_number: nextNumber,
                content: {
                    type: "html",
                    html: ""
                },
                publication_status: "draft"
            });
    }

    if (result.error) {
        submitButton.disabled = false;
        notify(getErrorMessage(result.error));
        return;
    }

    editingTopicId = null;

    notify("Topic saved successfully.");

    await openTopicManager(
        activeChapter.id,
        dashboardContainer
    );
}

/* =========================================
   REORDER TOPICS
========================================= */

async function reorderTopics(topicId, direction) {
    const currentIndex = topics.findIndex(
        item => item.id === topicId
    );

    if (currentIndex === -1) return;

    const targetIndex = currentIndex + direction;

    if (targetIndex < 0 || targetIndex >= topics.length) {
        return;
    }

    const reordered = [...topics];

    const [selected] = reordered.splice(currentIndex, 1);

    reordered.splice(targetIndex, 0, selected);

    const updates = reordered.map((topic, index) => ({
        id: topic.id,
        topic_number: index + 1
    }));

    const temporaryStart =
        Math.max(0, ...topics.map(item => item.topic_number)) +
        topics.length + 10;

    /*
       First assign temporary numbers so the unique
       chapter_id + topic_number constraint is not violated.
    */

    for (let i = 0; i < updates.length; i++) {
        const { error } = await supabase
            .from("course_topics")
            .update({
                topic_number: temporaryStart + i
            })
            .eq("id", updates[i].id)
            .eq("chapter_id", activeChapter.id);

        if (error) {
            notify(
                "Could not prepare topic ordering: " +
                getErrorMessage(error)
            );

            await openTopicManager(
                activeChapter.id,
                dashboardContainer
            );

            return;
        }
    }

    for (const update of updates) {
        const { error } = await supabase
            .from("course_topics")
            .update({
                topic_number: update.topic_number,
                updated_at: new Date().toISOString()
            })
            .eq("id", update.id)
            .eq("chapter_id", activeChapter.id);

        if (error) {
            notify(
                "Topic ordering was not completed: " +
                getErrorMessage(error)
            );

            await openTopicManager(
                activeChapter.id,
                dashboardContainer
            );

            return;
        }
    }

    await openTopicManager(
        activeChapter.id,
        dashboardContainer
    );
}

/* =========================================
   PUBLISH / UNPUBLISH TOPIC
========================================= */

async function toggleTopicPublication(topicId) {
    const topic = topics.find(
        item => item.id === topicId
    );

    if (!topic) return;

    const publishing =
        topic.publication_status !== "published";

    if (publishing && !topic.content?.html?.trim()) {
        notify(
            "Write and save the topic notes before publishing."
        );
        return;
    }

    const newStatus = publishing ? "published" : "draft";

    const confirmed = confirm(
        publishing
            ? "Publish this topic so students can access it?"
            : "Unpublish this topic so students can no longer access it?"
    );

    if (!confirmed) return;

    const { error } = await supabase
        .from("course_topics")
        .update({
            publication_status: newStatus,
            updated_at: new Date().toISOString()
        })
        .eq("id", topicId)
        .eq("course_id", activeCourse.id)
        .eq("chapter_id", activeChapter.id);

    if (error) {
        notify(getErrorMessage(error));
        return;
    }

    notify(
        publishing
            ? "Topic published successfully."
            : "Topic moved back to draft."
    );

    await openTopicManager(
        activeChapter.id,
        dashboardContainer
    );
}

/* =========================================
   DELETE TOPIC
========================================= */

async function deleteTopic(topicId) {
    const topic = topics.find(
        item => item.id === topicId
    );

    if (!topic) return;

    const confirmed = confirm(
        `Delete "${topic.topic_title}" and its notes? This cannot be undone.`
    );

    if (!confirmed) return;

    const { error } = await supabase
        .from("course_topics")
        .delete()
        .eq("id", topicId)
        .eq("course_id", activeCourse.id)
        .eq("chapter_id", activeChapter.id);

    if (error) {
        notify(getErrorMessage(error));
        return;
    }

    notify("Topic deleted.");

    await openTopicManager(
        activeChapter.id,
        dashboardContainer
    );
}

/* =========================================
   TOPIC EVENT HANDLERS
========================================= */

function attachTopicEvents(container) {
    container.onclick = async event => {
        const button = event.target.closest("[data-action]");

        if (!button) return;

        const action = button.dataset.action;
        const id = button.dataset.id;

        if (action === "add-topic") {
            renderTopicForm(container);
        }

        if (action === "edit-topic") {
            const topic = topics.find(item => item.id === id);

            if (topic) {
                renderTopicForm(container, topic);
            }
        }

        if (action === "edit-notes") {
            const topic = topics.find(item => item.id === id);

            if (topic) {
                renderNotesEditor(container, topic);
            }
        }
      if (action === "manage-topic-materials") {
    await openMaterialManager(
        activeCourse.id,
        id,
        container
    );
      }

        if (action === "toggle-topic") {
            await toggleTopicPublication(id);
        }

        if (action === "move-topic-up") {
            await reorderTopics(id, -1);
        }

        if (action === "move-topic-down") {
            await reorderTopics(id, 1);
        }

        if (action === "delete-topic") {
            await deleteTopic(id);
        }

        if (action === "back-to-topics") {
            await openTopicManager(
                activeChapter.id,
                container
            );
        }

        if (action === "back-to-chapters") {
            await openChapterManager(
                activeCourse.id,
                container
            );
        }

        if (action === "back-to-courses") {
            await loadCourses(container);
        }
    };
}
/* =========================================
   NOTES EDITOR — HTML SECURITY
========================================= */

/*
   Only approved formatting elements and attributes
   are retained before notes are saved.
*/

function sanitizeNoteHTML(html) {
    const parser = new DOMParser();

    const documentObject = parser.parseFromString(
        String(html || ""),
        "text/html"
    );

    const allowedTags = new Set([
        "P", "BR",
        "H1", "H2", "H3", "H4",
        "STRONG", "B", "EM", "I", "U",
        "UL", "OL", "LI",
        "BLOCKQUOTE",
        "A",
        "TABLE", "THEAD", "TBODY", "TR", "TH", "TD",
        "IMG",
        "HR"
    ]);

    function cleanNode(node) {
        for (const child of [...node.childNodes]) {
            if (child.nodeType === Node.TEXT_NODE) {
                continue;
            }

            if (child.nodeType !== Node.ELEMENT_NODE) {
                child.remove();
                continue;
            }

            const tag = child.tagName;

            if (!allowedTags.has(tag)) {
                if ([
                    "SCRIPT", "STYLE", "IFRAME",
                    "OBJECT", "EMBED", "FORM",
                    "INPUT", "BUTTON", "VIDEO",
                    "AUDIO", "SVG"
                ].includes(tag)) {
                    child.remove();
                } else {
                    child.replaceWith(...child.childNodes);
                }

                continue;
            }

            const originalAttributes = [...child.attributes];

            originalAttributes.forEach(attribute => {
                child.removeAttribute(attribute.name);
            });

            if (tag === "A") {
                const href = child.getAttribute("href") ||
                    originalAttributes.find(
                        item => item.name.toLowerCase() === "href"
                    )?.value;

                if (href && /^https:\/\//i.test(href)) {
                    child.setAttribute("href", href);
                    child.setAttribute("target", "_blank");
                    child.setAttribute("rel", "noopener noreferrer");
                }
            }

            if (tag === "IMG") {
                const src = originalAttributes.find(
                    item => item.name.toLowerCase() === "src"
                )?.value;

                const alt = originalAttributes.find(
                    item => item.name.toLowerCase() === "alt"
                )?.value || "";

                if (src && /^https:\/\//i.test(src)) {
                    child.setAttribute("src", src);
                    child.setAttribute("alt", alt);
                    child.setAttribute("loading", "lazy");
                } else {
                    child.remove();
                    continue;
                }
            }

            cleanNode(child);
        }
    }

    cleanNode(documentObject.body);

    return documentObject.body.innerHTML;
}

/* =========================================
   NOTES EDITOR
========================================= */

function renderNotesEditor(container, topic) {
    editingTopicId = topic.id;

    const savedHTML = sanitizeNoteHTML(
        topic.content?.html || ""
    );

    const topicIndex = topics.findIndex(
        item => item.id === topic.id
    );

    const topicLabel = getTopicLabel(
        topic,
        topicIndex
    );

    container.innerHTML = `
        <div class="admin-panel notes-editor-panel">

            <div class="admin-panel-header">
                <div>
                    <h2>Lecture Notes Editor</h2>

                    <p>
                        ${escapeHTML(activeCourse.course_code)}
                        — ${escapeHTML(activeCourse.course_title)}
                    </p>

                    <p>
                        Chapter ${getChapterPosition()}:
                        ${escapeHTML(activeChapter.chapter_title)}
                    </p>

                    <p>
                        Topic ${topicLabel}:
                        ${escapeHTML(topic.topic_title)}
                    </p>
                </div>
            </div>

            <div class="notes-editor-status">
                Current status:
                <strong>
                    ${topic.publication_status === "published"
                        ? "Published"
                        : "Draft"}
                </strong>
            </div>

            <div class="notes-toolbar">

                <button type="button" data-command="bold">
                    <b>B</b>
                </button>

                <button type="button" data-command="italic">
                    <i>I</i>
                </button>

                <button type="button" data-command="underline">
                    <u>U</u>
                </button>

                <button type="button" data-command="formatBlock" data-value="H1">
                    H1
                </button>

                <button type="button" data-command="formatBlock" data-value="H2">
                    H2
                </button>

                <button type="button" data-command="formatBlock" data-value="H3">
                    H3
                </button>

                <button type="button" data-command="formatBlock" data-value="P">
                    Paragraph
                </button>

                <button type="button" data-command="insertUnorderedList">
                    • List
                </button>

                <button type="button" data-command="insertOrderedList">
                    1. List
                </button>

                <button type="button" data-command="formatBlock" data-value="BLOCKQUOTE">
                    Quote
                </button>

                <button type="button" data-action="insert-link">
                    Link
                </button>

                <button type="button" data-action="insert-image">
                    Image
                </button>

                <button type="button" data-action="insert-table">
                    Table
                </button>

                <button type="button" data-command="insertHorizontalRule">
                    Divider
                </button>

            </div>

            <div
                id="notesEditor"
                class="notes-editor"
                contenteditable="true"
                spellcheck="true"
            >${savedHTML}</div>

            <div class="notes-editor-help">
                Use the toolbar to format your notes.
                You can also paste formatted text into the editor.
            </div>

            <div class="form-actions">

                <button
                    type="button"
                    data-action="save-note-draft"
                >
                    Save Draft
                </button>

                <button
                    type="button"
                    data-action="publish-note"
                >
                    Save and Publish
                </button>

                <button
                    type="button"
                    data-action="back-to-topics"
                >
                    Back to Topics
                </button>

            </div>

        </div>
    `;

    attachNotesEditorEvents(container);
}

/* =========================================
   NOTES EDITOR TOOLBAR
========================================= */

function attachNotesEditorEvents(container) {
    const editor = container.querySelector("#notesEditor");

    if (!editor) return;

    container.onclick = async event => {
        const button = event.target.closest("[data-action], [data-command]");

        if (!button) return;

        const action = button.dataset.action;
        const command = button.dataset.command;
        const value = button.dataset.value;

        if (command) {
            editor.focus();

            if (command === "formatBlock") {
                document.execCommand(
                    command,
                    false,
                    `<${value}>`
                );
            } else {
                document.execCommand(
                    command,
                    false,
                    null
                );
            }

            return;
        }

        if (action === "insert-link") {
            editor.focus();

            const url = prompt(
                "Enter the full HTTPS link:"
            );

            if (!url) return;

            if (!/^https:\/\//i.test(url.trim())) {
                notify("Only HTTPS links are allowed.");
                return;
            }

            const linkText = prompt(
                "Enter the text to display for this link:",
                url
            );

            if (!linkText) return;

            document.execCommand(
                "insertHTML",
                false,
                `<a href="${escapeHTML(url.trim())}" target="_blank" rel="noopener noreferrer">${escapeHTML(linkText)}</a>`
            );
        }

        if (action === "insert-image") {
            editor.focus();

            const imageURL = prompt(
                "Enter the full HTTPS image URL:"
            );

            if (!imageURL) return;

            if (!/^https:\/\//i.test(imageURL.trim())) {
                notify("Only HTTPS image links are allowed.");
                return;
            }

            document.execCommand(
                "insertHTML",
                false,
                `<img src="${escapeHTML(imageURL.trim())}" alt="Lecture note illustration">`
            );
        }

        if (action === "insert-table") {
            editor.focus();

            const rows = Number(
                prompt("How many rows? (1–10)", "3")
            );

            const columns = Number(
                prompt("How many columns? (1–6)", "2")
            );

            if (
                !Number.isInteger(rows) ||
                !Number.isInteger(columns) ||
                rows < 1 ||
                rows > 10 ||
                columns < 1 ||
                columns > 6
            ) {
                notify("Enter valid table dimensions.");
                return;
            }

            let tableHTML = `
                <table>
                    <tbody>
            `;

            for (let row = 0; row < rows; row++) {
                tableHTML += "<tr>";

                for (let column = 0; column < columns; column++) {
                    tableHTML += row === 0
                        ? "<th>Heading</th>"
                        : "<td>Content</td>";
                }

                tableHTML += "</tr>";
            }

            tableHTML += `
                    </tbody>
                </table>
                <p></p>
            `;

            document.execCommand(
                "insertHTML",
                false,
                tableHTML
            );
        }

        if (action === "save-note-draft") {
            await saveTopicNotes("draft");
        }

        if (action === "publish-note") {
            await saveTopicNotes("published");
        }

        if (action === "back-to-topics") {
            await openTopicManager(
                activeChapter.id,
                dashboardContainer
            );
        }
    };
}

/* =========================================
   SAVE TOPIC NOTES
========================================= */


async function saveTopicNotes(status) {
    if (!editingTopicId || !activeCourse || !activeChapter) {
        notify("Topic information is missing.");
        return;
    }

    const editor = dashboardContainer.querySelector(
        "#notesEditor"
    );

    if (!editor) {
        notify("Notes editor could not be found.");
        return;
    }

    const cleanHTML = sanitizeNoteHTML(editor.innerHTML);

    if (!cleanHTML.trim()) {
        notify("Write some notes before saving.");
        return;
    }

    if (
        status === "published" &&
        !confirm("Publish these notes for students?")
    ) {
        return;
    }

    const buttons = dashboardContainer.querySelectorAll(
        ".notes-editor-panel button"
    );

    buttons.forEach(button => {
        button.disabled = true;
    });

    try {
        const { data, error } = await supabase
            .from("course_topics")
            .update({
                content: {
                    type: "html",
                    html: cleanHTML
                },
                publication_status: status,
                updated_at: new Date().toISOString()
            })
            .eq("id", editingTopicId)
            .eq("course_id", activeCourse.id)
            .eq("chapter_id", activeChapter.id)
            .select("id, content, publication_status")
            .maybeSingle();

        if (error) {
            throw error;
        }

        if (!data) {
            throw new Error(
                "No topic was updated. The topic ID or chapter information did not match, or the database denied the update."
            );
        }

        notify(
            status === "published"
                ? "Notes updated and published successfully."
                : "Notes updated and saved as a draft."
        );

        await openTopicManager(
            activeChapter.id,
            dashboardContainer
        );

    } catch (error) {
        console.error("Notes update failed:", error);

        notify(
            "Could not save notes: " +
            getErrorMessage(error)
        );

    } finally {
        buttons.forEach(button => {
            button.disabled = false;
        });
    }
}

/* =========================================
   PDF MATERIALS — UPLOAD FOUNDATION
========================================= */

const MATERIALS_BUCKET = "course-materials";
const MAX_PDF_SIZE = 20 * 1024 * 1024;

async function uploadCourseMaterial({
    courseId,
    topicId = null,
    title,
    file
}) {
    if (!courseId || !title?.trim() || !file) {
        throw new Error("Complete the material details first.");
    }

    if (file.type !== "application/pdf") {
        throw new Error("Only PDF documents are allowed.");
    }

    if (file.size > MAX_PDF_SIZE) {
        throw new Error("The PDF must not exceed 20 MB.");
    }

    const safeFileName = file.name.replace(
        /[^a-zA-Z0-9._-]/g,
        "_"
    );

    const storagePath = [
        courseId,
        topicId || "course",
        `${crypto.randomUUID()}-${safeFileName}`
    ].join("/");

    const { error: uploadError } = await supabase
        .storage
        .from(MATERIALS_BUCKET)
        .upload(storagePath, file, {
            contentType: "application/pdf",
            upsert: false
        });

    if (uploadError) {
        throw uploadError;
    }

    const { data, error: recordError } = await supabase
        .from("course_materials")
        .insert({
            course_id: courseId,
            topic_id: topicId,
            material_title: title.trim(),
            file_name: file.name,
            storage_path: storagePath,
            file_type: "application/pdf",
            file_size: file.size
        })
        .select()
        .single();

    if (recordError) {
        await supabase
            .storage
            .from(MATERIALS_BUCKET)
            .remove([storagePath]);

        throw recordError;
    }

    return data;
}
/* =========================================
   PDF MATERIALS — MANAGEMENT SCREEN
========================================= */

async function openMaterialManager(courseId, topicId, container) {
    dashboardContainer = container;

    const course = courses.find(item => item.id === courseId);

    if (!course) {
        notify("Course information could not be found.");
        return;
    }

    const topic = topicId
        ? topics.find(item => item.id === topicId)
        : null;

    showLoading(container, "Loading PDF materials...");

    let query = supabase
        .from("course_materials")
        .select("*")
        .eq("course_id", courseId);

    query = topicId
        ? query.eq("topic_id", topicId)
        : query.is("topic_id", null);

    const { data, error } = await query
        .order("created_at", { ascending: false });

    if (error) {
        showError(
            container,
            "Unable to load PDF materials",
            getErrorMessage(error)
        );
        return;
    }

    const materials = data || [];
    const details = getCourseDetails(course);

    const materialCards = await Promise.all(
        materials.map(async material => {
            const { data: signedData, error: signedError } =
                await supabase
                    .storage
                    .from(MATERIALS_BUCKET)
                    .createSignedUrl(material.storage_path, 3600);

            const fileSize = material.file_size
                ? (material.file_size / (1024 * 1024)).toFixed(2) + " MB"
                : "PDF document";

            return `
                <div class="course-pdf-card">

                    <div class="course-pdf-card-icon">
                        <span>PDF</span>
                    </div>

                    <div class="course-pdf-card-content">
                        <h3>
                            ${escapeHTML(material.material_title)}
                        </h3>

                        <p class="course-pdf-file-name">
                            ${escapeHTML(material.file_name)}
                        </p>

                        <span class="course-pdf-file-size">
                            ${escapeHTML(fileSize)}
                        </span>
                    </div>

                    <div class="course-pdf-card-actions">

                        ${
                            signedError || !signedData?.signedUrl
                                ? `<span class="course-pdf-unavailable">Preview unavailable</span>`
                                : `
                                    <a
                                        class="course-pdf-open"
                                        href="${escapeHTML(signedData.signedUrl)}"
                                        target="_blank"
                                        rel="noopener"
                                    >
                                        Open PDF
                                    </a>
                                `
                        }

                        <button
                            type="button"
                            class="course-pdf-delete"
                            data-action="delete-material"
                            data-id="${material.id}"
                        >
                            Delete
                        </button>

                    </div>

                </div>
            `;
        })
    );

    container.innerHTML = `
        <div class="course-pdf-manager">

            <div class="course-pdf-header">

                <div>
                    <span class="course-pdf-eyebrow">
                        COURSE CONTENT
                    </span>

                    <h2>PDF Materials</h2>

                    <p class="course-pdf-course-name">
                        ${escapeHTML(course.course_code)}
                        — ${escapeHTML(course.course_title)}
                    </p>

                    <p class="course-pdf-course-details">
                        ${escapeHTML(details.level)}
                        · ${escapeHTML(details.semester)}
                        · ${escapeHTML(details.session)}
                    </p>

                    <span class="course-pdf-location">
                        ${
                            topic
                                ? "Topic: " + escapeHTML(topic.topic_title)
                                : "Course-level materials"
                        }
                    </span>
                </div>

                <button
                    type="button"
                    class="course-pdf-back"
                    data-action="back-to-material-parent"
                >
                    ← Back
                </button>

            </div>

            <div class="course-pdf-upload-card">

                <div class="course-pdf-upload-heading">
                    <div>
                        <span class="course-pdf-eyebrow">
                            MATERIAL MANAGEMENT
                        </span>

                        <h3>Upload a PDF</h3>

                        <p>
                            Add lecture notes, handouts or other course
                            documents for students.
                        </p>
                    </div>

                    <div class="course-pdf-upload-icon">
                        +
                    </div>
                </div>

                <div class="course-pdf-form-group">
                    <label for="materialTitle">
                        Document title
                    </label>

                    <input
                        type="text"
                        id="materialTitle"
                        placeholder="e.g. Introduction to Public Administration"
                        maxlength="150"
                    >
                </div>

                <div class="course-pdf-form-group">
                    <label for="materialFile">
                        Select PDF document
                    </label>

                    <input
                        type="file"
                        id="materialFile"
                        accept="application/pdf,.pdf"
                    >

                    <p class="course-pdf-file-hint">
                        PDF files only. Maximum file size: 20 MB.
                    </p>

                    <div
                        id="materialFileDetails"
                        class="course-pdf-file-details"
                    >
                        No file selected.
                    </div>
                </div>

                <div
                    id="materialUploadStatus"
                    class="course-pdf-status"
                    role="status"
                    aria-live="polite"
                ></div>

                <button
                    type="button"
                    class="course-pdf-upload-button"
                    data-action="upload-material"
                >
                    Upload PDF
                </button>

            </div>

            <div class="course-pdf-library-heading">
                <div>
                    <h3>Uploaded PDFs</h3>
                    <p>Documents currently available in this section.</p>
                </div>

                <span class="course-pdf-count">
                    ${materials.length}
                </span>
            </div>

            <div class="course-pdf-list">

                ${
                    materialCards.length
                        ? materialCards.join("")
                        : `
                            <div class="course-pdf-empty">
                                <div class="course-pdf-empty-icon">
                                    PDF
                                </div>

                                <h3>No PDFs uploaded yet</h3>

                                <p>
                                    Uploaded documents will appear here.
                                </p>
                            </div>
                        `
                }

            </div>

        </div>
    `;

    const fileInput = container.querySelector("#materialFile");

    fileInput?.addEventListener("change", () => {
        const file = fileInput.files?.[0];
        const detailsBox = container.querySelector(
            "#materialFileDetails"
        );
        const statusBox = container.querySelector(
            "#materialUploadStatus"
        );

        if (!file) {
            detailsBox.textContent = "No file selected.";
            statusBox.textContent = "";
            statusBox.className = "course-pdf-status";
            return;
        }

        const sizeMB = file.size / (1024 * 1024);

        detailsBox.textContent =
            file.name + " · " + sizeMB.toFixed(2) + " MB";

        if (
            file.type !== "application/pdf" &&
            !file.name.toLowerCase().endsWith(".pdf")
        ) {
            statusBox.textContent =
                "Invalid file. Please select a PDF document.";

            statusBox.className =
                "course-pdf-status error";

            return;
        }

        if (sizeMB > 20) {
            statusBox.textContent =
                "This file exceeds the 20 MB upload limit.";

            statusBox.className =
                "course-pdf-status error";

            return;
        }

        statusBox.textContent = "";
        statusBox.className = "course-pdf-status";
    });

    attachMaterialEvents(
        container,
        courseId,
        topicId
    );
}

/* =========================================
   PDF MATERIALS — BUTTON EVENTS
========================================= */

function attachMaterialEvents(container, courseId, topicId) {
    container.onclick = async event => {
        const button = event.target.closest("[data-action]");

        if (!button) return;

        const action = button.dataset.action;

        if (action === "back-to-material-parent") {
            if (topicId) {
                await openTopicManager(
                    activeChapter.id,
                    container
                );
            } else {
                await loadCourses(container);
            }

            return;
        }

        if (action === "upload-material") {
            const titleInput = container.querySelector(
                "#materialTitle"
            );

            const fileInput = container.querySelector(
                "#materialFile"
            );

            const statusBox = container.querySelector(
                "#materialUploadStatus"
            );

            const title = titleInput?.value.trim();
            const file = fileInput?.files?.[0];

            const showStatus = (message, type = "") => {
                if (!statusBox) return;

                statusBox.textContent = message;
                statusBox.className =
                    "course-pdf-status " + type;
            };

            if (!title || !file) {
                showStatus(
                    "Enter a document title and select a PDF file.",
                    "error"
                );
                return;
            }

            const isPDF =
                file.type === "application/pdf" ||
                file.name.toLowerCase().endsWith(".pdf");

            if (!isPDF) {
                showStatus(
                    "Invalid file. Please select a PDF document.",
                    "error"
                );
                return;
            }

            if (file.size > 20 * 1024 * 1024) {
                showStatus(
                    "File is too large. Maximum size is 20 MB.",
                    "error"
                );
                return;
            }

            button.disabled = true;
            button.textContent = "Uploading...";
            button.classList.add("uploading");

            showStatus(
                "Uploading your PDF. Please wait...",
                "loading"
            );

            try {
                await uploadCourseMaterial({
                    courseId,
                    topicId,
                    title,
                    file
                });

                notify("PDF uploaded successfully.");

                await openMaterialManager(
                    courseId,
                    topicId,
                    container
                );

            } catch (error) {
                console.error("PDF upload failed:", error);

                showStatus(
                    "Upload failed: " + getErrorMessage(error),
                    "error"
                );

                button.disabled = false;
                button.textContent = "Upload PDF";
                button.classList.remove("uploading");
            }

            return;
        }

        if (action === "delete-material") {
            const materialId = button.dataset.id;

            if (!confirm("Delete this PDF permanently?")) {
                return;
            }

            button.disabled = true;
            button.textContent = "Deleting...";

            try {
                const { data: material, error: fetchError } =
                    await supabase
                        .from("course_materials")
                        .select("storage_path")
                        .eq("id", materialId)
                        .single();

                if (fetchError) throw fetchError;

                const { error: storageError } = await supabase
                    .storage
                    .from(MATERIALS_BUCKET)
                    .remove([material.storage_path]);

                if (storageError) throw storageError;

                const { error: deleteError } = await supabase
                    .from("course_materials")
                    .delete()
                    .eq("id", materialId);

                if (deleteError) throw deleteError;

                notify("PDF deleted successfully.");

                await openMaterialManager(
                    courseId,
                    topicId,
                    container
                );

            } catch (error) {
                console.error("PDF deletion failed:", error);

                notify(
                    "Could not delete PDF: " +
                    getErrorMessage(error)
                );

                button.disabled = false;
                button.textContent = "Delete";
            }
        }
    };
}
