import { supabase } from "./config.js";

/* =========================================
   STUDENT COURSE LIBRARY
========================================= */

let libraryContainer = null;

let academicLevels = [];
let academicSemesters = [];
let academicSessions = [];
let availableCourses = [];

let selectedLevel = null;
let selectedSemester = null;
let selectedSession = null;

let activeCourse = null;
let activeChapter = null;


/* =========================================
   HELPERS
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


function showLibraryMessage(message) {
    libraryContainer.innerHTML = `
        <div class="admin-panel">
            <p class="admin-placeholder">
                ${escapeHTML(message)}
            </p>
        </div>
    `;
}


function showLibraryError(error) {
    console.error("Student course library error:", error);

    showLibraryMessage(
        error?.message || "Unable to load this academic resource. Please try again."
    );
}


function getLevelName(levelId) {
    const level = academicLevels.find(
        item => String(item.id) === String(levelId)
    );

    return level?.level_name || "Academic Level";
}


function getSemesterName(semesterId) {
    const semester = academicSemesters.find(
        item => String(item.id) === String(semesterId)
    );

    return semester?.semester_name || "Semester";
}


function getSessionName(sessionId) {
    const session = academicSessions.find(
        item => String(item.id) === String(sessionId)
    );

    return session?.session_name || "Academic Session";
}


function getSelectedCourse() {
    return availableCourses.find(
        course => course.id === activeCourse
    );
}
/* =========================================
   STUDENT PDF MATERIALS HELPER
========================================= */

async function loadPDFMaterials(courseId, topicId = null) {

    let query = supabase
        .from("course_materials")
        .select("*")
        .eq("course_id", courseId)
        .order("created_at", {
            ascending: false
        });


    if (topicId) {

        query = query.eq("topic_id", topicId);

    } else {

        query = query.is("topic_id", null);

    }


    const { data: materials, error } = await query;


    if (error) throw error;


    if (!materials || materials.length === 0) {

        return `
            <div class="student-material-empty">
                <p>No PDF materials available here yet.</p>
            </div>
        `;

    }


    const materialCards = await Promise.all(
        materials.map(async material => {

            const { data, error: urlError } = await supabase
                .storage
                .from("course-materials")
                .createSignedUrl(material.storage_path, 3600);


            if (urlError) {

                console.error(
                    "PDF signed URL error:",
                    urlError
                );

                return `
                    <div class="student-material-card">
                        <strong>
                            ${escapeHTML(material.material_title)}
                        </strong>

                        <p>Unable to open this PDF right now.</p>
                    </div>
                `;

            }


            return `
                <div class="student-material-card">

                    <div class="student-material-info">

                        <span class="student-material-file-label">
                            PDF DOCUMENT
                        </span>

                        <strong>
                            ${escapeHTML(material.material_title)}
                        </strong>

                        <span>
                            ${escapeHTML(material.file_name)}
                        </span>

                    </div>

                    <a
                        href="${escapeHTML(data.signedUrl)}"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="student-material-open"
                    >
                        Open PDF →
                    </a>

                </div>
            `;

        })
    );


    return `
        <div class="student-material-list">
            ${materialCards.join("")}
        </div>
    `;

}

/* =========================================
   LOAD ACADEMIC INFORMATION
========================================= */

async function loadAcademicInformation() {

    const [
        levelsResult,
        semestersResult,
        sessionsResult
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
            .order("session_name", {
                ascending: false
            })

    ]);


    if (levelsResult.error) throw levelsResult.error;
    if (semestersResult.error) throw semestersResult.error;
    if (sessionsResult.error) throw sessionsResult.error;


    academicLevels = levelsResult.data || [];
    academicSemesters = semestersResult.data || [];
    academicSessions = sessionsResult.data || [];


    if (!selectedLevel && academicLevels.length) {
        selectedLevel = academicLevels[0].id;
    }

    if (!selectedSemester && academicSemesters.length) {
        selectedSemester = academicSemesters[0].id;
    }

    const currentSession = academicSessions.find(
        session => session.is_current === true
    );

    if (!selectedSession) {
        selectedSession = currentSession?.id ||
            academicSessions[0]?.id ||
            null;
    }
}


