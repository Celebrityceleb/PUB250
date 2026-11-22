
import { supabase } from "./config.js";

/* =========================================
   PUB250 STUDENT TIMETABLE
========================================= */

let studentTimetableContainer = null;
let studentTimetableTab = "lectures";
let studentLectures = [];
let studentExams = [];


/* =========================================
   HELPERS
========================================= */

function studentTimetableEscape(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
}


function studentTimetableToday() {

    const now = new Date();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}


function studentTimetableDate(date) {

    if (!date) return "—";

    return new Date(date + "T00:00:00").toLocaleDateString(
        "en-GB",
        {
            weekday: "short",
            day: "numeric",
            month: "short",
            year: "numeric"
        }
    );
}


function studentTimetableTime(time) {

    if (!time) return "—";

    const [hours, minutes] = time.split(":");

    return new Date(2000, 0, 1, hours, minutes)
        .toLocaleTimeString("en-GB", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true
        });
}


/* =========================================
   LOAD STUDENT TIMETABLE
========================================= */

export async function loadStudentTimetable(container) {

    studentTimetableContainer = container;

    studentTimetableContainer.innerHTML = `
        <div class="student-timetable-loading">
            Loading your timetable...
        </div>
    `;

    try {

        await loadStudentLectureRecords();

        await loadStudentExamRecords();

        renderStudentTimetable();

    } catch (error) {

        console.error("Student timetable error:", error);

        studentTimetableContainer.innerHTML = `
            <div class="student-timetable-empty">
                <h3>Unable to Load Timetable</h3>
                <p>
                    ${studentTimetableEscape(error.message)}
                </p>
            </div>
        `;
    }
}


/* =========================================
   LOAD PUBLISHED LECTURES
========================================= */

async function loadStudentLectureRecords() {

    const { data, error } = await supabase
        .from("lecture_timetable")
        .select(`
            id,
            lecture_date,
            start_time,
            end_time,
            venue,
            lecturer_name,
            additional_information,
            status,
            courses (
                course_code,
                course_title
            )
        `)
        .in("status", ["published", "cancelled"])
        .gte("lecture_date", studentTimetableToday())
        .order("lecture_date", { ascending: true })
        .order("start_time", { ascending: true });

    if (error) throw error;

    studentLectures = data || [];
}


/* =========================================
   LOAD PUBLISHED EXAM TIMETABLES
========================================= */

async function loadStudentExamRecords() {

    const { data, error } = await supabase
        .from("exam_timetables")
        .select(`
            id,
            title,
            academic_session,
            semester,
            file_name,
            file_path,
            file_size,
            version_number,
            created_at
        `)
        .eq("status", "published")
        .order("created_at", { ascending: false });

    if (error) throw error;

    studentExams = data || [];
}


/* =========================================
   STUDENT TIMETABLE INTERFACE
========================================= */

function renderStudentTimetable() {

    studentTimetableContainer.innerHTML = `

        <div class="student-timetable-page">

            <div class="student-timetable-heading">

                <div>
                    <span class="student-timetable-eyebrow">
                        ACADEMIC INFORMATION
                    </span>

                    <h2>Timetable</h2>

                    <p>
                        View your latest lecture and examination schedules.
                    </p>
                </div>

            </div>


            <div class="student-timetable-tabs">

                <button
                    type="button"
                    class="${studentTimetableTab === "lectures" ? "active" : ""}"
                    data-student-timetable-tab="lectures">
                    Lecture Timetable
                </button>

                <button
                    type="button"
                    class="${studentTimetableTab === "exams" ? "active" : ""}"
                    data-student-timetable-tab="exams">
                    Examination Timetable
                </button>

            </div>


            <div id="studentTimetableContent"></div>

        </div>

    `;


    document.querySelectorAll("[data-student-timetable-tab]")
        .forEach(button => {

            button.addEventListener("click", () => {

                studentTimetableTab =
                    button.dataset.studentTimetableTab;

                renderStudentTimetable();

            });

        });


    if (studentTimetableTab === "lectures") {

        renderStudentLectures();

    } else {

        renderStudentExams();

    }
}


/* =========================================
   LECTURE TIMETABLE DISPLAY
========================================= */

function renderStudentLectures() {

    const content = document.getElementById(
        "studentTimetableContent"
    );

    if (!content) return;

    content.innerHTML = `

        <div class="student-timetable-section">

            <div class="student-timetable-section-heading">
                <h3>Upcoming Lectures</h3>

                <span>
                    ${studentLectures.length} scheduled
                </span>
            </div>


            ${
                studentLectures.length
                    ? studentLectures.map(
                        renderStudentLectureCard
                    ).join("")
                    : `
                        <div class="student-timetable-empty">
                            <h3>No Upcoming Lectures</h3>
                            <p>
                                There are currently no published lectures
                                on your timetable.
                            </p>
                        </div>
                    `
            }

        </div>

    `;
}


/* =========================================
   STUDENT LECTURE CARD
========================================= */

