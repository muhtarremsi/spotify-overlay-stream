const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID || "f43c4064e6524c169b69d773a12277eb";
const redirectUri = window.location.origin;

async function main() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");

    let accessToken = localStorage.getItem("access_token");
    const refreshToken = localStorage.getItem("refresh_token");
    const expiresAt = localStorage.getItem("expires_at");

    if (code) {
        accessToken = await getAccessToken(clientId, code);
        window.history.replaceState({}, document.title, "/"); 
    } else if (refreshToken && Date.now() > Number(expiresAt)) {
        accessToken = await refreshAccessToken(clientId, refreshToken);
    } else if (!accessToken) {
        redirectToAuthCodeFlow(clientId);
        return;
    }

    let currentTrackId = "";

    setInterval(async () => {
        const expires = localStorage.getItem("expires_at");
        if (Date.now() > Number(expires)) {
            const rt = localStorage.getItem("refresh_token");
            accessToken = await refreshAccessToken(clientId, rt!);
        }

        const track = await fetchNowPlaying(accessToken!);
        if (track && track.item && track.item.id !== currentTrackId) {
            currentTrackId = track.item.id;
            updateUI(track.item);
        }
    }, 5000);
}

function updateUI(item: any) {
    const nameElem = document.getElementById("track-name");
    const artistElem = document.getElementById("artist-name");
    const artElem = document.getElementById("track-art");
    const infoElem = document.getElementById("track-info");

    if (nameElem) nameElem.innerText = item.name;
    if (artistElem) artistElem.innerText = item.artists.map((a: any) => a.name).join(", ");
    if (artElem && item.album.images[0]) {
        artElem.innerHTML = `<img src="${item.album.images[0].url}" />`;
    }

    // Animation kurz resetten bei Songwechsel
    if (infoElem) {
        infoElem.style.animation = 'none';
        infoElem.offsetHeight; // Trigger Reflow
        infoElem.style.animation = 'fadeLoop 8s infinite ease-in-out';
    }
}

async function getAccessToken(clientId: string, code: string) {
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
    saveTokens(data);
    return data.access_token;
}

async function refreshAccessToken(clientId: string, refreshToken: string) {
    const params = new URLSearchParams();
    params.append("client_id", clientId);
    params.append("grant_type", "refresh_token");
    params.append("refresh_token", refreshToken);
    const result = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params
    });
    const data = await result.json();
    saveTokens(data);
    return data.access_token;
}

function saveTokens(data: any) {
    if (data.access_token) localStorage.setItem("access_token", data.access_token);
    if (data.refresh_token) localStorage.setItem("refresh_token", data.refresh_token);
    if (data.expires_in) localStorage.setItem("expires_at", (Date.now() + data.expires_in * 1000).toString());
}

async function fetchNowPlaying(token: string) {
    const result = await fetch("https://api.spotify.com/v1/me/player/currently-playing", {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` }
    });
    if (result.status === 204 || result.status > 400) return null;
    return await result.json();
}

async function redirectToAuthCodeFlow(clientId: string) {
    const verifier = generateCodeVerifier(128);
    const challenge = await generateCodeChallenge(verifier);
    localStorage.setItem("verifier", verifier);
    const p = new URLSearchParams();
    p.append("client_id", clientId);
    p.append("response_type", "code");
    p.append("redirect_uri", redirectUri);
    p.append("scope", "user-read-currently-playing user-read-playback-state");
    p.append("code_challenge_method", "S256");
    p.append("code_challenge", challenge);
    document.location = `https://accounts.spotify.com/authorize?${p.toString()}`;
}

function generateCodeVerifier(l: number) {
    let t = '';
    let p = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < l; i++) t += p.charAt(Math.floor(Math.random() * p.length));
    return t;
}

async function generateCodeChallenge(v: string) {
    const d = new TextEncoder().encode(v);
    const g = await window.crypto.subtle.digest('SHA-256', d);
    return btoa(String.fromCharCode.apply(null, [...new Uint8Array(g)]))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

main();