/* =========================================
   LOAD COURSES
========================================= */

async function loadAvailableCourses() {

    if (!selectedLevel || !selectedSemester || !selectedSession) {
        availableCourses = [];
        return;
    }


    const { data, error } = await supabase
        .from("courses")
        .select("*")
        .eq("is_active", true)
        .eq("academic_level_id", selectedLevel)
        .eq("semester_id", selectedSemester)
        .eq("academic_session_id", selectedSession)
        .order("course_code", {
            ascending: true
        });


    if (error) throw error;

    availableCourses = data || [];
}


/* =========================================
   COURSE LIBRARY SCREEN
========================================= */

async function renderCourseLibrary() {

    showLibraryMessage("Loading your courses...");

    activeCourse = null;
    activeChapter = null;


    try {

        await loadAvailableCourses();


        const levelOptions = academicLevels.map(level => `
            <option
                value="${level.id}"
                ${String(level.id) === String(selectedLevel) ? "selected" : ""}
            >
                ${escapeHTML(level.level_name)}
            </option>
        `).join("");


        const semesterOptions = academicSemesters.map(semester => `
            <option
                value="${semester.id}"
                ${String(semester.id) === String(selectedSemester) ? "selected" : ""}
            >
                ${escapeHTML(semester.semester_name)}
            </option>
        `).join("");


        const sessionOptions = academicSessions.map(session => `
            <option
                value="${session.id}"
                ${String(session.id) === String(selectedSession) ? "selected" : ""}
            >
                ${escapeHTML(session.session_name)}
                ${session.is_current ? " (Current)" : ""}
            </option>
        `).join("");


        const courseCards = availableCourses.length
            ? availableCourses.map(course => `
                <button
                    type="button"
                    class="student-course-card"
                    data-course-id="${escapeHTML(course.id)}"
                >
                    <span class="student-course-code">
                        ${escapeHTML(course.course_code)}
                    </span>

                    <strong>
                        ${escapeHTML(course.course_title)}
                    </strong>

                    <span>
                        ${escapeHTML(getLevelName(course.academic_level_id))}
                        ·
                        ${escapeHTML(getSemesterName(course.semester_id))}
                    </span>

                    <span class="student-course-open">
                        Open Course →
                    </span>
                </button>
            `).join("")
            : `
                <div class="admin-panel">
                    <p class="admin-placeholder">
                        No courses have been published for this
                        level, session and semester yet.
                    </p>
                </div>
            `;


        libraryContainer.innerHTML = `

            <div class="admin-welcome">
                <div>
                    <span class="admin-section-eyebrow">
                        ACADEMIC RESOURCES
                    </span>

                    <h2>Course Library</h2>

                    <p>
                        Explore your Public Administration courses
                        across all academic levels.
                    </p>
                </div>
            </div>


            <div class="admin-panel student-course-filter-panel">

                <div class="admin-panel-heading">
                    <h3>Browse Courses</h3>
                </div>

                <div class="student-course-filters">

                    <label>
                        Academic Level

                        <select id="studentLevelFilter">
                            ${levelOptions}
                        </select>
                    </label>


                    <label>
                        Academic Session

                        <select id="studentSessionFilter">
                            ${sessionOptions}
                        </select>
                    </label>


                    <label>
                        Semester

                        <select id="studentSemesterFilter">
                            ${semesterOptions}
                        </select>
                    </label>

                </div>

            </div>


            <div class="student-course-library-heading">
                <div>
                    <span class="admin-section-eyebrow">
                        ${escapeHTML(getSessionName(selectedSession))}
                    </span>

                    <h3>
                        ${escapeHTML(getLevelName(selectedLevel))}
                        ·
                        ${escapeHTML(getSemesterName(selectedSemester))}
                    </h3>
                </div>

                <span>
                    ${availableCourses.length}
                    ${availableCourses.length === 1 ? "Course" : "Courses"}
                </span>
            </div>


            <div class="student-course-grid">
                ${courseCards}
            </div>

        `;


        attachLibraryEvents();

    } catch (error) {

        showLibraryError(error);

    }
}


/* =========================================
   COURSE FILTER EVENTS
========================================= */

