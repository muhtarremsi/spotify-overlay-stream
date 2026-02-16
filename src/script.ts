// Überprüfe den gespeicherten Token beim Start der App
const token = localStorage.getItem("access_token");
if (token) {
    // Token verwenden, um auf Spotify zuzugreifen
    console.log("Token gefunden, Zugriff auf Spotify API.");
} else {
    // Starte den Authentifizierungsprozess, falls kein Token vorhanden ist
    redirectToAuthCodeFlow();
}

function redirectToAuthCodeFlow() {
    // Dein Code für den OAuth-Redirect zu Spotify
}
