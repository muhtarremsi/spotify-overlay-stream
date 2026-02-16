/**
 * 🎵 SPOTIFY OVERLAY - ENTERPRISE STABILITY EDITION
 * Reichweite: Umfangreiche Logik-Tiefe für TikTok Live Studio
 */

// --- KONFIGURATION & GLOBALE KONSTANTEN ---
const CONFIG = {
    clientId: import.meta.env.VITE_SPOTIFY_CLIENT_ID || "f43c4064e6524c169b69d773a12277eb",
    // Das Token als fester Fallback, falls der Speicher in TikTok gelöscht wird
    fallbackRefreshToken: "AQDBG-QB0sHRXBrTmdT_SAXQx9zOt8Oscdx8nzttHfPKsWOoVGEKPPyGyTDVqjjsEZzK8rJAGUca4o3q8tEHNN-rkOO7xWFPXEdp0bIK4g0rVGzmNZGhYfAJxkgNU7qM46U",
    endpoints: {
        token: "https://accounts.spotify.com/api/token",
        player: "https://api.spotify.com/v1/me/player/currently-playing"
    },
    intervals: {
        poll: 3000,      // API-Abfrage alle 3 Sek. für minimale Verzögerung
        refresh: 300000, // Token-Check alle 5 Min.
        retry: 10000     // Neustart bei Fehler nach 10 Sek.
    }
};

// --- LOGGING SYSTEM ---
class Logger {
    private static logs: string[] = [];
    private static maxLogs = 15;
    private static isDebug = new URLSearchParams(window.location.search).has('debug');

    static info(msg: string) { this.add(`[INFO] ${msg}`, "#1DB954"); }
    static warn(msg: string) { this.add(`[WARN] ${msg}`, "#FFA500"); }
    static error(msg: string) { this.add(`[ERR] ${msg}`, "#FF4B4B"); }

    private static add(msg: string, color: string) {
        const entry = `<span style="color: ${color}">${new Date().toLocaleTimeString()} - ${msg}</span>`;
        this.logs.unshift(entry);
        if (this.logs.length > this.maxLogs) this.logs.pop();
        this.render();
        console.log(`[Spotify] ${msg}`);
    }

    private static render() {
        if (!this.isDebug) return;
        let consoleElem = document.getElementById("debug-console");
        if (!consoleElem) {
            consoleElem = document.createElement("div");
            consoleElem.id = "debug-console";
            consoleElem.style.cssText = "position:fixed;bottom:0;left:0;width:100%;background:rgba(0,0,0,0.8);font-family:monospace;font-size:10px;padding:10px;z-index:10000;max-height:150px;overflow:hidden;";
            document.body.appendChild(consoleElem);
        }
        consoleElem.innerHTML = this.logs.join("<br>");
    }
}

// --- SPOTIFY ENGINE ---
class SpotifyEngine {
    private accessToken: string | null = null;
    private refreshToken: string | null = null;
    private currentTrackId: string | null = null;
    private isConnected = false;
    private failCount = 0;

    constructor() {
        Logger.info("Initialisiere Engine...");
        this.setupAuth();
    }

    private setupAuth() {
        const params = new URLSearchParams(window.location.search);
        const urlToken = params.get("refresh_token");

        if (urlToken) {
            Logger.info("Refresh Token aus URL übernommen.");
            this.refreshToken = urlToken;
            localStorage.setItem("refresh_token", urlToken);
            window.history.replaceState({}, document.title, window.location.pathname);
        } else {
            this.refreshToken = localStorage.getItem("refresh_token") || CONFIG.fallbackRefreshToken;
            Logger.info(this.refreshToken === CONFIG.fallbackRefreshToken ? "Nutze Fallback Token." : "Nutze gespeichertes Token.");
        }

        this.start();
    }

