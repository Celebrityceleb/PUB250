
import { supabase } from "./config.js";

/* =========================================
   ADMIN LECTURE MATERIALS
========================================= */

let adminMaterialsContainer = null;

let adminMaterials = [];
let adminCourses = [];

let adminLevels = [];
let adminSessions = [];
let adminSemesters = [];

let adminTopics = [];
let adminChapters = [];

let adminSelectedLevel = "all";
let adminSelectedSession = "all";
let adminSelectedSemester = "all";
let adminSelectedCourse = "all";


/* =========================================
   HTML SAFETY HELPER
========================================= */

function escapeAdminMaterialHTML(value) {

    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[character] || character);

}


/* =========================================
   DISPLAY MESSAGES
========================================= */

function showAdminMaterialsMessage(message) {

    adminMaterialsContainer.innerHTML = `
        <div class="admin-panel">
            <p class="admin-placeholder">
                ${escapeAdminMaterialHTML(message)}
            </p>
        </div>
    `;

}


/* =========================================
   ACADEMIC NAME HELPER
========================================= */

function getAdminAcademicName(list, id, field) {

    const item = list.find(
        entry => String(entry.id) === String(id)
    );

    return item?.[field] || "Not available";

}


/* =========================================
   LOAD ACADEMIC INFORMATION
========================================= */

async function loadAdminMaterialAcademicInfo() {

    const [
        levelsResult,
        sessionsResult,
        semestersResult,
        coursesResult,
        topicsResult,
        chaptersResult
    ] = await Promise.all([

        supabase
            .from("academic_levels")
            .select("*")
            .order("level_number"),

        supabase
            .from("academic_sessions")
            .select("*")
            .order("session_name", {
                ascending: false
            }),

        supabase
            .from("academic_semesters")
            .select("*")
            .order("semester_number"),

        supabase
            .from("courses")
            .select("*")
            .order("course_code"),

        supabase
            .from("course_topics")
            .select("*"),

        supabase
            .from("course_chapters")
            .select("*")

    ]);


    if (levelsResult.error) throw levelsResult.error;
    if (sessionsResult.error) throw sessionsResult.error;
    if (semestersResult.error) throw semestersResult.error;
    if (coursesResult.error) throw coursesResult.error;
    if (topicsResult.error) throw topicsResult.error;
    if (chaptersResult.error) throw chaptersResult.error;


    adminLevels = levelsResult.data || [];
    adminSessions = sessionsResult.data || [];
    adminSemesters = semestersResult.data || [];

    adminCourses = coursesResult.data || [];

    adminTopics = topicsResult.data || [];
    adminChapters = chaptersResult.data || [];

}


/* =========================================
   LOAD ALL UPLOADED PDF MATERIALS
========================================= */

