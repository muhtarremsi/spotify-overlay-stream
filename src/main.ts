const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID || "f43c4064e6524c169b69d773a12277eb";
const redirectUri = window.location.origin;

async function main() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    let accessToken = localStorage.getItem("access_token");

    if (code) {
        accessToken = await getAccessToken(clientId, code);
        window.history.replaceState({}, document.title, "/");
    } else if (!accessToken) {
        redirectToAuthCodeFlow(clientId);
        return;
    }

    // Sofortiger Start und Loop
    refreshLoop(accessToken);
}

async function refreshLoop(token: string) {
    let currentToken = token;
    setInterval(async () => {
        const expiresAt = localStorage.getItem("expires_at");
        // Wenn Token in weniger als 5 Minuten abläuft oder schon abgelaufen ist
        if (Date.now() > (Number(expiresAt) - 300000)) {
            const rt = localStorage.getItem("refresh_token");
            if (rt) currentToken = await refreshAccessToken(clientId, rt);
        }
        const track = await fetchNowPlaying(currentToken);
        if (track && track.item) updateUI(track.item);
    }, 5000);
}

// ... (Rest der Funktionen getAccessToken, refreshAccessToken, saveTokens wie vorher)
function saveTokens(data: any) {
    if (data.access_token) localStorage.setItem("access_token", data.access_token);
    if (data.refresh_token) localStorage.setItem("refresh_token", data.refresh_token);
    localStorage.setItem("expires_at", (Date.now() + data.expires_in * 1000).toString());
}
// ... (Hilfsfunktionen fetchNowPlaying, updateUI, redirectToAuthCodeFlow etc. beibehalten)
