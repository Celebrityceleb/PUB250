
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

let currentStudentId = null;
let savedMaterialIds = new Set();

let showSavedOnly = false;
let materialSaveEventsAttached = false;


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
   GET CURRENT STUDENT AND SAVED RECORDS
========================================= */

async function loadStudentSavedIds() {

    const { data: userData, error: userError } =
        await supabase.auth.getUser();

    if (userError) throw userError;

    if (!userData.user) {
        throw new Error("Student session not found.");
    }

    currentStudentId = userData.user.id;

    const { data, error } = await supabase
        .from("student_saved_materials")
        .select("material_id")
        .eq("student_id", currentStudentId);

    if (error) throw error;

    savedMaterialIds = new Set(
        (data || []).map(item => String(item.material_id))
    );

}


/* =========================================
   SAVE OR REMOVE A MATERIAL
========================================= */

async function toggleSavedMaterial(materialId) {

    const id = String(materialId);

    if (!currentStudentId) {

        alert("Your student session could not be verified.");

        return;

    }

    const button = materialsContainer.querySelector(
        `[data-save-material="${id}"]`
    );

    if (button) {

        button.disabled = true;

        button.textContent = "Please wait...";

    }

    try {

        if (savedMaterialIds.has(id)) {

            const { error } = await supabase
                .from("student_saved_materials")
                .delete()
                .eq("student_id", currentStudentId)
                .eq("material_id", id);

            if (error) throw error;

            savedMaterialIds.delete(id);

        } else {

            const { error } = await supabase
                .from("student_saved_materials")
                .insert({
                    student_id: currentStudentId,
                    material_id: id
                });

            if (error) throw error;

            savedMaterialIds.add(id);

        }

        await renderStudentMaterials();

    } catch (error) {

        console.error("Save material error:", error);

        alert(
            "Unable to update saved materials: " +
            error.message
        );

        if (button) {

            button.disabled = false;

            button.textContent =
                savedMaterialIds.has(id)
                    ? "★ Saved"
                    : "☆ Save";

        }

    }

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

        if (
            showSavedOnly &&
            !savedMaterialIds.has(String(material.id))
        ) {

            return false;

        }


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
            ${escapeHTML(course.course_code)}
            — ${escapeHTML(course.course_title)}
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

                        <option value="all">
                            All Levels
                        </option>

                        ${levelOptions}

                    </select>

                </label>


                <label>
                    Academic Session

                    <select id="materialSessionFilter">

                        <option value="all">
                            All Sessions
                        </option>

                        ${sessionOptions}

                    </select>

                </label>


                <label>
                    Semester

                    <select id="materialSemesterFilter">

                        <option value="all">
                            All Semesters
                        </option>

                        ${semesterOptions}

                    </select>

                </label>


                <label>
                    Course

                    <select id="materialCourseFilter">

                        <option value="all">
                            All Courses
                        </option>

                        ${courseOptions}

                    </select>

                </label>

            </div>

        </div>

    `;

}

/* =========================================
   RENDER PDF MATERIAL CARDS
========================================= */

async function renderMaterialCards() {

    const materials = getFilteredMaterials();


    if (!materials.length) {

        return `

            <div class="admin-panel">

                <p class="admin-placeholder">

                    ${showSavedOnly
                        ? "You have not saved any materials matching these filters."
                        : "No lecture materials match your selected filters."}

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
                        Topic:
                        ${escapeHTML(material.topicInfo.topic_title)}
                    </span>

                    <span>
                        Chapter
                        ${escapeHTML(material.chapterInfo?.chapter_number ?? "—")}

                        ${escapeHTML(material.chapterInfo?.chapter_title || "")}
                    </span>

                `

                : `

                    <span>
                        Course-level material
                    </span>

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


            const isSaved = savedMaterialIds.has(
                String(material.id)
            );


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
                                —
                                ${escapeHTML(course.course_title)}
                            </span>


                            <span>
                                ${escapeHTML(level)}
                                ·
                                ${escapeHTML(session)}
                                ·
                                ${escapeHTML(semester)}
                            </span>


                            ${topicDetails}

                        </div>

                    </div>


                    <div class="student-material-actions">

                        <button
                            type="button"
                            class="student-material-save"
                            data-save-material="${escapeHTML(material.id)}"
                        >
                            ${isSaved ? "★ Saved" : "☆ Save"}
                        </button>

                        ${openButton}

                    </div>

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

                <h2>
                    ${showSavedOnly
                        ? "Saved Materials"
                        : "Lecture Materials"}
                </h2>

                <p>
                    ${showSavedOnly
                        ? "Your personal collection of saved academic resources."
                        : "Access PDF materials across all academic levels."}
                </p>

            </div>

        </div>


        ${renderMaterialFilters()}


        <div class="student-course-library-heading">

            <h3>
                ${showSavedOnly
                    ? "Your Saved Materials"
                    : "Available PDF Materials"}
            </h3>


            <span>

                ${filteredMaterials.length}

                ${filteredMaterials.length === 1
                    ? "document"
                    : "documents"}

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
   SAVE BUTTON EVENT LISTENER
========================================= */

function attachMaterialSaveEvents() {

    if (materialSaveEventsAttached) return;


    materialsContainer.addEventListener("click", event => {

        const button = event.target.closest(
            "[data-save-material]"
        );

        if (!button) return;


        const materialId = button.dataset.saveMaterial;

        toggleSavedMaterial(materialId);

    });


    materialSaveEventsAttached = true;

}


/* =========================================
   MAIN STUDENT MATERIALS FUNCTION
========================================= */

export async function loadStudentMaterials(container) {

    materialsContainer = container;

    showSavedOnly = false;


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

        await loadStudentSavedIds();

        attachMaterialSaveEvents();

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


/* =========================================
   LOAD STUDENT SAVED MATERIALS
========================================= */

export async function loadStudentSavedMaterials(container) {

    materialsContainer = container;

    showSavedOnly = true;


    selectedMaterialLevel = "all";

    selectedMaterialSession = "all";

    selectedMaterialSemester = "all";

    selectedMaterialCourse = "all";


    showMaterialsMessage(
        "Loading your saved materials..."
    );


    try {

        await loadMaterialAcademicInfo();

        await loadAllPDFMaterials();

        await loadStudentSavedIds();

        attachMaterialSaveEvents();

        await renderStudentMaterials();


    } catch (error) {

        console.error(
            "Saved materials error:",
            error
        );

        showMaterialsMessage(
            "Unable to load your saved materials. Please refresh and try again."
        );

    }

}