async function loadAllAdminMaterials() {

    const { data, error } = await supabase
        .from("course_materials")
        .select("*")
        .order("created_at", {
            ascending: false
        });


    if (error) throw error;


    adminMaterials = (data || []).map(material => {

        const course = adminCourses.find(
            item => String(item.id) === String(material.course_id)
        );

        const topic = adminTopics.find(
            item => String(item.id) === String(material.topic_id)
        );

        const chapter = topic
            ? adminChapters.find(
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
   FILTER ADMIN MATERIALS
========================================= */

function getFilteredAdminMaterials() {

    return adminMaterials.filter(material => {

        const course = material.courseInfo;

        if (!course) return false;


        const matchesLevel =
            adminSelectedLevel === "all" ||
            String(course.academic_level_id) ===
            String(adminSelectedLevel);


        const matchesSession =
            adminSelectedSession === "all" ||
            String(course.academic_session_id) ===
            String(adminSelectedSession);


        const matchesSemester =
            adminSelectedSemester === "all" ||
            String(course.semester_id) ===
            String(adminSelectedSemester);


        const matchesCourse =
            adminSelectedCourse === "all" ||
            String(course.id) ===
            String(adminSelectedCourse);


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

function renderAdminMaterialFilters() {

    const levelOptions = adminLevels.map(level => `
        <option
            value="${escapeAdminMaterialHTML(level.id)}"
            ${String(level.id) === String(adminSelectedLevel) ? "selected" : ""}
        >
            ${escapeAdminMaterialHTML(level.level_name)}
        </option>
    `).join("");


    const sessionOptions = adminSessions.map(session => `
        <option
            value="${escapeAdminMaterialHTML(session.id)}"
            ${String(session.id) === String(adminSelectedSession) ? "selected" : ""}
        >
            ${escapeAdminMaterialHTML(session.session_name)}
        </option>
    `).join("");


    const semesterOptions = adminSemesters.map(semester => `
        <option
            value="${escapeAdminMaterialHTML(semester.id)}"
            ${String(semester.id) === String(adminSelectedSemester) ? "selected" : ""}
        >
            ${escapeAdminMaterialHTML(semester.semester_name)}
        </option>
    `).join("");


    const courseOptions = adminCourses.map(course => `
        <option
            value="${escapeAdminMaterialHTML(course.id)}"
            ${String(course.id) === String(adminSelectedCourse) ? "selected" : ""}
        >
            ${escapeAdminMaterialHTML(course.course_code)}
            — ${escapeAdminMaterialHTML(course.course_title)}
        </option>
    `).join("");


    return `

        <div class="admin-panel admin-material-filter-panel">

            <div class="admin-panel-heading">
                <h3>Filter Lecture Materials</h3>
            </div>


            <div class="admin-material-filters">

                <label>
                    Academic Level

                    <select id="adminMaterialLevelFilter">
                        <option value="all">All Levels</option>
                        ${levelOptions}
                    </select>
                </label>


                <label>
                    Academic Session

                    <select id="adminMaterialSessionFilter">
                        <option value="all">All Sessions</option>
                        ${sessionOptions}
                    </select>
                </label>


                <label>
                    Semester

                    <select id="adminMaterialSemesterFilter">
                        <option value="all">All Semesters</option>
                        ${semesterOptions}
                    </select>
                </label>


                <label>
                    Course

                    <select id="adminMaterialCourseFilter">
                        <option value="all">All Courses</option>
                        ${courseOptions}
                    </select>
                </label>

            </div>

        </div>

    `;

}


/* =========================================
   PREPARE MATERIAL LOCATION
========================================= */

function getAdminMaterialLocation(material) {

    if (!material.topicInfo) {

        return `
            <span class="admin-material-location">
                Course-level material
            </span>
        `;

    }


    const topic = material.topicInfo;

    const chapter = material.chapterInfo;


    return `

        <span class="admin-material-location">

            ${escapeAdminMaterialHTML(topic.topic_title)}

        </span>


        <span class="admin-material-chapter">

            Chapter
            ${escapeAdminMaterialHTML(chapter?.chapter_number ?? "—")}

            ${escapeAdminMaterialHTML(chapter?.chapter_title || "")}

        </span>

    `;

}

/* =========================================
   RENDER ADMIN MATERIAL CARDS
========================================= */

async function renderAdminMaterialCards() {

    const materials = getFilteredAdminMaterials();


    if (!materials.length) {

        return `
            <div class="admin-panel">
                <p class="admin-placeholder">
                    No lecture materials found for these filters.
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
                .createSignedUrl(
                    material.storage_path,
                    3600
                );


            const level = getAdminAcademicName(
                adminLevels,
                course.academic_level_id,
                "level_name"
            );


            const session = getAdminAcademicName(
                adminSessions,
                course.academic_session_id,
                "session_name"
            );


            const semester = getAdminAcademicName(
                adminSemesters,
                course.semester_id,
                "semester_name"
            );


            const openAction = error
                ? `
                    <span class="admin-material-unavailable">
                        PDF unavailable
                    </span>
                `
                : `
                    <a
                        href="${escapeAdminMaterialHTML(data.signedUrl)}"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="admin-material-open"
                    >
                        Open PDF →
                    </a>
                `;


            return `

                <div class="admin-material-card">

                    <div class="admin-material-card-info">

                        <span class="admin-material-file-label">
                            PDF DOCUMENT
                        </span>


                        <h4>
                            ${escapeAdminMaterialHTML(material.material_title)}
                        </h4>


                        <span class="admin-material-filename">
                            ${escapeAdminMaterialHTML(material.file_name)}
                        </span>


                        <div class="admin-material-metadata">

                            <span>
                                <strong>Course:</strong>

                                ${escapeAdminMaterialHTML(course.course_code)}
                                —
                                ${escapeAdminMaterialHTML(course.course_title)}
                            </span>


                            <span>
                                <strong>Level:</strong>
                                ${escapeAdminMaterialHTML(level)}
                            </span>


                            <span>
                                <strong>Session:</strong>
                                ${escapeAdminMaterialHTML(session)}
                            </span>


                            <span>
                                <strong>Semester:</strong>
                                ${escapeAdminMaterialHTML(semester)}
                            </span>


                            ${getAdminMaterialLocation(material)}

                        </div>

                    </div>


                    <div class="admin-material-card-actions">

                        ${openAction}


                        <button
                            type="button"
                            class="admin-material-delete"
                            data-delete-material="${escapeAdminMaterialHTML(material.id)}"
                        >
                            Delete PDF
                        </button>

                    </div>

                </div>

            `;

        })

    );


    return `
        <div class="admin-material-list">
            ${cards.join("")}
        </div>
    `;

}


/* =========================================
   DELETE MATERIAL
========================================= */

async function deleteAdminMaterial(materialId) {

    const material = adminMaterials.find(
        item => String(item.id) === String(materialId)
    );


    if (!material) {

        alert("Material record not found.");

        return;

    }


    const confirmed = confirm(
        `Delete "${material.material_title}"?\n\nThis will permanently remove the PDF and its record.`
    );


    if (!confirmed) return;


    try {

        const { error: storageError } = await supabase
            .storage
            .from("course-materials")
            .remove([material.storage_path]);


        if (storageError) throw storageError;


        const { error: databaseError } = await supabase
            .from("course_materials")
            .delete()
            .eq("id", materialId);


        if (databaseError) throw databaseError;


        await loadAllAdminMaterials();

        await renderAdminMaterials();


        alert("Lecture material deleted successfully.");


    } catch (error) {

        console.error(
            "Delete material error:",
            error
        );

        alert(
            "Unable to delete this material. Check your permissions and try again."
        );

    }

}

/* =========================================
   RENDER ADMIN MATERIALS PAGE
========================================= */

async function renderAdminMaterials() {

    const filteredMaterials = getFilteredAdminMaterials();

    const materialCards = await renderAdminMaterialCards();


    adminMaterialsContainer.innerHTML = `

        <div class="admin-welcome">

            <div>
                <h2>Lecture Materials</h2>

                <p>
                    Manage PDF materials uploaded across all academic levels.
                </p>
            </div>

        </div>


        <div class="admin-material-summary">

            <div class="admin-panel">

                <span>Total Uploaded PDFs</span>

                <h2>${adminMaterials.length}</h2>

            </div>


            <div class="admin-panel">

                <span>Currently Displayed</span>

                <h2>${filteredMaterials.length}</h2>

            </div>

        </div>


        ${renderAdminMaterialFilters()}


        <div class="admin-material-heading">

            <h3>Uploaded PDF Materials</h3>

            <span>
                ${filteredMaterials.length}
                ${filteredMaterials.length === 1 ? "document" : "documents"}
            </span>

        </div>


        <div id="adminMaterialResults">

            ${materialCards}

        </div>

    `;


    attachAdminMaterialEvents();

}


/* =========================================
   ATTACH FILTER AND DELETE EVENTS
========================================= */

function attachAdminMaterialEvents() {

    const levelFilter = document.getElementById(
        "adminMaterialLevelFilter"
    );

    const sessionFilter = document.getElementById(
        "adminMaterialSessionFilter"
    );

    const semesterFilter = document.getElementById(
        "adminMaterialSemesterFilter"
    );

    const courseFilter = document.getElementById(
        "adminMaterialCourseFilter"
    );


    levelFilter?.addEventListener("change", async event => {

        adminSelectedLevel = event.target.value;

        await renderAdminMaterials();

    });


    sessionFilter?.addEventListener("change", async event => {

        adminSelectedSession = event.target.value;

        await renderAdminMaterials();

    });


    semesterFilter?.addEventListener("change", async event => {

        adminSelectedSemester = event.target.value;

        await renderAdminMaterials();

    });


    courseFilter?.addEventListener("change", async event => {

        adminSelectedCourse = event.target.value;

        await renderAdminMaterials();

    });


    document
        .querySelectorAll("[data-delete-material]")
        .forEach(button => {

            button.addEventListener("click", async () => {

                await deleteAdminMaterial(
                    button.dataset.deleteMaterial
                );

            });

        });

}


/* =========================================
   MAIN ADMIN MATERIALS FUNCTION
========================================= */

export async function loadAdminMaterials(container) {

    adminMaterialsContainer = container;


    adminSelectedLevel = "all";
    adminSelectedSession = "all";
    adminSelectedSemester = "all";
    adminSelectedCourse = "all";


    showAdminMaterialsMessage(
        "Loading uploaded lecture materials..."
    );


    try {

        await loadAdminMaterialAcademicInfo();

        await loadAllAdminMaterials();

        await renderAdminMaterials();


    } catch (error) {

        console.error(
            "Admin materials loading error:",
            error
        );

        showAdminMaterialsMessage(
            "Unable to load lecture materials. Please refresh and try again."
        );

    }

}
