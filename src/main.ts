const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID || "f43c4064e6524c169b69d773a12277eb";
const fixedRefreshToken = "AQDBG-QB0sHRXBrTmdT_SAXQx9zOt8Oscdx8nzttHfPKsWOoVGEKPPyGyTDVqjjsEZzK8rJAGUca4o3q8tEHNN-rkOO7xWFPXEdp0bIK4g0rVGzmNZGhYfAJxkgNU7qM46U";

async function main() {
    // Erzwinge das Token in den Speicher
    localStorage.setItem("refresh_token", fixedRefreshToken);
    
    try {
        const token = await refreshAccessToken(clientId, fixedRefreshToken);
        startMusicLoop(token);
    } catch (e) {
        console.error("Initialer Start fehlgeschlagen");
    }
}

async function startMusicLoop(initialToken: string) {
    let accessToken = initialToken;
    let currentTrackId = "";

    setInterval(async () => {
        try {
            const track = await fetchNowPlaying(accessToken);
            if (track?.item) {
                if (track.item.id !== currentTrackId) {
                    currentTrackId = track.item.id;
                    updateUI(track.item);
                }
            } else {
                // Anzeige wenn keine Musik läuft
                const nameElem = document.getElementById("track-name");
                if (nameElem) nameElem.innerText = "Warte auf Musik...";
            }
        } catch (e) {
            // Bei Fehler (z.B. Token abgelaufen) neues Token holen
            const newToken = await refreshAccessToken(clientId, fixedRefreshToken);
            accessToken = newToken;
        }
    }, 5000);
}

function updateUI(item: any) {
    const nameElem = document.getElementById("track-name");
    const artistElem = document.getElementById("artist-name");
    const artElem = document.getElementById("track-art");
    if (nameElem) nameElem.innerText = item.name;
    if (artistElem) artistElem.innerText = item.artists.map((a: any) => a.name).join(", ");
    if (artElem && item.album.images[0]) {
        artElem.innerHTML = `<img src="${item.album.images[0].url}" style="width:100%;height:100%;border-radius:12px;object-fit:cover;" />`;
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
    return data.access_token;
}

async function fetchNowPlaying(token: string) {
    const result = await fetch("https://api.spotify.com/v1/me/player/currently-playing", {
        headers: { Authorization: `Bearer ${token}` }
    });
    if (result.status === 204 || result.status > 400) return null;
    return await result.json();
}

main();
