const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID || "f43c4064e6524c169b69d773a12277eb";
const redirectUri = window.location.origin;

async function main() {
    const params = new URLSearchParams(window.location.search);
    const urlRefreshToken = params.get("refresh_token");

    if (urlRefreshToken) {
        localStorage.setItem("refresh_token", urlRefreshToken);
        // URL säubern, um Loops zu verhindern
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    let refreshToken = localStorage.getItem("refresh_token");

    if (!refreshToken) {
        const code = params.get("code");
        if (code) {
            const token = await getAccessToken(clientId, code);
            startMusicLoop(token);
        } else {
            redirectToAuthCodeFlow(clientId);
        }
        return;
    }

    // Wenn Refresh-Token da ist: Direkt zum Refresh und Start!
    try {
        const token = await refreshAccessToken(clientId, refreshToken);
        startMusicLoop(token);
    } catch (e) {
        console.error("Token ungültig, neuer Login nötig");
        localStorage.clear();
        redirectToAuthCodeFlow(clientId);
    }
}

async function startMusicLoop(initialToken: string) {
    let accessToken = initialToken;
    let currentTrackId = "";

    setInterval(async () => {
        const expires = localStorage.getItem("expires_at");
        if (expires && Date.now() > (Number(expires) - 300000)) {
            const rt = localStorage.getItem("refresh_token");
            if (rt) accessToken = await refreshAccessToken(clientId, rt);
        }

        const track = await fetchNowPlaying(accessToken);
        if (track?.item) {
            if (track.item.id !== currentTrackId) {
                currentTrackId = track.item.id;
                updateUI(track.item);
            }
        } else {
            // "Warte auf Musik" Logik
            document.getElementById("track-name")!.innerText = "Warte auf Musik...";
            document.getElementById("artist-name")!.innerText = "Spotify starten";
        }
    }, 5000);
}

// ... (Restliche Hilfsfunktionen: updateUI, getAccessToken, refreshAccessToken, fetchNowPlaying, redirectToAuthCodeFlow wie zuvor)

function updateUI(item: any) {
    const nameElem = document.getElementById("track-name");
    const artistElem = document.getElementById("artist-name");
    const artElem = document.getElementById("track-art");
    if (nameElem) nameElem.innerText = item.name;
    if (artistElem) artistElem.innerText = item.artists.map((a: any) => a.name).join(", ");
    if (artElem && item.album.images[0]) {
        artElem.innerHTML = `<img src="${item.album.images[0].url}" />`;
    }
}

async function refreshAccessToken(clientId: string, refreshToken: string) {
    const params = new URLSearchParams({
        client_id: clientId,
        grant_type: "refresh_token",
        refresh_token: refreshToken
    });
    const result = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params
    });
    const data = await result.json();
    if (data.access_token) {
        localStorage.setItem("access_token", data.access_token);
        localStorage.setItem("expires_at", (Date.now() + data.expires_in * 1000).toString());
        return data.access_token;
    }
    throw new Error("Refresh failed");
}

async function getAccessToken(clientId: string, code: string) {
    const verifier = localStorage.getItem("verifier");
    const params = new URLSearchParams({
        client_id: clientId,
        grant_type: "authorization_code",
        code: code,
        redirect_uri: redirectUri,
        code_verifier: verifier!
    });
    const result = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params
    });
    const data = await result.json();
    localStorage.setItem("refresh_token", data.refresh_token);
    localStorage.setItem("expires_at", (Date.now() + data.expires_in * 1000).toString());
    return data.access_token;
}

async function fetchNowPlaying(token: string) {
    const result = await fetch("https://api.spotify.com/v1/me/player/currently-playing", {
        headers: { Authorization: `Bearer ${token}` }
    });
    if (result.status === 204 || result.status > 400) return null;
    return await result.json();
}

async function redirectToAuthCodeFlow(clientId: string) {
    const verifier = generateCodeVerifier(128);
    const challenge = await generateCodeChallenge(verifier);
    localStorage.setItem("verifier", verifier);
    const p = new URLSearchParams({
        client_id: clientId,
        response_type: "code",
        redirect_uri: redirectUri,
        scope: "user-read-currently-playing user-read-playback-state",
        code_challenge_method: "S256",
        code_challenge: challenge
    });
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
