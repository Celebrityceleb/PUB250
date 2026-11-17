
import { supabase } from "./config.js";


// Get the currently authenticated user's profile.
export async function getCurrentProfile() {

    const { data: { user }, error: userError } =
        await supabase.auth.getUser();

    if (userError || !user) {
        return null;
    }

    const { data: profile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

    if (error) {
        console.error("Profile loading error:", error.message);
        return null;
    }

    return profile;
}


// Extract the actual error returned by an Edge Function.
async function getFunctionError(error) {

    let message = error?.message || "Unknown login error.";

    if (error?.context) {

        try {

            const response = error.context.clone
                ? error.context.clone()
                : error.context;

            const responseText = await response.text();

            if (responseText) {

                try {
                    const responseData = JSON.parse(responseText);

                    message =
                        responseData.error ||
                        responseData.message ||
                        responseData.msg ||
                        responseText;

                } catch {
                    message = responseText;
                }
            }

        } catch (readError) {

            console.error(
                "Could not read Edge Function error:",
                readError
            );

        }
    }

    return message;
}


// Student login using matric number and access code.
export async function studentLogin(matricNo, accessCode) {

    try {

        const { data, error } = await supabase.functions.invoke(
            "student-login-",
            {
                body: {
                    matric_no: matricNo.trim(),
                    access_code: accessCode.trim()
                }
            }
        );

        // Expose the actual Edge Function error.
        if (error) {

            const actualError = await getFunctionError(error);

            console.error("Student login function error:", actualError);

            throw new Error(actualError);
        }

        if (!data) {
            throw new Error(
                "The student-login function returned an empty response."
            );
        }

        if (data.success === false || data.error) {

            throw new Error(
                data.error ||
                data.message ||
                "The student login function rejected the request."
            );
        }

        // Accept the session returned by the Edge Function.
        const session = data.session || data;

        if (!session.access_token || !session.refresh_token) {

            console.error(
                "Student login response is missing session tokens:",
                data
            );

            throw new Error(
                "Login response did not contain a valid student session."
            );
        }

        const { error: sessionError } =
            await supabase.auth.setSession({
                access_token: session.access_token,
                refresh_token: session.refresh_token
            });

        if (sessionError) {
            throw new Error(
                "Session creation failed: " + sessionError.message
            );
        }

        // Verify the student's actual profile.
        const profile = await getCurrentProfile();

        if (!profile) {

            await supabase.auth.signOut();

            throw new Error(
                "Login succeeded, but the student profile could not be loaded."
            );
        }

        if (profile.role !== "student") {

            await supabase.auth.signOut();

            throw new Error(
                "This account is not registered as a student account."
            );
        }

        if (profile.approval_status !== "approved") {

            await supabase.auth.signOut();

            throw new Error(
                "Your student account has not been approved."
            );
        }

        return {
            success: true,
            profile
        };

    } catch (error) {

        console.error("Student login failed:", error);

        throw error;
    }
}


// Admin login using email and password.
export async function adminLogin(email, password) {

    const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
    });

    if (error) {
        throw new Error(error.message);
    }

    const profile = await getCurrentProfile();

    if (!profile) {

        await supabase.auth.signOut();

        throw new Error(
            "Unable to load your administrator profile."
        );
    }

    if (
        profile.role !== "super_admin" &&
        profile.role !== "course_rep"
    ) {

        await supabase.auth.signOut();

        throw new Error(
            "This account does not have administrator access."
        );
    }

    if (profile.approval_status !== "approved") {

        await supabase.auth.signOut();

        throw new Error(
            "Your administrator account is not approved."
        );
    }

    return {
        success: true,
        profile,
        user: data.user
    };
}


// Protect student-only pages.
export async function requireStudent() {

    const profile = await getCurrentProfile();

    if (
        !profile ||
        profile.role !== "student" ||
        profile.approval_status !== "approved"
    ) {

        await supabase.auth.signOut();

        window.location.href = "login.html";

        return null;
    }

    return profile;
}


// Protect administrator pages.
export async function requireAdmin() {

    const profile = await getCurrentProfile();

    if (
        !profile ||
        (
            profile.role !== "super_admin" &&
            profile.role !== "course_rep"
        ) ||
        profile.approval_status !== "approved"
    ) {

        await supabase.auth.signOut();

        window.location.href = "admin.html";

        return null;
    }

    return profile;
}


// Sign out the currently authenticated user.
export async function logout() {

    const { error } = await supabase.auth.signOut();

    if (error) {
        throw new Error(error.message);
    }

    window.location.href = "index.html";
                    }
        