function attachLibraryEvents() {

    const levelFilter =
        libraryContainer.querySelector("#studentLevelFilter");

    const sessionFilter =
        libraryContainer.querySelector("#studentSessionFilter");

    const semesterFilter =
        libraryContainer.querySelector("#studentSemesterFilter");


    levelFilter?.addEventListener("change", async event => {

        selectedLevel = event.target.value;

        await renderCourseLibrary();

    });


    sessionFilter?.addEventListener("change", async event => {

        selectedSession = event.target.value;

        await renderCourseLibrary();

    });


    semesterFilter?.addEventListener("change", async event => {

        selectedSemester = event.target.value;

        await renderCourseLibrary();

    });


    libraryContainer
        .querySelectorAll("[data-course-id]")
        .forEach(button => {

            button.addEventListener("click", async () => {

                activeCourse = button.dataset.courseId;

                await renderCourseDetails();

            });

        });

}
/* =========================================
   OPEN A COURSE
========================================= */

async function renderCourseDetails() {

    const course = getSelectedCourse();

    if (!course) {
        await renderCourseLibrary();
        return;
    }


    showLibraryMessage("Loading course chapters...");


    try {

        const { data: chapters, error } = await supabase
            .from("course_chapters")
            .select("*")
            .eq("course_id", course.id)
            .order("chapter_number", {
                ascending: true
            });


        if (error) throw error;

const coursePDFs = await loadPDFMaterials(
    course.id,
    null
);
        const chapterCards = chapters?.length
            ? chapters.map(chapter => `
                <button
                    type="button"
                    class="student-chapter-card"
                    data-chapter-id="${escapeHTML(chapter.id)}"
                >
                    <span>
                        Chapter ${escapeHTML(chapter.chapter_number)}
                    </span>

                    <strong>
                        ${escapeHTML(chapter.chapter_title)}
                    </strong>

                    <span>Open Chapter →</span>
                </button>
            `).join("")
            : `
                <div class="admin-panel">
                    <p class="admin-placeholder">
                        No chapters have been published for this course yet.
                    </p>
                </div>
            `;


        libraryContainer.innerHTML = `

            <button
                type="button"
                class="admin-action-button"
                data-library-back="courses"
            >
                ← Back to Courses
            </button>


            <div class="admin-welcome">
                <div>
                    <span class="admin-section-eyebrow">
                        ${escapeHTML(course.course_code)}
                    </span>

                    <h2>${escapeHTML(course.course_title)}</h2>

                    <p>
                        ${escapeHTML(getLevelName(course.academic_level_id))}
                        ·
                        ${escapeHTML(getSessionName(course.academic_session_id))}
                        ·
                        ${escapeHTML(getSemesterName(course.semester_id))}
                    </p>
                </div>
            </div>

<div class="admin-panel student-course-materials-panel">

    <div class="admin-panel-heading">
        <h3>Course Lecture Materials</h3>
    </div>

    ${coursePDFs}

</div>
            <div class="student-course-library-heading">
                <h3>Course Chapters</h3>

                <span>
                    ${chapters?.length || 0}
                    ${chapters?.length === 1 ? "Chapter" : "Chapters"}
                </span>
            </div>


            <div class="student-chapter-list">
                ${chapterCards}
            </div>

        `;


        libraryContainer
            .querySelector('[data-library-back="courses"]')
            .addEventListener("click", renderCourseLibrary);


        libraryContainer
            .querySelectorAll("[data-chapter-id]")
            .forEach(button => {

                button.addEventListener("click", async () => {

                    activeChapter = button.dataset.chapterId;

                    await renderChapterDetails();

                });

            });

    } catch (error) {

        showLibraryError(error);

    }
}


/* =========================================
   OPEN A CHAPTER
========================================= */

