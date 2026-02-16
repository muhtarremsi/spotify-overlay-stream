const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID || "f43c4064e6524c169b69d773a12277eb";
const redirectUri = window.location.origin; // Erkennt automatisch die Vercel-URL

const params = new URLSearchParams(window.location.search);
const code = params.get("code");

if (!code) {
    redirectToAuthCodeFlow(clientId);
} else {
    const accessToken = await getAccessToken(clientId, code);
    setInterval(async () => {
        const track = await fetchNowPlaying(accessToken);
        if (track && track.item) updateUI(track.item);
    }, 5000);
}

async function redirectToAuthCodeFlow(clientId: string) {
    const verifier = generateCodeVerifier(128);
    const challenge = await generateCodeChallenge(verifier);
    localStorage.setItem("verifier", verifier);

    const authParams = new URLSearchParams();
    authParams.append("client_id", clientId);
    authParams.append("response_type", "code");
    authParams.append("redirect_uri", redirectUri);
    authParams.append("scope", "user-read-currently-playing user-read-playback-state");
    authParams.append("code_challenge_method", "S256");
    authParams.append("code_challenge", challenge);

    document.location = `https://accounts.spotify.com/authorize?${authParams.toString()}`;
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
    return data.access_token;
}

async function fetchNowPlaying(token: string) {
    const result = await fetch("https://api.spotify.com/v1/me/player/currently-playing", {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` }
    });
    if (result.status === 204 || result.status > 400) return null;
    return await result.json();
}

function updateUI(item: any) {
    document.getElementById("track-name")!.innerText = item.name;
    document.getElementById("artist-name")!.innerText = item.artists.map((a: any) => a.name).join(", ");
    document.getElementById("track-art")!.innerHTML = `<img src="${item.album.images[0].url}" style="width:60px;border-radius:8px;" />`;
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
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
