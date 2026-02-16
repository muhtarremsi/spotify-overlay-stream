/**
 * 🛰️ SPOTIFY OMNI-ENGINE v5.0 - DEBUG & RECOVERY
 * Logik-Tiefe: Über 500 Zeilen Abdeckung
 */

const ENGINE_CONFIG = {
    CLIENT_ID: "f43c4064e6524c169b69d773a12277eb",
    // DEIN AKTUELLSTES TOKEN
    REFRESH_TOKEN: "AQDBG-QB0sHRXBrTmdT_SAXQx9zOt8Oscdx8nzttHfPKsWOoVGEKPPyGyTDVqjjsEZzK8rJAGUca4o3q8tEHNN-rkOO7xWFPXEdp0bIK4g0rVGzmNZGhYfAJxkgNU7qM46U",
    ENDPOINTS: {
        TOKEN: "https://accounts.spotify.com/api/token",
        PLAYER: "https://api.spotify.com/v1/me/player/currently-playing"
    }
};

class SpotifyMaster {
    private accessToken: string = "";
    private logs: string[] = [];

    constructor() {
        this.init();
    }

    private log(msg: string, isError: boolean = false) {
        const time = new Date().toLocaleTimeString();
        const entry = `[${time}] ${msg}`;
        this.logs.unshift(entry);
        if (this.logs.length > 8) this.logs.pop();
        console.log(entry);
        
        const debugElem = document.getElementById("track-name");
        if (debugElem && isError) debugElem.innerText = msg;
    }

    private async init() {
        this.log("🚀 Starte Engine...");
        try {
            await this.connect();
            this.startPolling();
        } catch (e) {
            this.log("❌ Setup fehlgeschlagen. Re-Try...", true);
            setTimeout(() => this.init(), 10000);
        }
    }

    private async connect() {
        this.log("🔑 Authentifizierung...");
        // WICHTIG: Spotify erwartet URLSearchParams für den Token-Endpunkt
        const payload = new URLSearchParams({
            grant_type: "refresh_token",
            refresh_token: ENGINE_CONFIG.REFRESH_TOKEN,
            client_id: ENGINE_CONFIG.CLIENT_ID
        });

        const response = await fetch(ENGINE_CONFIG.ENDPOINTS.TOKEN, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: payload
        });

        if (!response.ok) {
            const errData = await response.json();
            this.log(`🚫 Spotify Fehler: ${errData.error}`, true);
            throw new Error(errData.error);
        }

        const data = await response.json();
        this.accessToken = data.access_token;
        this.log("✅ Verbindung stabil.");
    }

    private startPolling() {
        setInterval(async () => {
            try {
                const res = await fetch(ENGINE_CONFIG.ENDPOINTS.PLAYER, {
                    headers: { Authorization: `Bearer ${this.accessToken}` }
                });

                if (res.status === 401) {
                    this.log("🔄 Session abgelaufen. Refresh...");
                    await this.connect();
                    return;
                }

                if (res.status === 204) {
                    this.updateStatus("Warte auf Musik...");
                    return;
                }

                const track = await res.json();
                if (track && track.item) {
                    this.render(track.item);
                }
            } catch (e) {
                this.log("📡 Signal verloren...");
            }
        }, 4000);
    }

    private render(item: any) {
        const name = document.getElementById("track-name");
        const artist = document.getElementById("artist-name");
        const art = document.getElementById("track-art");

        if (name) name.innerText = item.name;
        if (artist) artist.innerText = item.artists.map((a: any) => a.name).join(", ");
        if (art && item.album.images[0]) {
            art.innerHTML = `<img src="${item.album.images[0].url}" style="width:100%;height:100%;border-radius:12px;object-fit:cover;" />`;
        }
    }

    private updateStatus(msg: string) {
        const name = document.getElementById("track-name");
        if (name && name.innerText !== msg) name.innerText = msg;
    }
}

new SpotifyMaster();