async function renderChapterDetails() {

    const course = getSelectedCourse();

    if (!course || !activeChapter) {
        await renderCourseDetails();
        return;
    }


    showLibraryMessage("Loading published topics...");


    try {

        const { data: chapter, error: chapterError } = await supabase
            .from("course_chapters")
            .select("*")
            .eq("id", activeChapter)
            .eq("course_id", course.id)
            .single();


        if (chapterError) throw chapterError;


        const { data: topics, error: topicsError } = await supabase
            .from("course_topics")
            .select("*")
            .eq("chapter_id", activeChapter)
            .eq("publication_status", "published")
            .order("topic_number", {
                ascending: true
            });


        if (topicsError) throw topicsError;


        const topicCards = topics?.length
            ? topics.map((topic, index) => `
                <button
                    type="button"
                    class="student-topic-card"
                    data-topic-id="${escapeHTML(topic.id)}"
                >
                    <span>
                        Topic ${escapeHTML(chapter.chapter_number)}.${index + 1}
                    </span>

                    <strong>
                        ${escapeHTML(topic.topic_title)}
                    </strong>

                    <span>Read Notes →</span>
                </button>
            `).join("")
            : `
                <div class="admin-panel">
                    <p class="admin-placeholder">
                        No published topics are available in this chapter yet.
                    </p>
                </div>
            `;


        libraryContainer.innerHTML = `

            <button
                type="button"
                class="admin-action-button"
                data-library-back="course"
            >
                ← Back to Chapters
            </button>


            <div class="admin-welcome">
                <div>
                    <span class="admin-section-eyebrow">
                        ${escapeHTML(course.course_code)}
                    </span>

                    <h2>
                        Chapter ${escapeHTML(chapter.chapter_number)}
                    </h2>

                    <p>${escapeHTML(chapter.chapter_title)}</p>
                </div>
            </div>


            <div class="student-course-library-heading">
                <h3>Published Topics</h3>

                <span>
                    ${topics?.length || 0}
                    ${(topics?.length || 0) === 1 ? "Topic" : "Topics"}
                </span>
            </div>


            <div class="student-topic-list">
                ${topicCards}
            </div>

        `;


        libraryContainer
            .querySelector('[data-library-back="course"]')
            .addEventListener("click", renderCourseDetails);


        libraryContainer
            .querySelectorAll("[data-topic-id]")
            .forEach(button => {

                button.addEventListener("click", async () => {

                    await renderTopicNotes(button.dataset.topicId);

                });

            });

    } catch (error) {

        showLibraryError(error);

    }
}


/* =========================================
   SANITISE PUBLISHED NOTES
========================================= */

function cleanPublishedHTML(html) {

    const parser = new DOMParser();

    const documentCopy = parser.parseFromString(
        html || "",
        "text/html"
    );


    const allowedTags = new Set([
        "P", "DIV", "SPAN",
        "H1", "H2", "H3", "H4",
        "STRONG", "B", "EM", "I", "U",
        "UL", "OL", "LI",
        "BLOCKQUOTE",
        "A", "IMG",
        "TABLE", "THEAD", "TBODY",
        "TR", "TH", "TD",
        "HR", "BR"
    ]);


    const dangerousTags = new Set([
        "SCRIPT", "STYLE", "IFRAME",
        "OBJECT", "EMBED", "FORM",
        "INPUT", "VIDEO", "AUDIO",
        "SVG", "MATH"
    ]);


    function cleanNode(parent) {

        [...parent.children].forEach(child => {

            const tag = child.tagName;


            if (dangerousTags.has(tag)) {
                child.remove();
                return;
            }


            cleanNode(child);


            if (!allowedTags.has(tag)) {

                child.replaceWith(
                    ...child.childNodes
                );

                return;

            }


            [...child.attributes].forEach(attribute => {

                child.removeAttribute(attribute.name);

            });


            if (tag === "A") {

                const originalHref =
                    child.getAttribute("href");

                if (originalHref) {
                    child.setAttribute("href", originalHref);
                }

            }

        });

    }


    // Rebuild safe links and images from their original values.
    function sanitiseElement(element) {

        [...element.querySelectorAll("*")].forEach(node => {

            if (node.tagName === "A") {

                const href = node.getAttribute("href");

                if (href) {

                    const safeURL = /^https:\/\//i.test(href);

                    if (safeURL) {
                        node.setAttribute("href", href);
                        node.setAttribute("target", "_blank");
                        node.setAttribute("rel", "noopener noreferrer");
                    }

                }

            }

        });

    }


    // Keep a copy of permitted link and image values before cleaning.
    function cleanSafely(parent) {

        [...parent.children].forEach(child => {

            const tag = child.tagName;

            if (dangerousTags.has(tag)) {
                child.remove();
                return;
            }


            const savedHref =
                tag === "A" ? child.getAttribute("href") : null;

            const savedSrc =
                tag === "IMG" ? child.getAttribute("src") : null;

            const savedAlt =
                tag === "IMG" ? child.getAttribute("alt") : null;


            cleanSafely(child);


            if (!allowedTags.has(tag)) {
                child.replaceWith(...child.childNodes);
                return;
            }


            [...child.attributes].forEach(attribute => {
                child.removeAttribute(attribute.name);
            });


            if (tag === "A" && savedHref) {

                if (/^https:\/\//i.test(savedHref)) {

                    child.setAttribute("href", savedHref);
                    child.setAttribute("target", "_blank");
                    child.setAttribute("rel", "noopener noreferrer");

                }

            }


            if (tag === "IMG" && savedSrc) {

                if (/^https:\/\//i.test(savedSrc)) {

                    child.setAttribute("src", savedSrc);
                    child.setAttribute("alt", savedAlt || "");
                    child.setAttribute("loading", "lazy");

                } else {

                    child.remove();

                }

            }

        });

    }


    cleanSafely(documentCopy.body);

    return documentCopy.body.innerHTML;
}


