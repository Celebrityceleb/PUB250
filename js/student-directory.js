
import { supabase } from "./config.js";

/* =========================================
   STUDENT DIRECTORY
   PUB250 STUDENT PORTAL
========================================= */

let directoryContainer = null;
let directoryStudents = [];
let directorySearchTerm = "";


/* =========================================
   HELPER FUNCTIONS
========================================= */

function directoryEscape(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        };

        return entities[character];
    });
}


function directoryInitials(name) {
    const words = String(name || "Student")
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    if (words.length === 0) return "S";

    if (words.length === 1) {
        return words[0].charAt(0).toUpperCase();
    }

    return (
        words[0].charAt(0) +
        words[words.length - 1].charAt(0)
    ).toUpperCase();
}


function directoryAvatar(student, large = false) {

    const name = directoryEscape(
        student.full_name || "Student"
    );

    const avatar = String(
        student.avatar_url || ""
    ).trim();

    const avatarClass = large
        ? "student-directory-avatar large"
        : "student-directory-avatar";

    if (/^https?:\/\//i.test(avatar)) {

        return `
            <div class="${avatarClass}">
                <img
                    src="${directoryEscape(avatar)}"
                    alt="${name}"
                    loading="lazy"
                >
            </div>
        `;
    }

    return `
        <div class="${avatarClass} initials-avatar">
            ${directoryEscape(
                directoryInitials(student.full_name)
            )}
        </div>
    `;
}


/* =========================================
   LOAD STUDENT DIRECTORY
========================================= */

export async function loadStudentDirectory(container) {

    directoryContainer = container;
    directorySearchTerm = "";
    directoryStudents = [];

    directoryContainer.innerHTML = `
        <div class="student-directory-page">

            <div class="student-directory-heading">

                <span class="student-directory-eyebrow">
                    CLASS COMMUNITY
                </span>

                <h2>Student Directory</h2>

                <p>
                    Discover other approved students in the
                    PUB250 admission set.
                </p>

            </div>

            <div class="student-directory-loading">
                Loading student directory...
            </div>

        </div>
    `;

    try {

        const { data, error } = await supabase.rpc(
            "get_student_directory"
        );

        if (error) throw error;

        directoryStudents = Array.isArray(data) ? data : [];

        renderStudentDirectory();

    } catch (error) {

        console.error(
            "Student directory loading failed:",
            error
        );

        directoryContainer.innerHTML = `
            <div class="student-directory-page">

                <div class="student-directory-heading">

                    <span class="student-directory-eyebrow">
                        CLASS COMMUNITY
                    </span>

                    <h2>Student Directory</h2>

                </div>

                <div class="student-directory-empty">

                    <strong>Unable to load the directory</strong>

                    <p>
                        Something went wrong while retrieving
                        student profiles. Please try again.
                    </p>

                    <button
                        class="student-directory-retry"
                        data-directory-retry
                    >
                        Try Again
                    </button>

                </div>

            </div>
        `;

        directoryContainer.querySelector(
            "[data-directory-retry]"
        )?.addEventListener("click", () => {
            loadStudentDirectory(directoryContainer);
        });
    }
}


/* =========================================
   RENDER DIRECTORY PAGE
========================================= */

