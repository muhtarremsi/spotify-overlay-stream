const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID || "f43c4064e6524c169b69d773a12277eb";
const redirectUri = window.location.origin;

const params = new URLSearchParams(window.location.search);
const code = params.get("code");

if (!code) {
    redirectToAuthCodeFlow(clientId);
} else {
    try {
        const accessToken = await getAccessToken(clientId, code);
        const profile = await fetchProfile(accessToken);
        populateUI(profile);
    } catch (error) {
        console.error("Fehler beim Laden des Profils:", error);
    }
}

async function redirectToAuthCodeFlow(clientId: string) {
    const verifier = generateCodeVerifier(128);
    const challenge = await generateCodeChallenge(verifier);

    localStorage.setItem("verifier", verifier);

    const params = new URLSearchParams();
    params.append("client_id", clientId);
    params.append("response_type", "code");
    params.append("redirect_uri", redirectUri);
    params.append("scope", "user-read-private user-read-email");
    params.append("code_challenge_method", "S256");
    params.append("code_challenge", challenge);

    document.location = `https://accounts.spotify.com/authorize?${params.toString()}`;
}

function generateCodeVerifier(length: number) {
    let text = '';
    let possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

async function generateCodeChallenge(codeVerifier: string) {
    const data = new TextEncoder().encode(codeVerifier);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode.apply(null, [...new Uint8Array(digest)]))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

async function getAccessToken(clientId: string, code: string): Promise<string> {
    const verifier = localStorage.getItem("verifier");

    const params = new URLSearchParams();
    params.append("client_id", clientId);
    params.append("grant_type", "authorization_code");
    params.append("code", code);
    params.append("redirect_uri", redirectUri);
    params.append("code_verifier", verifier!);

    const result = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params
    });

    const data = await result.json();
    return data.access_token;
}

async function fetchProfile(token: string): Promise<any> {
    const result = await fetch("https://api.spotify.com/v1/me", {
        method: "GET", 
        headers: { Authorization: `Bearer ${token}` }
    });

    return await result.json();
}

function populateUI(profile: any) {
    const displayNameElem = document.getElementById("displayName");
    const avatarElem = document.getElementById("avatar");
    const idElem = document.getElementById("id");
    const emailElem = document.getElementById("email");
    const uriElem = document.getElementById("uri");
    const urlElem = document.getElementById("url");
    const imgUrlElem = document.getElementById("imgUrl");

    if (displayNameElem) displayNameElem.innerText = profile.display_name;
    if (idElem) idElem.innerText = profile.id;
    if (emailElem) emailElem.innerText = profile.email;
    
    if (avatarElem && profile.images && profile.images[0]) {
        avatarElem.innerHTML = ''; 
        const profileImage = new Image(200, 200);
        profileImage.src = profile.images[0].url;
        avatarElem.appendChild(profileImage);
        if (imgUrlElem) imgUrlElem.innerText = profile.images[0].url;
    }

    if (uriElem) {
        uriElem.innerText = profile.uri;
        uriElem.setAttribute("href", profile.external_urls.spotify);
    }
    
    if (urlElem) {
        urlElem.innerText = profile.href;
        urlElem.setAttribute("href", profile.href);
    }
}