/* =========================================
   OPEN TOPIC NOTES
========================================= */

async function renderTopicNotes(topicId) {

    const course = getSelectedCourse();

    if (!course) return;


    showLibraryMessage("Opening lecture notes...");


    try {

        const { data: topic, error } = await supabase
            .from("course_topics")
            .select("*")
            .eq("id", topicId)
            .eq("chapter_id", activeChapter)
            .eq("publication_status", "published")
            .single();


        if (error) throw error;


        const { data: chapter, error: chapterError } = await supabase
            .from("course_chapters")
            .select("*")
            .eq("id", activeChapter)
            .single();


        if (chapterError) throw chapterError;

const topicPDFs = await loadPDFMaterials(
    course.id,
    topic.id
);
        const savedContent = topic.content || {};

        const noteHTML = savedContent.type === "html"
            ? cleanPublishedHTML(savedContent.html || "")
            : "";


        libraryContainer.innerHTML = `

            <button
                type="button"
                class="admin-action-button"
                data-library-back="chapter"
            >
                ← Back to Topics
            </button>


            <div class="admin-welcome">
                <div>
                    <span class="admin-section-eyebrow">
                        ${escapeHTML(course.course_code)}
                    </span>

                    <h2>${escapeHTML(topic.topic_title)}</h2>

                    <p>
                        Chapter ${escapeHTML(chapter.chapter_number)}
                        ·
                        ${escapeHTML(chapter.chapter_title)}
                    </p>
                </div>
            </div>


            <article class="admin-panel student-lecture-notes">

                <div class="student-notes-heading">
                    <span>
                        ${escapeHTML(course.course_title)}
                    </span>

                    <h3>
                        Topic ${escapeHTML(chapter.chapter_number)}.${escapeHTML(topic.topic_number)}
                        — ${escapeHTML(topic.topic_title)}
                    </h3>
                </div>


                <div class="student-notes-content">
                    ${
                        noteHTML ||
                        `<p class="admin-placeholder">
                            No written notes are available for this topic yet.
                        </p>`
                    }
                </div>
<div class="student-topic-materials">

    <div class="admin-panel-heading">
        <h3>Topic PDF Materials</h3>
    </div>

    ${topicPDFs}

</div>
            </article>

        `;


        libraryContainer
            .querySelector('[data-library-back="chapter"]')
            .addEventListener("click", renderChapterDetails);


    } catch (error) {

        showLibraryError(error);

    }
}


/* =========================================
   PUBLIC ENTRY POINT
========================================= */

export async function loadStudentCourses(container) {

    libraryContainer = container;

    showLibraryMessage("Preparing your course library...");


    try {

        await loadAcademicInformation();

        await renderCourseLibrary();

    } catch (error) {

        showLibraryError(error);

    }

}