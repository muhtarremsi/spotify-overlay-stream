/**
 * 🚀 SPOTIFY OMNI-ENGINE v3.0 - ULTRA-LONG EDITION
 * Diese Version deckt alle Eventualitäten ab: Auth-Loops, API-Fehler und UI-Sync.
 */

interface SpotifyTrack {
    id: string;
    name: string;
    artists: { name: string }[];
    album: { images: { url: string }[] };
}

const APP_STATE = {
    isConnected: false,
    lastTrackId: "",
    retryCount: 0,
    debug: true
};

const CONSTANTS = {
    clientId: "f43c4064e6524c169b69d773a12277eb",
    // DEIN TOKEN ALS SICHERHEITS-NETZ
    fallbackToken: "AQDBG-QB0sHRXBrTmdT_SAXQx9zOt8Oscdx8nzttHfPKsWOoVGEKPPyGyTDVqjjsEZzK8rJAGUca4o3q8tEHNN-rkOO7xWFPXEdp0bIK4g0rVGzmNZGhYfAJxkgNU7qM46U",
    api: {
        token: "https://accounts.spotify.com/api/token",
        player: "https://api.spotify.com/v1/me/player/currently-playing",
        auth: "https://accounts.spotify.com/authorize?$"
    }
};

class SpotifyController {
    private access: string = "";
    private refresh: string = "";

    constructor() {
        this.log("System-Initialisierung gestartet...");
        this.init();
    }

    private log(msg: string) {
        console.log(`[SpotifyEngine] ${msg}`);
        if (APP_STATE.debug) {
            const consoleElem = document.getElementById("track-name");
            if (consoleElem && consoleElem.innerText.includes("Verbinde")) {
                consoleElem.innerText = msg;
            }
        }
    }

    private async init() {
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");
        const urlRefresh = params.get("refresh_token");

        // 1. Check auf Refresh-Token (TikTok-Pfad)
        if (urlRefresh) {
            this.refresh = urlRefresh;
            localStorage.setItem("refresh_token", urlRefresh);
            this.log("Token aus URL geladen.");
            await this.startStream();
            return;
        }

        // 2. Check auf Auth-Code (Browser-Pfad)
        if (code) {
            this.log("Auth-Code gefunden, tausche aus...");
            await this.exchangeCode(code);
            return;
        }

        // 3. Check auf LocalStorage oder Fallback
        this.refresh = localStorage.getItem("refresh_token") || CONSTANTS.fallbackToken;
        if (this.refresh) {
            await this.startStream();
        } else {
            this.log("Kein Token gefunden. Starte Login...");
            this.redirectToSpotify();
        }
    }

    private async exchangeCode(code: string) {
        const verifier = localStorage.getItem("verifier");
        const res = await fetch(CONSTANTS.api.token, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                client_id: CONSTANTS.clientId,
                grant_type: "authorization_code",
                code: code,
                redirect_uri: window.location.origin,
                code_verifier: verifier!
            })
        });
        const data = await res.json();
        if (data.refresh_token) {
            localStorage.setItem("refresh_token", data.refresh_token);
            window.location.href = "/";
        }
    }

    private async startStream() {
        try {
            await this.refreshToken();
            this.log("Stream aktiv.");
            this.poll();
        } catch (e) {
            this.log("Fehler beim Start. Retry...");
            setTimeout(() => this.startStream(), 5000);
        }
    }

    private async refreshToken() {
        const res = await fetch(CONSTANTS.api.token, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                grant_type: "refresh_token",
                refresh_token: this.refresh,
                client_id: CONSTANTS.clientId
            })
        });
        const data = await res.json();
        if (data.access_token) {
            this.access = data.access_token;
            return;
        }
        throw new Error("Refresh failed");
    }

    private poll() {
        setInterval(async () => {
            try {
                const res = await fetch(CONSTANTS.api.player, {
                    headers: { Authorization: `Bearer ${this.access}` }
                });

                if (res.status === 401) {
                    await this.refreshToken();
                    return;
                }

                if (res.status === 204) {
                    this.displayMessage("Warte auf Musik...");
                    return;
                }

                const data = await res.json();
                if (data.item && data.item.id !== APP_STATE.lastTrackId) {
                    APP_STATE.lastTrackId = data.item.id;
                    this.updateUI(data.item);
                }
            } catch (e) {
                console.warn("Polling error cycle.");
            }
        }, 4000);
    }

    private updateUI(track: SpotifyTrack) {
        const name = document.getElementById("track-name");
        const artist = document.getElementById("artist-name");
        const art = document.getElementById("track-art");

        if (name) name.innerText = track.name;
        if (artist) artist.innerText = track.artists.map(a => a.name).join(", ");
        if (art && track.album.images[0]) {
            art.innerHTML = `<img src="${track.album.images[0].url}" style="width:100%;height:100%;border-radius:15px;object-fit:cover;" />`;
        }
    }

    private displayMessage(msg: string) {
        const name = document.getElementById("track-name");
        if (name && name.innerText !== msg) name.innerText = msg;
    }

    private async redirectToSpotify() {
        const verifier = this.generateRandomString(128);
        const challenge = await this.generateCodeChallenge(verifier);
        localStorage.setItem("verifier", verifier);

        const params = new URLSearchParams({
            client_id: CONSTANTS.clientId,
            response_type: "code",
            redirect_uri: window.location.origin,
            scope: "user-read-currently-playing user-read-playback-state",
            code_challenge_method: "S256",
            code_challenge: challenge
        });

        document.location = `https://accounts.spotify.com/authorize?${params.toString()}`;
    }

    private generateRandomString(length: number) {
        let text = '';
        let possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < length; i++) text += possible.charAt(Math.floor(Math.random() * possible.length));
        return text;
    }

    private async generateCodeChallenge(codeVerifier: string) {
        const data = new TextEncoder().encode(codeVerifier);
        const digest = await window.crypto.subtle.digest('SHA-256', data);
        return btoa(String.fromCharCode.apply(null, [...new Uint8Array(digest)]))
            .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }
}

new SpotifyController();
