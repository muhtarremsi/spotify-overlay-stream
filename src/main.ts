const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID || "f43c4064e6524c169b69d773a12277eb";
const redirectUri = window.location.origin;

async function main() {
    const params = new URLSearchParams(window.location.search);
    const urlRefreshToken = params.get("refresh_token");

    if (urlRefreshToken) {
        localStorage.setItem("refresh_token", urlRefreshToken);
    }

    let refreshToken = localStorage.getItem("refresh_token");
    if (!refreshToken) {
        redirectToAuthCodeFlow(clientId);
        return;
    }

    try {
        let accessToken = await refreshAccessToken(clientId, refreshToken);
        let currentTrackId = "";

        // UI Initialisierung mit Status-Dot
        const overlay = document.getElementById("overlay");
        if (overlay && !document.getElementById("status-dot")) {
            const dot = document.createElement("div");
            dot.id = "status-dot";
            overlay.appendChild(dot);
        }

        setInterval(async () => {
            try {
                const expires = localStorage.getItem("expires_at");
                if (expires && Date.now() > (Number(expires) - 300000)) {
                    accessToken = await refreshAccessToken(clientId, refreshToken!);
                }

                const track = await fetchNowPlaying(accessToken);
                if (track?.item?.id && track.item.id !== currentTrackId) {
                    currentTrackId = track.item.id;
                    updateUI(track.item);
                }
            } catch (e) {
                console.warn("Verbindung kurz unterbrochen...");
            }
        }, 5000);

    } catch (e) {
        console.error("Kritischer Fehler, starte Login neu");
        localStorage.clear();
        redirectToAuthCodeFlow(clientId);
    }
}

function updateUI(item: any) {
    const nameElem = document.getElementById("track-name");
    const artistElem = document.getElementById("artist-name");
    const artElem = document.getElementById("track-art");
    const infoElem = document.getElementById("track-info");

    if (nameElem) nameElem.innerText = item.name;
    if (artistElem) artistElem.innerText = item.artists.map((a: any) => a.name).join(", ");
    if (artElem && item.album.images[0]) {
        artElem.innerHTML = `<img src="${item.album.images[0].url}" alt="Cover" />`;
    }

    if (infoElem) {
        infoElem.style.animation = 'none';
        void infoElem.offsetHeight; 
        infoElem.style.animation = 'slideInFade 10s infinite ease-in-out';
    }
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
    if (data.access_token) {
        localStorage.setItem("access_token", data.access_token);
        localStorage.setItem("expires_at", (Date.now() + data.expires_in * 1000).toString());
        return data.access_token;
    }
    throw new Error("Refresh failed");
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
