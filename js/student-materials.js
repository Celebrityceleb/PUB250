
import { supabase } from "./config.js";

/* =========================================
   STUDENT LECTURE MATERIALS
========================================= */

let materialsContainer = null;

let allMaterials = [];
let allCourses = [];
let academicLevels = [];
let academicSemesters = [];
let academicSessions = [];

let selectedMaterialLevel = "all";
let selectedMaterialSession = "all";
let selectedMaterialSemester = "all";
let selectedMaterialCourse = "all";


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


function showMaterialsMessage(message) {
    materialsContainer.innerHTML = `
        <div class="admin-panel">
            <p class="admin-placeholder">
                ${escapeHTML(message)}
            </p>
        </div>
    `;
}


function getAcademicName(list, id, field) {
    const item = list.find(
        entry => String(entry.id) === String(id)
    );

    return item?.[field] || "Not available";
}


/* =========================================
   LOAD ALL ACADEMIC INFORMATION
========================================= */

async function loadMaterialAcademicInfo() {

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
            .order("session_name", {
                ascending: false
            }),

        supabase
            .from("courses")
            .select("*")
            .eq("is_active", true)
            .order("course_code")

    ]);


    if (levelsResult.error) throw levelsResult.error;
    if (semestersResult.error) throw semestersResult.error;
    if (sessionsResult.error) throw sessionsResult.error;
    if (coursesResult.error) throw coursesResult.error;


    academicLevels = levelsResult.data || [];
    academicSemesters = semestersResult.data || [];
    academicSessions = sessionsResult.data || [];
    allCourses = coursesResult.data || [];

}


/* =========================================
   LOAD ACCESSIBLE PDF MATERIALS
========================================= */

async function loadAllPDFMaterials() {

    const { data, error } = await supabase
        .from("course_materials")
        .select("*")
        .order("created_at", {
            ascending: false
        });


    if (error) throw error;


    allMaterials = data || [];


    const [
        topicsResult,
        chaptersResult
    ] = await Promise.all([

        supabase
            .from("course_topics")
            .select("id, topic_title, topic_number, chapter_id"),

        supabase
            .from("course_chapters")
            .select("id, chapter_number, chapter_title")

    ]);


    if (topicsResult.error) throw topicsResult.error;
    if (chaptersResult.error) throw chaptersResult.error;


    const topics = topicsResult.data || [];
    const chapters = chaptersResult.data || [];


    allMaterials = allMaterials.map(material => {

        const course = allCourses.find(
            item => String(item.id) === String(material.course_id)
        );

        const topic = topics.find(
            item => String(item.id) === String(material.topic_id)
        );

        const chapter = topic
            ? chapters.find(
                item => String(item.id) === String(topic.chapter_id)
            )
            : null;


        return {
            ...material,
            courseInfo: course || null,
            topicInfo: topic || null,
            chapterInfo: chapter || null
        };

    });

}

/* =========================================
   FILTER MATERIALS
========================================= */

function getFilteredMaterials() {

    return allMaterials.filter(material => {

        const course = material.courseInfo;

        if (!course) return false;


        const matchesLevel =
            selectedMaterialLevel === "all" ||
            String(course.academic_level_id) ===
            String(selectedMaterialLevel);


        const matchesSession =
            selectedMaterialSession === "all" ||
            String(course.academic_session_id) ===
            String(selectedMaterialSession);


        const matchesSemester =
            selectedMaterialSemester === "all" ||
            String(course.semester_id) ===
            String(selectedMaterialSemester);


        const matchesCourse =
            selectedMaterialCourse === "all" ||
            String(course.id) ===
            String(selectedMaterialCourse);


        return (
            matchesLevel &&
            matchesSession &&
            matchesSemester &&
            matchesCourse
        );

    });

}


/* =========================================
   RENDER FILTER OPTIONS
========================================= */

function renderMaterialFilters() {

    const levelOptions = academicLevels.map(level => `
        <option
            value="${escapeHTML(level.id)}"
            ${String(level.id) === String(selectedMaterialLevel) ? "selected" : ""}
        >
            ${escapeHTML(level.level_name)}
        </option>
    `).join("");


    const sessionOptions = academicSessions.map(session => `
        <option
            value="${escapeHTML(session.id)}"
            ${String(session.id) === String(selectedMaterialSession) ? "selected" : ""}
        >
            ${escapeHTML(session.session_name)}
        </option>
    `).join("");


    const semesterOptions = academicSemesters.map(semester => `
        <option
            value="${escapeHTML(semester.id)}"
            ${String(semester.id) === String(selectedMaterialSemester) ? "selected" : ""}
        >
            ${escapeHTML(semester.semester_name)}
        </option>
    `).join("");


    const courseOptions = allCourses.map(course => `
        <option
            value="${escapeHTML(course.id)}"
            ${String(course.id) === String(selectedMaterialCourse) ? "selected" : ""}
        >
            ${escapeHTML(course.course_code)} — ${escapeHTML(course.course_title)}
        </option>
    `).join("");


    return `
        <div class="admin-panel student-material-filter-panel">

            <div class="admin-panel-heading">
                <h3>Filter Lecture Materials</h3>
            </div>

            <div class="student-material-filters">

                <label>
                    Academic Level

                    <select id="materialLevelFilter">
                        <option value="all">All Levels</option>
                        ${levelOptions}
                    </select>
                </label>


                <label>
                    Academic Session

                    <select id="materialSessionFilter">
                        <option value="all">All Sessions</option>
                        ${sessionOptions}
                    </select>
                </label>


                <label>
                    Semester

                    <select id="materialSemesterFilter">
                        <option value="all">All Semesters</option>
                        ${semesterOptions}
                    </select>
                </label>


                <label>
                    Course

                    <select id="materialCourseFilter">
                        <option value="all">All Courses</option>
                        ${courseOptions}
                    </select>
                </label>

            </div>

        </div>
    `;

}