function renderStudentDirectory() {

    directoryContainer.innerHTML = `
        <div class="student-directory-page">

            <div class="student-directory-heading">

                <span class="student-directory-eyebrow">
                    CLASS COMMUNITY
                </span>

                <h2>Student Directory</h2>

                <p>
                    Discover other approved students in the
                    PUB250 admission set.
                </p>

            </div>


            <!-- SEARCH -->

            <div class="student-directory-search">

                <span class="student-directory-search-icon">
                    ⌕
                </span>

                <input
                    type="search"
                    id="studentDirectorySearch"
                    placeholder="Search students by name..."
                    autocomplete="off"
                >

            </div>


            <!-- DIRECTORY COUNT -->

            <div class="student-directory-toolbar">

                <h3>Class Members</h3>

                <span id="studentDirectoryCount">
                    0 students
                </span>

            </div>


            <!-- STUDENT CARDS -->

            <div
                class="student-directory-grid"
                id="studentDirectoryResults"
            ></div>

        </div>
    `;

    renderStudentDirectoryResults();

    directoryContainer.oninput = event => {

        if (event.target.id !== "studentDirectorySearch") {
            return;
        }

        directorySearchTerm = event.target.value
            .trim()
            .toLowerCase();

        renderStudentDirectoryResults();
    };

    directoryContainer.onclick = event => {

        const retryButton = event.target.closest(
            "[data-directory-retry]"
        );

        if (retryButton) {
            loadStudentDirectory(directoryContainer);
            return;
        }

        const backButton = event.target.closest(
            "[data-directory-back]"
        );

        if (backButton) {
            renderStudentDirectory();
            return;
        }

        const profileButton = event.target.closest(
            "[data-student-id]"
        );

        if (profileButton) {

            const student = directoryStudents.find(
                item => item.id === profileButton.dataset.studentId
            );

            if (student) {
                renderStudentProfile(student);
            }
        }
    };
}


/* =========================================
   RENDER SEARCH RESULTS
========================================= */

function renderStudentDirectoryResults() {

    const resultsContainer = directoryContainer.querySelector(
        "#studentDirectoryResults"
    );

    const countContainer = directoryContainer.querySelector(
        "#studentDirectoryCount"
    );

    if (!resultsContainer || !countContainer) return;

    const filteredStudents = directoryStudents.filter(student => {

        const name = String(student.full_name || "")
            .toLowerCase();

        return name.includes(directorySearchTerm);
    });


    countContainer.textContent =
        `${filteredStudents.length} ${
            filteredStudents.length === 1
                ? "student"
                : "students"
        }`;


    if (filteredStudents.length === 0) {

        resultsContainer.innerHTML = `
            <div class="student-directory-empty">

                <strong>
                    ${
                        directorySearchTerm
                            ? "No matching student found"
                            : "No student profiles available yet"
                    }
                </strong>

                <p>
                    ${
                        directorySearchTerm
                            ? "Try searching with another name."
                            : "Approved student profiles will appear here."
                    }
                </p>

            </div>
        `;

        return;
    }


    resultsContainer.innerHTML = filteredStudents.map(student => {

        const name = directoryEscape(
            student.full_name || "Student"
        );

        return `
            <button
                type="button"
                class="student-directory-card"
                data-student-id="${directoryEscape(student.id)}"
            >

                ${directoryAvatar(student)}

                <div class="student-directory-card-info">

                    <h4>${name}</h4>

                    <span>Public Administration</span>

                </div>

                <span class="student-directory-card-arrow">
                    ›
                </span>

            </button>
        `;

    }).join("");
}


/* =========================================
   INDIVIDUAL STUDENT PROFILE
========================================= */

function renderStudentProfile(student) {

    const name = directoryEscape(
        student.full_name || "Student"
    );

    directoryContainer.innerHTML = `
        <div class="student-directory-page">

            <button
                type="button"
                class="student-directory-back"
                data-directory-back
            >
                ← Back to Student Directory
            </button>


            <div class="student-directory-profile">

                <div class="student-directory-profile-header">

                    ${directoryAvatar(student, true)}

                    <span class="student-directory-profile-label">
                        APPROVED STUDENT
                    </span>

                    <h2>${name}</h2>

                    <p>Public Administration</p>

                </div>


                <div class="student-directory-profile-details">

                    <div class="student-directory-profile-section">

                        <span class="student-directory-eyebrow">
                            PROFILE INFORMATION
                        </span>

                        <h3>Student Profile</h3>

                        <div class="student-directory-profile-detail">

                            <span>Full Name</span>

                            <strong>${name}</strong>

                        </div>

                        <div class="student-directory-profile-detail">

                            <span>Programme</span>

                            <strong>Public Administration</strong>

                        </div>

                        <div class="student-directory-profile-detail">

                            <span>Admission Set</span>

                            <strong>2025</strong>

                        </div>

                    </div>


                    <div class="student-directory-private-note">

                        <span>🔒</span>

                        <p>
                            Personal contact details and
                            matriculation information are kept private.
                        </p>

                    </div>

                </div>

            </div>

        </div>
    `;
}
