
import { supabase } from "./config.js";

/* =================================
   STUDENT ASSIGNMENTS
================================= */

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
}

function formatAssignmentDate(date) {
    if (!date) return "Not specified";

    return new Date(date + "T00:00:00").toLocaleDateString(
        "en-GB",
        {
            day: "numeric",
            month: "short",
            year: "numeric"
        }
    );
}

function formatAssignmentFileSize(bytes) {
    if (!bytes || bytes <= 0) return "";

    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* =================================
   LOAD STUDENT ASSIGNMENTS
================================= */

export async function loadStudentAssignments(container) {

    container.innerHTML = `
        <div class="student-assignment-loading">
            <p>Loading assignments...</p>
        </div>
    `;

    try {

        const today = new Date().toISOString().slice(0, 10);

        const { data: assignments, error } = await supabase
            .from("assignments")
            .select(`
                id,
                assignment_text,
                publication_date,
                submission_date,
                courses (
                    course_code,
                    course_title
                ),
                assignment_documents (
                    id,
                    file_name,
                    file_path,
                    file_size,
                    file_type
                )
            `)
            .eq("status", "published")
            .lte("publication_date", today)
            .order("submission_date", {
                ascending: true
            });

        if (error) throw error;

        if (!assignments || assignments.length === 0) {
            container.innerHTML = `
                <div class="student-assignment-empty">
                    <h3>No Assignments Available</h3>
                    <p>
                        Published assignments will appear here
                        when they become available.
                    </p>
                </div>
            `;
            return;
        }

        const assignmentCards = await Promise.all(
            assignments.map(async assignment => {

                const course = assignment.courses || {};

                const documents = assignment.assignment_documents || [];

                const documentLinks = await Promise.all(
                    documents.map(async doc => {

                        const { data, error } = await supabase.storage
                            .from("assignment-documents")
                            .createSignedUrl(doc.file_path, 300);

                        if (error || !data?.signedUrl) {
                            return `
                                <div class="student-assignment-file">
                                    <span>
                                        ${escapeHTML(doc.file_name)}
                                    </span>
                                    <span class="student-assignment-file-error">
                                        Download unavailable
                                    </span>
                                </div>
                            `;
                        }

                        return `
                            <div class="student-assignment-file">
                                <div class="student-assignment-file-info">
                                    <span class="student-assignment-file-name">
                                        ${escapeHTML(doc.file_name)}
                                    </span>

                                    <small>
                                        ${formatAssignmentFileSize(doc.file_size)}
                                    </small>
                                </div>

                                <a
                                    class="student-assignment-download"
                                    href="${escapeHTML(data.signedUrl)}"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    download
                                >
                                    Download
                                </a>
                            </div>
                        `;
                    })
                );

                return `
                    <article class="student-assignment-card">

                        <div class="student-assignment-header">
                            <div>
                                <span class="student-assignment-course">
                                    ${escapeHTML(course.course_code || "Course")}
                                </span>

                                <h3>
                                    ${escapeHTML(course.course_title || "Untitled Course")}
                                </h3>
                            </div>
                        </div>

                        <div class="student-assignment-body">
                            <p>
                                ${escapeHTML(assignment.assignment_text)
                                    .replace(/\n/g, "<br>")}
                            </p>
                        </div>

                        <div class="student-assignment-meta">
                            <div>
                                <small>Published</small>
                                <strong>
                                    ${formatAssignmentDate(assignment.publication_date)}
                                </strong>
                            </div>

                            <div>
                                <small>Submission Deadline</small>
                                <strong>
                                    ${formatAssignmentDate(assignment.submission_date)}
                                </strong>
                            </div>
                        </div>

                        ${
                            documentLinks.length > 0
                                ? `
                                    <div class="student-assignment-documents">
                                        <h4>Attached Documents</h4>
                                        ${documentLinks.join("")}
                                    </div>
                                `
                                : ""
                        }

                    </article>
                `;
            })
        );

        container.innerHTML = `
            <div class="student-assignments-page">

                <div class="student-assignments-heading">
                    <h2>Published Assignments</h2>
                    <p>
                        View your course assignments and download
                        any attached instructions.
                    </p>
                </div>

                <div class="student-assignments-list">
                    ${assignmentCards.join("")}
                </div>

            </div>
        `;

    } catch (error) {

        console.error("Student assignments error:", error);

        container.innerHTML = `
            <div class="student-assignment-empty">
                <h3>Unable to Load Assignments</h3>
                <p>
                    ${escapeHTML(error.message || "Something went wrong.")}
                </p>

                <button
                    type="button"
                    class="student-assignment-retry"
                    onclick="location.reload()"
                >
                    Reload Page
                </button>
            </div>
        `;
    }
}