    private async start() {
        try {
            await this.refreshTokens();
            this.isConnected = true;
            this.startPolling();
            this.startAutoRefresh();
            Logger.info("Verbindung hergestellt. Monitoring aktiv.");
        } catch (err) {
            this.isConnected = false;
            Logger.error("Initialer Start fehlgeschlagen. Re-connect in 10s...");
            setTimeout(() => this.start(), CONFIG.intervals.retry);
        }
    }

    private async refreshTokens() {
        Logger.info("Erneuere Access Token...");
        try {
            const response = await fetch(CONFIG.endpoints.token, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({
                    grant_type: "refresh_token",
                    refresh_token: this.refreshToken!,
                    client_id: CONFIG.clientId
                })
            });

            const data = await response.json();
            if (data.access_token) {
                this.accessToken = data.access_token;
                if (data.refresh_token) {
                    this.refreshToken = data.refresh_token;
                    localStorage.setItem("refresh_token", data.refresh_token);
                }
                localStorage.setItem("expires_at", (Date.now() + data.expires_in * 1000).toString());
                return true;
            }
            throw new Error("Kein Access Token in Antwort.");
        } catch (e) {
            Logger.error(`Token Refresh fehlgeschlagen: ${e}`);
            throw e;
        }
    }

    private startPolling() {
        setInterval(async () => {
            if (!this.isConnected || !this.accessToken) return;

            try {
                const res = await fetch(CONFIG.endpoints.player, {
                    headers: { Authorization: `Bearer ${this.accessToken}` }
                });

                if (res.status === 401) {
                    Logger.warn("Access Token abgelaufen.");
                    await this.refreshTokens();
                    return;
                }

                if (res.status === 204) {
                    this.updateUIStatus("Warte auf Musik...");
                    return;
                }

                const trackData = await res.json();
                if (trackData?.item && trackData.item.id !== this.currentTrackId) {
                    this.currentTrackId = trackData.item.id;
                    this.renderUI(trackData.item);
                }
                this.failCount = 0;
            } catch (err) {
                this.failCount++;
                if (this.failCount > 5) {
                    Logger.error("Zu viele Fehler beim Polling. Re-Auth...");
                    this.refreshTokens();
                }
            }
        }, CONFIG.intervals.poll);
    }

    private startAutoRefresh() {
        setInterval(() => {
            const expires = localStorage.getItem("expires_at");
            if (expires && Date.now() > (Number(expires) - 600000)) {
                this.refreshTokens();
            }
        }, CONFIG.intervals.refresh);
    }

    private renderUI(item: any) {
        Logger.info(`Song-Wechsel: ${item.name}`);
        const elements = {
            name: document.getElementById("track-name"),
            artist: document.getElementById("track-name"), // Fallback falls Künstler-ID fehlt
            art: document.getElementById("track-art"),
            info: document.getElementById("track-info")
        };

        if (elements.name) elements.name.innerText = item.name;
        
        const artists = item.artists.map((a: any) => a.name).join(", ");
        const artistElem = document.getElementById("artist-name");
        if (artistElem) artistElem.innerText = artists;

        if (elements.art && item.album.images[0]) {
            elements.art.innerHTML = `<img src="${item.album.images[0].url}" style="width:100%;height:100%;border-radius:15px;object-fit:cover;box-shadow:0 10px 25px rgba(0,0,0,0.5);" />`;
        }

        if (elements.info) {
            elements.info.style.animation = 'none';
            void elements.info.offsetHeight; 
            elements.info.style.animation = 'fadeLoop 10s infinite ease-in-out';
        }
    }

    private updateUIStatus(msg: string) {
        const nameElem = document.getElementById("track-name");
        const artistElem = document.getElementById("artist-name");
        if (nameElem && nameElem.innerText !== msg) {
            nameElem.innerText = msg;
            if (artistElem) artistElem.innerText = "Spotify starten";
            Logger.info(`Status-Update: ${msg}`);
        }
    }
}

// --- INITIALISIERUNG ---
window.onload = () => {
    new SpotifyEngine();
};