/* =========================================
   RENDER PDF CARDS
========================================= */

async function renderMaterialCards() {

    const materials = getFilteredMaterials();


    if (!materials.length) {

        return `
            <div class="admin-panel">
                <p class="admin-placeholder">
                    No lecture materials match your selected filters.
                </p>
            </div>
        `;

    }


    const cards = await Promise.all(

        materials.map(async material => {

            const course = material.courseInfo;


            const { data, error } = await supabase
                .storage
                .from("course-materials")
                .createSignedUrl(material.storage_path, 3600);


            const level = getAcademicName(
                academicLevels,
                course.academic_level_id,
                "level_name"
            );

            const session = getAcademicName(
                academicSessions,
                course.academic_session_id,
                "session_name"
            );

            const semester = getAcademicName(
                academicSemesters,
                course.semester_id,
                "semester_name"
            );


            const topicDetails = material.topicInfo
                ? `
                    <span>
                        Topic: ${escapeHTML(material.topicInfo.topic_title)}
                    </span>

                    <span>
                        Chapter ${escapeHTML(material.chapterInfo?.chapter_number ?? "—")}
                        ${escapeHTML(material.chapterInfo?.chapter_title || "")}
                    </span>
                `
                : `
                    <span>Course-level material</span>
                `;


            const openButton = error
                ? `
                    <span class="student-material-unavailable">
                        Unable to open PDF
                    </span>
                `
                : `
                    <a
                        href="${escapeHTML(data.signedUrl)}"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="student-material-open"
                    >
                        Open PDF →
                    </a>
                `;


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

                        <div class="student-material-metadata">

                            <span>
                                ${escapeHTML(course.course_code)}
                                — ${escapeHTML(course.course_title)}
                            </span>

                            <span>
                                ${escapeHTML(level)}
                                · ${escapeHTML(session)}
                                · ${escapeHTML(semester)}
                            </span>

                            ${topicDetails}

                        </div>

                    </div>

                    ${openButton}

                </div>
            `;

        })

    );


    return `
        <div class="student-material-list">
            ${cards.join("")}
        </div>
    `;

}

/* =========================================
   RENDER STUDENT MATERIALS PAGE
========================================= */

async function renderStudentMaterials() {

    const filteredMaterials = getFilteredMaterials();

    const materialCards = await renderMaterialCards();

    materialsContainer.innerHTML = `

        <div class="admin-welcome">

            <div>
                <h2>Lecture Materials</h2>

                <p>
                    Access PDF materials across all academic levels.
                </p>
            </div>

        </div>


        ${renderMaterialFilters()}


        <div class="student-course-library-heading">

            <h3>Available PDF Materials</h3>

            <span>
                ${filteredMaterials.length}
                ${filteredMaterials.length === 1 ? "document" : "documents"}
            </span>

        </div>


        <div id="studentMaterialResults">

            ${materialCards}

        </div>

    `;


    attachMaterialFilterEvents();

}


/* =========================================
   FILTER EVENT LISTENERS
========================================= */

function attachMaterialFilterEvents() {

    const levelFilter = document.getElementById(
        "materialLevelFilter"
    );

    const sessionFilter = document.getElementById(
        "materialSessionFilter"
    );

    const semesterFilter = document.getElementById(
        "materialSemesterFilter"
    );

    const courseFilter = document.getElementById(
        "materialCourseFilter"
    );


    levelFilter?.addEventListener("change", async event => {

        selectedMaterialLevel = event.target.value;

        await renderStudentMaterials();

    });


    sessionFilter?.addEventListener("change", async event => {

        selectedMaterialSession = event.target.value;

        await renderStudentMaterials();

    });


    semesterFilter?.addEventListener("change", async event => {

        selectedMaterialSemester = event.target.value;

        await renderStudentMaterials();

    });


    courseFilter?.addEventListener("change", async event => {

        selectedMaterialCourse = event.target.value;

        await renderStudentMaterials();

    });

}


/* =========================================
   MAIN STUDENT MATERIALS FUNCTION
========================================= */

export async function loadStudentMaterials(container) {

    materialsContainer = container;


    selectedMaterialLevel = "all";
    selectedMaterialSession = "all";
    selectedMaterialSemester = "all";
    selectedMaterialCourse = "all";


    showMaterialsMessage(
        "Loading lecture materials..."
    );


    try {

        await loadMaterialAcademicInfo();

        await loadAllPDFMaterials();

        await renderStudentMaterials();


    } catch (error) {

        console.error(
            "Student materials error:",
            error
        );

        showMaterialsMessage(
            "Unable to load lecture materials. Please refresh and try again."
        );

    }

}
