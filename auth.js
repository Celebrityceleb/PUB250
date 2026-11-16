
import { supabase } from "./config.js";

// Get the authenticated user's profile.
export async function getCurrentProfile() {
    const {
        data: { user },
        error: userError
    } = await supabase.auth.getUser();

    if (userError || !user) {
        return null;
    }

    const { data: profile, error } = await supabase
        .from("profiles")
        .select(`
            id,
            full_name,
            matric_no,
            email,
            role,
            approval_status,
            avatar_url
        `)
        .eq("id", user.id)
        .single();

    if (error) {
        throw new Error("Unable to retrieve your account profile.");
    }

    return profile;
}


// STUDENT LOGIN
export async function studentLogin(matricNo, accessCode) {
    const { data, error } = await supabase.functions.invoke(
        "student-login",
        {
            body: {
                matric_no: matricNo.trim().toUpperCase(),
                access_code: accessCode.trim().toUpperCase()
            }
        }
    );

    if (error) {
        throw new Error(
            data?.error || "Student login failed. Please try again."
        );
    }

    if (!data?.success || !data?.session) {
        throw new Error(
            data?.error || "Invalid matriculation number or access code."
        );
    }

    // Save the genuine Supabase session.
    const { error: sessionError } = await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token
    });

    if (sessionError) {
        throw new Error("Unable to establish your login session.");
    }

    // Confirm the account has student access.
    try {
        const profile = await getCurrentProfile();

        if (
            !profile ||
            profile.role !== "student" ||
            profile.approval_status !== "approved"
        ) {
            await supabase.auth.signOut();
            throw new Error("This account is not authorised for student access.");
        }

        return profile;

    } catch (error) {
        await supabase.auth.signOut();
        throw error;
    }
}


// ADMINISTRATOR LOGIN
export async function adminLogin(email, password) {
    const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password
    });

    if (error) {
        throw new Error("Invalid administrator email or password.");
    }

    try {
        const profile = await getCurrentProfile();

        if (
            !profile ||
            !["super_admin", "course_rep"].includes(profile.role) ||
            profile.approval_status !== "approved"
        ) {
            await supabase.auth.signOut();
            throw new Error("Administrator access denied.");
        }

        return profile;

    } catch (error) {
        await supabase.auth.signOut();
        throw error;
    }
}


// PROTECT STUDENT PAGES
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


// PROTECT ADMIN PAGES
export async function requireAdmin() {
    const profile = await getCurrentProfile();

    if (
        !profile ||
        !["super_admin", "course_rep"].includes(profile.role) ||
        profile.approval_status !== "approved"
    ) {
        await supabase.auth.signOut();
        window.location.href = "admin.html";
        return null;
    }

    return profile;
}


// SIGN OUT
export async function logout() {
    const { error } = await supabase.auth.signOut();

    if (error) {
        throw new Error("Unable to sign out. Please try again.");
    }

    window.location.href = "index.html";
}