function renderStudentLectureCard(lecture) {

    const course = lecture.courses || {};

    const cancelled = lecture.status === "cancelled";

    return `

        <article class="student-lecture-card ${cancelled ? "lecture-cancelled" : ""}">

            <div class="student-lecture-top">

                <div>
                    <span class="student-lecture-course-code">
                        ${studentTimetableEscape(course.course_code || "COURSE")}
                    </span>

                    <h4>
                        ${studentTimetableEscape(course.course_title || "Untitled Course")}
                    </h4>
                </div>

                <span class="student-lecture-status ${cancelled ? "cancelled" : "published"}">
                    ${cancelled ? "Cancelled" : "Scheduled"}
                </span>

            </div>


            <div class="student-lecture-details">

                <div>
                    <span>Date</span>
                    <strong>
                        ${studentTimetableDate(lecture.lecture_date)}
                    </strong>
                </div>

                <div>
                    <span>Time</span>
                    <strong>
                        ${studentTimetableTime(lecture.start_time)}
                        –
                        ${studentTimetableTime(lecture.end_time)}
                    </strong>
                </div>

                <div>
                    <span>Venue</span>
                    <strong>
                        ${studentTimetableEscape(lecture.venue)}
                    </strong>
                </div>

                ${
                    lecture.lecturer_name
                        ? `
                            <div>
                                <span>Lecturer</span>
                                <strong>
                                    ${studentTimetableEscape(lecture.lecturer_name)}
                                </strong>
                            </div>
                        `
                        : ""
                }

            </div>


            ${
                cancelled
                    ? `
                        <div class="student-lecture-cancellation">
                            This lecture has been cancelled. Do not attend.
                        </div>
                    `
                    : ""
            }


            ${
                lecture.additional_information
                    ? `
                        <p class="student-lecture-note">
                            ${studentTimetableEscape(lecture.additional_information)}
                        </p>
                    `
                    : ""
            }

        </article>

    `;
}

/* =========================================
   EXAMINATION TIMETABLE DISPLAY
========================================= */

function renderStudentExams() {

    const content = document.getElementById(
        "studentTimetableContent"
    );

    if (!content) return;

    content.innerHTML = `

        <div class="student-timetable-section">

            <div class="student-timetable-section-heading">
                <h3>Published Examination Timetables</h3>

                <span>
                    ${studentExams.length} available
                </span>
            </div>


            ${
                studentExams.length
                    ? studentExams.map(
                        renderStudentExamCard
                    ).join("")
                    : `
                        <div class="student-timetable-empty">
                            <h3>No Examination Timetable</h3>
                            <p>
                                No examination timetable has been published yet.
                            </p>
                        </div>
                    `
            }

        </div>

    `;


    document.querySelectorAll("[data-student-exam-download]")
        .forEach(button => {

            button.addEventListener("click", async () => {

                const exam = studentExams.find(
                    item => item.id === button.dataset.studentExamDownload
                );

                if (!exam) return;

                await downloadStudentExam(exam, button);

            });

        });
}


/* =========================================
   STUDENT EXAMINATION CARD
========================================= */

function renderStudentExamCard(exam) {

    const fileSize = exam.file_size
        ? `${(exam.file_size / (1024 * 1024)).toFixed(2)} MB`
        : "PDF document";

    return `

        <article class="student-exam-card">

            <div class="student-exam-icon">
                PDF
            </div>


            <div class="student-exam-information">

                <span class="student-exam-session">
                    ${studentTimetableEscape(exam.academic_session)}
                </span>

                <h4>
                    ${studentTimetableEscape(exam.title)}
                </h4>

                <p>
                    ${studentTimetableEscape(exam.semester)}
                </p>

                <div class="student-exam-file">
                    <span>
                        ${studentTimetableEscape(exam.file_name)}
                    </span>

                    <small>
                        ${studentTimetableEscape(fileSize)}
                        · Version ${exam.version_number}
                    </small>
                </div>

            </div>


            <button
                type="button"
                class="student-exam-download-button"
                data-student-exam-download="${exam.id}">

                View / Download

            </button>

        </article>

    `;
}


/* =========================================
   SECURE EXAMINATION DOWNLOAD
========================================= */

async function downloadStudentExam(exam, button) {

    const originalText = button.textContent;

    button.disabled = true;
    button.textContent = "Preparing PDF...";

    try {

        const { data, error } = await supabase
            .storage
            .from("exam-timetables")
            .createSignedUrl(exam.file_path, 300);

        if (error) throw error;

        if (!data?.signedUrl) {
            throw new Error("Unable to generate a secure download link.");
        }

        window.open(
            data.signedUrl,
            "_blank",
            "noopener,noreferrer"
        );

    } catch (error) {

        console.error("Student exam download error:", error);

        alert(
            error.message ||
            "Unable to open this examination timetable."
        );

    } finally {

        button.disabled = false;
        button.textContent = originalText;

    }
}
