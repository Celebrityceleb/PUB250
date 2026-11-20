
import { supabase } from "./config.js";

/* =========================================
   STUDENT PAST QUESTIONS
========================================= */

let studentPastQuestions = [];

let selectedPastQuestion = null;
let selectedImageIndex = 0;

/* =========================================
   LOAD PUBLISHED PAST QUESTIONS
========================================= */

export async function loadStudentPastQuestions(container) {

    container.innerHTML = `
        <div class="pq-student-wrapper">
            <div class="pq-student-heading">
                <h2>Past Questions</h2>
                <p>Access examination papers across all academic levels.</p>
            </div>

            <div id="studentPQContent">
                <p>Loading past questions...</p>
            </div>
        </div>
    `;

    try {

        const { data, error } = await supabase
            .from("past_questions")
            .select(`
                id,
                title,
                exam_type,
                file_type,
                pdf_storage_path,
                pdf_file_name,
                pdf_file_size,
                created_at,

                courses (
                    course_code,
                    course_title,
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
            .eq("publication_status", "published")
            .order("created_at", { ascending: false });

        if (error) {
            throw error;
        }

        studentPastQuestions = data || [];

        studentPastQuestions.forEach(question => {

            if (question.past_question_images) {

                question.past_question_images.sort(
                    (a, b) => a.page_number - b.page_number
                );

            }

        });

        renderStudentPastQuestionPage();

        attachStudentPastQuestionEvents();

    } catch (error) {

        console.error("Student Past Questions Error:", error);

        document.getElementById("studentPQContent").innerHTML = `
            <div class="pq-student-error">
                <h3>Unable to load past questions</h3>
                <p>${escapeStudentPQHTML(error.message)}</p>

                <button id="studentPQLoadRetry">
                    Try Again
                </button>
            </div>
        `;

        document.getElementById("studentPQLoadRetry")
            ?.addEventListener("click", () => {
                loadStudentPastQuestions(container);
            });

    }

}

/* =========================================
   HTML SAFETY
========================================= */

function escapeStudentPQHTML(value) {

    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"

    })[character]);

}
/* =========================================
   RENDER STUDENT PAST QUESTIONS PAGE
========================================= */

function renderStudentPastQuestionPage() {

    const content = document.getElementById("studentPQContent");

    if (!content) return;

    const levels = [100, 200, 300, 400];

    const courses = [...new Map(
        studentPastQuestions.map(question => [
            question.courses?.course_code,
            question.courses
        ]).filter(item => item[0])
    ).values()];

    const sessions = [...new Set(
        studentPastQuestions.map(
            question => question.academic_sessions?.session_name
        ).filter(Boolean)
    )];

    const semesters = [...new Set(
        studentPastQuestions.map(
            question => question.academic_semesters?.semester_name
        ).filter(Boolean)
    )];

    const examTypes = [...new Set(
        studentPastQuestions.map(question => question.exam_type)
            .filter(Boolean)
    )];

    content.innerHTML = `

        <div class="pq-student-stats">
            <div class="pq-student-stat">
                <strong>${studentPastQuestions.length}</strong>
                <span>Published Papers</span>
            </div>

            <div class="pq-student-stat">
                <strong>${courses.length}</strong>
                <span>Courses</span>
            </div>
        </div>

        <div class="pq-student-filters">

            <input
                type="search"
                id="studentPQSearch"
                placeholder="Search course code or title..."
            >

            <select id="studentPQLevel">
                <option value="">All Levels</option>
                ${levels.map(level => `
                    <option value="${level}">${level} Level</option>
                `).join("")}
            </select>

            <select id="studentPQCourse">
                <option value="">All Courses</option>
                ${courses.map(course => `
                    <option value="${escapeStudentPQHTML(course.course_code)}">
                        ${escapeStudentPQHTML(course.course_code)}
                    </option>
                `).join("")}
            </select>

            <select id="studentPQSession">
                <option value="">All Sessions</option>
                ${sessions.map(session => `
                    <option value="${escapeStudentPQHTML(session)}">
                        ${escapeStudentPQHTML(session)}
                    </option>
                `).join("")}
            </select>

            <select id="studentPQSemester">
                <option value="">All Semesters</option>
                ${semesters.map(semester => `
                    <option value="${escapeStudentPQHTML(semester)}">
                        ${escapeStudentPQHTML(semester)}
                    </option>
                `).join("")}
            </select>

            <select id="studentPQExamType">
                <option value="">All Examination Types</option>
                ${examTypes.map(type => `
                    <option value="${escapeStudentPQHTML(type)}">
                        ${escapeStudentPQHTML(type)}
                    </option>
                `).join("")}
            </select>

        </div>

        <div class="pq-student-results-heading">
            <h3>Available Examination Papers</h3>
            <span id="studentPQResultCount"></span>
        </div>

        <div id="studentPQRecords" class="pq-student-records"></div>

        <div id="studentPQViewer"></div>

    `;

    renderStudentPQRecords();

}

/* =========================================
   RENDER FILTERED RECORDS
========================================= */

function renderStudentPQRecords() {

    const recordsContainer =
        document.getElementById("studentPQRecords");

    if (!recordsContainer) return;

    const search = (
        document.getElementById("studentPQSearch")?.value || ""
    ).trim().toLowerCase();

    const level = document.getElementById("studentPQLevel")?.value || "";
    const course = document.getElementById("studentPQCourse")?.value || "";
    const session = document.getElementById("studentPQSession")?.value || "";
    const semester = document.getElementById("studentPQSemester")?.value || "";
    const examType = document.getElementById("studentPQExamType")?.value || "";

    const filtered = studentPastQuestions.filter(question => {

        const courseCode = question.courses?.course_code || "";
        const courseTitle = question.courses?.course_title || "";

        const questionLevel = String(
            question.courses?.academic_levels?.level_number || ""
        );

        const questionSession =
            question.academic_sessions?.session_name || "";

        const questionSemester =
            question.academic_semesters?.semester_name || "";

        const matchesSearch =
            !search ||
            question.title.toLowerCase().includes(search) ||
            courseCode.toLowerCase().includes(search) ||
            courseTitle.toLowerCase().includes(search);

        return (
            matchesSearch &&
            (!level || questionLevel === level) &&
            (!course || courseCode === course) &&
            (!session || questionSession === session) &&
            (!semester || questionSemester === semester) &&
            (!examType || question.exam_type === examType)
        );

    });

    const count = document.getElementById("studentPQResultCount");

    if (count) {
        count.textContent = `${filtered.length} paper(s)`;
    }

    if (!filtered.length) {

        recordsContainer.innerHTML = `
            <div class="pq-student-empty">
                <h3>No examination papers found</h3>
                <p>Try changing your search or filters.</p>
            </div>
        `;

        return;
    }

    recordsContainer.innerHTML = filtered.map(question => {

        const course = question.courses || {};

        const level =
            course.academic_levels?.level_number || "N/A";

        const pageCount =
            question.past_question_images?.length || 0;

        const formatLabel = question.file_type === "pdf"
            ? "PDF Document"
            : `${pageCount} Image Page(s)`;

        return `

            <article class="pq-student-card">

                <div class="pq-student-card-top">

                    <span class="pq-student-format">
                        ${question.file_type === "pdf" ? "PDF" : "IMAGE ALBUM"}
                    </span>

                    <span class="pq-student-level">
                        ${escapeStudentPQHTML(level)} Level
                    </span>

                </div>

                <h3>
                    ${escapeStudentPQHTML(question.title)}
                </h3>

                <p class="pq-student-course">
                    ${escapeStudentPQHTML(course.course_code || "")}
                    — ${escapeStudentPQHTML(course.course_title || "")}
                </p>

                <div class="pq-student-details">

                    <span>
                        ${escapeStudentPQHTML(question.academic_sessions?.session_name || "Session unavailable")}
                    </span>

                    <span>
                        ${escapeStudentPQHTML(question.academic_semesters?.semester_name || "Semester unavailable")}
                    </span>

                    <span>
                        ${escapeStudentPQHTML(question.exam_type)}
                    </span>

                </div>

                <div class="pq-student-card-bottom">

                    <span>${formatLabel}</span>

                    <button
                        class="student-pq-open"
                        data-id="${question.id}"
                    >
                        Open Paper
                    </button>

                </div>

            </article>

        `;

    }).join("");

}

/* =========================================
   FILTER EVENTS
========================================= */

function attachStudentPastQuestionEvents() {

    const filterIds = [
        "studentPQSearch",
        "studentPQLevel",
        "studentPQCourse",
        "studentPQSession",
        "studentPQSemester",
        "studentPQExamType"
    ];

    filterIds.forEach(id => {

        const element = document.getElementById(id);

        if (!element) return;

        element.addEventListener("input", renderStudentPQRecords);
        element.addEventListener("change", renderStudentPQRecords);

    });

    document.getElementById("studentPQRecords")
        ?.addEventListener("click", event => {

            const button = event.target.closest(".student-pq-open");

            if (!button) return;

            openStudentPastQuestion(button.dataset.id);

        });

}
/* =========================================
   SELECTED IMAGE ALBUM
========================================= */

let selectedImageUrls = [];

/* =========================================
   OPEN AN EXAMINATION PAPER
========================================= */

async function openStudentPastQuestion(id) {

    const question = studentPastQuestions.find(
        item => item.id === id
    );

    if (!question) return;

    selectedPastQuestion = question;

    const viewer = document.getElementById("studentPQViewer");

    if (!viewer) return;

    viewer.innerHTML = `
        <div class="pq-student-loading">
            Opening examination paper...
        </div>
    `;

    try {

        /* =================================
           PDF PAPER
        ================================= */

        if (question.file_type === "pdf") {

            if (!question.pdf_storage_path) {
                throw new Error("PDF file is missing.");
            }

            const { data, error } = await supabase.storage
                .from("past-questions")
                .createSignedUrl(
                    question.pdf_storage_path,
                    3600,
                    { download: false }
                );

            if (error) throw error;

            const downloadResult = await supabase.storage
                .from("past-questions")
                .createSignedUrl(
                    question.pdf_storage_path,
                    3600,
                    { download: true }
                );

            if (downloadResult.error) {
                throw downloadResult.error;
            }

            viewer.innerHTML = `

                <div class="pq-student-viewer-overlay">

                    <div class="pq-student-viewer">

                        <div class="pq-student-viewer-header">

                            <div>
                                <h3>
                                    ${escapeStudentPQHTML(question.title)}
                                </h3>
                                <p>PDF Examination Paper</p>
                            </div>

                            <button
                                class="student-pq-close"
                                type="button"
                            >
                                ✕
                            </button>

                        </div>

                        <div class="pq-student-pdf-actions">

                            <a
                                href="${escapeStudentPQHTML(downloadResult.data.signedUrl)}"
                                download="${escapeStudentPQHTML(question.pdf_file_name || "past-question.pdf")}"
                                target="_blank"
                                rel="noopener"
                            >
                                Download PDF
                            </a>

                            <a
                                href="${escapeStudentPQHTML(data.signedUrl)}"
                                target="_blank"
                                rel="noopener"
                            >
                                Open in New Tab
                            </a>

                        </div>

                        <iframe
                            class="pq-student-pdf-frame"
                            src="${escapeStudentPQHTML(data.signedUrl)}"
                            title="Past question PDF"
                        ></iframe>

                    </div>

                </div>

            `;

            attachStudentPQViewerEvents();

            return;

        }

        /* =================================
           IMAGE ALBUM
        ================================= */

        const images = question.past_question_images || [];

        if (!images.length) {
            throw new Error("This image album has no pages.");
        }

        selectedImageIndex = 0;

        selectedImageUrls = [];

        for (const image of images) {

            const { data, error } = await supabase.storage
                .from("past-questions")
                .createSignedUrl(image.storage_path, 3600);

            if (error) throw error;

            selectedImageUrls.push(data.signedUrl);

        }

        renderStudentImageViewer(question);

    } catch (error) {

        console.error("Past Question Viewer Error:", error);

        viewer.innerHTML = `
            <div class="pq-student-error">
                <p>${escapeStudentPQHTML(error.message)}</p>

                <button
                    type="button"
                    class="student-pq-close"
                >
                    Close
                </button>
            </div>
        `;

        attachStudentPQViewerEvents();

    }

}

/* =========================================
   VIEWER CLOSE EVENTS
========================================= */

function attachStudentPQViewerEvents() {

    const viewer = document.getElementById("studentPQViewer");

    if (!viewer) return;

    viewer.querySelectorAll(".student-pq-close").forEach(button => {

        button.addEventListener("click", closeStudentPQViewer);

    });

}

/* =========================================
   CLOSE VIEWER
========================================= */

function closeStudentPQViewer() {

    const viewer = document.getElementById("studentPQViewer");

    if (viewer) {
        viewer.innerHTML = "";
    }

    selectedPastQuestion = null;
    selectedImageUrls = [];
    selectedImageIndex = 0;

}
/* =========================================
   IMAGE ALBUM VIEWER
========================================= */

function renderStudentImageViewer(question) {

    const viewer = document.getElementById("studentPQViewer");

    if (!viewer) return;

    const images = question.past_question_images || [];

    const totalPages = images.length;

    const currentImage = images[selectedImageIndex];

    viewer.innerHTML = `

        <div class="pq-student-viewer-overlay">

            <div class="pq-student-viewer">

                <div class="pq-student-viewer-header">

                    <div>
                        <h3>${escapeStudentPQHTML(question.title)}</h3>
                        <p>Image Examination Album</p>
                    </div>

                    <button
                        class="student-pq-close"
                        type="button"
                    >
                        ✕
                    </button>

                </div>

                <div class="pq-student-image-toolbar">

                    <span>
                        Page ${selectedImageIndex + 1} of ${totalPages}
                    </span>

                    <button
                        type="button"
                        id="studentPQZoom"
                    >
                        Zoom Image
                    </button>

                </div>

                <div
                    class="pq-student-image-stage"
                    id="studentPQImageStage"
                >
                    <img
                        id="studentPQCurrentImage"
                        src="${escapeStudentPQHTML(selectedImageUrls[selectedImageIndex])}"
                        alt="Examination page ${selectedImageIndex + 1}"
                    >
                </div>

                <div class="pq-student-image-navigation">

                    <button
                        type="button"
                        id="studentPQPrevious"
                        ${selectedImageIndex === 0 ? "disabled" : ""}
                    >
                        Previous
                    </button>

                    <button
                        type="button"
                        id="studentPQNext"
                        ${selectedImageIndex === totalPages - 1 ? "disabled" : ""}
                    >
                        Next
                    </button>

                </div>

                <div class="pq-student-album-actions">

                    <button
                        type="button"
                        id="studentPQDownloadAlbum"
                    >
                        Download Entire Album (ZIP)
                    </button>

                </div>

                <p
                    id="studentPQAlbumMessage"
                    class="pq-student-album-message"
                ></p>

            </div>

        </div>

    `;

    attachStudentPQViewerEvents();

    document.getElementById("studentPQPrevious")
        ?.addEventListener("click", () => {

            if (selectedImageIndex > 0) {
                selectedImageIndex--;
                renderStudentImageViewer(question);
            }

        });

    document.getElementById("studentPQNext")
        ?.addEventListener("click", () => {

            if (selectedImageIndex < totalPages - 1) {
                selectedImageIndex++;
                renderStudentImageViewer(question);
            }

        });

    document.getElementById("studentPQZoom")
        ?.addEventListener("click", () => {

            const image = document.getElementById(
                "studentPQCurrentImage"
            );

            if (!image) return;

            const zoomed = image.classList.toggle("pq-image-zoomed");

            document.getElementById("studentPQZoom").textContent =
                zoomed ? "Reset Zoom" : "Zoom Image";

        });

    document.getElementById("studentPQDownloadAlbum")
        ?.addEventListener("click", downloadStudentPQAlbum);

    /* Swipe navigation on touch screens. */

    const stage = document.getElementById("studentPQImageStage");

    let touchStartX = 0;

    stage?.addEventListener("touchstart", event => {

        touchStartX = event.changedTouches[0].screenX;

    }, { passive: true });

    stage?.addEventListener("touchend", event => {

        const touchEndX = event.changedTouches[0].screenX;

        const difference = touchEndX - touchStartX;

        if (Math.abs(difference) < 60) return;

        if (difference < 0 && selectedImageIndex < totalPages - 1) {

            selectedImageIndex++;
            renderStudentImageViewer(question);

        } else if (difference > 0 && selectedImageIndex > 0) {

            selectedImageIndex--;
            renderStudentImageViewer(question);

        }

    }, { passive: true });

}

/* =========================================
   DOWNLOAD IMAGE ALBUM AS ZIP
========================================= */

async function downloadStudentPQAlbum() {

    const button = document.getElementById(
        "studentPQDownloadAlbum"
    );

    const message = document.getElementById(
        "studentPQAlbumMessage"
    );

    if (!selectedPastQuestion) return;

    if (typeof JSZip === "undefined") {

        message.textContent =
            "ZIP download library is not loaded yet.";

        return;

    }

    const images = selectedPastQuestion.past_question_images || [];

    if (!images.length) {

        message.textContent = "No image pages are available.";

        return;

    }

    button.disabled = true;
    button.textContent = "Preparing ZIP...";

    try {

        const zip = new JSZip();

        for (let index = 0; index < images.length; index++) {

            message.textContent =
                `Preparing page ${index + 1} of ${images.length}...`;

            const response = await fetch(selectedImageUrls[index]);

            if (!response.ok) {
                throw new Error(`Unable to download page ${index + 1}.`);
            }

            const imageBlob = await response.blob();

            const originalName = images[index].file_name || "";

            const extension = originalName.includes(".")
                ? originalName.split(".").pop()
                : "jpg";

            const fileName =
                `Page-${String(index + 1).padStart(3, "0")}.${extension}`;

            zip.file(fileName, imageBlob);

        }

        message.textContent = "Creating ZIP file...";

        const zipBlob = await zip.generateAsync({
            type: "blob"
        });

        const downloadUrl = URL.createObjectURL(zipBlob);

        const link = document.createElement("a");

        link.href = downloadUrl;

        link.download =
            `${selectedPastQuestion.title.replace(/[^a-z0-9_-]/gi, "_")}.zip`;

        document.body.appendChild(link);

        link.click();

        link.remove();

        URL.revokeObjectURL(downloadUrl);

        message.textContent = "Album ZIP download started successfully.";

    } catch (error) {

        console.error("Album ZIP Error:", error);

        message.textContent =
            error.message || "Unable to create album ZIP.";

    } finally {

        button.disabled = false;

        button.textContent = "Download Entire Album (ZIP)";

    }

}